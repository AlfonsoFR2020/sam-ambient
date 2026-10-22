import asyncio
from collections.abc import AsyncIterator

import httpx
import pytest

from sam_ambient.adapters.http import HttpStatusError, HttpxJsonTransport
from sam_ambient.core.turns import CancellationToken, OperationCancelled


@pytest.mark.parametrize("outcome", ["success", "http_error", "malformed"])
def test_json_preflight_timing_separates_headers_and_body_without_content(monkeypatch, outcome):
    from sam_ambient.adapters import http as adapter
    from sam_ambient.diagnostic_log import correlation, safe_record

    now, records = [100], []
    monkeypatch.setattr(adapter.time, "monotonic_ns", lambda: now[0] * 1_000_000)
    monkeypatch.setattr(
        adapter,
        "diagnostic",
        lambda stage, **fields: records.append(
            safe_record(stage, {**(correlation.get() or {}), **fields})
        ),
    )

    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            now[0] = 160
            yield b'{"private": "private-model"}' if outcome != "malformed" else b"private bad JSON"

    async def scenario():
        async def handler(request):
            now[0] = 120
            return httpx.Response(
                401 if outcome == "http_error" else 200, request=request, stream=Stream()
            )

        context = correlation.set(
            {"generation_id": "private-generation", "command_id": "private-command"}
        )
        try:
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                transport = HttpxJsonTransport(client=client)
                try:
                    result = await transport.request_json(
                        "GET",
                        "https://private-provider.invalid/secret",
                        headers={"Authorization": "private credential"},
                        cancellation=CancellationToken("private-preflight"),
                    )
                except adapter.HttpTransportError:
                    assert outcome != "success"
                else:
                    assert outcome == "success" and result["private"] == "private-model"
        finally:
            correlation.reset(context)

    asyncio.run(scenario())
    assert [record["stage"] for record in records] == [
        "provider.json_request",
        "provider.json_headers",
        "provider.json_closed",
    ]
    assert [record.get("elapsed_ms") for record in records] == [None, 20, 60]
    assert records[-1]["state"] == ("completed" if outcome == "success" else "failed")
    assert all("generation_id" in record and "command_id" in record for record in records)
    assert "private" not in str(records)


def test_provider_timing_separates_headers_first_line_and_close_without_content(monkeypatch):
    from sam_ambient.adapters import http as adapter
    from sam_ambient.diagnostic_log import correlation, safe_record

    now, records = [100], []
    monkeypatch.setattr(adapter.time, "monotonic_ns", lambda: now[0] * 1_000_000)
    monkeypatch.setattr(
        adapter,
        "diagnostic",
        lambda stage, **fields: records.append(
            safe_record(stage, {**(correlation.get() or {}), **fields})
        ),
    )

    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            now[0] = 180
            yield b"\n"
            now[0] = 210
            yield b"data: private response\n"
            now[0] = 240
            yield b"data: [DONE]\n"

    async def scenario():
        async def handler(request):
            now[0] = 120
            return httpx.Response(200, request=request, stream=Stream())

        token = correlation.set({"generation_id": "private-generation"})
        try:
            async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                transport = HttpxJsonTransport(client=client)
                lines = [
                    line
                    async for line in transport.stream_lines(
                        "POST",
                        "https://private-provider.invalid/secret",
                        body={"prompt": "private prompt"},
                        headers={"Authorization": "private credential"},
                        cancellation=CancellationToken("local-fixture"),
                    )
                ]
                assert len(lines) == 2
        finally:
            correlation.reset(token)

    asyncio.run(scenario())
    assert [record["stage"] for record in records] == [
        "provider.request",
        "provider.headers",
        "provider.first_line",
        "provider.stream_closed",
    ]
    assert [record.get("elapsed_ms") for record in records] == [None, 20, 110, 140]
    assert records[-1]["count"] == 2
    assert all("generation_id" in record for record in records)
    assert "private" not in str(records)


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


@pytest.mark.parametrize("streaming", [False, True])
def test_token_cancellation_closes_active_httpx_stream(streaming) -> None:
    async def scenario() -> None:
        stream = BlockingByteStream()

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, request=request, stream=stream)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        transport = HttpxJsonTransport(client=client)
        cancellation = CancellationToken("cancel-http-stream")

        async def consume() -> None:
            if streaming:
                async for _line in transport.stream_lines(
                    "POST",
                    "https://example.invalid/stream",
                    body={"stream": True},
                    headers={},
                    timeout_s=10,
                    cancellation=cancellation,
                ):
                    pass
            else:
                await transport.request_json(
                    "GET",
                    "https://example.invalid/health",
                    cancellation=cancellation,
                )

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


@pytest.mark.parametrize("streaming", [False, True])
def test_authenticated_provider_error_cannot_reflect_secret_into_exception(
    streaming: bool,
) -> None:
    async def scenario() -> None:
        secret = "secret-value-never-log"

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                401,
                json={"error": f"rejected Bearer {secret}"},
                request=request,
            )

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        transport = HttpxJsonTransport(client=client)
        headers = {"Authorization": f"Bearer {secret}"}
        try:
            with pytest.raises(HttpStatusError) as raised:
                if streaming:
                    async for _line in transport.stream_lines(
                        "POST",
                        "https://example.invalid/chat",
                        body={"stream": True},
                        headers=headers,
                        cancellation=CancellationToken("secret-stream"),
                    ):
                        pass
                else:
                    await transport.request_json(
                        "GET",
                        "https://example.invalid/models",
                        body=None,
                        headers=headers,
                        cancellation=CancellationToken("secret-json"),
                    )
            assert raised.value.status == 401
            assert secret not in str(raised.value)
            assert raised.value.detail == "authenticated provider request failed"
        finally:
            await client.aclose()

    asyncio.run(scenario())
