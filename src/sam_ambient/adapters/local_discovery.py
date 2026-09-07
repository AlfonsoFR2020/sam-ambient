"""Known loopback discovery and opt-in bounded bootstrap; never download."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from dataclasses import asdict, dataclass, field
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
            await process.wait()
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


@dataclass
class LocalService:
    id: str
    endpoint: str
    executable: str | None = None
    running: bool = False
    models: list[str] = field(default_factory=list)
    available_models: list[str] = field(default_factory=list)
    detail: str = "unavailable"
    daemon_running: bool | None = None
    started_by_sam: bool = False
    server_running: bool | None = None


@dataclass
class Discovery:
    services: list[LocalService]
    selected: LocalService | None
    model: str | None
    reason: str
    owned_processes: list[asyncio.subprocess.Process] = field(default_factory=list, repr=False)

    async def aclose(self) -> None:
        while self.owned_processes:
            process = self.owned_processes.pop()
            if process.returncode is None:
                try:
                    process.terminate()
                except ProcessLookupError:
                    pass
            try:
                await asyncio.wait_for(process.wait(), 2)
            except TimeoutError:
                process.kill()
                await process.wait()

    def to_dict(self) -> dict:
        return {
            "providers": [asdict(service) for service in self.services],
            "selection": {
                "provider": self.selected.id if self.selected else None,
                "model": self.model,
                "reason": self.reason,
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
    service.available_models = []
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
                "ready" if service.models else "server running; install/load a conversational model"
            )
    except Exception as error:
        service.detail = f"unreachable ({type(error).__name__})"
    finally:
        await transport.aclose()


async def _local_command(argv: tuple[str, ...]) -> None:
    """Bounded CLI requests; never shell strings or interactive prompts."""
    process = await asyncio.create_subprocess_exec(
        *argv,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL,
    )
    try:
        async with asyncio.timeout(20):
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


async def bootstrap_service(service: LocalService, requested: str | None, owned: list) -> None:
    """Start installed local backends only. No downloads or model eviction."""
    if not service.executable or service.id not in {"ollama", "lm-studio"}:
        return
    try:
        async with asyncio.timeout(20):
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
            while not service.running:
                await probe_service(service)
                if not service.running:
                    await asyncio.sleep(0.25)
            if service.id == "lm-studio" and not service.models and service.available_models:
                # Never evict a loaded model to satisfy a stale preference.
                model = (
                    requested
                    if requested in service.available_models
                    else service.available_models[0]
                )
                log.info(
                    "Loading installed %s model %s (4096 context; 600 s idle TTL)",
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
                    )
                )
                await probe_service(service)
            if service.started_by_sam:
                service.detail += "; started by Sam" + (
                    "; shared LM Studio service retained on exit"
                    if service.id == "lm-studio"
                    else ""
                )
            else:
                service.detail += "; already running; reused"
    except (OSError, RuntimeError, TimeoutError) as error:
        service.detail = (
            f"local startup/load failed ({type(error).__name__}, 20 s limit); "
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
    daemon, server = (
        await asyncio.gather(lms_status(lms, "daemon"), lms_status(lms, "server"))
        if lms
        else ({}, {})
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
        lm.detail += "; installed. Start your local server with lms server start, then restart Sam"
    explicit = provider != "auto" or base_url is not None
    owned: list[asyncio.subprocess.Process] = []
    order = services.copy()
    if preferred and not explicit:
        order.sort(key=lambda service: service.id != preferred[0])
    if bootstrap:
        try:
            for service in order:
                if explicit and service.id != ("ollama" if provider == "auto" else provider):
                    continue
                if not service.running or not service.models:
                    await bootstrap_service(
                        service, model or (preferred[1] if preferred else None), owned
                    )
                if service.running and service.models and (not model or model in service.models):
                    break
        except BaseException:
            await Discovery([], None, None, "cancelled", owned).aclose()
            raise
    eligible = [
        service
        for service in order
        if service.running and service.models and (not model or model in service.models)
    ]
    if explicit:
        expected = "ollama" if provider == "auto" else provider
        target = next(service for service in services if service.id == expected)
        eligible = [target] if target in eligible else []
    selected = eligible[0] if eligible else None
    reason = (
        (
            "explicit configuration"
            if explicit
            else "last successful local provider/model"
            if preferred and selected.id == preferred[0]
            else "local priority: Ollama, LM Studio, configured compatible"
        )
        if selected
        else "No usable local chat model. " + "; ".join(f"{s.id}: {s.detail}" for s in services)
    )
    if selected:
        reason += "; " + (
            "started by Sam" if selected.started_by_sam else "already running; reused"
        )
    chosen = model or (
        preferred[1]
        if preferred
        and selected
        and selected.id == preferred[0]
        and preferred[1] in selected.models
        else selected.models[0]
        if selected
        else None
    )
    return Discovery(services, selected, chosen if selected else None, reason, owned)


def provider_for(service: LocalService) -> LLMProvider:
    if service.id == "ollama":
        return OllamaProvider(base_url=service.endpoint)
    return OpenAICompatibleProvider(
        provider_id=service.id,
        base_url=service.endpoint,
        data_boundary=DataBoundary.LOCAL,
        transport=HttpxJsonTransport(trust_env=False, verify=service.endpoint.startswith("https:")),
    )
