"""PCM-only fake output; no PortAudio, synthesis subprocess, network or audio device."""

import asyncio
from array import array

from sam_ambient.core.protocol import EventType
from sam_ambient.core.voice import AudioFrame
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_phase9_packaging import _AnswerProvider, _FakeTts


class BufferedSpeech(_FakeTts):
    frame_count = 180

    async def synthesize(self, text, *, voice, language, cancellation):
        # Simulate fully precomputed synthesis. Silence and quieter syllables
        # remain measured PCM, not a visual speaking-state oscillator.
        for sequence in range(self.frame_count):
            cancellation.raise_if_cancelled()
            level = 0 if 60 <= sequence < 90 else 700 if sequence >= 90 else 4_000
            yield AudioFrame(
                self.audio_format, array("h", [level] * 20).tobytes(), sequence * 20, sequence
            )


class ObservedOutput:
    def __init__(self):
        self.queued = asyncio.Event()
        self.release = asyncio.Event()
        self.draining = asyncio.Event()
        self.finish = asyncio.Event()
        self.observer = None
        self.last_frame = None

    async def play(self, frames, cancellation, *, on_frame=None):
        self.observer = on_frame
        async for frame in frames:
            self.queued.set()
            await self.release.wait()
            cancellation.raise_if_cancelled()
            self.last_frame = frame
            if on_frame:
                await on_frame(frame)
            await asyncio.sleep(0)
        self.draining.set()
        await self.finish.wait()
        cancellation.raise_if_cancelled()


def test_synthesis_wait_delivery_silence_drain_and_late_observation(tmp_path):
    async def scenario():
        output = ObservedOutput()
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            tts=BufferedSpeech(),
            audio_output=output,
        )
        seen = []
        runtime.events.add_observer(seen.append)
        try:
            runtime.submit_user_message("A long pre-buffered answer")
            await asyncio.wait_for(output.queued.wait(), 2)
            assert any(event.type == EventType.MODEL_COMPLETED for event in seen)
            assert not any(event.type == EventType.TTS_LEVEL for event in seen)
            generation = runtime._active_generation_id
            assert generation is not None
            assert runtime._active_playback_generation_id == generation
            output.release.set()
            await asyncio.wait_for(output.draining.wait(), 2)
            levels = [event for event in seen if event.type == EventType.TTS_LEVEL]
            assert len(levels) == 180
            assert all(event.generation_id == generation for event in levels)
            assert all(event.payload["source"] == "playback_write" for event in levels)
            assert [event.payload["sequence"] for event in levels] == list(range(180))
            assert levels[0].payload["envelope"] > levels[-1].payload["envelope"] > 0
            assert all(event.payload["envelope"] == 0 for event in levels[60:90])
            assert not any(event.type == EventType.TTS_COMPLETED for event in seen)
            output.finish.set()
            await asyncio.wait_for(asyncio.gather(*tuple(runtime._tasks)), 2)
            assert any(event.type == EventType.TTS_COMPLETED for event in seen)
            assert runtime._active_playback_generation_id is None
            await output.observer(output.last_frame)
            assert sum(event.type == EventType.TTS_LEVEL for event in seen) == 180
        finally:
            output.release.set()
            output.finish.set()
            await runtime.close()

    asyncio.run(scenario())


def test_cancelled_delivery_ignores_retained_observer_and_keeps_completed_text(tmp_path):
    async def scenario():
        output = ObservedOutput()
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            tts=BufferedSpeech(),
            audio_output=output,
        )
        seen = []
        runtime.events.add_observer(seen.append)
        try:
            runtime.submit_user_message("Stop before playback")
            await asyncio.wait_for(output.queued.wait(), 2)
            generation = runtime._active_generation_id
            await runtime._cancel_active_playback("owner_stop_speaking")
            await output.observer(AudioFrame(BufferedSpeech.audio_format, b"\1\0" * 20, 0, 0))
            assert not any(event.type == EventType.TTS_LEVEL for event in seen)
            assert any(
                event.type == EventType.MODEL_COMPLETED and event.generation_id == generation
                for event in seen
            )
            assert not any(event.type == EventType.MODEL_CANCELLED for event in seen)
        finally:
            output.release.set()
            output.finish.set()
            await runtime.close()

    asyncio.run(scenario())
