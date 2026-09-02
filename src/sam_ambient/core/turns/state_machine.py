"""Deterministic multi-signal conversational turn state machine."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from uuid import uuid4

from sam_ambient.core.protocol import EventType, ProtocolEvent


class VoiceState(StrEnum):
    IDLE = "IDLE"
    LISTENING = "LISTENING"
    USER_SPEAKING = "USER_SPEAKING"
    ENDPOINT_CANDIDATE = "ENDPOINT_CANDIDATE"
    COMMITTING = "COMMITTING"
    THINKING = "THINKING"
    SPEAKING = "SPEAKING"
    INTERRUPTION_CANDIDATE = "INTERRUPTION_CANDIDATE"
    INTERRUPTED = "INTERRUPTED"
    RECOVERING = "RECOVERING"
    ERROR = "ERROR"
    OFFLINE = "OFFLINE"


class InterruptionMode(StrEnum):
    AGGRESSIVE = "aggressive"
    BALANCED = "balanced"
    CONSERVATIVE = "conservative"


@dataclass(frozen=True, slots=True)
class TurnConfig:
    min_speech_ms: int = 180
    tentative_endpoint_silence_ms: int = 350
    normal_endpoint_silence_ms: int = 650
    uncertain_endpoint_silence_ms: int = 1100
    max_endpoint_wait_ms: int = 1800
    min_interrupt_speech_ms: int = 180
    false_interrupt_recovery_ms: int = 900
    vad_speech_probability: float = 0.5
    interruption_mode: InterruptionMode = InterruptionMode.BALANCED

    def __post_init__(self) -> None:
        durations = (
            self.min_speech_ms,
            self.tentative_endpoint_silence_ms,
            self.normal_endpoint_silence_ms,
            self.uncertain_endpoint_silence_ms,
            self.max_endpoint_wait_ms,
            self.min_interrupt_speech_ms,
            self.false_interrupt_recovery_ms,
        )
        if any(not isinstance(value, int) or isinstance(value, bool) for value in durations):
            raise TypeError("turn timing values must be integers")
        if any(value < 0 for value in durations):
            raise ValueError("turn timing values must be non-negative")
        if not 0.0 <= self.vad_speech_probability <= 1.0:
            raise ValueError("vad_speech_probability must be between 0 and 1")
        if self.max_endpoint_wait_ms < self.uncertain_endpoint_silence_ms:
            raise ValueError("max_endpoint_wait_ms must cover the uncertain endpoint threshold")
        if not isinstance(self.interruption_mode, InterruptionMode):
            raise TypeError("interruption_mode must be an InterruptionMode")

    @property
    def interrupt_threshold_ms(self) -> int:
        multipliers = {
            InterruptionMode.AGGRESSIVE: 0.6,
            InterruptionMode.BALANCED: 1.0,
            InterruptionMode.CONSERVATIVE: 1.6,
        }
        return max(1, round(self.min_interrupt_speech_ms * multipliers[self.interruption_mode]))


_ALLOWED_TRANSITIONS: dict[VoiceState, frozenset[VoiceState]] = {
    VoiceState.IDLE: frozenset({VoiceState.LISTENING, VoiceState.ERROR, VoiceState.OFFLINE}),
    VoiceState.LISTENING: frozenset(
        {VoiceState.IDLE, VoiceState.USER_SPEAKING, VoiceState.ERROR, VoiceState.OFFLINE}
    ),
    VoiceState.USER_SPEAKING: frozenset(
        {
            VoiceState.LISTENING,
            VoiceState.ENDPOINT_CANDIDATE,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }
    ),
    VoiceState.ENDPOINT_CANDIDATE: frozenset(
        {VoiceState.USER_SPEAKING, VoiceState.COMMITTING, VoiceState.ERROR, VoiceState.OFFLINE}
    ),
    VoiceState.COMMITTING: frozenset({VoiceState.THINKING, VoiceState.ERROR, VoiceState.OFFLINE}),
    VoiceState.THINKING: frozenset(
        {
            VoiceState.SPEAKING,
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.INTERRUPTED,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }
    ),
    VoiceState.SPEAKING: frozenset(
        {
            VoiceState.IDLE,
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }
    ),
    VoiceState.INTERRUPTION_CANDIDATE: frozenset(
        {
            VoiceState.USER_SPEAKING,
            VoiceState.INTERRUPTED,
            VoiceState.RECOVERING,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }
    ),
    VoiceState.INTERRUPTED: frozenset(
        {VoiceState.USER_SPEAKING, VoiceState.LISTENING, VoiceState.ERROR, VoiceState.OFFLINE}
    ),
    VoiceState.RECOVERING: frozenset(
        {
            VoiceState.SPEAKING,
            VoiceState.THINKING,
            VoiceState.IDLE,
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.INTERRUPTED,
            VoiceState.ERROR,
            VoiceState.OFFLINE,
        }
    ),
    VoiceState.ERROR: frozenset({VoiceState.IDLE, VoiceState.LISTENING, VoiceState.OFFLINE}),
    VoiceState.OFFLINE: frozenset({VoiceState.IDLE, VoiceState.LISTENING, VoiceState.ERROR}),
}

_BACKCHANNELS = frozenset(
    {
        "ah",
        "cough",
        "hmm",
        "laughter",
        "mhm",
        "mm",
        "mm hm",
        "mm hmm",
        "mm-hm",
        "mm-hmm",
        "uh huh",
        "uh-huh",
        "throat clearing",
        "yeah",
    }
)


class TurnManager:
    """Pure timestamp-driven orchestration for endpointing and interruption."""

    def __init__(
        self,
        session_id: str,
        *,
        config: TurnConfig | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        if not session_id.strip():
            raise ValueError("session_id must be non-blank")
        self.session_id = session_id
        self.config = config or TurnConfig()
        self.state = VoiceState.IDLE
        self.turn_id: str | None = None
        self.generation_id: str | None = None
        self.cancellation_id: str | None = None
        self.transcript = ""
        self.transcript_final = False
        self.transcript_confidence = 0.0
        self._id_factory = id_factory or (lambda: str(uuid4()))
        self._last_ms = -1
        self._speech_started_ms: int | None = None
        self._speech_accumulated_ms = 0
        self._silence_started_ms: int | None = None
        self._vad_active = False
        self._interruption_speech_started_ms: int | None = None
        self._interruption_speech_accumulated_ms = 0
        self._recovery_started_ms: int | None = None
        self._candidate_origin_state: VoiceState | None = None
        self._candidate_turn_id: str | None = None
        self._candidate_cancellation_id: str | None = None
        self._candidate_transcript = ""
        self._candidate_transcript_final = False
        self._candidate_transcript_confidence = 0.0
        self._model_active = False
        self._tts_active = False

    def start_listening(
        self,
        at_ms: int,
        *,
        turn_id: str | None = None,
        cancellation_id: str | None = None,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if self.state not in {VoiceState.IDLE, VoiceState.ERROR, VoiceState.OFFLINE}:
            raise RuntimeError(f"cannot start listening from {self.state}")
        self.turn_id = turn_id or self._id_factory()
        self.cancellation_id = cancellation_id or self._id_factory()
        self.generation_id = None
        self._model_active = False
        self._tts_active = False
        self._reset_observation()
        return (self._transition(VoiceState.LISTENING, at_ms, "listening_started"),)

    def on_vad(self, at_ms: int, speech_probability: float) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if not 0.0 <= speech_probability <= 1.0:
            raise ValueError("speech_probability must be between 0 and 1")
        is_speech = speech_probability >= self.config.vad_speech_probability
        events = [
            self._event(
                EventType.VOICE_VAD,
                at_ms,
                {"speech_probability": speech_probability, "is_speech": is_speech},
            )
        ]

        if self.state is VoiceState.LISTENING and is_speech:
            self._begin_speech(at_ms)
            events.append(self._transition(VoiceState.USER_SPEAKING, at_ms, "vad_speech"))
        elif self.state is VoiceState.USER_SPEAKING and not is_speech and self._vad_active:
            self._end_speech(at_ms)
            if self._speech_accumulated_ms >= self.config.min_speech_ms:
                self._silence_started_ms = at_ms
                events.append(self._transition(VoiceState.ENDPOINT_CANDIDATE, at_ms, "vad_silence"))
            else:
                self._reset_observation()
                events.append(self._transition(VoiceState.LISTENING, at_ms, "speech_too_short"))
        elif self.state is VoiceState.ENDPOINT_CANDIDATE and is_speech:
            self._begin_speech(at_ms)
            self._silence_started_ms = None
            events.append(self._transition(VoiceState.USER_SPEAKING, at_ms, "speech_resumed"))
        elif self.state in {VoiceState.SPEAKING, VoiceState.THINKING} and is_speech:
            self._begin_interruption(at_ms)
            events.append(
                self._transition(
                    VoiceState.INTERRUPTION_CANDIDATE,
                    at_ms,
                    "possible_user_interruption",
                    candidate=True,
                )
            )
        elif self.state is VoiceState.RECOVERING and is_speech:
            self._resume_interruption(at_ms)
            events.append(
                self._transition(
                    VoiceState.INTERRUPTION_CANDIDATE,
                    at_ms,
                    "candidate_speech_resumed",
                    candidate=True,
                )
            )
        elif self.state is VoiceState.INTERRUPTION_CANDIDATE:
            if is_speech and self._should_confirm_interruption(at_ms):
                events.extend(self._confirm_interruption(at_ms, "sustained_speech"))
            elif not is_speech:
                self._end_interruption_speech(at_ms)
                self._recovery_started_ms = at_ms
                events.append(
                    self._transition(
                        VoiceState.RECOVERING,
                        at_ms,
                        "interruption_not_confirmed",
                        candidate=True,
                    )
                )
        return tuple(events)

    def on_transcript(
        self,
        at_ms: int,
        text: str,
        *,
        is_final: bool,
        confidence: float,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if not 0.0 <= confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")
        normalized = " ".join(text.split())
        candidate = self.state in {
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.RECOVERING,
        }
        if candidate:
            self._candidate_transcript = normalized
            self._candidate_transcript_final = is_final
            self._candidate_transcript_confidence = confidence
        else:
            self.transcript = normalized
            self.transcript_final = is_final
            self.transcript_confidence = confidence

        event = self._event(
            EventType.TRANSCRIPT_FINAL if is_final else EventType.TRANSCRIPT_PARTIAL,
            at_ms,
            {"text": normalized, "confidence": confidence},
            candidate=candidate,
        )
        events = [event]
        if self.state in {VoiceState.INTERRUPTION_CANDIDATE, VoiceState.RECOVERING}:
            if self._credible_interrupt(normalized, confidence, is_final=is_final):
                events.extend(
                    self._confirm_interruption(
                        at_ms,
                        "credible_transcript",
                        speech_ended=self.state is VoiceState.RECOVERING,
                    )
                )
        return tuple(events)

    def on_time(self, at_ms: int) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if self.state is VoiceState.ENDPOINT_CANDIDATE:
            silence_ms = self._elapsed_since(self._silence_started_ms, at_ms)
            if (
                silence_ms >= self._endpoint_threshold_ms()
                or silence_ms >= self.config.max_endpoint_wait_ms
            ):
                return self._commit(at_ms)
        elif (
            self.state is VoiceState.INTERRUPTION_CANDIDATE
            and self._vad_active
            and self._should_confirm_interruption(at_ms)
        ):
            return self._confirm_interruption(at_ms, "sustained_speech")
        elif self.state is VoiceState.RECOVERING:
            recovery_ms = self._elapsed_since(self._recovery_started_ms, at_ms)
            if recovery_ms >= self.config.false_interrupt_recovery_ms:
                target = self._candidate_origin_state or VoiceState.SPEAKING
                cancelled = self._candidate_stt_cancelled_event(
                    at_ms,
                    "false_interruption",
                )
                self._clear_interruption_candidate()
                recovered = self._transition(target, at_ms, "false_interruption_recovered")
                return (recovered,) if cancelled is None else (cancelled, recovered)
        return ()

    @property
    def endpoint_threshold_ms(self) -> int:
        """Current silence threshold, exposed for STT finalization coordination."""

        return self._endpoint_threshold_ms()

    @property
    def candidate_turn_id(self) -> str | None:
        return self._candidate_turn_id

    @property
    def candidate_cancellation_id(self) -> str | None:
        return self._candidate_cancellation_id

    def on_model_started(
        self,
        at_ms: int,
        *,
        generation_id: str,
        cancellation_id: str | None = None,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if self.state is not VoiceState.COMMITTING:
            raise RuntimeError(f"cannot start model from {self.state}")
        if not generation_id.strip():
            raise ValueError("generation_id must be non-blank")
        if cancellation_id is not None and cancellation_id != self.cancellation_id:
            raise ValueError("generation cancellation_id must match the committed turn")
        self.generation_id = generation_id
        self._model_active = True
        return (self._transition(VoiceState.THINKING, at_ms, "model_started"),)

    def on_model_completed(
        self,
        at_ms: int,
        *,
        generation_id: str,
    ) -> tuple[ProtocolEvent, ...]:
        """Accept completion only for the authoritative active generation."""

        self._check_time(at_ms)
        if generation_id != self.generation_id or not self._model_active:
            return ()
        self._model_active = False
        return (
            self._event(
                EventType.MODEL_COMPLETED,
                at_ms,
                {"status": "completed"},
            ),
        )

    def on_tts_started(
        self,
        at_ms: int,
        *,
        generation_id: str,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if generation_id != self.generation_id:
            return ()
        if self.state is not VoiceState.THINKING:
            raise RuntimeError(f"cannot start TTS from {self.state}")
        self._tts_active = True
        return (
            self._event(EventType.TTS_STARTED, at_ms, {}),
            self._transition(VoiceState.SPEAKING, at_ms, "tts_started"),
        )

    def on_tts_completed(
        self,
        at_ms: int,
        *,
        generation_id: str,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if generation_id != self.generation_id:
            return ()
        if not self._tts_active:
            return ()
        if self.state not in {
            VoiceState.SPEAKING,
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.RECOVERING,
        }:
            raise RuntimeError(f"cannot complete TTS from {self.state}")
        self._tts_active = False
        self._model_active = False
        completed = self._event(EventType.TTS_COMPLETED, at_ms, {})
        if self.state is VoiceState.INTERRUPTION_CANDIDATE:
            return (completed, *self._promote_candidate_after_tts(at_ms))
        if self.state is VoiceState.RECOVERING:
            candidate_cancelled = self._candidate_stt_cancelled_event(
                at_ms,
                "assistant_completed",
            )
            self._clear_interruption_candidate()
            idle = self._transition(VoiceState.IDLE, at_ms, "tts_completed")
            events = [completed]
            if candidate_cancelled is not None:
                events.append(candidate_cancelled)
            events.append(idle)
            return tuple(events)
        return (completed, self._transition(VoiceState.IDLE, at_ms, "tts_completed"))

    def on_component_error(
        self,
        at_ms: int,
        *,
        component: str,
        reason: str,
        generation_id: str | None = None,
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if generation_id is not None and generation_id != self.generation_id:
            return ()
        if not component.strip() or not reason.strip():
            raise ValueError("component and reason must be non-blank")
        candidate_cancelled = self._candidate_stt_cancelled_event(at_ms, reason)
        events = [
            self._event(
                EventType.COMPONENT_ERROR,
                at_ms,
                {"component": component, "reason": reason},
            ),
            self._transition(VoiceState.ERROR, at_ms, reason),
        ]
        if candidate_cancelled is not None:
            events.insert(0, candidate_cancelled)
        return tuple(events)

    def on_audio_lost(
        self, at_ms: int, reason: str = "audio_device_lost"
    ) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if self.state is VoiceState.OFFLINE:
            return ()
        candidate_cancelled = self._candidate_stt_cancelled_event(at_ms, reason)
        events = [
            self._event(
                EventType.COMPONENT_ERROR,
                at_ms,
                {"component": "audio", "reason": reason},
            ),
            self._transition(VoiceState.OFFLINE, at_ms, reason),
        ]
        if candidate_cancelled is not None:
            events.insert(0, candidate_cancelled)
        return tuple(events)

    def on_audio_restored(self, at_ms: int) -> tuple[ProtocolEvent, ...]:
        self._check_time(at_ms)
        if self.state is not VoiceState.OFFLINE:
            raise RuntimeError(f"cannot restore audio from {self.state}")
        return (self._transition(VoiceState.IDLE, at_ms, "audio_restored"),)

    def _commit(self, at_ms: int) -> tuple[ProtocolEvent, ...]:
        state_event = self._transition(VoiceState.COMMITTING, at_ms, "endpoint_confirmed")
        committed_event = self._event(
            EventType.TURN_COMMITTED,
            at_ms,
            {
                "text": self.transcript,
                "confidence": self.transcript_confidence,
                "speech_ms": self._speech_accumulated_ms,
            },
        )
        return state_event, committed_event

    def _begin_speech(self, at_ms: int) -> None:
        self._vad_active = True
        self._speech_started_ms = at_ms

    def _end_speech(self, at_ms: int) -> None:
        if self._speech_started_ms is not None:
            self._speech_accumulated_ms += at_ms - self._speech_started_ms
        self._speech_started_ms = None
        self._vad_active = False

    def _begin_interruption(self, at_ms: int) -> None:
        self._candidate_origin_state = self.state
        self._vad_active = True
        self._interruption_speech_started_ms = at_ms
        self._interruption_speech_accumulated_ms = 0
        self._recovery_started_ms = None
        self._candidate_turn_id = self._id_factory()
        self._candidate_cancellation_id = self._id_factory()
        self._candidate_transcript = ""
        self._candidate_transcript_final = False
        self._candidate_transcript_confidence = 0.0

    def _resume_interruption(self, at_ms: int) -> None:
        self._vad_active = True
        self._interruption_speech_started_ms = at_ms
        self._recovery_started_ms = None

    def _end_interruption_speech(self, at_ms: int) -> None:
        if self._interruption_speech_started_ms is not None:
            self._interruption_speech_accumulated_ms += at_ms - self._interruption_speech_started_ms
        self._interruption_speech_started_ms = None
        self._vad_active = False

    def _confirm_interruption(
        self,
        at_ms: int,
        reason: str,
        *,
        speech_ended: bool = False,
    ) -> tuple[ProtocolEvent, ...]:
        old_turn_id = self.turn_id
        old_cancellation_id = self.cancellation_id
        old_generation_id = self.generation_id
        candidate_speech_started_ms = self._interruption_speech_started_ms
        candidate_speech_ms = self._interruption_speech_accumulated_ms
        candidate_silence_started_ms = self._recovery_started_ms
        interrupted = self._transition(VoiceState.INTERRUPTED, at_ms, reason)
        cancelled_events: list[ProtocolEvent] = []
        if self._model_active:
            cancelled_events.append(
                ProtocolEvent(
                    type=EventType.MODEL_CANCELLED,
                    monotonic_ms=at_ms,
                    session_id=self.session_id,
                    turn_id=old_turn_id,
                    generation_id=old_generation_id,
                    cancellation_id=old_cancellation_id,
                    payload={"reason": "user_interruption", "status": "cancelled"},
                )
            )
        if self._tts_active:
            cancelled_events.append(
                ProtocolEvent(
                    type=EventType.TTS_CANCELLED,
                    monotonic_ms=at_ms,
                    session_id=self.session_id,
                    turn_id=old_turn_id,
                    generation_id=old_generation_id,
                    cancellation_id=old_cancellation_id,
                    payload={"reason": "user_interruption", "status": "cancelled"},
                )
            )
        self.turn_id = self._candidate_turn_id or self._id_factory()
        self.cancellation_id = self._candidate_cancellation_id or self._id_factory()
        self.generation_id = None
        candidate_text = self._candidate_transcript
        candidate_final = self._candidate_transcript_final
        candidate_confidence = self._candidate_transcript_confidence
        self._reset_observation()
        self.transcript = candidate_text
        self.transcript_final = candidate_final
        self.transcript_confidence = candidate_confidence
        self._model_active = False
        self._tts_active = False
        self._speech_accumulated_ms = candidate_speech_ms
        self._vad_active = not speech_ended
        self._speech_started_ms = None if speech_ended else candidate_speech_started_ms
        speaking = self._transition(VoiceState.USER_SPEAKING, at_ms, "interruption_confirmed")
        events = [interrupted, *cancelled_events, speaking]
        if speech_ended:
            self._silence_started_ms = candidate_silence_started_ms or at_ms
            events.append(
                self._transition(
                    VoiceState.ENDPOINT_CANDIDATE,
                    at_ms,
                    "interruption_speech_ended",
                )
            )
        return tuple(events)

    def _promote_candidate_after_tts(self, at_ms: int) -> tuple[ProtocolEvent, ...]:
        candidate_speech_started_ms = self._interruption_speech_started_ms
        candidate_speech_ms = self._interruption_speech_accumulated_ms
        candidate_text = self._candidate_transcript
        candidate_final = self._candidate_transcript_final
        candidate_confidence = self._candidate_transcript_confidence
        self.turn_id = self._candidate_turn_id or self._id_factory()
        self.cancellation_id = self._candidate_cancellation_id or self._id_factory()
        self.generation_id = None
        self._reset_observation()
        self.transcript = candidate_text
        self.transcript_final = candidate_final
        self.transcript_confidence = candidate_confidence
        self._vad_active = True
        self._speech_started_ms = candidate_speech_started_ms
        self._speech_accumulated_ms = candidate_speech_ms
        return (
            self._transition(
                VoiceState.USER_SPEAKING,
                at_ms,
                "assistant_finished_during_candidate",
            ),
        )

    def _clear_interruption_candidate(self) -> None:
        self._candidate_turn_id = None
        self._candidate_cancellation_id = None
        self._candidate_transcript = ""
        self._candidate_transcript_final = False
        self._candidate_transcript_confidence = 0.0
        self._interruption_speech_started_ms = None
        self._interruption_speech_accumulated_ms = 0
        self._recovery_started_ms = None
        self._candidate_origin_state = None
        self._vad_active = False

    def _candidate_stt_cancelled_event(
        self,
        at_ms: int,
        reason: str,
    ) -> ProtocolEvent | None:
        if self.state not in {
            VoiceState.INTERRUPTION_CANDIDATE,
            VoiceState.RECOVERING,
        }:
            return None
        return self._event(
            EventType.STT_CANCELLED,
            at_ms,
            {"reason": reason, "status": "cancelled"},
            candidate=True,
        )

    def _reset_observation(self) -> None:
        self.transcript = ""
        self.transcript_final = False
        self.transcript_confidence = 0.0
        self._speech_started_ms = None
        self._speech_accumulated_ms = 0
        self._silence_started_ms = None
        self._vad_active = False
        self._clear_interruption_candidate()

    def _interruption_duration(self, at_ms: int) -> int:
        active_ms = self._elapsed_since(self._interruption_speech_started_ms, at_ms)
        return self._interruption_speech_accumulated_ms + active_ms

    def _should_confirm_interruption(self, at_ms: int) -> bool:
        threshold = self.config.interrupt_threshold_ms
        if self._is_backchannel(self._candidate_transcript):
            threshold *= 3
        return self._interruption_duration(at_ms) >= threshold

    @staticmethod
    def _elapsed_since(start_ms: int | None, at_ms: int) -> int:
        return 0 if start_ms is None else at_ms - start_ms

    def _endpoint_threshold_ms(self) -> int:
        if (
            self.transcript_final
            and self.transcript_confidence >= 0.6
            and self.transcript.rstrip().endswith((".", "?", "!"))
        ):
            return self.config.tentative_endpoint_silence_ms
        if self.transcript_final and self.transcript_confidence >= 0.6:
            return self.config.normal_endpoint_silence_ms
        return self.config.uncertain_endpoint_silence_ms

    def _credible_interrupt(self, text: str, confidence: float, *, is_final: bool) -> bool:
        normalized = text.lower().strip(" .,!?")
        if not normalized or self._is_backchannel(normalized):
            return False
        thresholds = {
            InterruptionMode.AGGRESSIVE: 0.55,
            InterruptionMode.BALANCED: 0.65,
            InterruptionMode.CONSERVATIVE: 0.8,
        }
        if self.config.interruption_mode is InterruptionMode.CONSERVATIVE and not is_final:
            return False
        return confidence >= thresholds[self.config.interruption_mode] and len(normalized) >= 2

    @staticmethod
    def _is_backchannel(text: str) -> bool:
        return text.lower().strip(" .,!?") in _BACKCHANNELS

    def _event(
        self,
        event_type: str,
        at_ms: int,
        payload: dict[str, object],
        *,
        candidate: bool = False,
    ) -> ProtocolEvent:
        return ProtocolEvent(
            type=event_type,
            monotonic_ms=at_ms,
            session_id=self.session_id,
            turn_id=self._candidate_turn_id if candidate else self.turn_id,
            generation_id=None if candidate else self.generation_id,
            cancellation_id=(
                self._candidate_cancellation_id if candidate else self.cancellation_id
            ),
            payload=payload,
        )

    def _transition(
        self,
        target: VoiceState,
        at_ms: int,
        reason: str,
        *,
        candidate: bool = False,
    ) -> ProtocolEvent:
        previous = self.state
        if target not in _ALLOWED_TRANSITIONS[previous]:
            raise RuntimeError(f"invalid voice transition: {previous} -> {target}")
        self.state = target
        return self._event(
            EventType.VOICE_STATE_CHANGED,
            at_ms,
            {"from": previous, "to": target, "reason": reason},
            candidate=candidate,
        )

    def _check_time(self, at_ms: int) -> None:
        if not isinstance(at_ms, int) or isinstance(at_ms, bool) or at_ms < 0:
            raise ValueError("timestamp must be a non-negative integer")
        if at_ms < self._last_ms:
            raise ValueError("timestamps must be monotonic")
        self._last_ms = at_ms
