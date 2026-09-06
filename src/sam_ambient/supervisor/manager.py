"""Bounded, LLM-independent supervision and crash recovery."""

from __future__ import annotations

import asyncio
import inspect
import logging
import time
from collections.abc import Callable
from typing import Protocol
from uuid import uuid4

from sam_ambient.supervisor.models import (
    ComponentSpec,
    ComponentStatus,
    HealthState,
    LaunchContext,
)
from sam_ambient.supervisor.persistence import CrashRecord, SupervisorStore
from sam_ambient.supervisor.process import ManagedProcess, ProcessLauncher

log = logging.getLogger(__name__)


class Clock(Protocol):
    def monotonic_ms(self) -> int: ...

    def wall_time_ms(self) -> int: ...

    async def sleep(self, seconds: float) -> None: ...


class SystemClock:
    def monotonic_ms(self) -> int:
        return time.monotonic_ns() // 1_000_000

    def wall_time_ms(self) -> int:
        return time.time_ns() // 1_000_000

    async def sleep(self, seconds: float) -> None:
        await asyncio.sleep(seconds)


class Supervisor:
    """Own trusted component lifecycles, not conversation or model decisions."""

    def __init__(
        self,
        components: tuple[ComponentSpec, ...],
        launcher: ProcessLauncher,
        store: SupervisorStore,
        *,
        clock: Clock | None = None,
        revoke_capabilities: Callable[[str], object] | None = None,
        on_ready: Callable[[str], None] | None = None,
    ) -> None:
        ids = [item.component_id for item in components]
        if len(ids) != len(set(ids)):
            raise ValueError("supervised component ids must be unique")
        self.components = components
        self.launcher = launcher
        self.store = store
        self.clock = clock or SystemClock()
        self.revoke_capabilities = revoke_capabilities
        self.on_ready = on_ready
        self.statuses = {
            item.component_id: store.load_status(item.component_id)
            or ComponentStatus(item.component_id)
            for item in components
        }
        self.safe_mode = store.security_state().safe_mode
        self._processes: dict[str, ManagedProcess] = {}
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._shutdown = asyncio.Event()
        self._shutdown_lock = asyncio.Lock()
        self._planned_restarts: set[str] = set()
        self._started = False

    @property
    def health(self) -> HealthState:
        if self.safe_mode:
            return HealthState.SAFE_MODE
        states = {status.health for status in self.statuses.values()}
        if HealthState.UNHEALTHY in states or HealthState.CRASH_LOOP in states:
            return HealthState.UNHEALTHY
        if HealthState.DEGRADED in states:
            return HealthState.DEGRADED
        if states and states <= {HealthState.HEALTHY}:
            return HealthState.HEALTHY
        if HealthState.STARTING in states:
            return HealthState.STARTING
        return HealthState.STOPPED

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        log.info("Supervisor started%s", " in safe mode" if self.safe_mode else "")
        for spec in self.components:
            if self.safe_mode and spec.critical:
                status = self.statuses[spec.component_id]
                status.health = HealthState.SAFE_MODE
                status.last_exit_reason = "persisted_safe_mode"
                self.store.save_status(status)
                continue
            self._tasks[spec.component_id] = asyncio.create_task(self._monitor(spec))

    async def run_forever(self) -> None:
        await self.start()
        await self._shutdown.wait()

    async def wait_component(self, component_id: str) -> None:
        task = self._tasks.get(component_id)
        if task is not None:
            await task

    def accepts_event(self, component_id: str, instance_id: str) -> bool:
        status = self.statuses.get(component_id)
        return status is not None and status.instance_id == instance_id

    async def restart_component(self, component_id: str) -> None:
        """Request one trusted planned restart without counting it as a crash."""

        if component_id not in self.statuses:
            raise ValueError("unknown supervised component")
        process = self._processes.get(component_id)
        if process is None:
            raise RuntimeError("component is not currently running")
        spec = next(item for item in self.components if item.component_id == component_id)
        self._planned_restarts.add(component_id)
        await process.stop(spec.restart.shutdown_timeout_s)

    async def shutdown(self) -> None:
        async with self._shutdown_lock:
            if self._shutdown.is_set():
                return
            self._shutdown.set()
            log.info("Shutting down Sam managed components")
            for spec in reversed(self.components):
                process = self._processes.get(spec.component_id)
                if process is not None:
                    await process.stop(spec.restart.shutdown_timeout_s)
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
            for status in self.statuses.values():
                if status.health not in {HealthState.CRASH_LOOP, HealthState.SAFE_MODE}:
                    status.health = HealthState.STOPPED
                    self.store.save_status(status)
            log.info("Sam stopped")

    async def _monitor(self, spec: ComponentSpec) -> None:
        status = self.statuses[spec.component_id]
        current_wall_ms = self.clock.wall_time_ms()
        window_ms = int(spec.restart.crash_window_s * 1000)
        crash_times = [
            item.timestamp_ms
            for item in self.store.crashes()
            if item.component_id == spec.component_id
            and current_wall_ms - item.timestamp_ms <= window_ms
        ]
        while not self._shutdown.is_set():
            security = self.store.security_state()
            context = LaunchContext(
                instance_id=str(uuid4()),
                capability_epoch=security.capability_epoch,
                capabilities_revoked=security.capabilities_revoked,
                safe_mode=security.safe_mode,
                state_db=self.store.path,
            )
            status.instance_id = context.instance_id
            status.health = HealthState.STARTING
            status.last_start_ms = self.clock.monotonic_ms()
            status.last_exit_code = None
            status.last_exit_reason = None
            self.store.save_status(status)
            process: ManagedProcess | None = None
            ready_at: int | None = None
            exit_code: int | None = None
            reason = "startup_failed"
            log.info("Starting %s (restart count %d)", spec.component_id, status.restart_count)
            try:
                process = await self.launcher.launch(spec, context)
                self._processes[spec.component_id] = process
                status.pid = process.pid
                self.store.save_status(status)
                ready_task = asyncio.create_task(process.wait_ready(spec.restart.startup_timeout_s))
                exit_task = asyncio.create_task(process.wait())
                done, _ = await asyncio.wait(
                    {ready_task, exit_task}, return_when=asyncio.FIRST_COMPLETED
                )
                if exit_task in done:
                    exit_code = exit_task.result()
                    ready_task.cancel()
                    await asyncio.gather(ready_task, return_exceptions=True)
                    reason = "exit_before_ready"
                else:
                    try:
                        report = ready_task.result()
                    except TimeoutError:
                        reason = "startup_timeout"
                        await process.stop(spec.restart.shutdown_timeout_s)
                        exit_code = await exit_task
                    except Exception:
                        reason = "invalid_readiness"
                        await process.stop(spec.restart.shutdown_timeout_s)
                        exit_code = await exit_task
                    else:
                        if report.instance_id != context.instance_id:
                            reason = "stale_readiness"
                            await process.stop(spec.restart.shutdown_timeout_s)
                            exit_code = await exit_task
                        else:
                            ready_at = self.clock.monotonic_ms()
                            status.health = report.state
                            status.last_healthy_ms = ready_at
                            self.store.save_status(status)
                            log.info("%s ready: %s", spec.component_id, report.state)
                            if self.on_ready is not None:
                                self.on_ready(spec.component_id)
                            exit_code = await exit_task
                            reason = "unexpected_exit"
            except (OSError, RuntimeError) as error:
                reason = f"launch_failed:{type(error).__name__}"
            finally:
                self._processes.pop(spec.component_id, None)
                status.pid = None

            if self._shutdown.is_set():
                status.health = HealthState.STOPPED
                self.store.save_status(status)
                return

            if spec.component_id in self._planned_restarts:
                self._planned_restarts.discard(spec.component_id)
                status.health = HealthState.STOPPED
                status.last_exit_reason = "planned_restart"
                self.store.save_status(status)
                continue

            now = self.clock.monotonic_ms()
            if ready_at is not None and now - ready_at >= int(spec.restart.stable_after_s * 1000):
                crash_times.clear()
            wall_now = self.clock.wall_time_ms()
            crash_times = [item for item in crash_times if wall_now - item <= window_ms]
            crash_times.append(wall_now)
            status.restart_count += 1
            status.last_exit_code = exit_code
            status.last_exit_reason = reason
            status.health = HealthState.UNHEALTHY
            if spec.critical:
                await self._revoke(f"{spec.component_id}:{reason}")

            crash_loop = len(crash_times) >= spec.restart.maximum_failures
            action = (
                "safe_mode"
                if crash_loop and spec.critical
                else ("stop_restarts" if crash_loop else "restart")
            )
            if crash_loop:
                status.health = HealthState.CRASH_LOOP
                if spec.critical:
                    self.store.enter_safe_mode(f"{spec.component_id}:crash_loop")
                    self.safe_mode = True
            self.store.save_status(status)
            self.store.append_crash(
                CrashRecord(
                    wall_now,
                    spec.component_id,
                    exit_code,
                    reason,
                    status.restart_count,
                    action,
                    status.instance_id,
                )
            )
            if crash_loop:
                log.error("%s crash loop: %s", spec.component_id, action)
                return
            log.warning(
                "%s failed (%s); restart in %.1fs",
                spec.component_id,
                reason,
                spec.restart.delay_for(status.restart_count),
            )
            await self._sleep_or_shutdown(spec.restart.delay_for(status.restart_count))

    async def _revoke(self, reason: str) -> None:
        log.warning("Capabilities revoked: %s", reason)
        self.store.revoke_capabilities(reason)
        if self.revoke_capabilities is None:
            return
        result = self.revoke_capabilities(reason)
        if inspect.isawaitable(result):
            await result

    async def _sleep_or_shutdown(self, seconds: float) -> None:
        sleep_task = asyncio.create_task(self.clock.sleep(seconds))
        shutdown_task = asyncio.create_task(self._shutdown.wait())
        done, pending = await asyncio.wait(
            {sleep_task, shutdown_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
        for task in done:
            task.result()
