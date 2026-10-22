"""Utterance framing and stale recognition without devices or an STT engine."""

import asyncio
from dataclasses import replace

import pytest

from sam_ambient.core.protocol import EventType
from sam_ambient.core.turns import CancellationToken, OperationCancelled, TurnManager
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    Transcript,
    VadResult,
    VoiceInputPipeline,
)
from tests.integration.test_voice_input_pipeline import (
    FakeCapture,
    FinalOnlyStt,
    FinalOnlySttStream,
)


class TimelineVad:
    def analyze(self, frame):
        speech = 300 <= frame.monotonic_ms < 600 or 850 <= frame.monotonic_ms < 1150
        return VadResult(speech, 0.75 if speech else 0.0)


class RecordingStream(FinalOnlySttStream):
    def __init__(self, context, token, fault=None):
        super().__init__(context, token, "Una pregunta completa.")
        self.frames = []
        self.fault = fault
        self.polled = False

    async def push_audio(self, frame, cancellation):
        self.frames.append(frame)

    async def partial_transcript(self):
        if self.fault == "late-partial":
            self._token.cancel("retired_utterance")
            return Transcript("stale partial", False)
        if self.fault == "early-final" and not self.polled:
            self.polled = True
            return Transcript("provisional evidence", True, 0.9)
        return None

    async def finalize(self, cancellation):
        self.finalizations += 1
        if self.fault == "late-final":
            cancellation.cancel("retired_utterance")
        return Transcript(self._text, self.fault != "provisional-final", 0.9)


class RecordingStt(FinalOnlyStt):
    def __init__(self, fault=None):
        super().__init__("unused")
        self.fault = fault

    async def start_stream(self, context, cancellation):
        if self.fault == "wrong-context":
            context = replace(context, turn_id="retired-turn")
        self.stream = RecordingStream(context, cancellation, self.fault)
        return self.stream


async def run_pipeline(duration=20, fault=None):
    audio_format = AudioFormat()
    frames = [
        AudioFrame(audio_format, b"\x01\0" * audio_format.samples_for_ms(duration), at, index)
        for index, at in enumerate(range(0, 2800, duration))
    ]
    events, stt = [], RecordingStt(fault)

    async def publish(event):
        events.append(event)

    pipeline = VoiceInputPipeline(
        capture=FakeCapture(frames),
        vad=TimelineVad(),
        stt=stt,
        turn_manager=TurnManager("fixture-session"),
        publish=publish,
        language="es",
    )
    return pipeline, stt, events


@pytest.mark.parametrize("duration", [10, 20, 30])
def test_preroll_is_duration_bounded_and_paused_utterance_has_no_missing_or_duplicate_pcm(duration):
    async def scenario():
        pipeline, stt, events = await run_pipeline(duration)
        result = await pipeline.run(CancellationToken())
        assert result.transcript.text == "Una pregunta completa."
        assert stt.stream is not None
        frames = stt.stream.frames
        onset = next(frame for frame in frames if TimelineVad().analyze(frame).is_speech)
        lead_ms = onset.monotonic_ms - frames[0].monotonic_ms
        assert 200 - 2 * duration <= lead_ms <= 200
        sequences = [frame.sequence for frame in frames]
        assert sequences == list(range(sequences[0], sequences[-1] + 1))
        assert any(850 <= frame.monotonic_ms < 1150 for frame in frames)
        assert sum(event.type is EventType.TURN_COMMITTED for event in events) == 1
        assert stt.stream.finalizations == 1

    asyncio.run(scenario())


@pytest.mark.parametrize("fault", ["late-partial", "late-final"])
def test_late_cancelled_recognition_cannot_publish_or_commit(fault):
    async def scenario():
        pipeline, stt, events = await run_pipeline(fault=fault)
        with pytest.raises(OperationCancelled):
            await pipeline.run(CancellationToken())
        assert not any(
            event.type
            in {EventType.TRANSCRIPT_FINAL, EventType.TRANSCRIPT_PARTIAL, EventType.TURN_COMMITTED}
            for event in events
        )
        assert stt.stream is not None and stt.stream.cancellations == 1

    asyncio.run(scenario())


def test_stream_from_another_utterance_cannot_receive_pcm():
    async def scenario():
        pipeline, stt, events = await run_pipeline(fault="wrong-context")
        with pytest.raises(RuntimeError, match="context"):
            await pipeline.run(CancellationToken())
        assert stt.stream is not None and stt.stream.frames == []
        assert not any(event.type is EventType.TURN_COMMITTED for event in events)

    asyncio.run(scenario())


def test_polling_an_early_final_still_publishes_provisional_evidence_until_finalize():
    async def scenario():
        pipeline, _, events = await run_pipeline(fault="early-final")
        await pipeline.run(CancellationToken())
        finals = [event for event in events if event.type is EventType.TRANSCRIPT_FINAL]
        assert len(finals) == 1 and finals[0].payload["text"] == "Una pregunta completa."

    asyncio.run(scenario())


def test_finalize_cannot_commit_a_result_still_marked_provisional():
    async def scenario():
        pipeline, _, events = await run_pipeline(fault="provisional-final")
        with pytest.raises(RuntimeError, match="final"):
            await pipeline.run(CancellationToken())
        assert not any(event.type is EventType.TURN_COMMITTED for event in events)

    asyncio.run(scenario())
