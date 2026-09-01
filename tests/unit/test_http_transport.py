import asyncio
from collections.abc import AsyncIterator

import httpx
import pytest

from sam_ambient.adapters.http import HttpxJsonTransport
from sam_ambient.core.turns import CancellationToken, OperationCancelled


class BlockingByteStream(httpx.AsyncByteStream):
    def __init__(self) -> None:
        self.started = asyncio.Event()
        self.closed = asyncio.Event()

    async def __aiter__(self) -> AsyncIterator[bytes]:
        self.started.set()
        await asyncio.Event().wait()
        yield b"unreachable"

    async def aclose(self) -> None:
        self.closed.set()


def test_token_cancellation_closes_active_httpx_stream() -> None:
    async def scenario() -> None:
        stream = BlockingByteStream()

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, request=request, stream=stream)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        transport = HttpxJsonTransport(client=client)
        cancellation = CancellationToken("cancel-http-stream")

        async def consume() -> None:
            async for _line in transport.stream_lines(
                "POST",
                "https://example.invalid/stream",
                body={"stream": True},
                headers={},
                timeout_s=10,
                cancellation=cancellation,
            ):
                pass

        consumer = asyncio.create_task(consume())
        await stream.started.wait()
        cancellation.cancel("barge-in")

        with pytest.raises(OperationCancelled) as raised:
            await consumer
        assert raised.value.cancellation_id == "cancel-http-stream"
        assert stream.closed.is_set()
        await client.aclose()

    asyncio.run(scenario())


def test_json_requests_use_bounded_httpx_streaming_reader() -> None:
    async def scenario() -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"ok": True}, request=request)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        transport = HttpxJsonTransport(client=client, max_response_bytes=100)

        result = await transport.request_json(
            "GET",
            "https://example.invalid/health",
            body=None,
            headers={},
            timeout_s=1,
            cancellation=CancellationToken("cancel-http-json"),
        )

        assert result == {"ok": True}
        await client.aclose()

    asyncio.run(scenario())
