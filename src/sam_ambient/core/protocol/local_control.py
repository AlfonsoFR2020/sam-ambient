"""Typed, non-conversational owner controls shared by UI and future voice intents."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class LocalControlKind(StrEnum):
    SWITCH_INFERENCE = "switch_inference"
    STOP_SPEAKING = "stop_speaking"


class LocalControlOutcome(StrEnum):
    STARTED = "started"
    SUCCESS = "success"
    UNAVAILABLE = "unavailable"
    AMBIGUOUS = "ambiguous"
    BLOCKED = "blocked"
    INVALID = "invalid"
    FAILED = "failed"


@dataclass(frozen=True, slots=True)
class LocalControlIntent:
    kind: LocalControlKind
    provider_id: str | None = None
    model_id: str | None = None
    remember: bool = False


@dataclass(frozen=True, slots=True)
class LocalControlResult:
    outcome: LocalControlOutcome
    reason: str
    provider_id: str | None = None
    model_id: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.outcome is LocalControlOutcome.SUCCESS
