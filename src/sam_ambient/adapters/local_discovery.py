"""Bounded discovery of known loopback services. Never install, start, or download."""

from __future__ import annotations

import asyncio
import json
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


@dataclass
class Discovery:
    services: list[LocalService]
    selected: LocalService | None
    model: str | None
    reason: str

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
        }
    )


async def probe_service(service: LocalService) -> None:
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
            service.detail = "ready" if service.models else "server running; no usable model"
    except Exception as error:
        service.detail = f"unreachable ({type(error).__name__})"
    finally:
        await transport.aclose()


async def discover_local(
    *,
    provider: str = "auto",
    base_url: str | None = None,
    model: str | None = None,
    compatible_url: str | None = None,
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
    if ollama_url != DEFAULT_OLLAMA_BASE_URL:
        services.insert(1, LocalService("ollama", DEFAULT_OLLAMA_BASE_URL, shutil.which("ollama")))
    if provider == "openai-compatible":
        services.append(LocalService("openai-compatible", local_url(base_url)))
    elif compatible_url:
        services.append(LocalService("openai-compatible", local_url(compatible_url)))
    await asyncio.gather(*(probe_service(service) for service in services))
    lm = next(service for service in services if service.id == "lm-studio")
    if lm.executable and not lm.running:
        lm.detail += "; installed. Start your local server with lms server start, then restart Sam"
    explicit = provider != "auto" or base_url is not None
    eligible = [
        service
        for service in services
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
            else "local priority: Ollama, LM Studio, configured compatible"
        )
        if selected
        else "No usable local model. Start a local server with a model, then restart Sam."
    )
    return Discovery(
        services, selected, (model or selected.models[0]) if selected else None, reason
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
