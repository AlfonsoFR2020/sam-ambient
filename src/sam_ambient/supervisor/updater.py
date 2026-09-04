"""Trusted staged update orchestration with health-validated rollback."""

from __future__ import annotations

import asyncio
import contextlib
import inspect
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Protocol

from sam_ambient.adapters.process import SubprocessAdapter
from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationToken
from sam_ambient.supervisor.manager import Clock, Supervisor, SystemClock
from sam_ambient.supervisor.models import HealthState
from sam_ambient.supervisor.persistence import SupervisorStore
from sam_ambient.supervisor.update_layout import StagedArtifact, VersionLayout, _contained
from sam_ambient.supervisor.update_models import (
    CandidateRequest,
    ComponentVersionState,
    HealthObservation,
    UpdatableComponent,
    UpdateError,
    UpdateState,
    UpdateTransaction,
    ValidationStep,
)
from sam_ambient.supervisor.update_store import UpdateStore

UpdatePublisher = Callable[[ProtocolEvent], Awaitable[None]]


class UpdateRuntime(Protocol):
    async def restart_and_observe(
        self,
        component_id: str,
        active_path: Path,
        observation_s: float,
    ) -> HealthObservation: ...


class StructuredValidator:
    def __init__(self, process: SubprocessAdapter | None = None) -> None:
        self.process = process or SubprocessAdapter()

    async def validate(
        self,
        steps: tuple[ValidationStep, ...],
        artifact: StagedArtifact,
        cancellation: CancellationToken,
    ) -> None:
        for step in steps:
            cwd = _contained(artifact.path, step.cwd, strict=True)
            if not cwd.is_dir():
                raise UpdateError("validation cwd must be a staged directory")
            argv = tuple(value.replace("{candidate}", str(artifact.path)) for value in step.argv)
            result = await self.process.run(
                argv[0],
                argv[1:],
                cwd=cwd,
                timeout_s=step.timeout_s,
                stdout_limit=step.stdout_limit,
                stderr_limit=step.stderr_limit,
                cancellation=cancellation,
            )
            if result.timed_out:
                raise UpdateError("candidate validation timed out")
            if result.exit_code != 0:
                detail = result.stderr.strip() or result.stdout.strip() or "no output"
                raise UpdateError(f"candidate validation failed: {detail[:500]}")


class SupervisorUpdateRuntime:
    """Small adapter from updater health semantics to the Phase 7 supervisor."""

    def __init__(
        self,
        supervisor: Supervisor,
        *,
        poll_interval_s: float = 0.05,
        readiness_timeout_s: float = 30.0,
    ) -> None:
        if poll_interval_s <= 0 or readiness_timeout_s <= 0:
            raise ValueError("update health timing must be positive")
        self.supervisor = supervisor
        self.poll_interval_s = poll_interval_s
        self.readiness_timeout_s = readiness_timeout_s

    async def restart_and_observe(
        self,
        component_id: str,
        active_path: Path,
        observation_s: float,
    ) -> HealthObservation:
        del active_path  # A stable packaged launcher resolves the active manifest.
        prior_status = self.supervisor.statuses[component_id]
        prior = prior_status.instance_id
        prior_restarts = prior_status.restart_count
        await self.supervisor.restart_component(component_id)
        deadline = time.monotonic() + self.readiness_timeout_s
        instance: str | None = None
        while time.monotonic() < deadline:
            status = self.supervisor.statuses[component_id]
            if status.health in {HealthState.CRASH_LOOP, HealthState.SAFE_MODE}:
                return HealthObservation(status.health, False, status.last_exit_reason or "failed")
            if status.restart_count > prior_restarts:
                return HealthObservation(
                    HealthState.UNHEALTHY,
                    False,
                    status.last_exit_reason or "candidate exited before readiness",
                )
            if (
                status.instance_id is not None
                and status.instance_id != prior
                and status.health in {HealthState.HEALTHY, HealthState.DEGRADED}
            ):
                instance = status.instance_id
                break
            await asyncio.sleep(self.poll_interval_s)
        if instance is None:
            return HealthObservation(HealthState.UNHEALTHY, False, "readiness timeout")
        observation_deadline = time.monotonic() + observation_s
        while time.monotonic() < observation_deadline:
            status = self.supervisor.statuses[component_id]
            if status.instance_id != instance or status.health not in {
                HealthState.HEALTHY,
                HealthState.DEGRADED,
            }:
                return HealthObservation(status.health, False, "health changed during observation")
            await asyncio.sleep(min(self.poll_interval_s, observation_s))
        return HealthObservation(self.supervisor.statuses[component_id].health, True, "stable")


class UpdateCoordinator:
    def __init__(
        self,
        components: tuple[UpdatableComponent, ...],
        update_store: UpdateStore,
        supervisor_store: SupervisorStore,
        runtime: UpdateRuntime,
        *,
        validator: StructuredValidator | None = None,
        clock: Clock | None = None,
        publish: UpdatePublisher | None = None,
        revoke_capabilities: Callable[[str], object] | None = None,
    ) -> None:
        self.components = {item.component_id: item for item in components}
        if len(self.components) != len(components):
            raise ValueError("updatable component ids must be unique")
        if "sam-supervisor" in self.components:
            raise ValueError("sam-supervisor self-update requires a separate trusted bootstrap")
        self.update_store = update_store
        self.supervisor_store = supervisor_store
        self.runtime = runtime
        self.validator = validator or StructuredValidator()
        self.clock = clock or SystemClock()
        self.publish = publish
        self.revoke_capabilities = revoke_capabilities

    def register_current(self, component_id: str, version: str) -> ComponentVersionState:
        component = self._component(component_id)
        artifact = VersionLayout(component).artifact(version)
        VersionLayout(component).activate(artifact)
        state = ComponentVersionState(
            component_id,
            version,
            str(artifact.path),
            artifact.artifact_hash,
            None,
            version,
        )
        self.update_store.save_component(state)
        return state

    async def prepare(self, request: CandidateRequest) -> UpdateTransaction:
        component = self._component(request.component_id)
        current = self.update_store.component(request.component_id)
        transaction = UpdateTransaction(
            request.component_id,
            request.version,
            request.source_relative,
            request.provenance,
            current_version=current.active_version,
            previous_version=current.active_version,
            last_known_good_version=current.last_known_good_version,
            activation_target=str(VersionLayout(component).active_pointer),
            updated_at_ms=self.clock.wall_time_ms(),
        )
        self.update_store.save_transaction(transaction)
        await self._emit(transaction)
        layout = VersionLayout(component)
        try:
            await self._transition(transaction, UpdateState.VERIFYING)
            verified = await asyncio.to_thread(
                layout.verify_source,
                request.source_relative,
                version=request.version,
                expected_hash=request.expected_hash,
            )
            transaction.artifact_hash = verified.artifact_hash
            await self._transition(transaction, UpdateState.STAGING)
            staged = await asyncio.to_thread(layout.stage, verified, transaction.update_tx_id)
            transaction.candidate_path = str(staged.path)
            await self._transition(transaction, UpdateState.VALIDATING)
            await self.validator.validate(
                component.validation, staged, CancellationToken(transaction.update_tx_id)
            )
            await self._transition(transaction, UpdateState.READY)
            self.update_store.save_component(
                ComponentVersionState(
                    current.component_id,
                    current.active_version,
                    current.active_path,
                    current.active_hash,
                    current.previous_version,
                    current.last_known_good_version,
                    request.version,
                    transaction.update_tx_id,
                )
            )
        except asyncio.CancelledError:
            transaction.error = "candidate validation was cancelled"
            if transaction.state is not UpdateState.FAILED:
                await self._transition(transaction, UpdateState.FAILED)
            await self._cleanup_failed(layout, current)
            raise
        except Exception as error:
            transaction.error = str(error)[:500]
            if transaction.state is not UpdateState.FAILED:
                await self._transition(transaction, UpdateState.FAILED)
            await self._cleanup_failed(layout, current)
            raise
        return transaction

    async def activate(self, update_tx_id: str) -> UpdateTransaction:
        transaction = self.update_store.transaction(update_tx_id)
        if transaction.state is UpdateState.COMMITTED:
            return transaction
        if transaction.state is not UpdateState.READY:
            raise UpdateError("only a READY candidate may be activated")
        component = self._component(transaction.component_id)
        layout = VersionLayout(component)
        candidate = layout.artifact(transaction.candidate_version)
        if candidate.artifact_hash != transaction.artifact_hash:
            transaction.error = "staged candidate hash changed before activation"
            await self._transition(transaction, UpdateState.FAILED)
            raise UpdateError(transaction.error)
        previous = self.update_store.component(component.component_id)
        await self._revoke(f"update:{transaction.update_tx_id}:activation")
        await self._transition(transaction, UpdateState.ACTIVATING)
        transaction.activation_time_ms = self.clock.wall_time_ms()
        self.update_store.save_transaction(transaction)
        try:
            await asyncio.to_thread(layout.activate, candidate)
            self.update_store.save_component(
                ComponentVersionState(
                    previous.component_id,
                    candidate.version,
                    str(candidate.path),
                    candidate.artifact_hash,
                    previous.active_version,
                    previous.last_known_good_version,
                    candidate.version,
                    transaction.update_tx_id,
                )
            )
            await self._transition(transaction, UpdateState.OBSERVING)
            observation = await self.runtime.restart_and_observe(
                component.component_id, candidate.path, component.observation_s
            )
        except Exception as error:
            transaction.error = f"candidate activation failed: {error}"[:500]
            self.update_store.save_transaction(transaction)
            return await self._rollback(transaction, previous, layout)
        transaction.health_result = f"{observation.state}:{observation.detail}"[:500]
        if observation.accepted:
            self.update_store.save_component(
                ComponentVersionState(
                    previous.component_id,
                    candidate.version,
                    str(candidate.path),
                    candidate.artifact_hash,
                    previous.active_version,
                    candidate.version,
                    None,
                    transaction.update_tx_id,
                )
            )
            transaction.last_known_good_version = candidate.version
            await self._transition(transaction, UpdateState.COMMITTED)
            await asyncio.to_thread(
                layout.cleanup_failed,
                keep_versions={candidate.version, previous.active_version},
            )
            return transaction
        return await self._rollback(transaction, previous, layout)

    async def recover_incomplete(self) -> tuple[UpdateTransaction, ...]:
        recovered: list[UpdateTransaction] = []
        for transaction in self.update_store.incomplete():
            if transaction.state is UpdateState.READY:
                recovered.append(transaction)
                continue
            if transaction.state in {
                UpdateState.ACTIVATING,
                UpdateState.OBSERVING,
                UpdateState.ROLLING_BACK,
            }:
                component = self.update_store.component(transaction.component_id)
                recovered.append(
                    await self._rollback(
                        transaction,
                        component,
                        VersionLayout(self._component(transaction.component_id)),
                        recovering=True,
                    )
                )
                continue
            transaction.error = "supervisor restarted before candidate became READY"
            await self._transition(transaction, UpdateState.FAILED)
            recovered.append(transaction)
        return tuple(recovered)

    async def _rollback(
        self,
        transaction: UpdateTransaction,
        version_state: ComponentVersionState,
        layout: VersionLayout,
        *,
        recovering: bool = False,
    ) -> UpdateTransaction:
        if transaction.state is not UpdateState.ROLLING_BACK:
            await self._transition(transaction, UpdateState.ROLLING_BACK)
        try:
            rollback_version = transaction.previous_version or version_state.last_known_good_version
            rollback = layout.artifact(rollback_version)
            await self._revoke(f"update:{transaction.update_tx_id}:rollback")
            await asyncio.to_thread(layout.activate, rollback)
            self.update_store.save_component(
                ComponentVersionState(
                    version_state.component_id,
                    rollback.version,
                    str(rollback.path),
                    rollback.artifact_hash,
                    transaction.candidate_version,
                    rollback.version,
                    transaction.candidate_version,
                    transaction.update_tx_id,
                )
            )
            observation = await self.runtime.restart_and_observe(
                version_state.component_id,
                rollback.path,
                self._component(version_state.component_id).observation_s,
            )
        except Exception as error:
            return await self._fail_rollback(transaction, f"rollback execution failed: {error}")
        transaction.health_result = f"rollback {observation.state}:{observation.detail}"[:500]
        if observation.accepted:
            await self._transition(transaction, UpdateState.ROLLED_BACK)
            self.update_store.save_transaction(transaction)
            await asyncio.to_thread(
                layout.cleanup_failed,
                keep_versions={rollback.version, transaction.candidate_version},
            )
            return transaction
        detail = "rollback target failed health observation" + (
            " during recovery" if recovering else ""
        )
        return await self._fail_rollback(transaction, detail)

    async def _fail_rollback(
        self, transaction: UpdateTransaction, detail: str
    ) -> UpdateTransaction:
        transaction.error = detail[:500]
        await self._transition(transaction, UpdateState.FAILED)
        self.supervisor_store.enter_safe_mode(f"update:{transaction.update_tx_id}:rollback_failed")
        return transaction

    async def _cleanup_failed(self, layout: VersionLayout, current: ComponentVersionState) -> None:
        with contextlib.suppress(UpdateError, OSError):
            await asyncio.to_thread(
                layout.cleanup_failed,
                keep_versions={current.active_version, current.last_known_good_version},
            )

    async def _transition(self, transaction: UpdateTransaction, target: UpdateState) -> None:
        transaction.transition(target, now_ms=self.clock.wall_time_ms())
        self.update_store.save_transaction(transaction)
        await self._emit(transaction)

    async def _emit(self, transaction: UpdateTransaction) -> None:
        if self.publish is None:
            return
        with contextlib.suppress(Exception):
            await self.publish(
                ProtocolEvent(
                    type=EventType.UPDATE_STATE_CHANGED,
                    monotonic_ms=max(0, self.clock.monotonic_ms()),
                    update_tx_id=transaction.update_tx_id,
                    payload={
                        "component_id": transaction.component_id,
                        "state": transaction.state,
                        "candidate_version": transaction.candidate_version,
                        "error": transaction.error,
                    },
                )
            )

    async def _revoke(self, reason: str) -> None:
        self.supervisor_store.revoke_capabilities(reason)
        if self.revoke_capabilities is None:
            return
        result = self.revoke_capabilities(reason)
        if inspect.isawaitable(result):
            await result

    def _component(self, component_id: str) -> UpdatableComponent:
        try:
            return self.components[component_id]
        except KeyError as error:
            raise UpdateError("component is not registered for trusted updates") from error
