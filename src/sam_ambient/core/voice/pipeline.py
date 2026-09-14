"""Event-driven microphone/VAD/STT orchestration for one user turn."""

from __future__ import annotations

import logging
import math
import sys
import time
from array import array
from collections import deque
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, replace

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationToken, TurnManager, VoiceState
from sam_ambient.core.voice.delivery import InterruptionCoordinator, InterruptionEffects
from sam_ambient.core.voice.interfaces import AudioInput, SpeechToText, VoiceActivityDetector
from sam_ambient.core.voice.models import AudioFrame, SampleFormat, Transcript, VoiceStreamContext

log = logging.getLogger(__name__)


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


@dataclass(frozen=True, slots=True)
class EndpointingPolicy:
    """Conservative evidence bounds layered above binary VAD output."""

    resume_frames: int = 5
    sparse_candidate_ms: int = 12_000
    recent_window_ms: int = 1_500
    minimum_overall_speech_ratio: float = 0.18
    minimum_recent_speech_ratio: float = 0.25


class SpeechEvidence:
    """Track bounded speech density and require credible endpoint resumption."""

    def __init__(self, policy: EndpointingPolicy | None = None) -> None:
        self.policy = policy or EndpointingPolicy()
        self.opened_ms: int | None = None
        self.speech_ms = 0.0
        self.total_ms = 0.0
        self.resume_run = 0
        self.recent: deque[tuple[int, float, bool]] = deque()

    def gate(self, state: VoiceState, speech_probability: float) -> float:
        speech = speech_probability >= 0.5
        if state is not VoiceState.ENDPOINT_CANDIDATE:
            self.resume_run = 0
            return speech_probability
        self.resume_run = self.resume_run + 1 if speech else 0
        return speech_probability if self.resume_run >= self.policy.resume_frames else 0.0

    def observe(self, frame: AudioFrame, speech_probability: float) -> None:
        if self.opened_ms is None:
            self.opened_ms = frame.monotonic_ms
        duration = frame.duration_ms
        speech = speech_probability >= 0.5
        self.total_ms += duration
        if speech:
            self.speech_ms += duration
        self.recent.append((frame.monotonic_ms, duration, speech))
        cutoff = frame.monotonic_ms - self.policy.recent_window_ms
        while self.recent and self.recent[0][0] < cutoff:
            self.recent.popleft()

    def sparse_too_long(self, at_ms: int) -> bool:
        if self.opened_ms is None or at_ms - self.opened_ms < self.policy.sparse_candidate_ms:
            return False
        recent_total = sum(item[1] for item in self.recent)
        recent_speech = sum(item[1] for item in self.recent if item[2])
        overall_ratio = self.speech_ms / max(1.0, self.total_ms)
        recent_ratio = recent_speech / max(1.0, recent_total)
        return (
            overall_ratio < self.policy.minimum_overall_speech_ratio
            and recent_ratio < self.policy.minimum_recent_speech_ratio
        )


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
        if self._turn_manager.state not in {
            VoiceState.IDLE,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }:
            raise RuntimeError("voice input pipeline must start from an inactive state")

        stt_stream = None
        candidate_since_ms: int | None = None
        final_transcript: Transcript | None = None
        last_partial: Transcript | None = None
        audio_frames = 0
        listening_started = False
        frame_stream = self._capture.frames(cancellation)
        # Retain only 200 ms before VAD opens STT, so initial consonants aren't clipped.
        pre_roll: deque[AudioFrame] = deque(maxlen=10)
        evidence = SpeechEvidence()
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
                    await self._publish(
                        ProtocolEvent(
                            type=EventType.COMPONENT_HEALTH,
                            monotonic_ms=frame.monotonic_ms,
                            session_id=self._turn_manager.session_id,
                            payload={
                                "component": "voice_input",
                                "state": "healthy",
                                "reason": "ready",
                                "retrying": False,
                            },
                        )
                    )
                audio_frames += 1
                if final_transcript is not None:
                    # Final STT may lower confidence and lengthen the remaining
                    # endpoint wait. Do not reopen or re-finalize its terminal stream.
                    time_events = self._turn_manager.on_time(frame.monotonic_ms)
                    await self._publish_all(time_events)
                    if any(event.type == EventType.TURN_COMMITTED for event in time_events):
                        return VoiceInputResult(final_transcript, audio_frames)
                    continue
                vad_result = self._vad.analyze(frame)
                await self._publish(self._level_event(frame, vad_result.speech_probability))
                gated_probability = evidence.gate(
                    self._turn_manager.state, vad_result.speech_probability
                )
                vad_events = self._turn_manager.on_vad(
                    frame.monotonic_ms,
                    gated_probability,
                )
                await self._publish_all(vad_events)
                if stt_stream is not None and self._turn_manager.state is VoiceState.LISTENING:
                    # A subminimum noise burst was rejected. Its audio must not
                    # accumulate across unrelated future bursts in the same STT stream.
                    return VoiceInputResult(Transcript("", is_final=True), audio_frames)
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
                elif stt_stream is not None and final_transcript is None:
                    await stt_stream.push_audio(frame, cancellation)
                if stt_stream is not None:
                    evidence.observe(frame, vad_result.speech_probability)
                    if evidence.sparse_too_long(frame.monotonic_ms):
                        log.info(
                            "Rejecting low-density voice candidate after %d ms",
                            frame.monotonic_ms
                            - (
                                evidence.opened_ms
                                if evidence.opened_ms is not None
                                else frame.monotonic_ms
                            ),
                        )
                        return VoiceInputResult(Transcript("", is_final=True), audio_frames)
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
                    log.info(
                        "conversation_timing stage=speech_endpoint_detected audio_ms=%d",
                        frame.monotonic_ms
                        - (
                            evidence.opened_ms
                            if evidence.opened_ms is not None
                            else frame.monotonic_ms
                        ),
                    )
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
                    stt_started = time.monotonic()
                    final_transcript = await stt_stream.finalize(cancellation)
                    log.info(
                        "conversation_timing stage=stt_final_available stt_ms=%d",
                        round((time.monotonic() - stt_started) * 1000),
                    )
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
