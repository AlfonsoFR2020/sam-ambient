"""Event-driven microphone/VAD/STT orchestration for one user turn."""

from __future__ import annotations

import math
import sys
from array import array
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationToken, TurnManager, VoiceState
from sam_ambient.core.voice.delivery import InterruptionCoordinator, InterruptionEffects
from sam_ambient.core.voice.interfaces import AudioInput, SpeechToText, VoiceActivityDetector
from sam_ambient.core.voice.models import AudioFrame, SampleFormat, Transcript, VoiceStreamContext


class VoicePipelineEnded(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class VoiceInputResult:
    transcript: Transcript
    audio_frames: int


@dataclass(frozen=True, slots=True)
class BargeInResult:
    events: tuple[ProtocolEvent, ...]
    effects: InterruptionEffects


EventPublisher = Callable[[ProtocolEvent], Awaitable[None]]


class BargeInController:
    """Turn continuous VAD/STT evidence into authoritative interruption effects."""

    _ACTIVE_STATES = frozenset(
        {
            VoiceState.THINKING,
            VoiceState.SPEAKING,
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.RECOVERING,
        }
    )

    def __init__(
        self,
        *,
        vad: VoiceActivityDetector,
        turn_manager: TurnManager,
        interruptions: InterruptionCoordinator,
        publish: EventPublisher,
    ) -> None:
        self._vad = vad
        self._turn_manager = turn_manager
        self._interruptions = interruptions
        self._publish = publish

    async def process_audio_frame(self, frame: AudioFrame) -> BargeInResult:
        if self._turn_manager.state not in self._ACTIVE_STATES:
            raise RuntimeError(f"barge-in controller is inactive in {self._turn_manager.state}")
        vad = self._vad.analyze(frame)
        events = self._turn_manager.on_vad(frame.monotonic_ms, vad.speech_probability)
        events += self._turn_manager.on_time(frame.monotonic_ms)
        return await self._apply_and_publish(events)

    async def process_transcript(
        self,
        at_ms: int,
        transcript: Transcript,
        *,
        cancellation_id: str,
    ) -> BargeInResult:
        if cancellation_id != self._turn_manager.candidate_cancellation_id:
            return await self._apply_and_publish(())
        if self._turn_manager.state not in {
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.RECOVERING,
        }:
            raise RuntimeError("candidate transcript received without an interruption candidate")
        confidence = transcript.confidence if transcript.confidence is not None else 0.5
        events = self._turn_manager.on_transcript(
            at_ms,
            transcript.text,
            is_final=transcript.is_final,
            confidence=confidence,
        )
        return await self._apply_and_publish(events)

    async def _apply_and_publish(
        self,
        events: tuple[ProtocolEvent, ...],
    ) -> BargeInResult:
        # Apply cancellation before any subscriber backpressure can delay audio stop.
        effects = self._interruptions.apply(events)
        if effects.delivery is not None:
            delivery = effects.delivery
            events = tuple(
                replace(
                    event,
                    payload={
                        **event.payload,
                        "spoken_text": delivery.spoken_text,
                        "unspoken_text": delivery.unspoken_text,
                    },
                )
                if event.type == EventType.TTS_CANCELLED
                and event.generation_id == delivery.generation_id
                else event
                for event in events
            )
        for event in events:
            await self._publish(event)
        return BargeInResult(events=events, effects=effects)


class VoiceInputPipeline:
    """Capture exactly one committed user turn while publishing protocol events."""

    def __init__(
        self,
        *,
        capture: AudioInput,
        vad: VoiceActivityDetector,
        stt: SpeechToText,
        turn_manager: TurnManager,
        publish: EventPublisher,
        language: str = "auto",
        unknown_confidence: float = 0.5,
    ) -> None:
        if not language.strip():
            raise ValueError("language must be non-blank")
        if not 0.0 <= unknown_confidence <= 1.0:
            raise ValueError("unknown_confidence must be between 0 and 1")
        self._capture = capture
        self._vad = vad
        self._stt = stt
        self._turn_manager = turn_manager
        self._publish = publish
        self._language = language
        self._unknown_confidence = unknown_confidence

    async def run(self, cancellation: CancellationToken) -> VoiceInputResult:
        if self._turn_manager.state is not VoiceState.IDLE:
            raise RuntimeError("voice input pipeline must start from IDLE")

        stt_stream = None
        candidate_since_ms: int | None = None
        final_transcript: Transcript | None = None
        last_partial: Transcript | None = None
        audio_frames = 0
        listening_started = False
        frame_stream = self._capture.frames(cancellation)
        # Retain only 200 ms before VAD opens STT, so initial consonants aren't clipped.
        pre_roll: deque[AudioFrame] = deque(maxlen=10)
        try:
            async for frame in frame_stream:
                if not listening_started:
                    await self._publish_all(
                        self._turn_manager.start_listening(
                            frame.monotonic_ms,
                            cancellation_id=cancellation.cancellation_id,
                        )
                    )
                    listening_started = True
                audio_frames += 1
                vad_result = self._vad.analyze(frame)
                await self._publish(self._level_event(frame, vad_result.speech_probability))
                vad_events = self._turn_manager.on_vad(
                    frame.monotonic_ms,
                    vad_result.speech_probability,
                )
                await self._publish_all(vad_events)
                if stt_stream is None:
                    pre_roll.append(frame)
                if stt_stream is None and self._turn_manager.state is VoiceState.USER_SPEAKING:
                    context = VoiceStreamContext(
                        session_id=self._turn_manager.session_id,
                        turn_id=self._require_id(self._turn_manager.turn_id, "turn_id"),
                        cancellation_id=cancellation.cancellation_id,
                        language=self._language,
                    )
                    stt_stream = await self._stt.start_stream(context, cancellation)
                    for buffered in pre_roll:
                        await stt_stream.push_audio(buffered, cancellation)
                    pre_roll.clear()
                elif stt_stream is not None:
                    await stt_stream.push_audio(frame, cancellation)
                if self._turn_manager.state is VoiceState.ENDPOINT_CANDIDATE:
                    if candidate_since_ms is None:
                        candidate_since_ms = frame.monotonic_ms
                else:
                    candidate_since_ms = None

                partial = await stt_stream.partial_transcript() if stt_stream is not None else None
                if partial is not None and partial != last_partial:
                    await self._publish_transcript(frame.monotonic_ms, partial)
                    last_partial = partial

                if stt_stream is not None and self._should_finalize(
                    frame.monotonic_ms, candidate_since_ms
                ):
                    await self._publish(
                        ProtocolEvent(
                            type=EventType.VOICE_STATE_CHANGED,
                            monotonic_ms=frame.monotonic_ms,
                            session_id=self._turn_manager.session_id,
                            turn_id=self._turn_manager.turn_id,
                            cancellation_id=cancellation.cancellation_id,
                            payload={
                                "from": "ENDPOINT_CANDIDATE",
                                "to": "ENDPOINT_CANDIDATE",
                                "reason": "stt_finalizing",
                            },
                        )
                    )
                    final_transcript = await stt_stream.finalize(cancellation)
                    if final_transcript != last_partial:
                        await self._publish_transcript(frame.monotonic_ms, final_transcript)
                        last_partial = final_transcript

                time_events = self._turn_manager.on_time(frame.monotonic_ms)
                await self._publish_all(time_events)
                if any(event.type == EventType.TURN_COMMITTED for event in time_events):
                    if final_transcript is None and stt_stream is not None:
                        final_transcript = await stt_stream.finalize(cancellation)
                    if final_transcript is None:
                        raise VoicePipelineEnded("speech committed without an STT stream")
                    return VoiceInputResult(final_transcript, audio_frames)
        finally:
            try:
                close_frames = getattr(frame_stream, "aclose", None)
                if close_frames is not None:
                    await close_frames()
            finally:
                if stt_stream is not None and final_transcript is None:
                    await stt_stream.cancel(
                        cancellation.cancellation_id,
                        "voice_pipeline_stopped",
                    )
        raise VoicePipelineEnded("audio input ended before a user turn was committed")

    def _should_finalize(self, at_ms: int, candidate_since_ms: int | None) -> bool:
        if candidate_since_ms is None:
            return False
        return at_ms - candidate_since_ms >= self._turn_manager.endpoint_threshold_ms

    async def _publish_transcript(self, at_ms: int, transcript: Transcript) -> None:
        confidence = (
            transcript.confidence if transcript.confidence is not None else self._unknown_confidence
        )
        await self._publish_all(
            self._turn_manager.on_transcript(
                at_ms,
                transcript.text,
                is_final=transcript.is_final,
                confidence=confidence,
            )
        )

    async def _publish_all(self, events: tuple[ProtocolEvent, ...]) -> None:
        for event in events:
            await self._publish(event)

    def _level_event(self, frame: AudioFrame, speech_probability: float) -> ProtocolEvent:
        rms, peak = normalized_audio_metrics(frame)
        return ProtocolEvent(
            type=EventType.VOICE_LEVEL,
            monotonic_ms=frame.monotonic_ms,
            session_id=self._turn_manager.session_id,
            turn_id=self._turn_manager.turn_id,
            cancellation_id=self._turn_manager.cancellation_id,
            payload={
                "level": rms,
                "rms": rms,
                "peak": peak,
                "speech_probability": speech_probability,
                "sequence": frame.sequence,
                "dropped_before": frame.dropped_before,
            },
        )

    @staticmethod
    def _require_id(value: str | None, name: str) -> str:
        if value is None:
            raise RuntimeError(f"turn manager did not assign {name}")
        return value


def normalized_audio_level(frame: AudioFrame) -> float:
    """Return an RMS level in [0, 1] for supported PCM frame formats."""

    return normalized_audio_metrics(frame)[0]


def normalized_audio_metrics(frame: AudioFrame) -> tuple[float, float]:
    """Return normalized RMS and peak without exporting raw microphone audio."""

    if frame.format.channels != 1:
        raise ValueError("audio level currently requires mono PCM")
    if frame.format.sample_format is SampleFormat.PCM_S16LE:
        samples = array("h")
        samples.frombytes(frame.data)
        if sys.byteorder != "little":
            samples.byteswap()
        scale = 32_768.0
    elif frame.format.sample_format is SampleFormat.PCM_F32LE:
        samples = array("f")
        samples.frombytes(frame.data)
        if sys.byteorder != "little":
            samples.byteswap()
        scale = 1.0
    else:  # pragma: no cover - SampleFormat is exhaustive
        raise ValueError("unsupported sample format")
    mean_square = sum(float(sample) ** 2 for sample in samples) / len(samples)
    rms = min(1.0, math.sqrt(mean_square) / scale)
    peak = min(1.0, max(abs(float(sample)) for sample in samples) / scale)
    return rms, peak
