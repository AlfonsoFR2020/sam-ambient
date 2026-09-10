from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import pytest

from sam_ambient.core.protocol import EventType
from sam_ambient.core.tools import CapabilityAuthority, ToolInvocation
from sam_ambient.core.turns import CancellationToken
from sam_ambient.supervisor import (
    CandidateRequest,
    ComponentVersionState,
    HealthObservation,
    HealthState,
    InvalidUpdateTransition,
    StagedArtifact,
    StructuredValidator,
    SupervisorStore,
    UpdatableComponent,
    UpdateCoordinator,
    UpdateError,
    UpdateState,
    UpdateStore,
    UpdateTransaction,
    ValidationStep,
    VersionLayout,
)


class VirtualClock:
    def __init__(self) -> None:
        self.now = 10_000

    def monotonic_ms(self) -> int:
        return self.now

    def wall_time_ms(self) -> int:
        self.now += 1
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.now += int(seconds * 1000)


class FakeValidator:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[tuple[str, ...]] = []

    async def validate(self, steps, artifact, cancellation) -> None:
        del cancellation
        self.calls.append(tuple(str(item.path) for item in (artifact,)))
        if self.error is not None:
            raise self.error


class FakeRuntime:
    def __init__(self, *observations: HealthObservation | Exception) -> None:
        self.observations = list(observations)
        self.calls: list[tuple[str, Path, float]] = []

    async def restart_and_observe(self, component_id, active_path, observation_s):
        self.calls.append((component_id, active_path, observation_s))
        result = self.observations.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def write_version(root: Path, component_id: str, version: str, text: str) -> Path:
    target = root / version
    target.mkdir(parents=True)
    (target / "component.json").write_text(
        json.dumps({"component_id": component_id, "version": version}), encoding="utf-8"
    )
    (target / "payload.txt").write_text(text, encoding="utf-8")
    return target


def setup_component(tmp_path: Path, *, validation=()):
    component_root = tmp_path / "component"
    versions = component_root / "versions"
    incoming = tmp_path / "incoming"
    versions.mkdir(parents=True)
    incoming.mkdir()
    write_version(versions, "sam-core", "1.0", "known good")
    write_version(incoming, "sam-core", "2.0", "candidate")
    component = UpdatableComponent(
        "sam-core",
        component_root,
        incoming,
        validation=validation,
        observation_s=2,
    )
    database = tmp_path / "state.db"
    return component, UpdateStore(database), SupervisorStore(database)


def coordinator(
    component,
    update_store,
    supervisor_store,
    runtime,
    *,
    validator=None,
    authority=None,
    events=None,
):
    async def publish(event) -> None:
        events.append(event)

    manager = UpdateCoordinator(
        (component,),
        update_store,
        supervisor_store,
        runtime,
        validator=validator or FakeValidator(),
        clock=VirtualClock(),
        publish=publish if events is not None else None,
        revoke_capabilities=authority.revoke if authority is not None else None,
    )
    manager.register_current("sam-core", "1.0")
    return manager


def request(*, expected_hash: str | None = None) -> CandidateRequest:
    return CandidateRequest("sam-core", "2.0", "2.0", "local fixture", expected_hash)


def test_transaction_state_machine_is_explicit_and_idempotent() -> None:
    transaction = UpdateTransaction("sam-core", "2.0", "candidate", "local")
    assert transaction.transition(UpdateState.VERIFYING, now_ms=1) is True
    assert transaction.transition(UpdateState.VERIFYING, now_ms=2) is False
    with pytest.raises(InvalidUpdateTransition):
        transaction.transition(UpdateState.COMMITTED, now_ms=3)


def test_transaction_and_component_metadata_persist_and_reload(tmp_path: Path) -> None:
    store = UpdateStore(tmp_path / "state.db")
    transaction = UpdateTransaction("sam-core", "2.0", "candidate", "local")
    transaction.transition(UpdateState.VERIFYING, now_ms=7)
    store.save_transaction(transaction)
    component = ComponentVersionState("sam-core", "1.0", "path", "a" * 64, None, "1.0")
    store.save_component(component)

    reopened = UpdateStore(tmp_path / "state.db")
    assert reopened.transaction(transaction.update_tx_id).state is UpdateState.VERIFYING
    assert reopened.component("sam-core") == component
    assert [item.update_tx_id for item in reopened.incomplete()] == [transaction.update_tx_id]


def test_staging_records_hash_identity_and_rejects_untrusted_paths(tmp_path: Path) -> None:
    component, _updates, _supervisor = setup_component(tmp_path)
    layout = VersionLayout(component)
    verified = layout.verify_source("2.0", version="2.0", expected_hash=None)
    staged = layout.stage(verified, "tx")

    assert staged.artifact_hash == verified.artifact_hash
    assert staged.file_count == 2
    assert staged.path == component.component_root / "versions/2.0"
    with pytest.raises(UpdateError, match=r"relative|traverse"):
        layout.verify_source("../outside", version="x", expected_hash=None)
    with pytest.raises(UpdateError, match=r"relative|trusted"):
        layout.verify_source(str(tmp_path.resolve()), version="x", expected_hash=None)
    with pytest.raises(UpdateError, match="hash"):
        layout.verify_source("2.0", version="2.0", expected_hash="0" * 64)


def test_wrong_component_identity_and_post_stage_tampering_are_rejected(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    write_version(component.incoming_root, "other", "3.0", "bad")
    with pytest.raises(UpdateError, match="identity"):
        VersionLayout(component).verify_source("3.0", version="3.0", expected_hash=None)

    runtime = FakeRuntime(HealthObservation(HealthState.HEALTHY, True))
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        (Path(transaction.candidate_path) / "payload.txt").write_text("tampered", encoding="utf-8")
        with pytest.raises(UpdateError, match="hash changed"):
            await manager.activate(transaction.update_tx_id)
        assert updates.transaction(transaction.update_tx_id).state is UpdateState.FAILED
        assert runtime.calls == []

    asyncio.run(scenario())


def test_active_pointer_path_or_hash_tampering_is_rejected(tmp_path: Path) -> None:
    component, _updates, _supervisor = setup_component(tmp_path)
    layout = VersionLayout(component)
    artifact = layout.artifact("1.0")
    layout.activate(artifact)
    payload = layout.active()
    payload["artifact_hash"] = "0" * 64
    layout.active_pointer.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(UpdateError, match="does not match"):
        layout.active()


def test_structured_validation_success_failure_and_timeout(tmp_path: Path) -> None:
    artifact_path = write_version(tmp_path, "sam-core", "1.0", "data")
    artifact = StagedArtifact("1.0", artifact_path, "a" * 64, 2, 4)
    validator = StructuredValidator()

    async def scenario() -> None:
        await validator.validate(
            (ValidationStep((sys.executable, "-c", "print('ok')")),),
            artifact,
            CancellationToken("success"),
        )
        with pytest.raises(UpdateError, match="failed"):
            await validator.validate(
                (ValidationStep((sys.executable, "-c", "raise SystemExit(3)")),),
                artifact,
                CancellationToken("failure"),
            )
        with pytest.raises(UpdateError, match="timed out"):
            await validator.validate(
                (
                    ValidationStep(
                        (sys.executable, "-c", "import time; time.sleep(2)"),
                        timeout_s=0.05,
                    ),
                ),
                artifact,
                CancellationToken("timeout"),
            )

    asyncio.run(scenario())


def test_validation_failure_blocks_activation_and_is_persisted(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    runtime = FakeRuntime(HealthObservation(HealthState.HEALTHY, True))
    manager = coordinator(
        component,
        updates,
        supervisor,
        runtime,
        validator=FakeValidator(UpdateError("tests failed")),
    )

    async def scenario() -> None:
        with pytest.raises(UpdateError, match="tests failed"):
            await manager.prepare(request())
        transaction = updates.incomplete()
        assert transaction == ()
        assert VersionLayout(component).active()["version"] == "1.0"
        assert runtime.calls == []

    asyncio.run(scenario())


def test_success_observes_before_commit_and_advances_security_epoch(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    authority = CapabilityAuthority()
    invocation = ToolInvocation("old", "files.read", {})
    lease = authority.issue_lease(invocation)
    events = []
    runtime = FakeRuntime(HealthObservation(HealthState.HEALTHY, True, "stable"))
    manager = coordinator(
        component,
        updates,
        supervisor,
        runtime,
        authority=authority,
        events=events,
    )

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        assert updates.component("sam-core").last_known_good_version == "1.0"
        committed = await manager.activate(transaction.update_tx_id)

        assert committed.state is UpdateState.COMMITTED
        assert updates.component("sam-core").last_known_good_version == "2.0"
        assert VersionLayout(component).active()["version"] == "2.0"
        assert runtime.calls == [("sam-core", component.component_root / "versions/2.0", 2)]
        assert authority.is_valid(lease, invocation) is False
        assert supervisor.security_state().capability_epoch == 1
        assert {event.type for event in events} == {EventType.UPDATE_STATE_CHANGED}
        assert all(event.update_tx_id == transaction.update_tx_id for event in events)
        calls = len(runtime.calls)
        assert (await manager.activate(transaction.update_tx_id)).state is UpdateState.COMMITTED
        assert len(runtime.calls) == calls

    asyncio.run(scenario())


def test_candidate_mutation_during_observation_rolls_back_instead_of_promoting(
    tmp_path: Path,
) -> None:
    component, updates, supervisor = setup_component(tmp_path)

    class MutatingRuntime(FakeRuntime):
        async def restart_and_observe(self, component_id, active_path, observation_s):
            self.calls.append((component_id, active_path, observation_s))
            if active_path.name == "2.0":
                (active_path / "payload.txt").write_text("mutated after start", encoding="utf-8")
            return self.observations.pop(0)

    runtime = MutatingRuntime(
        HealthObservation(HealthState.HEALTHY, True, "candidate appeared stable"),
        HealthObservation(HealthState.HEALTHY, True, "known good stable"),
    )
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        result = await manager.activate(transaction.update_tx_id)

        assert result.state is UpdateState.ROLLED_BACK
        assert result.error == "candidate artifact changed during health observation"
        assert VersionLayout(component).active()["version"] == "1.0"
        assert updates.component("sam-core").last_known_good_version == "1.0"
        assert [call[1].name for call in runtime.calls] == ["2.0", "1.0"]

    asyncio.run(scenario())


def test_mutated_rollback_target_fails_closed_into_safe_mode(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)

    class MutatingRuntime(FakeRuntime):
        async def restart_and_observe(self, component_id, active_path, observation_s):
            self.calls.append((component_id, active_path, observation_s))
            (component.component_root / "versions/1.0/payload.txt").write_text(
                "tampered known good", encoding="utf-8"
            )
            return self.observations.pop(0)

    runtime = MutatingRuntime(HealthObservation(HealthState.UNHEALTHY, False, "failed"))
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        result = await manager.activate(transaction.update_tx_id)

        assert result.state is UpdateState.FAILED
        assert "trusted hash" in (result.error or "")
        assert supervisor.security_state().safe_mode is True
        assert supervisor.security_state().capabilities_revoked is True
        assert len(runtime.calls) == 1

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "candidate_health",
    [HealthState.UNHEALTHY, HealthState.CRASH_LOOP, HealthState.STOPPED],
)
def test_candidate_health_failure_rolls_back_and_confirms_old_version(
    tmp_path: Path, candidate_health: HealthState
) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    runtime = FakeRuntime(
        HealthObservation(candidate_health, False, "candidate failed"),
        HealthObservation(HealthState.HEALTHY, True, "old stable"),
    )
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        rolled_back = await manager.activate(transaction.update_tx_id)

        assert rolled_back.state is UpdateState.ROLLED_BACK
        assert VersionLayout(component).active()["version"] == "1.0"
        assert updates.component("sam-core").last_known_good_version == "1.0"
        assert [call[1].name for call in runtime.calls] == ["2.0", "1.0"]
        assert supervisor.security_state().capability_epoch == 2
        assert supervisor.security_state().capabilities_revoked is True

    asyncio.run(scenario())


def test_candidate_and_rollback_double_failure_enters_safe_mode_once(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    runtime = FakeRuntime(
        HealthObservation(HealthState.UNHEALTHY, False),
        HealthObservation(HealthState.UNHEALTHY, False),
    )
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        failed = await manager.activate(transaction.update_tx_id)

        assert failed.state is UpdateState.FAILED
        assert supervisor.security_state().safe_mode is True
        assert len(runtime.calls) == 2
        assert (await manager.recover_incomplete()) == ()

    asyncio.run(scenario())


def test_restart_exception_rolls_back_and_rollback_exception_enters_safe_mode(
    tmp_path: Path,
) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    manager = coordinator(
        component,
        updates,
        supervisor,
        FakeRuntime(RuntimeError("candidate did not start"), RuntimeError("old did not start")),
    )

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        failed = await manager.activate(transaction.update_tx_id)

        assert failed.state is UpdateState.FAILED
        assert "rollback execution failed" in (failed.error or "")
        assert supervisor.security_state().safe_mode is True
        assert supervisor.security_state().capability_epoch == 2

    asyncio.run(scenario())


def test_restart_recovery_keeps_ready_inactive_and_fails_ambiguous_staging(
    tmp_path: Path,
) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    manager = coordinator(
        component,
        updates,
        supervisor,
        FakeRuntime(HealthObservation(HealthState.HEALTHY, True)),
    )
    created = UpdateTransaction("sam-core", "3.0", "3.0", "local")
    created.transition(UpdateState.VERIFYING, now_ms=1)
    created.transition(UpdateState.STAGING, now_ms=2)
    updates.save_transaction(created)

    async def scenario() -> None:
        ready = await manager.prepare(request())
        recovered = await manager.recover_incomplete()
        states = {item.update_tx_id: item.state for item in recovered}
        assert states[ready.update_tx_id] is UpdateState.READY
        assert states[created.update_tx_id] is UpdateState.FAILED
        assert VersionLayout(component).active()["version"] == "1.0"

    asyncio.run(scenario())


def test_restart_during_observation_conservatively_rolls_back(tmp_path: Path) -> None:
    component, updates, supervisor = setup_component(tmp_path)
    runtime = FakeRuntime(HealthObservation(HealthState.HEALTHY, True, "rollback stable"))
    manager = coordinator(component, updates, supervisor, runtime)

    async def scenario() -> None:
        transaction = await manager.prepare(request())
        candidate = VersionLayout(component).artifact("2.0")
        VersionLayout(component).activate(candidate)
        transaction.transition(UpdateState.ACTIVATING, now_ms=20)
        transaction.transition(UpdateState.OBSERVING, now_ms=21)
        updates.save_transaction(transaction)
        updates.save_component(
            ComponentVersionState(
                "sam-core", "2.0", str(candidate.path), candidate.artifact_hash, "1.0", "1.0"
            )
        )

        recovered = await manager.recover_incomplete()
        assert recovered[0].state is UpdateState.ROLLED_BACK
        assert VersionLayout(component).active()["version"] == "1.0"
        assert runtime.calls[0][1].name == "1.0"

    asyncio.run(scenario())


def test_cleanup_retains_active_known_good_and_only_bounded_failed_versions(
    tmp_path: Path,
) -> None:
    component, _updates, _supervisor = setup_component(tmp_path)
    layout = VersionLayout(component)
    for version in ("failed-1", "failed-2", "failed-3"):
        write_version(layout.versions, "sam-core", version, version)
    layout.cleanup_failed(keep_versions={"1.0"}, maximum_failed=2)

    assert (layout.versions / "1.0").exists()
    assert len([path for path in layout.versions.iterdir() if path.name.startswith("failed")]) == 2


def test_supervisor_self_update_is_explicitly_deferred(tmp_path: Path) -> None:
    component_root = tmp_path / "supervisor"
    incoming = tmp_path / "incoming"
    component_root.mkdir()
    incoming.mkdir()
    component = UpdatableComponent("sam-supervisor", component_root, incoming)
    database = tmp_path / "state.db"
    with pytest.raises(ValueError, match="separate trusted bootstrap"):
        UpdateCoordinator(
            (component,),
            UpdateStore(database),
            SupervisorStore(database),
            FakeRuntime(),
        )
