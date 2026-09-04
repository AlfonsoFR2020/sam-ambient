from __future__ import annotations

import asyncio
import json
import sys
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

import pytest

from sam_ambient.adapters.tts import SystemTextToSpeech
from sam_ambient.core.protocol import EventBus, EventType
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    Transcript,
    VadResult,
    VoiceStreamContext,
)
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from sam_ambient.static_server import StaticUiServer
from sam_ambient.supervisor import UpdatableComponent, UpdateError, VersionLayout
from sam_ambient.supervisor.component_launcher import resolve_core_command


def _write_version(root: Path, version: str) -> Path:
    target = root / "versions" / version
    target.mkdir(parents=True)
    (target / "component.json").write_text(
        json.dumps({"component_id": "sam-core", "version": version}), encoding="utf-8"
    )
    (target / "sam_core.py").write_text("print('candidate')\n", encoding="utf-8")
    return target


def test_packaged_launcher_resolves_rehashed_active_version_and_safe_fallback(
    tmp_path: Path,
) -> None:
    component_root = tmp_path / "component"
    incoming = tmp_path / "incoming"
    component_root.mkdir()
    incoming.mkdir()
    component = UpdatableComponent("sam-core", component_root, incoming)
    _write_version(component_root, "0.1.0")
    layout = VersionLayout(component)
    layout.activate(layout.artifact("0.1.0"))

    command = resolve_core_command(component_root, ("--root", str(tmp_path)))
    assert command == (
        sys.executable,
        str(component_root / "versions/0.1.0/sam_core.py"),
        "--root",
        str(tmp_path),
    )

    clean_root = tmp_path / "not-yet-versioned"
    fallback = resolve_core_command(clean_root, ("--root", str(tmp_path)))
    assert fallback[:4] == (sys.executable, "-m", "sam_ambient", "runtime")

    (component_root / "versions/0.1.0/sam_core.py").write_text("tampered\n", encoding="utf-8")
    with pytest.raises(UpdateError, match="artifact"):
        resolve_core_command(component_root, ())


def test_packaged_static_ui_is_loopback_only_and_rejects_traversal() -> None:
    async def scenario() -> None:
        with pytest.raises(ValueError, match="loopback"):
            StaticUiServer(host="0.0.0.0")
        server = StaticUiServer(port=0)
        await server.start()
        try:
            reader, writer = await asyncio.open_connection("127.0.0.1", server.port)
            writer.write(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
            await writer.drain()
            response = await reader.read()
            assert response.startswith(b"HTTP/1.1 200 OK")
            assert b'<div id="root"></div>' in response

            reader, writer = await asyncio.open_connection("127.0.0.1", server.port)
            writer.write(b"GET /..%2FREADME.md HTTP/1.1\r\nHost: localhost\r\n\r\n")
            await writer.drain()
            assert (await reader.read()).startswith(b"HTTP/1.1 404 Not Found")
        finally:
            await server.close()

    asyncio.run(scenario())


_WAVE_WRITER = """
import io
import sys
import wave
text = sys.stdin.read()
buffer = io.BytesIO()
with wave.open(buffer, 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(16000)
    output.writeframes(b'\\0\\0' * max(320, len(text)))
sys.stdout.buffer.write(buffer.getvalue())
"""


def test_system_tts_uses_structured_process_and_cancels_it() -> None:
    async def scenario() -> None:
        adapter = SystemTextToSpeech(
            (sys.executable, "-c", _WAVE_WRITER),
            backend_id="test-system-voice",
            audio_format=AudioFormat(),
        )
        frames = [
            frame
            async for frame in adapter.synthesize(
                "hello; this is data, not shell syntax",
                voice="default",
                language="en",
                cancellation=CancellationToken("tts-ok"),
            )
        ]
        assert frames and b"hello" not in b"".join(frame.data for frame in frames)

        slow = SystemTextToSpeech(
            (sys.executable, "-c", "import sys,time;sys.stdin.read();time.sleep(30)"),
            backend_id="slow-test-voice",
            audio_format=AudioFormat(),
        )
        token = CancellationToken("tts-cancel")

        async def consume() -> None:
            async for _frame in slow.synthesize(
                "stop",
                voice="default",
                language="en",
                cancellation=token,
            ):
                pass

        task = asyncio.create_task(consume())
        await asyncio.sleep(0.05)
        token.cancel("barge-in")
        with pytest.raises(OperationCancelled):
            await task
        assert not slow._processes
        await adapter.aclose()
        await slow.aclose()

    asyncio.run(scenario())


class _AnswerProvider(LLMProvider):
    id = "phase9-fake"
    data_boundary = DataBoundary.LOCAL

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        return [ModelInfo("fake", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model
        cancellation.raise_if_cancelled()
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "Hello from Sam.")
        yield ModelEvent(ModelEventKind.COMPLETED)


class _FakeTts:
    audio_format = AudioFormat(sample_rate_hz=1_000)

    async def synthesize(self, text, *, voice, language, cancellation):
        del text, voice, language
        cancellation.raise_if_cancelled()
        from sam_ambient.core.voice import AudioFrame

        yield AudioFrame(self.audio_format, b"\0\0" * 20, monotonic_ms=0, sequence=0)

    async def aclose(self) -> None:
        return None


class _FakeOutput:
    def __init__(self) -> None:
        self.frames = 0

    async def play(self, frames, cancellation) -> None:
        async for _frame in frames:
            cancellation.raise_if_cancelled()
            self.frames += 1


def test_runtime_streams_model_through_real_tts_boundary_and_persists_turn(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        output = _FakeOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=32)
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db"),
            events=events,
            tts=_FakeTts(),
            audio_output=output,
        )
        runtime.submit_user_message("Hello")
        seen = []
        while True:
            event = await asyncio.wait_for(subscription.get(), 2)
            seen.append(event)
            if (
                event.type is EventType.TRANSCRIPT_FINAL
                and event.payload.get("role") == "assistant"
            ):
                break
        await runtime.close()
        await subscription.close()
        assert output.frames == 1
        assert EventType.TTS_STARTED in {event.type for event in seen}
        assert EventType.TTS_COMPLETED in {event.type for event in seen}
        assert runtime.state is not None
        assert [message.role for message in runtime.state.recent()] == ["user", "assistant"]

    asyncio.run(scenario())


class _InterruptCapture:
    async def frames(self, cancellation):
        audio_format = AudioFormat(sample_rate_hz=1_000)
        for sequence, at_ms in enumerate((1_400, 1_600, 1_700, 1_720, 2_820)):
            cancellation.raise_if_cancelled()
            yield AudioFrame(audio_format, b"\0\0" * 20, at_ms, sequence)


class _InterruptVad:
    def analyze(self, frame: AudioFrame) -> VadResult:
        speech = frame.monotonic_ms < 1_720
        return VadResult(speech, 1.0 if speech else 0.0)


class _InterruptSttStream:
    def __init__(self, context: VoiceStreamContext, token: CancellationToken) -> None:
        self.context = context
        self.token = token

    async def push_audio(self, frame, cancellation) -> None:
        assert cancellation is self.token

    async def partial_transcript(self):
        return None

    async def finalize(self, cancellation):
        assert cancellation is self.token
        return Transcript("Please stop and listen.", True, 0.9)

    async def cancel(self, cancellation_id, reason="cancelled"):
        return (
            self.token.cancel(reason) if cancellation_id == self.context.cancellation_id else False
        )


class _InterruptStt:
    async def start_stream(self, context, cancellation):
        return _InterruptSttStream(context, cancellation)

    async def aclose(self) -> None:
        return None


def test_composed_voice_monitor_confirms_barge_in_and_commits_fresh_turn(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        events = EventBus()
        subscription = await events.subscribe(max_queue=64)
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(_InterruptCapture(), _InterruptVad(), _InterruptStt()),
        )
        manager = runtime.voice_turns
        manager.start_listening(0, turn_id="old-turn", cancellation_id="old-cancel")
        manager.on_vad(10, 1.0)
        manager.on_vad(210, 1.0)
        manager.on_vad(220, 0.0)
        manager.on_time(1_320)
        manager.on_model_started(1_330, generation_id="old-generation")
        old_token = runtime.cancellations.create("old-cancel")
        runtime.delivery.start_generation(
            turn_id="old-turn",
            generation_id="old-generation",
            cancellation_id="old-cancel",
        )
        runtime._active_generation_id = "old-generation"
        runtime._active_token = old_token

        response = asyncio.create_task(old_token.wait())
        committed = await runtime._monitor_barge_in(response)
        await response
        assert committed is not None
        transcript, candidate_token = committed
        assert transcript.text == "Please stop and listen."
        assert old_token.is_cancelled
        assert not candidate_token.is_cancelled
        assert manager.state.value == "COMMITTING"

        observed = []
        states = []
        while subscription.pending:
            event = await subscription.get()
            observed.append(event.type)
            if event.type == EventType.VOICE_STATE_CHANGED:
                states.append(event.payload.get("to"))
        assert EventType.MODEL_CANCELLED in observed
        assert EventType.TURN_COMMITTED in observed
        assert "INTERRUPTED" in states
        await runtime.close()
        await subscription.close()

    asyncio.run(scenario())
