import asyncio
from collections.abc import AsyncIterator

import httpx
import pytest

from sam_ambient.adapters.stt import (
    SpeechRecognitionProtocolError,
    WhisperCppServerSTT,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import AudioFormat, AudioFrame, VoiceStreamContext


def test_whisper_cpp_stt_sends_bounded_wav_and_returns_final_text() -> None:
    async def scenario() -> None:
        requests: list[httpx.Request] = []

        async def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return httpx.Response(200, json={"text": "  hello   Sam  "}, request=request)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        provider = WhisperCppServerSTT(client=client)
        token = CancellationToken("stt-cancel")
        stream = await provider.start_stream(
            VoiceStreamContext("session", "turn", token.cancellation_id, "en"),
            token,
        )
        audio_format = AudioFormat()
        await stream.push_audio(
            AudioFrame(audio_format, b"\0" * 640, monotonic_ms=0, sequence=0),
            token,
        )

        result = await stream.finalize(token)

        assert result.text == "hello Sam"
        assert result.is_final is True
        assert b"RIFF" in requests[0].content
        assert b"speech.wav" in requests[0].content
        await client.aclose()

    asyncio.run(scenario())


def test_whisper_cpp_stt_blocks_remote_audio_export_by_default() -> None:
    with pytest.raises(ValueError, match="export microphone audio"):
        WhisperCppServerSTT(base_url="https://speech.example")


def test_whisper_cpp_stt_rejects_audio_discontinuity() -> None:
    async def scenario() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _request: None))
        provider = WhisperCppServerSTT(client=client)
        token = CancellationToken("stt-gap")
        stream = await provider.start_stream(
            VoiceStreamContext("session", "turn", token.cancellation_id),
            token,
        )
        frame = AudioFrame(
            AudioFormat(),
            b"\0" * 640,
            monotonic_ms=0,
            sequence=2,
            dropped_before=1,
        )

        with pytest.raises(SpeechRecognitionProtocolError, match="discontinuity"):
            await stream.push_audio(frame, token)
        await client.aclose()

    asyncio.run(scenario())


def test_whisper_cpp_stt_cancellation_is_scoped_and_idempotent() -> None:
    async def scenario() -> None:
        client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _request: None))
        provider = WhisperCppServerSTT(client=client)
        token = CancellationToken("stt-scoped")
        stream = await provider.start_stream(
            VoiceStreamContext("session", "turn", token.cancellation_id),
            token,
        )

        assert await stream.cancel("other-id", "barge-in") is False
        assert await stream.cancel("stt-scoped", "barge-in") is True
        assert await stream.cancel("stt-scoped", "again") is False
        with pytest.raises(OperationCancelled) as caught:
            await stream.push_audio(
                AudioFrame(AudioFormat(), b"\0" * 640, monotonic_ms=0, sequence=0),
                token,
            )
        assert caught.value.reason == "barge-in"
        await client.aclose()

    asyncio.run(scenario())


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


def test_whisper_cpp_cancellation_closes_active_response_stream() -> None:
    async def scenario() -> None:
        response_stream = BlockingByteStream()

        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, request=request, stream=response_stream)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        provider = WhisperCppServerSTT(client=client)
        token = CancellationToken("stt-http-cancel")
        stream = await provider.start_stream(
            VoiceStreamContext("session", "turn", token.cancellation_id),
            token,
        )
        await stream.push_audio(
            AudioFrame(AudioFormat(), b"\0" * 640, monotonic_ms=0, sequence=0),
            token,
        )

        request = asyncio.create_task(stream.finalize(token))
        await response_stream.started.wait()
        token.cancel("barge-in")
        with pytest.raises(OperationCancelled):
            await request
        assert response_stream.closed.is_set()
        await client.aclose()

    asyncio.run(scenario())
