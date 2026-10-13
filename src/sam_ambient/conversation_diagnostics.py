"""Bounded read-only projection of authoritative lifecycle events; never controls turns."""

from __future__ import annotations

import time
from collections import OrderedDict, deque
from collections.abc import Callable

from sam_ambient.core.protocol.models import (
    ControlCommand,
    ControlCommandType,
    EventType,
    ProtocolEvent,
)
from sam_ambient.diagnostic_log import diagnostic, identity

_TERMINAL = {EventType.MODEL_COMPLETED, EventType.MODEL_CANCELLED, EventType.COMPONENT_ERROR}
_DELIVERY_END = {EventType.TTS_COMPLETED, EventType.TTS_CANCELLED, EventType.TTS_FAILED}


class ConversationTrace:
    def __init__(self, *, now: Callable[[], int] | None = None, limit: int = 128) -> None:
        self.now = now or (lambda: time.monotonic_ns() // 1_000_000)
        self.limit = limit
        self.pending: OrderedDict[tuple[str, str], tuple[int, dict]] = OrderedDict()
        self.history: deque[dict] = deque(maxlen=256)
        self.maxima = {"inference": 0, "stt": 0, "command": 0, "stream": 0, "delivery": 0}
        self.oscillations = self.failures = self.dropped = 0
        self._partials: deque[str] = deque(maxlen=256)
        self._first_audio: deque[str] = deque(maxlen=256)

    def record(self, stage: str, **fields: object) -> None:
        # Keep only the same positive projection used by the log, never payloads.
        from sam_ambient.diagnostic_log import safe_record

        fields = {"source_ms": self.now(), **fields}
        self.history.append(safe_record(stage, fields))
        diagnostic(stage, **fields)

    def begin(self, kind: str, key: str | None, **ids: object) -> None:
        if key is None:
            return
        index = (kind, identity(key))
        if index not in self.pending:
            while len(self.pending) >= self.limit:
                self.pending.popitem(last=False)
                self.dropped += 1
            bounded = {k: v[:256] for k, v in ids.items() if isinstance(v, str)}
            self.pending[index] = (self.now(), bounded)
            self.record(f"{kind}.begin", **bounded)

    def end(self, kind: str, key: str | None, *, state: str = "completed") -> None:
        if key is None:
            return
        entry = self.pending.pop((kind, identity(key)), None)
        if entry is None:
            return
        started, ids = entry
        elapsed = max(0, self.now() - started)
        if kind in self.maxima:
            self.maxima[kind] = max(self.maxima[kind], elapsed)
        self.record(f"{kind}.end", state=state, elapsed_ms=elapsed, **ids)

    def command(self, command: ControlCommand, phase: str) -> None:
        ids = {
            "command_id": command.command_id,
            "turn_id": command.turn_id,
            "generation_id": command.generation_id,
        }
        if phase == "queued":
            self.begin("command", command.command_id, **ids)
        elif phase == "dispatch":
            if command.type == ControlCommandType.USER_MESSAGE_SUBMIT:
                self.begin("request", command.command_id, **ids)
        elif phase in {"acknowledged", "rejected", "cancelled"}:
            self.end(
                "command",
                command.command_id,
                state=phase if phase != "acknowledged" else "accepted",
            )
            if phase != "acknowledged":
                self.end("request", command.command_id, state=phase)
        self.record(f"command.{phase}", **ids)

    def event(self, event: ProtocolEvent) -> None:
        if event.type == "provider.discovery":
            self.record(
                "provider.discovery",
                state=event.payload.get("state"),
                command_id=event.payload.get("request_id"),
            )
            return
        try:
            kind = EventType(event.type)
        except ValueError:
            return
        ids = {
            "turn_id": event.turn_id,
            "generation_id": event.generation_id,
            "command_id": event.payload.get("command_id"),
            "operation_id": event.cancellation_id,
        }
        key = event.turn_id or event.cancellation_id
        if kind == EventType.VOICE_STATE_CHANGED:
            before, after = event.payload.get("from"), event.payload.get("to")
            if event.payload.get("reason") == "playback_echo":
                self.record("candidate.playback_suspected", state="rejected", **ids)
            if before == "ENDPOINT_CANDIDATE" and after == "USER_SPEAKING":
                self.oscillations += 1
                self.record("candidate.endpoint_resumed", count=self.oscillations, **ids)
            if after in {"USER_SPEAKING", "INTERRUPTION_CANDIDATE"}:
                self.begin("candidate", key, **ids)
            if event.payload.get("reason") == "stt_finalizing":
                self.begin("stt", key, **ids)
            if after in {"IDLE", "LISTENING", "ERROR", "OFFLINE", "RECOVERING"}:
                self.end("candidate", key, state="cancelled")
                self.end("stt", key, state="cancelled")
            self.record("voice.transition", state=after, **ids)
        elif kind in {EventType.TRANSCRIPT_PARTIAL, EventType.TRANSCRIPT_FINAL}:
            if kind == EventType.TRANSCRIPT_FINAL:
                self.end("stt", key)
                if event.payload.get("role") == "user" and event.generation_id is not None:
                    self.record("turn.committed", **ids)
            elif key is not None:
                fingerprint = identity(key)
                if fingerprint in self._partials:
                    return
                self._partials.append(fingerprint)
            self.record(str(kind), nonempty=bool(str(event.payload.get("text", "")).strip()), **ids)
        elif kind == EventType.TURN_COMMITTED:
            self.end("candidate", key)
            self.end("stt", key)
            self.record("turn.committed", **ids)
        elif kind == EventType.MODEL_DELTA:
            if ("inference", identity(event.generation_id or "")) in self.pending:
                self.record("model.first_token", **ids)
            self.end("inference", event.generation_id)
        elif kind in _TERMINAL:
            stream = self.pending.get(("stream", identity(event.generation_id or "")))
            command_id = event.payload.get("command_id") or (
                stream[1].get("command_id") if stream else None
            )
            state = (
                "failed"
                if kind == EventType.COMPONENT_ERROR
                else "cancelled"
                if kind == EventType.MODEL_CANCELLED
                else "completed"
            )
            self.failures += int(state == "failed")
            self.end("inference", event.generation_id, state=state)
            self.end("stream", event.generation_id, state=state)
            self.end("request", command_id, state=state)
            self.record(str(kind), state=state, **ids)
        elif kind == EventType.STT_CANCELLED:
            self.end("candidate", key, state="cancelled")
            self.end("stt", key, state="cancelled")
            self.record(str(kind), state="cancelled", **ids)
        elif kind == EventType.TTS_STARTED:
            self.begin("delivery", event.generation_id, **ids)
        elif kind == EventType.TTS_LEVEL:
            fingerprint = identity(event.generation_id or "")
            if event.payload.get("rms", 0) > 0 and fingerprint not in self._first_audio:
                self._first_audio.append(fingerprint)
                self.record("synthesis.first_activity", **ids)
        elif kind in _DELIVERY_END:
            state = (
                "failed"
                if kind == EventType.TTS_FAILED
                else "cancelled"
                if kind == EventType.TTS_CANCELLED
                else "completed"
            )
            self.end("delivery", event.generation_id, state=state)
            self.record(str(kind), state=state, **ids)
        elif kind in {
            EventType.COMPONENT_HEALTH,
            EventType.LOCAL_CONTROL,
            EventType.SYSTEM_STOPPING,
        }:
            self.record(
                str(kind),
                state=event.payload.get("state"),
                component=event.payload.get("component"),
                **ids,
            )

    def snapshot(self) -> dict[str, int]:
        maxima = dict(self.maxima)
        for (kind, _), (started, _) in self.pending.items():
            if kind in maxima:
                maxima[kind] = max(maxima[kind], max(0, self.now() - started))
        return {
            "longest_inference_ms": maxima["inference"],
            "longest_stt_ms": maxima["stt"],
            "longest_command_ms": maxima["command"],
            "longest_stream_ms": maxima["stream"],
            "longest_delivery_ms": maxima["delivery"],
            "oscillations": self.oscillations,
            "nonterminal": len(self.pending),
            "failures": self.failures,
            "dropped": self.dropped,
        }

    def summary(self, **owners: int) -> None:
        self.record("conversation.summary", **self.snapshot(), **owners)
        for (kind, _), (started, ids) in tuple(self.pending.items())[:8]:
            self.record(
                "operation.nonterminal",
                component=kind,
                elapsed_ms=max(0, self.now() - started),
                **ids,
            )
