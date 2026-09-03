"""Small, trusted process-supervision domain model."""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

_COMPONENT_ID = re.compile(r"^[a-z][a-z0-9-]{0,63}$")


class HealthState(StrEnum):
    STARTING = "STARTING"
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"
    STOPPED = "STOPPED"
    CRASH_LOOP = "CRASH_LOOP"
    SAFE_MODE = "SAFE_MODE"


@dataclass(frozen=True, slots=True)
class RestartPolicy:
    startup_timeout_s: float = 15.0
    restart_delay_s: float = 0.5
    maximum_restart_delay_s: float = 8.0
    crash_window_s: float = 60.0
    maximum_failures: int = 3
    stable_after_s: float = 30.0
    shutdown_timeout_s: float = 5.0

    def __post_init__(self) -> None:
        positive = (
            self.startup_timeout_s,
            self.restart_delay_s,
            self.maximum_restart_delay_s,
            self.crash_window_s,
            self.stable_after_s,
            self.shutdown_timeout_s,
        )
        if any(value <= 0 for value in positive):
            raise ValueError("restart-policy durations must be positive")
        if self.maximum_failures < 1:
            raise ValueError("maximum_failures must be positive")
        if self.maximum_restart_delay_s < self.restart_delay_s:
            raise ValueError("maximum restart delay cannot be below the base delay")

    def delay_for(self, restart_count: int) -> float:
        if restart_count < 1:
            raise ValueError("restart_count must be positive")
        return min(
            self.restart_delay_s * (2 ** (restart_count - 1)),
            self.maximum_restart_delay_s,
        )


@dataclass(frozen=True, slots=True)
class ComponentSpec:
    """Trusted launch specification; never constructed from model/UI messages."""

    component_id: str
    command: tuple[str, ...]
    cwd: Path
    critical: bool = True
    restart: RestartPolicy = RestartPolicy()

    def __post_init__(self) -> None:
        if not _COMPONENT_ID.fullmatch(self.component_id):
            raise ValueError("component_id must be a stable lowercase identifier")
        if not self.command or any(not item or "\x00" in item for item in self.command):
            raise ValueError("component command must contain non-blank argv values")
        canonical = self.cwd.resolve(strict=True)
        if not canonical.is_dir():
            raise ValueError("component cwd must be an existing directory")
        object.__setattr__(self, "cwd", canonical)


@dataclass(frozen=True, slots=True)
class LaunchContext:
    instance_id: str
    capability_epoch: int
    capabilities_revoked: bool
    safe_mode: bool
    state_db: Path


@dataclass(frozen=True, slots=True)
class HealthReport:
    state: HealthState
    instance_id: str
    detail: str = ""

    def __post_init__(self) -> None:
        if self.state not in {HealthState.HEALTHY, HealthState.DEGRADED}:
            raise ValueError("readiness may report only HEALTHY or DEGRADED")
        if not self.instance_id.strip():
            raise ValueError("readiness instance_id must be non-blank")
        if len(self.detail) > 500:
            raise ValueError("health detail exceeds 500 characters")


@dataclass(slots=True)
class ComponentStatus:
    component_id: str
    health: HealthState = HealthState.STOPPED
    instance_id: str | None = None
    pid: int | None = None
    restart_count: int = 0
    last_start_ms: int | None = None
    last_healthy_ms: int | None = None
    last_exit_code: int | None = None
    last_exit_reason: str | None = None


@dataclass(frozen=True, slots=True)
class SecurityState:
    capability_epoch: int
    capabilities_revoked: bool
    safe_mode: bool
    reason: str | None
