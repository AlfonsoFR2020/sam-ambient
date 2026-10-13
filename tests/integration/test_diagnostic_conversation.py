"""One paced synthetic noise/voice/typed/slow-provider/recovery journey, no hardware."""

import asyncio
import json
import struct
import time
from collections import deque

from sam_ambient.adapters.stt.whisper_cpp import SpeechRecognitionUnavailable
from sam_ambient.core.owner import OwnerConnection
from sam_ambient.core.protocol import ControlCommand, EventType
from sam_ambient.core.providers import ModelEvent, ModelEventKind
from sam_ambient.core.turns import VoiceState
from sam_ambient.core.voice import AudioFormat, AudioFrame, Transcript
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.integration.test_core_experience import Speech, Stt, Vad
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_phase9_packaging import _FakeOutput


class PacedCapture:
    def __init__(self):
        self.levels = deque()

    def feed(self, frames):
        self.levels.extend(frames)

    async def frames(self, token):
        sequence = 0
        while True:
            token.raise_if_cancelled()
            await asyncio.sleep(0.02)
            level = self.levels.popleft() if self.levels else 0
            yield AudioFrame(
                AudioFormat(),
                struct.pack("<h", level) * 320,
                time.monotonic_ns() // 1_000_000,
                sequence,
            )
            sequence += 1


class ScriptedStt(Stt):
    def __init__(self):
        super().__init__()
        self.text, self.partial, self.fail = "", "", False
        self.starts = 0

    async def start_stream(self, context, cancellation):
        stream = await super().start_stream(context, cancellation)
        self.starts += 1
        text, partial, fail = self.text, self.partial, self.fail

        async def result(token):
            await asyncio.sleep(0.06)
            token.raise_if_cancelled()
            if fail:
                raise SpeechRecognitionUnavailable("fixture STT failure")
            return Transcript(text, True, 0.99)

        async def interim():
            return Transcript(partial, False, 0.99)

        stream.finalize, stream.partial_transcript = result, interim
        return stream


class ControlledProvider(ConversationProvider):
    def __init__(self):
        super().__init__()
        self.started, self.release = asyncio.Event(), asyncio.Event()

    async def stream_chat(self, messages, tools, *, model, cancellation):
        self.contexts.append(list(messages))
        if messages[-1].content == "stubborn fixture":
            self.started.set()
            while not self.release.is_set():
                try:
                    await self.release.wait()
                except asyncio.CancelledError:
                    continue
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "retired late output")
            yield ModelEvent(ModelEventKind.COMPLETED)
            return
        await asyncio.sleep(0.03)
        cancellation.raise_if_cancelled()
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "## Complete **answer** with three words.")
        await asyncio.sleep(0.04)
        yield ModelEvent(ModelEventKind.COMPLETED)


class PacedOutput(_FakeOutput):
    def __init__(self):
        super().__init__()
        self.started = asyncio.Event()
        self.delay = 0.02

    async def play(self, frames, cancellation):
        async for _frame in frames:
            cancellation.raise_if_cancelled()
            self.frames += 1
            self.started.set()
            await asyncio.sleep(self.delay)


async def until(predicate):
    async with asyncio.timeout(4):
        while not predicate():  # noqa: ASYNC110 - bounded fixture condition, not runtime polling
            await asyncio.sleep(0.01)


def test_paced_noise_empty_stt_overlap_noncooperative_stream_and_typed_recovery(tmp_path):
    async def scenario():
        capture, stt, provider = PacedCapture(), ScriptedStt(), ControlledProvider()
        output = PacedOutput()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db"),
            voice=RuntimeVoiceAdapters(capture, Vad(), stt),
            tts=Speech(),
            audio_output=output,
        )
        events = []
        runtime.events.add_observer(events.append)
        connection = OwnerConnection(runtime.bridge.owner, "fixture")

        async def command(kind, identifier, payload=None):
            return await runtime.controls.dispatch(
                ControlCommand(
                    kind,
                    identifier,
                    runtime._next_event_ms(),
                    session_id=runtime.session_id,
                    payload=payload or {},
                ),
                owner_connection=connection,
            )

        async def typed(text, identifier):
            await command("control.user_message.submit", identifier, {"text": text})
            await asyncio.wait_for(runtime._active_done.wait(), 3)

        def committed():
            return [e for e in events if e.type == EventType.TURN_COMMITTED]

        await runtime.start()
        try:
            await typed("private typed one", "typed-one")
            await typed("private typed two", "typed-two")
            # A genuine voice turn through continuous paced capture and endpointing.
            stt.text = stt.partial = "private genuine voice"
            before = len(committed())
            capture.feed([1600] * 20 + [0] * 40)
            await until(lambda: len(committed()) > before)
            await until(lambda: runtime.active_generation_id is None)
            await until(lambda: not capture.levels)
            stt.text = stt.partial = "private second voice"
            before = len(committed())
            capture.feed([1600] * 12 + [0] * 3 + [1600] * 12 + [0] * 40)
            await until(lambda: len(committed()) > before)
            await until(lambda: runtime.active_generation_id is None)
            await until(lambda: not capture.levels)
            assert runtime.trace.oscillations >= 1
            # Subminimum ambient bursts do not become committed owner text.
            stt.text = stt.partial = ""
            before = len(committed())
            capture.feed([1600] * 2 + [0] * 20)
            await until(lambda: not capture.levels)
            assert len(committed()) == before
            # A plausible partial is superseded by a final no-speech decision.
            stt.partial = "hallucination-like private candidate"
            stt.text = ""
            before_starts = stt.starts
            capture.feed([1600] * 20 + [0] * 40)
            await until(lambda: stt.starts > before_starts)
            await until(lambda: not capture.levels)
            assert len(committed()) == before
            # Queue exhaustion is not endpoint completion. Keep continuous silence
            # until the actual no-speech operation has retired before changing plans.
            await until(lambda: runtime.voice_turns.state == VoiceState.LISTENING)
            stt.fail = True
            capture.feed([1600] * 20 + [0] * 40)
            await until(lambda: runtime._voice_task is not None and runtime._voice_task.done())
            assert len(committed()) == before
            await typed("private typed recovery after STT failure", "typed-stt-recovery")
            stt.fail = False
            capture.levels.clear()
            await command("control.microphone.set", "resume-mic", {"enabled": True})
            # Playback overlap/no meaningful STT must not cancel typed inference.
            stt.partial = stt.text = ""
            capture.feed([1600] * 2 + [0] * 20)
            await typed("private typed with nearby noise", "typed-noise")
            await until(lambda: not capture.levels)
            # Actual synthetic playback overlaps paced speaker-like microphone PCM.
            stt.text = stt.partial = "Complete answer with three words."
            output.delay = 0.1
            output.started.clear()
            before = len(committed())
            before_users = sum(
                e.type == EventType.TRANSCRIPT_FINAL and e.payload.get("role") == "user"
                for e in events
            )
            await command(
                "control.user_message.submit",
                "echo-overlap",
                {"text": "private echo overlap fixture"},
            )
            await until(output.started.is_set)
            capture.feed([1600] * 20 + [0] * 40)
            await until(lambda: not capture.levels)
            await until(lambda: runtime.active_generation_id is None)
            assert len(committed()) == before  # No voice commitment from copied playback.
            assert (
                sum(
                    e.type == EventType.TRANSCRIPT_FINAL and e.payload.get("role") == "user"
                    for e in events
                )
                == before_users + 1
            )
            output.delay = 0.02
            stt.text = stt.partial = ""
            await command("control.user_message.submit", "slow", {"text": "stubborn fixture"})
            await provider.started.wait()
            await asyncio.sleep(0.08)
            assert runtime.trace.snapshot()["longest_inference_ms"] >= 50
            await command("control.emergency_stop", "stop")
            await typed("private typed recovery", "typed-recovery")
            provider.release.set()
            await until(lambda: all(task.done() for task in runtime._tasks))
            assert runtime.active_generation_id is None
            assert not any(
                e.type == EventType.TRANSCRIPT_FINAL
                and e.payload.get("text") == "retired late output"
                for e in events
            )
            assert any(e.type == EventType.MODEL_CANCELLED for e in events)
            assert any(e.type == EventType.TTS_COMPLETED for e in events)
        finally:
            provider.release.set()
            await runtime.close()
        history = json.dumps(list(runtime.trace.history))
        assert "private" not in history and "hallucination-like" not in history
        assert runtime.trace.snapshot()["longest_stt_ms"] >= 40
        assert runtime.trace.snapshot()["nonterminal"] == 0, list(runtime.trace.pending.items())
        summary = next(
            record for record in runtime.trace.history if record["stage"] == "conversation.summary"
        )
        print("Synthetic conversation aggregate:", json.dumps(summary, sort_keys=True))
        assert (
            not summary["active_generation"]
            and not summary["active_delivery"]
            and not summary["tasks"]
        )

    asyncio.run(scenario())
