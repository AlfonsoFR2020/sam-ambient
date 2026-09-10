"""Trusted, component-neutral staged-update domain model."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Self
from uuid import uuid4

from sam_ambient.supervisor.models import HealthState

_VERSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class UpdateError(RuntimeError):
    """A trusted update transaction could not proceed safely."""


class InvalidUpdateTransition(UpdateError):
    pass


class UpdateState(StrEnum):
    CREATED = "CREATED"
    VERIFYING = "VERIFYING"
    STAGING = "STAGING"
    VALIDATING = "VALIDATING"
    READY = "READY"
    ACTIVATING = "ACTIVATING"
    OBSERVING = "OBSERVING"
    COMMITTED = "COMMITTED"
    ROLLING_BACK = "ROLLING_BACK"
    ROLLED_BACK = "ROLLED_BACK"
    FAILED = "FAILED"


_TRANSITIONS: dict[UpdateState, frozenset[UpdateState]] = {
    UpdateState.CREATED: frozenset({UpdateState.VERIFYING, UpdateState.FAILED}),
    UpdateState.VERIFYING: frozenset({UpdateState.STAGING, UpdateState.FAILED}),
    UpdateState.STAGING: frozenset({UpdateState.VALIDATING, UpdateState.FAILED}),
    UpdateState.VALIDATING: frozenset({UpdateState.READY, UpdateState.FAILED}),
    UpdateState.READY: frozenset({UpdateState.ACTIVATING, UpdateState.FAILED}),
    UpdateState.ACTIVATING: frozenset({UpdateState.OBSERVING, UpdateState.ROLLING_BACK}),
    UpdateState.OBSERVING: frozenset({UpdateState.COMMITTED, UpdateState.ROLLING_BACK}),
    UpdateState.ROLLING_BACK: frozenset({UpdateState.ROLLED_BACK, UpdateState.FAILED}),
    UpdateState.COMMITTED: frozenset(),
    UpdateState.ROLLED_BACK: frozenset(),
    UpdateState.FAILED: frozenset(),
}


@dataclass(frozen=True, slots=True)
class ValidationStep:
    argv: tuple[str, ...]
    cwd: str = "."
    timeout_s: float = 60.0
    stdout_limit: int = 32_768
    stderr_limit: int = 32_768

    def __post_init__(self) -> None:
        if not self.argv or any(not value or "\x00" in value for value in self.argv):
            raise ValueError("validation argv must contain non-blank values")
        if not 0.05 <= self.timeout_s <= 600:
            raise ValueError("validation timeout must be between 0.05 and 600 seconds")
        if not 1 <= self.stdout_limit <= 131_072 or not 1 <= self.stderr_limit <= 131_072:
            raise ValueError("validation output limits are out of bounds")


@dataclass(frozen=True, slots=True)
class UpdatableComponent:
    component_id: str
    component_root: Path
    incoming_root: Path
    validation: tuple[ValidationStep, ...] = ()
    observation_s: float = 5.0
    critical: bool = True

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", self.component_id):
            raise ValueError("invalid update component id")
        component_root = self.component_root.resolve(strict=True)
        incoming_root = self.incoming_root.resolve(strict=True)
        if not component_root.is_dir() or not incoming_root.is_dir():
            raise ValueError("update roots must be existing directories")
        if self.observation_s <= 0:
            raise ValueError("observation window must be positive")
        object.__setattr__(self, "component_root", component_root)
        object.__setattr__(self, "incoming_root", incoming_root)


@dataclass(frozen=True, slots=True)
class CandidateRequest:
    component_id: str
    version: str
    source_relative: str
    provenance: str
    expected_hash: str | None = None

    def __post_init__(self) -> None:
        if not _VERSION.fullmatch(self.version):
            raise ValueError("candidate version contains unsupported characters")
        if not self.provenance.strip() or len(self.provenance) > 500:
            raise ValueError("candidate provenance must be present and bounded")
        if self.expected_hash is not None and not re.fullmatch(r"[0-9a-f]{64}", self.expected_hash):
            raise ValueError("expected candidate hash must be lowercase SHA-256")


@dataclass(slots=True)
class UpdateTransaction:
    component_id: str
    candidate_version: str
    source: str
    provenance: str
    update_tx_id: str = field(default_factory=lambda: str(uuid4()))
    state: UpdateState = UpdateState.CREATED
    current_version: str | None = None
    previous_version: str | None = None
    last_known_good_version: str | None = None
    candidate_path: str | None = None
    artifact_hash: str | None = None
    previous_artifact_hash: str | None = None
    activation_target: str | None = None
    activation_time_ms: int | None = None
    health_result: str | None = None
    error: str | None = None
    updated_at_ms: int = 0

    def transition(self, target: UpdateState, *, now_ms: int) -> bool:
        if target is self.state:
            return False
        if target not in _TRANSITIONS[self.state]:
            raise InvalidUpdateTransition(f"cannot transition {self.state} -> {target}")
        self.state = target
        self.updated_at_ms = now_ms
        return True

    def to_dict(self) -> dict[str, Any]:
        payload = asdict(self)
        payload["state"] = self.state.value
        return payload

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> Self:
        copied = dict(payload)
        copied["state"] = UpdateState(copied["state"])
        return cls(**copied)


@dataclass(frozen=True, slots=True)
class ComponentVersionState:
    component_id: str
    active_version: str
    active_path: str
    active_hash: str
    previous_version: str | None
    last_known_good_version: str
    candidate_version: str | None = None
    update_tx_id: str | None = None


@dataclass(frozen=True, slots=True)
class HealthObservation:
    state: HealthState
    stable: bool
    detail: str = ""

    @property
    def accepted(self) -> bool:
        return self.state in {HealthState.HEALTHY, HealthState.DEGRADED} and self.stable
