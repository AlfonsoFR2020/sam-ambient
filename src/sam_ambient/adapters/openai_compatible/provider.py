"""Generic OpenAI-compatible model discovery and streaming adapter."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any

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


class OpenAICompatibleProvider(LLMProvider):
    def __init__(
        self,
        *,
        provider_id: str,
        base_url: str,
        api_key: str | None = None,
        data_boundary: DataBoundary = DataBoundary.CLOUD,
        transport: JsonHttpTransport | None = None,
        timeout_s: float = 120.0,
        discovery_timeout_s: float = 10.0,
    ) -> None:
        if not provider_id.strip():
            raise ValueError("provider_id must be non-blank")
        if timeout_s <= 0 or discovery_timeout_s <= 0:
            raise ValueError("provider timeouts must be positive")
        self.id = provider_id
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.data_boundary = data_boundary
        self._transport = transport or HttpxJsonTransport()
        self._timeout_s = timeout_s
        self._discovery_timeout_s = discovery_timeout_s

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        try:
            await self._models_response(cancellation)
        except (ProviderUnavailable, ProviderResponseError) as error:
            return ProviderHealth(False, str(error))
        return ProviderHealth(True, "OpenAI-compatible service reachable")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        body = await self._models_response(cancellation)
        rows = body.get("data", [])
        if not isinstance(rows, list):
            raise ProviderResponseError("models response contained a non-list data field")
        result: list[ModelInfo] = []
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("id"), str):
                continue
            model_id = row["id"]
            result.append(
                ModelInfo(
                    id=model_id,
                    provider_id=self.id,
                    display_name=model_id,
                    provenance={key: row[key] for key in ("owned_by", "created") if key in row},
                )
            )
        return result

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
            "stream_options": {"include_usage": True},
        }
        if tools:
            body["tools"] = [tool.to_openai_wire() for tool in tools]

        saw_completion = False
        usage: Mapping[str, Any] = {}
        try:
            lines = self._transport.stream_lines(
                "POST",
                f"{self.base_url}/chat/completions",
                body=body,
                headers=self._headers(),
                timeout_s=self._timeout_s,
                cancellation=cancellation,
            )
            async for line in lines:
                cancellation.raise_if_cancelled()
                if line.startswith(":") or not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    saw_completion = True
                    break
                chunk = self._decode_chunk(data)
                raw_usage = chunk.get("usage")
                if isinstance(raw_usage, dict):
                    usage = raw_usage
                choices = chunk.get("choices", [])
                if not isinstance(choices, list):
                    raise ProviderResponseError("stream choices field must be a list")
                for choice in choices:
                    if not isinstance(choice, dict):
                        continue
                    delta = choice.get("delta")
                    if isinstance(delta, dict):
                        content = delta.get("content")
                        if isinstance(content, str) and content:
                            yield ModelEvent(ModelEventKind.TEXT_DELTA, text=content)
                        tool_calls = delta.get("tool_calls")
                        if isinstance(tool_calls, list):
                            for tool_call in tool_calls:
                                if isinstance(tool_call, dict):
                                    yield ModelEvent(ModelEventKind.TOOL_CALL, payload=tool_call)
                    if choice.get("finish_reason") is not None:
                        saw_completion = True
        except HttpStatusError as error:
            self._raise_http_status(error)
        except HttpTimeoutError as error:
            raise ProviderTimeout(f"{self.id} stream timed out: {error}") from error
        except HttpTransportError as error:
            raise ProviderUnavailable(f"{self.id} stream unavailable: {error}") from error

        if not saw_completion:
            raise ProviderResponseError(f"{self.id} stream ended before completion")
        yield ModelEvent(ModelEventKind.COMPLETED, payload=dict(usage))

    async def _models_response(self, cancellation: CancellationToken) -> dict[str, Any]:
        try:
            return await self._transport.request_json(
                "GET",
                f"{self.base_url}/models",
                body=None,
                headers=self._headers(),
                timeout_s=self._discovery_timeout_s,
                cancellation=cancellation,
            )
        except HttpStatusError as error:
            self._raise_http_status(error)
        except HttpTimeoutError as error:
            raise ProviderTimeout(f"{self.id} request timed out: {error}") from error
        except HttpTransportError as error:
            raise ProviderUnavailable(f"{self.id} unavailable: {error}") from error
        raise AssertionError("unreachable")

    async def aclose(self) -> None:
        close = getattr(self._transport, "aclose", None)
        if close is not None:
            await close()

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        return {"Authorization": f"Bearer {self.api_key}"}

    def _raise_http_status(self, error: HttpStatusError) -> None:
        if error.status >= 500 or error.status in {408, 429}:
            raise ProviderUnavailable(f"{self.id} unavailable: {error}") from error
        raise ProviderResponseError(f"{self.id} rejected request: {error}") from error

    @staticmethod
    def _decode_chunk(data: str) -> dict[str, Any]:
        try:
            value = json.loads(data)
        except json.JSONDecodeError as error:
            raise ProviderResponseError("stream contained invalid JSON") from error
        if not isinstance(value, dict):
            raise ProviderResponseError("stream chunk must be an object")
        return value
