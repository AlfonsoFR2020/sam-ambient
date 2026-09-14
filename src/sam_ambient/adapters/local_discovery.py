"""Known loopback discovery and opt-in bounded bootstrap; never download."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlsplit

from sam_ambient.adapters.http import HttpxJsonTransport
from sam_ambient.adapters.ollama import DEFAULT_OLLAMA_BASE_URL, OllamaProvider
from sam_ambient.adapters.ollama.provider import normalize_ollama_base_url
from sam_ambient.adapters.openai_compatible import OpenAICompatibleProvider
from sam_ambient.core.providers import DataBoundary, LLMProvider
from sam_ambient.core.turns import CancellationToken

LM_STUDIO_URL = "http://127.0.0.1:1234/v1"
log = logging.getLogger(__name__)


class LifecycleIntent(StrEnum):
    QUIT = "quit"
    RESTART = "restart"
    FAILURE = "failure"


class CleanupStatus(StrEnum):
    SUCCEEDED = "succeeded"
    SKIPPED = "skipped"
    UNSUPPORTED = "unsupported"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class CleanupPolicy:
    model_on_exit: str = "keep"
    provider_on_exit: str = "keep"

    def __post_init__(self) -> None:
        if self.model_on_exit not in {"keep", "unload_if_sam_loaded"}:
            raise ValueError("unsupported model exit policy")
        if self.provider_on_exit not in {"keep", "stop_if_sam_started"}:
            raise ValueError("unsupported provider exit policy")


@dataclass(frozen=True, slots=True)
class CleanupResult:
    resource: str
    provider: str
    status: CleanupStatus
    detail: str


def local_url(value: str) -> str:
    parsed = urlsplit(value)
    host = parsed.hostname or ""
    try:
        loopback = host == "localhost" or ip_address(host).is_loopback
    except ValueError:
        loopback = False
    if (
        parsed.scheme not in {"http", "https"}
        or not loopback
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Local discovery requires an http(s) loopback URL without credentials")
    _ = parsed.port  # Validate malformed/out-of-range ports before any network operation.
    return value.rstrip("/")


def find_lms() -> str | None:
    found = shutil.which("lms")
    if found:
        return found
    for directory in (Path.home() / ".lmstudio/bin", Path.home() / ".cache/lm-studio/bin"):
        for name in ("lms.exe", "lms") if os.name == "nt" else ("lms",):
            candidate = directory / name
            if candidate.is_file():
                return str(candidate)
    return None


async def lms_status(executable: str, subject: str) -> dict:
    """Only status commands: `ps`/`ls` can implicitly wake a stopped daemon."""
    if subject not in {"daemon", "server"}:
        raise ValueError("only read-only lms status is supported")
    process = None
    try:
        async with asyncio.timeout(2):
            process = await asyncio.create_subprocess_exec(
                executable,
                subject,
                "status",
                "--json",
                "--quiet",
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            assert process.stdout is not None
            raw = await process.stdout.read(16_385)
            if len(raw) > 16_384:
                return {}
            if await process.wait() != 0:
                return {}
            body = json.loads(raw)
            return body if isinstance(body, dict) else {}
    except (OSError, ValueError, TimeoutError):
        return {}
    finally:
        if process is not None and process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()


async def lms_models(executable: str) -> list[str]:
    """Read the installed LM Studio inventory without loading or downloading."""

    process = None
    try:
        async with asyncio.timeout(4):
            process = await asyncio.create_subprocess_exec(
                executable,
                "ls",
                "--json",
                "--quiet",
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            assert process.stdout is not None
            raw = await process.stdout.read(262_145)
            if len(raw) > 262_144 or await process.wait() != 0:
                return []
            body = json.loads(raw)
            rows = body.get("models", body.get("data", [])) if isinstance(body, dict) else body
            if not isinstance(rows, list):
                return []
            string_ids = [row for row in rows[:256] if isinstance(row, str)]
            return (
                _ids(rows, "modelKey")
                or _ids(rows, "id")
                or _ids(rows, "path")
                or sorted({value for value in string_ids if 0 < len(value) <= 256})
            )
    except (OSError, ValueError, TimeoutError):
        return []
    finally:
        if process is not None and process.returncode is None:
            try:
                process.kill()
            except ProcessLookupError:
                pass
            await process.wait()


@dataclass
class LocalService:
    id: str
    endpoint: str
    executable: str | None = None
    running: bool = False
    models: list[str] = field(default_factory=list)
    available_models: list[str] = field(default_factory=list)
    installed_models: list[str] = field(default_factory=list)
    detail: str = "unavailable"
    daemon_running: bool | None = None
    started_by_sam: bool = False
    server_running: bool | None = None
    models_loaded_by_sam: list[str] = field(default_factory=list, repr=False)


@dataclass
class Discovery:
    services: list[LocalService]
    selected: LocalService | None
    model: str | None
    reason: str
    owned_processes: list[asyncio.subprocess.Process] = field(default_factory=list, repr=False)
    pending_provider: str | None = None
    pending_model: str | None = None

    async def aclose(
        self,
        *,
        intent: LifecycleIntent = LifecycleIntent.FAILURE,
        policy: CleanupPolicy | None = None,
    ) -> tuple[CleanupResult, ...]:
        """Release only resources this discovery instance proved it created.

        Restart/failure never invokes optional provider cleanup. Handles are not
        reconstructed from persisted PIDs or current external state.
        """
        policy = policy or CleanupPolicy()
        results: list[CleanupResult] = []
        if intent is not LifecycleIntent.QUIT:
            log.info("Provider cleanup skipped: lifecycle reason=%s", intent)
            self.owned_processes.clear()
            return tuple(results)

        if policy.model_on_exit == "unload_if_sam_loaded":
            for service in self.services:
                for model in tuple(service.models_loaded_by_sam):
                    result = await unload_owned_model(service, model)
                    results.append(result)
                    log.info(
                        "Model cleanup provider=%s model=%s status=%s detail=%s",
                        service.id,
                        model,
                        result.status,
                        result.detail,
                    )
                service.models_loaded_by_sam.clear()
        if policy.provider_on_exit == "stop_if_sam_started":
            for service in self.services:
                if not service.started_by_sam:
                    continue
                result = await stop_owned_service(service, self.owned_processes)
                results.append(result)
                log.info(
                    "Provider cleanup provider=%s status=%s detail=%s",
                    service.id,
                    result.status,
                    result.detail,
                )
        self.owned_processes.clear()
        return tuple(results)

    def to_dict(self) -> dict:
        return {
            "providers": [
                {
                    key: value
                    for key, value in asdict(service).items()
                    if key != "models_loaded_by_sam"
                }
                for service in self.services
            ],
            "selection": {
                "provider": self.selected.id if self.selected else None,
                "model": self.model,
                "reason": self.reason,
                "pending_provider": self.pending_provider,
                "pending_model": self.pending_model,
            },
        }


def _ids(rows: object, key: str) -> list[str]:
    if not isinstance(rows, list):
        return []
    return sorted(
        {
            row[key]
            for row in rows[:256]
            if isinstance(row, dict)
            and isinstance(row.get(key), str)
            and 0 < len(row[key]) <= 256
            and not any(ord(char) < 32 for char in row[key])
            and row.get("type") not in {"embeddings", "embedding"}
            and "embed" not in row[key].lower()
            and not row[key].startswith("-")
        }
    )


async def probe_service(service: LocalService) -> None:
    service.running = False
    service.models = []
    installed = service.installed_models.copy()
    service.available_models = installed
    transport = HttpxJsonTransport(
        trust_env=False, verify=service.endpoint.startswith("https:"), max_response_bytes=512 * 1024
    )
    token = CancellationToken()
    try:
        async with asyncio.timeout(3):
            if service.id == "ollama":
                body = await transport.request_json(
                    "GET", service.endpoint + "/api/tags", timeout_s=2, cancellation=token
                )
                service.models = _ids(body.get("models"), "name")

                # Ollama tags don't declare embedding capability. Require completion
                # support rather than discovering an embedding-only model as chat.
                async def conversational(name: str) -> bool:
                    try:
                        info = await transport.request_json(
                            "POST",
                            service.endpoint + "/api/show",
                            body={"model": name},
                            timeout_s=1,
                            cancellation=token,
                        )
                        return "completion" in info.get("capabilities", [])
                    except Exception:
                        return False

                names = service.models[:16]
                supported = await asyncio.gather(*(conversational(name) for name in names))
                service.models = [
                    name for name, usable in zip(names, supported, strict=True) if usable
                ]
                service.available_models = service.models.copy()
                service.installed_models = service.models.copy()
            else:
                body = await transport.request_json(
                    "GET", service.endpoint + "/models", timeout_s=2, cancellation=token
                )
                service.models = _ids(body.get("data"), "id")
                service.available_models = service.models.copy()
                if service.id == "lm-studio":
                    try:
                        native = await transport.request_json(
                            "GET",
                            service.endpoint.removesuffix("/v1") + "/api/v0/models",
                            timeout_s=1,
                            cancellation=token,
                        )
                        rows = native.get("data")
                        if isinstance(rows, list):
                            service.available_models = _ids(rows, "id")
                            service.installed_models = service.available_models.copy()
                            service.models = _ids(
                                [
                                    row
                                    for row in rows
                                    if isinstance(row, dict) and row.get("state") == "loaded"
                                ],
                                "id",
                            )
                    except Exception:
                        # Older compatible-only servers advertise callable models in /v1/models.
                        pass
            service.running = True
            service.detail = (
                "ready"
                if service.models
                else "server running; installed chat model available but not loaded"
                if service.installed_models
                else "server running; no conversational model installed"
            )
    except Exception as error:
        service.detail = f"unreachable ({type(error).__name__})"
    finally:
        await transport.aclose()


async def _local_command(argv: tuple[str, ...], *, timeout_s: float = 20) -> None:
    """Bounded CLI requests; never shell strings or interactive prompts."""
    process = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        async with asyncio.timeout(timeout_s):
            assert process.stdout is not None
            raw = await process.stdout.read(65_537)
            if len(raw) > 65_536:
                raise RuntimeError("provider CLI output limit")
            if await process.wait() != 0:
                raise RuntimeError("provider CLI failed")
    finally:
        if process.returncode is None:
            process.kill()
            await process.wait()


async def unload_owned_model(service: LocalService, model: str) -> CleanupResult:
    """Best-effort provider-neutral release with fail-closed provider support."""
    if service.id == "lm-studio":
        await probe_service(service)
        if not service.running:
            return CleanupResult("model", service.id, CleanupStatus.FAILED, "provider unavailable")
    if model not in service.models:
        return CleanupResult("model", service.id, CleanupStatus.SUCCEEDED, "already absent")
    if service.id != "lm-studio" or not service.executable:
        return CleanupResult(
            "model", service.id, CleanupStatus.UNSUPPORTED, "adapter has no safe unload operation"
        )
    try:
        await _local_command((service.executable, "unload", model, "--yes"), timeout_s=8)
    except (OSError, RuntimeError, TimeoutError) as error:
        return CleanupResult("model", service.id, CleanupStatus.FAILED, type(error).__name__)
    return CleanupResult("model", service.id, CleanupStatus.SUCCEEDED, "unloaded")


async def stop_owned_service(
    service: LocalService, owned_processes: list[asyncio.subprocess.Process]
) -> CleanupResult:
    if not service.started_by_sam:
        return CleanupResult("provider", service.id, CleanupStatus.SKIPPED, "external ownership")
    if service.id == "lm-studio" and service.executable:
        try:
            await _local_command((service.executable, "server", "stop"), timeout_s=8)
        except (OSError, RuntimeError, TimeoutError) as error:
            return CleanupResult("provider", service.id, CleanupStatus.FAILED, type(error).__name__)
        return CleanupResult("provider", service.id, CleanupStatus.SUCCEEDED, "stopped")
    if service.id == "ollama" and owned_processes:
        failed = False
        for process in tuple(owned_processes):
            if process.returncode is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
            try:
                await asyncio.wait_for(process.wait(), 2)
            except TimeoutError:
                try:
                    process.kill()
                except ProcessLookupError:
                    pass
                try:
                    await asyncio.wait_for(process.wait(), 2)
                except TimeoutError:
                    failed = True
        return CleanupResult(
            "provider",
            service.id,
            CleanupStatus.FAILED if failed else CleanupStatus.SUCCEEDED,
            "owned process stop timed out" if failed else "owned process stopped",
        )
    return CleanupResult(
        "provider", service.id, CleanupStatus.UNSUPPORTED, "no owned service handle"
    )


async def bootstrap_service(service: LocalService, requested: str | None, owned: list) -> None:
    """Start installed local backends only. No downloads or model eviction."""
    if not service.executable or service.id not in {"ollama", "lm-studio"}:
        return
    try:
        # Service startup remains short; only an explicitly chosen, already
        # installed LM model receives the longer bounded loading window below.
        async with asyncio.timeout(205):
            if not service.running and not service.server_running:
                log.info(
                    "Starting installed %s on %s (bounded wait; no download)",
                    service.id,
                    service.endpoint,
                )
                if service.id == "lm-studio":
                    if Path(service.executable).stem.lower() != "lms":
                        service.detail = "llmster found but lms CLI missing; install/configure lms"
                        return
                    port = urlsplit(service.endpoint).port or 1234
                    await _local_command(
                        (
                            service.executable,
                            "server",
                            "start",
                            "--port",
                            str(port),
                            "--bind",
                            "127.0.0.1",
                        )
                    )
                else:
                    process = await asyncio.create_subprocess_exec(
                        service.executable,
                        "serve",
                        env={**os.environ, "OLLAMA_HOST": service.endpoint},
                        stdin=asyncio.subprocess.DEVNULL,
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    owned.append(process)
                service.started_by_sam = True
            readiness_attempts = 0
            while not service.running:
                await probe_service(service)
                if not service.running:
                    readiness_attempts += 1
                    if readiness_attempts >= 80:
                        raise TimeoutError("provider service readiness exceeded 20 seconds")
                    await asyncio.sleep(0.25)
            inventory = service.installed_models or service.available_models
            if service.id == "lm-studio" and requested not in service.models and inventory:
                # Never evict a loaded model to satisfy a stale preference.
                model = requested if requested in inventory else None
                if model is None and requested is None and len(inventory) == 1:
                    model = inventory[0]
                if model is None:
                    service.detail = (
                        "server running; several conversational models are installed; "
                        "choose one in configuration"
                    )
                    return
                log.info(
                    "Loading installed %s model %s (separate 180 s model-load phase)",
                    service.id,
                    model,
                )
                await _local_command(
                    (
                        service.executable,
                        "load",
                        model,
                        "--identifier",
                        model,
                        "--context-length",
                        "4096",
                        "--ttl",
                        "600",
                        "--yes",
                    ),
                    timeout_s=180,
                )
                await probe_service(service)
                if model not in service.models:
                    raise RuntimeError("loaded model was not advertised by the serving endpoint")
                service.models_loaded_by_sam.append(model)
            if service.started_by_sam:
                service.detail += "; started by Sam" + (
                    "; eligible for configured ownership-aware exit cleanup"
                    if service.id == "lm-studio"
                    else ""
                )
            else:
                service.detail += "; already running; reused"
    except (OSError, RuntimeError, TimeoutError) as error:
        service.detail = (
            f"local startup/load failed ({type(error).__name__}); "
            "check installed runtime/model; no downloads attempted"
        )
        log.warning("%s: %s", service.id, service.detail)


async def discover_local(
    *,
    provider: str = "auto",
    base_url: str | None = None,
    model: str | None = None,
    compatible_url: str | None = None,
    bootstrap: bool = False,
    preferred: tuple[str, str] | None = None,
) -> Discovery:
    if provider not in {"auto", "ollama", "lm-studio", "openai-compatible"}:
        raise ValueError("unsupported local provider")
    if provider == "openai-compatible" and not base_url:
        raise ValueError("--base-url is required for an explicit compatible provider")
    lms = find_lms()
    daemon, server, installed_lm = (
        await asyncio.gather(lms_status(lms, "daemon"), lms_status(lms, "server"), lms_models(lms))
        if lms
        else ({}, {}, [])
    )
    lm_url = LM_STUDIO_URL
    if server.get("running") is True and type(server.get("port")) is int:
        if 1 <= server["port"] <= 65_535:
            lm_url = f"http://127.0.0.1:{server['port']}/v1"
    configured_ollama = (base_url if provider in {"auto", "ollama"} else None) or os.getenv(
        "OLLAMA_HOST"
    )
    ollama_url = local_url(normalize_ollama_base_url(configured_ollama or DEFAULT_OLLAMA_BASE_URL))
    services = [
        LocalService("ollama", ollama_url, shutil.which("ollama")),
        LocalService(
            "lm-studio",
            local_url(base_url if provider == "lm-studio" and base_url else lm_url),
            lms or shutil.which("llmster"),
        ),
    ]
    services[1].daemon_running = daemon.get("status") == "running" if daemon else None
    services[1].server_running = server.get("running") if server else None
    services[1].installed_models = installed_lm
    services[1].available_models = installed_lm.copy()
    if ollama_url != DEFAULT_OLLAMA_BASE_URL:
        services.insert(1, LocalService("ollama", DEFAULT_OLLAMA_BASE_URL, shutil.which("ollama")))
    if provider == "openai-compatible":
        services.append(LocalService("openai-compatible", local_url(base_url)))
    elif compatible_url:
        services.append(LocalService("openai-compatible", local_url(compatible_url)))
    await asyncio.gather(*(probe_service(service) for service in services))
    for service in services:
        if not service.running and not service.executable:
            service.detail += "; CLI not found; start external service or install runtime"
    lm = next(service for service in services if service.id == "lm-studio")
    if lm.executable and not lm.running:
        lm.detail += "; installed; Sam can start it after a model is selected"
    explicit_provider = provider != "auto" or base_url is not None
    owned: list[asyncio.subprocess.Process] = []
    order = services.copy()
    if preferred and not explicit_provider:
        order.sort(key=lambda service: service.id != preferred[0])
    desired: tuple[str, str] | None = None
    if model:
        targets = [item for item in order if provider == "auto" or item.id == provider]
        target = next(
            (
                item
                for item in targets
                if model in set(item.models + item.installed_models + item.available_models)
            ),
            None,
        )
        if target:
            desired = (target.id, model)
    elif preferred and not explicit_provider:
        target = next((item for item in services if item.id == preferred[0]), None)
        if target and preferred[1] in set(
            target.models + target.installed_models + target.available_models
        ):
            desired = preferred
    candidates = sorted(
        {
            (service.id, candidate)
            for service in services
            if not explicit_provider or service.id == provider
            for candidate in (
                service.installed_models or service.available_models or service.models
            )
            if not model or candidate == model
        }
    )
    if desired is None:
        if len(candidates) == 1:
            desired = candidates[0]
    if bootstrap and desired:
        try:
            for service in order:
                if service.id != desired[0]:
                    continue
                if not service.running or desired[1] not in service.models:
                    await bootstrap_service(service, desired[1], owned)
                if service.running and desired[1] in service.models:
                    break
        except BaseException:
            await Discovery([], None, None, "cancelled", owned).aclose()
            raise
    eligible = [
        service
        for service in order
        if desired and service.id == desired[0] and service.running and desired[1] in service.models
    ]
    selected = eligible[0] if eligible else None
    reason = (
        (
            "explicit configuration"
            if explicit_provider or model
            else "last successful local provider/model"
            if preferred and desired == preferred
            else "sole installed local conversational model"
        )
        if selected
        else (
            "Several local conversational models are installed; choose one"
            if len(candidates) > 1 and not desired
            else "No usable local chat model. " + "; ".join(f"{s.id}: {s.detail}" for s in services)
        )
    )
    if selected:
        reason += "; " + (
            "started by Sam" if selected.started_by_sam else "already running; reused"
        )
    chosen = desired[1] if desired and selected else None
    return Discovery(
        services,
        selected,
        chosen if selected else None,
        reason,
        owned,
        desired[0] if desired and not selected else None,
        desired[1] if desired and not selected else None,
    )


def provider_for(service: LocalService) -> LLMProvider:
    if service.id == "ollama":
        return OllamaProvider(base_url=service.endpoint)
    return OpenAICompatibleProvider(
        provider_id=service.id,
        base_url=service.endpoint,
        data_boundary=DataBoundary.LOCAL,
        transport=HttpxJsonTransport(trust_env=False, verify=service.endpoint.startswith("https:")),
    )
