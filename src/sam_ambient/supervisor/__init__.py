"""Stable supervisor and update authority boundary.

This package must not import provider or model-reasoning implementations.
"""

from sam_ambient.supervisor.manager import Clock, Supervisor, SystemClock
from sam_ambient.supervisor.models import (
    ComponentSpec,
    ComponentStatus,
    HealthReport,
    HealthState,
    LaunchContext,
    RestartPolicy,
    SecurityState,
)
from sam_ambient.supervisor.persistence import (
    CrashRecord,
    SupervisorStateError,
    SupervisorStore,
)
from sam_ambient.supervisor.process import ManagedProcess, ProcessLauncher, SubprocessLauncher

__all__ = [
    "Clock",
    "ComponentSpec",
    "ComponentStatus",
    "CrashRecord",
    "HealthReport",
    "HealthState",
    "LaunchContext",
    "ManagedProcess",
    "ProcessLauncher",
    "RestartPolicy",
    "SecurityState",
    "SubprocessLauncher",
    "Supervisor",
    "SupervisorStateError",
    "SupervisorStore",
    "SystemClock",
]
