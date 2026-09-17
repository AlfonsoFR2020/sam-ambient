import asyncio
import json
from collections.abc import AsyncIterator, Mapping
from typing import Any

import pytest

from sam_ambient.adapters.openai_compatible import OpenAICompatibleProvider
from sam_ambient.core.providers import (
    Message,
    MessageRole,
    ModelEventKind,
    ProviderResponseError,
    ProviderTimeout,
)
from sam_ambient.core.turns import CancellationToken


class FakeTransport:
    def __init__(self) -> None:
        self.headers: list[Mapping[str, str]] = []

    async def request_json(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any] | None,
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> dict[str, Any]:
        del method, url, body, timeout_s
        cancellation.raise_if_cancelled()
        self.headers.append(headers)
        return {"data": [{"id": "compatible-model", "owned_by": "test-owner"}]}

    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        del method, url, body, timeout_s
        self.headers.append(headers)
        cancellation.raise_if_cancelled()
        yield f"data: {json.dumps({'choices': [{'delta': {'content': 'Hi'}}]})}"
        yield f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}"
        yield f"data: {json.dumps({'choices': [], 'usage': {'total_tokens': 3}})}"
        yield "data: [DONE]"


def test_compatible_discovery_streaming_and_auth_header() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        provider = OpenAICompatibleProvider(
            provider_id="compatible",
            base_url="https://example.invalid/v1",
            api_key="secret-value",
            transport=transport,
        )
        cancellation = CancellationToken("cancel-compatible")

        health = await provider.health(cancellation)
        models = await provider.list_models(cancellation)
        events = [
            event
            async for event in provider.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model="compatible-model",
                cancellation=cancellation,
            )
        ]

        assert health.available
        assert models[0].id == "compatible-model"
        assert models[0].provenance["owned_by"] == "test-owner"
        assert [event.kind for event in events] == [
            ModelEventKind.TEXT_DELTA,
            ModelEventKind.COMPLETED,
        ]
        assert events[0].text == "Hi"
        assert events[-1].payload["total_tokens"] == 3
        assert all(
            headers["Authorization"] == "Bearer secret-value" for headers in transport.headers
        )

    asyncio.run(scenario())


class MetadataOnlyTransport(FakeTransport):
    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        del method, url, body, timeout_s
        self.headers.append(headers)
        cancellation.raise_if_cancelled()
        yield f"data: {json.dumps({'choices': [{'delta': {'role': 'assistant'}}]})}"
        yield f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}"
        yield "data: [DONE]"


def test_metadata_only_completed_stream_is_an_actionable_failure() -> None:
    async def scenario() -> None:
        provider = OpenAICompatibleProvider(
            provider_id="compatible",
            base_url="https://example.invalid/v1",
            transport=MetadataOnlyTransport(),
        )

        with pytest.raises(ProviderResponseError, match="without usable text or tool calls"):
            _ = [
                event
                async for event in provider.stream_chat(
                    [Message(MessageRole.USER, "hello")],
                    (),
                    model="compatible-model",
                    cancellation=CancellationToken("cancel-empty"),
                )
            ]

    asyncio.run(scenario())


class KeepaliveOnlyTransport(FakeTransport):
    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        del method, url, body, timeout_s
        self.headers.append(headers)
        while True:
            cancellation.raise_if_cancelled()
            yield ": keepalive"
            yield f"data: {json.dumps({'choices': [{'delta': {'role': 'assistant'}}]})}"
            await asyncio.sleep(0)


def test_keepalives_and_role_only_chunks_do_not_extend_first_content_deadline() -> None:
    async def scenario() -> None:
        provider = OpenAICompatibleProvider(
            provider_id="compatible",
            base_url="https://example.invalid/v1",
            transport=KeepaliveOnlyTransport(),
            timeout_s=1,
            first_content_timeout_s=0.01,
        )

        with pytest.raises(ProviderTimeout, match="first usable content"):
            _ = [
                event
                async for event in provider.stream_chat(
                    [Message(MessageRole.USER, "hello")],
                    (),
                    model="compatible-model",
                    cancellation=CancellationToken("cancel-no-content"),
                )
            ]

    asyncio.run(scenario())


class TextThenKeepaliveTransport(FakeTransport):
    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        del method, url, body, timeout_s
        self.headers.append(headers)
        yield f"data: {json.dumps({'choices': [{'delta': {'content': 'Started'}}]})}"
        while True:
            cancellation.raise_if_cancelled()
            yield ": keepalive"
            await asyncio.sleep(0)


def test_keepalives_after_first_text_do_not_extend_total_generation_deadline() -> None:
    async def scenario() -> None:
        provider = OpenAICompatibleProvider(
            provider_id="compatible",
            base_url="https://example.invalid/v1",
            transport=TextThenKeepaliveTransport(),
            timeout_s=0.02,
            first_content_timeout_s=0.01,
        )

        with pytest.raises(ProviderTimeout, match="generation deadline"):
            _ = [
                event
                async for event in provider.stream_chat(
                    [Message(MessageRole.USER, "hello")],
                    (),
                    model="compatible-model",
                    cancellation=CancellationToken("cancel-total-timeout"),
                )
            ]

    asyncio.run(scenario())
