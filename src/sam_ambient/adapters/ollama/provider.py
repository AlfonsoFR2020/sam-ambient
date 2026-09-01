"""Native Ollama HTTP adapter with discovery, provenance, and streaming."""

from __future__ import annotations

import json
import shutil
from collections.abc import AsyncIterator, Mapping, Sequence
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from sam_ambient.adapters.http import (
    HttpStatusError,
    HttpTimeoutError,
    HttpTransportError,
    HttpxJsonTransport,
    JsonHttpTransport,
)
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ProviderResponseError,
    ProviderTimeout,
    ProviderUnavailable,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken

DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"


def find_ollama_executable() -> str | None:
    """Return the installed Ollama executable without assuming a platform path."""

    return shutil.which("ollama")


def normalize_ollama_base_url(value: str) -> str:
    normalized = value.strip()
    if "://" not in normalized:
        normalized = f"http://{normalized}"
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Ollama base URL must use http or https and include a host")
    path = parsed.path.rstrip("/")
    if path.endswith("/v1"):
        path = path[:-3]
    return urlunsplit((parsed.scheme, parsed.netloc, path, "", "")).rstrip("/")


class OllamaProvider(LLMProvider):
    id = "ollama"

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_OLLAMA_BASE_URL,
        transport: JsonHttpTransport | None = None,
        timeout_s: float = 120.0,
        discovery_timeout_s: float = 5.0,
        data_boundary: DataBoundary | None = None,
    ) -> None:
        if timeout_s <= 0 or discovery_timeout_s <= 0:
            raise ValueError("provider timeouts must be positive")
        self.base_url = normalize_ollama_base_url(base_url)
        self.data_boundary = data_boundary or self._infer_data_boundary(self.base_url)
        self._transport = transport or HttpxJsonTransport(
            trust_env=False,
            verify=self.base_url.startswith("https://"),
        )
        self._timeout_s = timeout_s
        self._discovery_timeout_s = discovery_timeout_s

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        try:
            body = await self._request_json(
                "GET",
                "/api/version",
                body=None,
                timeout_s=self._discovery_timeout_s,
                cancellation=cancellation,
            )
        except (ProviderUnavailable, ProviderResponseError) as error:
            return ProviderHealth(available=False, detail=str(error))
        version = body.get("version")
        return ProviderHealth(
            available=True,
            detail="Ollama service reachable",
            version=version if isinstance(version, str) else None,
        )

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        body = await self._request_json(
            "GET",
            "/api/tags",
            body=None,
            timeout_s=self._discovery_timeout_s,
            cancellation=cancellation,
        )
        raw_models = body.get("models", [])
        if not isinstance(raw_models, list):
            raise ProviderResponseError("Ollama /api/tags returned a non-list models field")

        models: list[ModelInfo] = []
        for row in raw_models:
            cancellation.raise_if_cancelled()
            if not isinstance(row, dict):
                continue
            model_id = row.get("name") or row.get("model")
            if not isinstance(model_id, str) or not model_id:
                continue
            details: dict[str, Any] = {}
            try:
                details = await self._request_json(
                    "POST",
                    "/api/show",
                    body={"model": model_id},
                    timeout_s=self._discovery_timeout_s,
                    cancellation=cancellation,
                )
            except (ProviderUnavailable, ProviderResponseError):
                pass
            models.append(self._model_info(model_id, row, details))
        return models

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        if not model.strip():
            raise ValueError("model must be non-blank")
        if not messages:
            raise ValueError("at least one message is required")
        body: dict[str, Any] = {
            "model": model,
            "messages": [message.to_wire() for message in messages],
            "stream": True,
        }
        if tools:
            body["tools"] = [tool.to_openai_wire() for tool in tools]

        completed = False
        try:
            lines = self._transport.stream_lines(
                "POST",
                f"{self.base_url}/api/chat",
                body=body,
                headers={},
                timeout_s=self._timeout_s,
                cancellation=cancellation,
            )
            async for line in lines:
                cancellation.raise_if_cancelled()
                chunk = self._decode_chunk(line)
                error = chunk.get("error")
                if error:
                    raise ProviderResponseError(f"Ollama stream failed: {str(error)[:500]}")
                message = chunk.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content:
                        yield ModelEvent(ModelEventKind.TEXT_DELTA, text=content)
                    tool_calls = message.get("tool_calls")
                    if isinstance(tool_calls, list):
                        for tool_call in tool_calls:
                            if isinstance(tool_call, dict):
                                yield ModelEvent(ModelEventKind.TOOL_CALL, payload=tool_call)
                if chunk.get("done") is True:
                    completed = True
                    metadata = {
                        key: chunk[key]
                        for key in (
                            "done_reason",
                            "prompt_eval_count",
                            "eval_count",
                            "total_duration",
                            "load_duration",
                        )
                        if key in chunk
                    }
                    yield ModelEvent(ModelEventKind.COMPLETED, payload=metadata)
                    break
        except HttpStatusError as error:
            self._raise_http_status(error)
        except HttpTimeoutError as error:
            raise ProviderTimeout(f"Ollama stream timed out: {error}") from error
        except HttpTransportError as error:
            raise ProviderUnavailable(f"Ollama stream unavailable: {error}") from error
        if not completed:
            raise ProviderResponseError("Ollama stream ended before a completion marker")

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        body: Mapping[str, Any] | None,
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> dict[str, Any]:
        try:
            return await self._transport.request_json(
                method,
                f"{self.base_url}{path}",
                body=body,
                headers={},
                timeout_s=timeout_s,
                cancellation=cancellation,
            )
        except HttpStatusError as error:
            self._raise_http_status(error)
        except HttpTimeoutError as error:
            raise ProviderTimeout(f"Ollama request timed out: {error}") from error
        except HttpTransportError as error:
            raise ProviderUnavailable(f"Ollama unavailable: {error}") from error
        raise AssertionError("unreachable")

    async def aclose(self) -> None:
        close = getattr(self._transport, "aclose", None)
        if close is not None:
            await close()

    @staticmethod
    def _raise_http_status(error: HttpStatusError) -> None:
        if error.status >= 500 or error.status in {408, 429}:
            raise ProviderUnavailable(f"Ollama unavailable: {error}") from error
        raise ProviderResponseError(f"Ollama rejected request: {error}") from error

    @staticmethod
    def _decode_chunk(line: str) -> dict[str, Any]:
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise ProviderResponseError("Ollama stream contained invalid JSON") from error
        if not isinstance(value, dict):
            raise ProviderResponseError("Ollama stream chunk must be an object")
        return value

    def _model_info(
        self,
        model_id: str,
        tag: Mapping[str, Any],
        show: Mapping[str, Any],
    ) -> ModelInfo:
        model_info = show.get("model_info")
        context_window = self._context_window(model_info if isinstance(model_info, dict) else {})
        capabilities = show.get("capabilities", ())
        if not isinstance(capabilities, list):
            capabilities = []
        license_value = show.get("license")
        if isinstance(license_value, list):
            license_value = "\n".join(str(item) for item in license_value)
        details = tag.get("details") if isinstance(tag.get("details"), dict) else {}
        provenance = {
            key: value
            for key, value in {
                "digest": tag.get("digest"),
                "modified_at": tag.get("modified_at"),
                "size": tag.get("size"),
                "family": details.get("family"),
                "parameter_size": details.get("parameter_size"),
                "quantization_level": details.get("quantization_level"),
                "source": f"{self.base_url}/api/show",
            }.items()
            if value is not None
        }
        return ModelInfo(
            id=model_id,
            provider_id=self.id,
            display_name=model_id,
            context_window=context_window,
            capabilities=tuple(item for item in capabilities if isinstance(item, str)),
            license=license_value if isinstance(license_value, str) else None,
            provenance=provenance,
        )

    @staticmethod
    def _context_window(model_info: Mapping[str, Any]) -> int | None:
        for key, value in model_info.items():
            if key.endswith(".context_length") and isinstance(value, int) and value > 0:
                return value
        return None

    @staticmethod
    def _infer_data_boundary(base_url: str) -> DataBoundary:
        host = urlsplit(base_url).hostname or ""
        if host.lower() == "localhost":
            return DataBoundary.LOCAL
        try:
            return DataBoundary.LOCAL if ip_address(host).is_loopback else DataBoundary.CLOUD
        except ValueError:
            return DataBoundary.CLOUD
