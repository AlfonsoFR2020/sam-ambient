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
from sam_ambient.supervisor.update_layout import StagedArtifact, VersionLayout, read_active_pointer
from sam_ambient.supervisor.update_models import (
    CandidateRequest,
    ComponentVersionState,
    HealthObservation,
    InvalidUpdateTransition,
    UpdatableComponent,
    UpdateError,
    UpdateState,
    UpdateTransaction,
    ValidationStep,
)
from sam_ambient.supervisor.update_store import UpdateStore
from sam_ambient.supervisor.updater import (
    StructuredValidator,
    SupervisorUpdateRuntime,
    UpdateCoordinator,
    UpdateRuntime,
)

__all__ = [
    "CandidateRequest",
    "Clock",
    "ComponentSpec",
    "ComponentStatus",
    "ComponentVersionState",
    "CrashRecord",
    "HealthObservation",
    "HealthReport",
    "HealthState",
    "InvalidUpdateTransition",
    "LaunchContext",
    "ManagedProcess",
    "ProcessLauncher",
    "RestartPolicy",
    "SecurityState",
    "StagedArtifact",
    "StructuredValidator",
    "SubprocessLauncher",
    "Supervisor",
    "SupervisorStateError",
    "SupervisorStore",
    "SupervisorUpdateRuntime",
    "SystemClock",
    "UpdatableComponent",
    "UpdateCoordinator",
    "UpdateError",
    "UpdateRuntime",
    "UpdateState",
    "UpdateStore",
    "UpdateTransaction",
    "ValidationStep",
    "VersionLayout",
    "read_active_pointer",
]
