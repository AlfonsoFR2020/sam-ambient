import asyncio
import json
from collections.abc import AsyncIterator, Mapping
from typing import Any

from sam_ambient.adapters.openai_compatible import OpenAICompatibleProvider
from sam_ambient.core.providers import Message, MessageRole, ModelEventKind
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
