"""Cancellation-aware JSON HTTP transport built on HTTPX."""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator, Callable, Mapping
from typing import Any, Protocol

import httpx

from sam_ambient.core.turns import CancellationToken, OperationCancelled


class HttpTransportError(RuntimeError):
    pass


class HttpTimeoutError(HttpTransportError):
    pass


class HttpStatusError(HttpTransportError):
    def __init__(self, status: int, detail: str) -> None:
        super().__init__(f"HTTP {status}: {detail}")
        self.status = status
        self.detail = detail


class HttpProtocolError(HttpTransportError):
    pass


class JsonHttpTransport(Protocol):
    async def request_json(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any] | None,
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> dict[str, Any]: ...

    def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]: ...

    async def aclose(self) -> None: ...


class HttpxJsonTransport:
    """Shared async client with bounded responses and token-driven stream closure."""

    def __init__(
        self,
        *,
        client: httpx.AsyncClient | None = None,
        max_response_bytes: int = 4 * 1024 * 1024,
        trust_env: bool = True,
        verify: bool = True,
    ) -> None:
        if max_response_bytes < 1:
            raise ValueError("max_response_bytes must be positive")
        self._client = client or httpx.AsyncClient(
            follow_redirects=False,
            trust_env=trust_env,
            verify=verify,
        )
        self._owns_client = client is None
        self._max_response_bytes = max_response_bytes

    async def request_json(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any] | None = None,
        headers: Mapping[str, str] | None = None,
        timeout_s: float = 10.0,
        cancellation: CancellationToken,
    ) -> dict[str, Any]:
        request_options = self._request_options(body, headers, timeout_s)
        remove_callback = self._bind_cancellation(cancellation)
        try:
            async with self._client.stream(method, url, **request_options) as response:
                raw = await self._read_limited(response)
                self._raise_for_status(response, raw)
        except asyncio.CancelledError as error:
            self._raise_if_token_cancelled(cancellation, error)
            raise
        except httpx.TimeoutException as error:
            raise HttpTimeoutError(str(error)) from error
        except httpx.RequestError as error:
            raise HttpTransportError(str(error)) from error
        finally:
            remove_callback()
        return self._decode_object(raw)

    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str] | None = None,
        timeout_s: float = 120.0,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        request_options = self._request_options(body, headers, timeout_s)
        remove_callback = self._bind_cancellation(cancellation)
        try:
            async with self._client.stream(method, url, **request_options) as response:
                if response.status_code >= 400:
                    raw = await self._read_limited(response)
                    self._raise_for_status(response, raw)
                async for line in response.aiter_lines():
                    cancellation.raise_if_cancelled()
                    if len(line.encode("utf-8")) > self._max_response_bytes:
                        raise HttpProtocolError("stream line exceeded configured size limit")
                    stripped = line.strip()
                    if stripped:
                        yield stripped
        except asyncio.CancelledError as error:
            self._raise_if_token_cancelled(cancellation, error)
            raise
        except httpx.TimeoutException as error:
            raise HttpTimeoutError(str(error)) from error
        except httpx.RequestError as error:
            raise HttpTransportError(str(error)) from error
        finally:
            remove_callback()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    def _request_options(
        self,
        body: Mapping[str, Any] | None,
        headers: Mapping[str, str] | None,
        timeout_s: float,
    ) -> dict[str, Any]:
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")
        options: dict[str, Any] = {
            "headers": dict(headers or {}),
            "timeout": httpx.Timeout(timeout_s),
        }
        if body is not None:
            options["json"] = dict(body)
        return options

    async def _read_limited(self, response: httpx.Response) -> bytes:
        content = bytearray()
        async for chunk in response.aiter_bytes():
            content.extend(chunk)
            if len(content) > self._max_response_bytes:
                raise HttpProtocolError("HTTP response exceeded configured size limit")
        return bytes(content)

    def _bind_cancellation(self, cancellation: CancellationToken) -> Callable[[], None]:
        cancellation.raise_if_cancelled()
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("HTTP transport requires an asyncio task")
        return cancellation.add_callback(lambda _reason: task.cancel())

    @staticmethod
    def _raise_if_token_cancelled(
        cancellation: CancellationToken,
        error: asyncio.CancelledError,
    ) -> None:
        if cancellation.is_cancelled:
            raise OperationCancelled(
                cancellation.cancellation_id,
                cancellation.reason or "cancelled",
            ) from error

    @classmethod
    def _raise_for_status(cls, response: httpx.Response, raw: bytes) -> None:
        if response.status_code >= 400:
            raise HttpStatusError(response.status_code, cls._error_detail(raw))

    @staticmethod
    def _decode_object(raw: bytes) -> dict[str, Any]:
        try:
            value = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise HttpProtocolError("response was not valid JSON") from error
        if not isinstance(value, dict):
            raise HttpProtocolError("JSON response must be an object")
        return value

    @classmethod
    def _error_detail(cls, raw: bytes) -> str:
        try:
            value = cls._decode_object(raw)
        except HttpProtocolError:
            return raw.decode("utf-8", errors="replace")[:500] or "request failed"
        detail = value.get("error") or value.get("message") or "request failed"
        if isinstance(detail, dict):
            detail = detail.get("message") or "request failed"
        return str(detail)[:500]
