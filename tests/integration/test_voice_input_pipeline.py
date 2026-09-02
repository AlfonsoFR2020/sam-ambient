import asyncio
from collections.abc import AsyncIterator

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationToken, TurnManager, VoiceState
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    Transcript,
    VadResult,
    VoiceInputPipeline,
)


class FakeCapture:
    def __init__(self, frames: list[AudioFrame]) -> None:
        self._frames = frames

    async def frames(self, cancellation: CancellationToken) -> AsyncIterator[AudioFrame]:
        for frame in self._frames:
            cancellation.raise_if_cancelled()
            yield frame


class SequenceVad:
    def analyze(self, frame: AudioFrame) -> VadResult:
        is_speech = frame.sequence == 1
        return VadResult(is_speech, 1.0 if is_speech else 0.0)


class FakeSttStream:
    def __init__(self, context, token: CancellationToken) -> None:
        self.context = context
        self._token = token
        self.pushed = 0

    async def push_audio(self, _frame, cancellation: CancellationToken) -> None:
        assert cancellation is self._token
        self.pushed += 1

    async def partial_transcript(self) -> Transcript | None:
        if self.pushed >= 2:
            return Transcript("What time", is_final=False, confidence=0.8)
        return None

    async def finalize(self, cancellation: CancellationToken) -> Transcript:
        assert cancellation is self._token
        return Transcript("What time is it?", is_final=True, confidence=None)

    async def cancel(self, cancellation_id: str, reason: str = "cancelled") -> bool:
        return (
            self._token.cancel(reason) if cancellation_id == self.context.cancellation_id else False
        )


class FakeStt:
    def __init__(self) -> None:
        self.stream: FakeSttStream | None = None

    async def start_stream(self, context, cancellation: CancellationToken) -> FakeSttStream:
        self.stream = FakeSttStream(context, cancellation)
        return self.stream

    async def aclose(self) -> None:
        return None


def test_voice_input_pipeline_emits_levels_transcript_and_committed_turn() -> None:
    async def scenario() -> None:
        audio_format = AudioFormat(sample_rate_hz=1_000)
        times = [0, 20, 220, 620, 1_020, 1_320]
        frames = [
            AudioFrame(
                audio_format,
                b"\0" * 40,
                monotonic_ms=at_ms,
                sequence=index,
            )
            for index, at_ms in enumerate(times)
        ]
        manager = TurnManager("session", id_factory=iter(("turn",)).__next__)
        stt = FakeStt()
        events: list[ProtocolEvent] = []

        async def publish(event: ProtocolEvent) -> None:
            events.append(event)

        pipeline = VoiceInputPipeline(
            capture=FakeCapture(frames),
            vad=SequenceVad(),
            stt=stt,
            turn_manager=manager,
            publish=publish,
        )
        result = await pipeline.run(CancellationToken("voice-cancel"))

        assert result.transcript.text == "What time is it?"
        assert result.audio_frames == len(frames)
        assert manager.state is VoiceState.COMMITTING
        assert stt.stream is not None and stt.stream.pushed == len(frames)
        assert sum(event.type == EventType.VOICE_LEVEL for event in events) == len(frames)
        first_level = next(event for event in events if event.type == EventType.VOICE_LEVEL)
        assert first_level.payload["rms"] == 0.0
        assert first_level.payload["peak"] == 0.0
        assert first_level.payload["speech_probability"] == 0.0
        transcript_index = next(
            index for index, event in enumerate(events) if event.type == EventType.TRANSCRIPT_FINAL
        )
        partial_index = next(
            index
            for index, event in enumerate(events)
            if event.type == EventType.TRANSCRIPT_PARTIAL
        )
        commit_index = next(
            index for index, event in enumerate(events) if event.type == EventType.TURN_COMMITTED
        )
        assert partial_index < transcript_index < commit_index
        committed = events[commit_index]
        assert committed.payload["text"] == "What time is it?"
        assert committed.cancellation_id == "voice-cancel"

    asyncio.run(scenario())
