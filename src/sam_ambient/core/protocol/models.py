"""Versioned, JSON-compatible local protocol models."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType
from typing import Any, ClassVar, Final, Self

PROTOCOL_VERSION: Final = 1


class ProtocolError(ValueError):
    """Raised when a local protocol message is invalid or unsupported."""


class EventType(StrEnum):
    SYSTEM_READY = "system.ready"
    COMPONENT_HEALTH = "component.health"
    COMPONENT_ERROR = "component.error"
    VOICE_LEVEL = "voice.level"
    VOICE_VAD = "voice.vad"
    VOICE_STATE_CHANGED = "voice.state_changed"
    TRANSCRIPT_PARTIAL = "transcript.partial"
    TRANSCRIPT_FINAL = "transcript.final"
    STT_CANCELLED = "stt.cancelled"
    TURN_COMMITTED = "turn.committed"
    MODEL_DELTA = "model.delta"
    MODEL_COMPLETED = "model.completed"
    MODEL_CANCELLED = "model.cancelled"
    TTS_STARTED = "tts.started"
    TTS_LEVEL = "tts.level"
    TTS_COMPLETED = "tts.completed"
    TTS_CANCELLED = "tts.cancelled"
    TOOL_REQUESTED = "tool.requested"
    TOOL_AUTHORIZING = "tool.authorizing"
    TOOL_APPROVAL_REQUESTED = "tool.approval_requested"
    TOOL_STARTED = "tool.started"
    TOOL_COMPLETED = "tool.completed"
    TOOL_FAILED = "tool.failed"
    TOOL_CANCELLED = "tool.cancelled"
    TOOL_DENIED = "tool.denied"
    CAPABILITY_AUTHORITY_CHANGED = "capability.authority_changed"
    UPDATE_STATE_CHANGED = "update.state_changed"
    CONTROL_ACKNOWLEDGED = "control.acknowledged"
    CONTROL_REJECTED = "control.rejected"


class ControlCommandType(StrEnum):
    MICROPHONE_SET = "control.microphone.set"
    TTS_OUTPUT_SET = "control.tts_output.set"
    STOP_SPEAKING = "control.stop_speaking"
    EMERGENCY_STOP = "control.emergency_stop"
    USER_MESSAGE_SUBMIT = "control.user_message.submit"
    TOOL_APPROVE = "control.tool.approve"
    TOOL_DENY = "control.tool.deny"
    CAPABILITIES_REVOKE_ALL = "control.capabilities.revoke_all"


LOSSY_EVENT_TYPES: Final[frozenset[str]] = frozenset({EventType.VOICE_LEVEL, EventType.TTS_LEVEL})


@dataclass(frozen=True, slots=True)
class ProtocolEvent:
    """A single versioned message exchanged between local components."""

    type: str
    monotonic_ms: int
    payload: dict[str, Any] = field(default_factory=dict)
    protocol: int = PROTOCOL_VERSION
    session_id: str | None = None
    turn_id: str | None = None
    generation_id: str | None = None
    cancellation_id: str | None = None
    tool_call_id: str | None = None
    update_tx_id: str | None = None

    _OPTIONAL_IDS: ClassVar[tuple[str, ...]] = (
        "session_id",
        "turn_id",
        "generation_id",
        "cancellation_id",
        "tool_call_id",
        "update_tx_id",
    )

    def __post_init__(self) -> None:
        if self.protocol != PROTOCOL_VERSION:
            raise ProtocolError(
                f"unsupported protocol {self.protocol}; expected {PROTOCOL_VERSION}"
            )
        if not isinstance(self.type, str) or "." not in self.type or self.type.strip() != self.type:
            raise ProtocolError("event type must be a non-blank namespaced string")
        if not isinstance(self.monotonic_ms, int) or isinstance(self.monotonic_ms, bool):
            raise ProtocolError("monotonic_ms must be an integer")
        if self.monotonic_ms < 0:
            raise ProtocolError("monotonic_ms must be non-negative")
        if not isinstance(self.payload, dict):
            raise ProtocolError("payload must be an object")
        for name in self._OPTIONAL_IDS:
            value = getattr(self, name)
            if value is not None and (not isinstance(value, str) or not value.strip()):
                raise ProtocolError(f"{name} must be a non-blank string when present")

        copied_payload = dict(self.payload)
        try:
            json.dumps(copied_payload, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise ProtocolError("payload must contain finite JSON-compatible values") from error
        object.__setattr__(self, "payload", MappingProxyType(copied_payload))

    @property
    def is_lossy(self) -> bool:
        return self.type in LOSSY_EVENT_TYPES

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "protocol": self.protocol,
            "type": self.type,
            "monotonic_ms": self.monotonic_ms,
            "payload": dict(self.payload),
        }
        for name in self._OPTIONAL_IDS:
            value = getattr(self, name)
            if value is not None:
                result[name] = value
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), allow_nan=False, separators=(",", ":"), sort_keys=True)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> Self:
        if not isinstance(value, dict):
            raise ProtocolError("protocol message must be an object")
        required = {"protocol", "type", "monotonic_ms", "payload"}
        missing = required.difference(value)
        if missing:
            raise ProtocolError(f"missing required fields: {', '.join(sorted(missing))}")
        allowed = required.union(cls._OPTIONAL_IDS)
        unexpected = set(value).difference(allowed)
        if unexpected:
            raise ProtocolError(f"unexpected fields: {', '.join(sorted(unexpected))}")
        try:
            return cls(**value)
        except TypeError as error:
            raise ProtocolError("invalid protocol field types") from error

    @classmethod
    def from_json(cls, value: str) -> Self:
        try:
            decoded = json.loads(value)
        except (TypeError, json.JSONDecodeError) as error:
            raise ProtocolError("invalid JSON protocol message") from error
        return cls.from_dict(decoded)


@dataclass(frozen=True, slots=True)
class ControlCommand:
    """A versioned UI request; authoritative effects remain in Sam core."""

    type: str
    command_id: str
    monotonic_ms: int
    payload: dict[str, Any] = field(default_factory=dict)
    protocol: int = PROTOCOL_VERSION
    session_id: str | None = None
    turn_id: str | None = None
    generation_id: str | None = None
    cancellation_id: str | None = None
    tool_call_id: str | None = None

    _OPTIONAL_IDS: ClassVar[tuple[str, ...]] = (
        "session_id",
        "turn_id",
        "generation_id",
        "cancellation_id",
        "tool_call_id",
    )

    def __post_init__(self) -> None:
        if self.protocol != PROTOCOL_VERSION:
            raise ProtocolError(
                f"unsupported protocol {self.protocol}; expected {PROTOCOL_VERSION}"
            )
        try:
            ControlCommandType(self.type)
        except (TypeError, ValueError) as error:
            raise ProtocolError(f"unsupported control command: {self.type}") from error
        if not isinstance(self.command_id, str) or not self.command_id.strip():
            raise ProtocolError("command_id must be a non-blank string")
        if not isinstance(self.monotonic_ms, int) or isinstance(self.monotonic_ms, bool):
            raise ProtocolError("monotonic_ms must be an integer")
        if self.monotonic_ms < 0:
            raise ProtocolError("monotonic_ms must be non-negative")
        if not isinstance(self.payload, dict):
            raise ProtocolError("payload must be an object")
        for name in self._OPTIONAL_IDS:
            value = getattr(self, name)
            if value is not None and (not isinstance(value, str) or not value.strip()):
                raise ProtocolError(f"{name} must be a non-blank string when present")
        copied_payload = dict(self.payload)
        try:
            json.dumps(copied_payload, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise ProtocolError("payload must contain finite JSON-compatible values") from error
        object.__setattr__(self, "payload", MappingProxyType(copied_payload))

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "protocol": self.protocol,
            "type": self.type,
            "command_id": self.command_id,
            "monotonic_ms": self.monotonic_ms,
            "payload": dict(self.payload),
        }
        for name in self._OPTIONAL_IDS:
            value = getattr(self, name)
            if value is not None:
                result[name] = value
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), allow_nan=False, separators=(",", ":"), sort_keys=True)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> Self:
        if not isinstance(value, dict):
            raise ProtocolError("control command must be an object")
        required = {"protocol", "type", "command_id", "monotonic_ms", "payload"}
        missing = required.difference(value)
        if missing:
            raise ProtocolError(f"missing required fields: {', '.join(sorted(missing))}")
        allowed = required.union(cls._OPTIONAL_IDS)
        unexpected = set(value).difference(allowed)
        if unexpected:
            raise ProtocolError(f"unexpected fields: {', '.join(sorted(unexpected))}")
        try:
            return cls(**value)
        except TypeError as error:
            raise ProtocolError("invalid control command field types") from error

    @classmethod
    def from_json(cls, value: str) -> Self:
        try:
            decoded = json.loads(value)
        except (TypeError, json.JSONDecodeError) as error:
            raise ProtocolError("invalid JSON control command") from error
        return cls.from_dict(decoded)
