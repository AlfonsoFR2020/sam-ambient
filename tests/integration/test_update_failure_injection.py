from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from sam_ambient.core.tools import CapabilityAuthority, ToolInvocation
from sam_ambient.supervisor import (
    CandidateRequest,
    HealthObservation,
    HealthState,
    SupervisorStore,
    UpdatableComponent,
    UpdateCoordinator,
    UpdateState,
    UpdateStore,
    ValidationStep,
    VersionLayout,
)


class ScriptedRuntime:
    def __init__(self, observations: list[HealthObservation]) -> None:
        self.observations = observations
        self.restarts: list[str] = []

    async def restart_and_observe(self, component_id, active_path, observation_s):
        del component_id, observation_s
        self.restarts.append(active_path.name)
        return self.observations.pop(0)


def version(root: Path, name: str, payload: str) -> None:
    target = root / name
    target.mkdir(parents=True)
    (target / "component.json").write_text(
        json.dumps({"component_id": "sam-core", "version": name}), encoding="utf-8"
    )
    (target / "payload.txt").write_text(payload, encoding="utf-8")


def build(tmp_path: Path, runtime: ScriptedRuntime, authority: CapabilityAuthority):
    root = tmp_path / "core"
    incoming = tmp_path / "incoming"
    (root / "versions").mkdir(parents=True)
    incoming.mkdir()
    version(root / "versions", "1.0", "known-good")
    version(incoming, "2.0", "candidate")
    component = UpdatableComponent(
        "sam-core",
        root,
        incoming,
        validation=(
            ValidationStep(
                (
                    sys.executable,
                    "-c",
                    "from pathlib import Path; assert Path('payload.txt').is_file()",
                )
            ),
        ),
        observation_s=0.01,
    )
    state_db = tmp_path / "state.db"
    coordinator = UpdateCoordinator(
        (component,),
        UpdateStore(state_db),
        SupervisorStore(state_db),
        runtime,
        revoke_capabilities=authority.revoke,
    )
    coordinator.register_current("sam-core", "1.0")
    return component, coordinator


def test_candidate_failure_rolls_back_known_good_end_to_end(tmp_path: Path) -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        invocation = ToolInvocation("before-update", "files.read", {})
        lease = authority.issue_lease(invocation)
        runtime = ScriptedRuntime(
            [
                HealthObservation(HealthState.UNHEALTHY, False, "candidate exited"),
                HealthObservation(HealthState.HEALTHY, True, "known-good stable"),
            ]
        )
        component, coordinator = build(tmp_path, runtime, authority)
        transaction = await coordinator.prepare(
            CandidateRequest("sam-core", "2.0", "2.0", "integration fixture")
        )
        result = await coordinator.activate(transaction.update_tx_id)

        assert result.state is UpdateState.ROLLED_BACK
        assert runtime.restarts == ["2.0", "1.0"]
        assert VersionLayout(component).active()["version"] == "1.0"
        assert authority.is_valid(lease, invocation) is False
        assert coordinator.supervisor_store.security_state().capability_epoch == 2

    asyncio.run(scenario())


def test_stable_candidate_becomes_last_known_good_end_to_end(tmp_path: Path) -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        runtime = ScriptedRuntime(
            [HealthObservation(HealthState.HEALTHY, True, "stable observation complete")]
        )
        component, coordinator = build(tmp_path, runtime, authority)
        transaction = await coordinator.prepare(
            CandidateRequest("sam-core", "2.0", "2.0", "integration fixture")
        )
        result = await coordinator.activate(transaction.update_tx_id)

        assert result.state is UpdateState.COMMITTED
        assert runtime.restarts == ["2.0"]
        assert VersionLayout(component).active()["version"] == "2.0"
        assert coordinator.update_store.component("sam-core").last_known_good_version == "2.0"
        assert coordinator.supervisor_store.security_state().capabilities_revoked is True

    asyncio.run(scenario())
