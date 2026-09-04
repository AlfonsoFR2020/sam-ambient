from __future__ import annotations

import asyncio
from pathlib import Path

from sam_ambient.core.tools import CapabilityAuthority, ToolInvocation
from sam_ambient.supervisor import (
    ComponentSpec,
    CrashRecord,
    HealthReport,
    HealthState,
    RestartPolicy,
    Supervisor,
    SupervisorStore,
)


class VirtualClock:
    def __init__(self) -> None:
        self.now_ms = 0
        self.sleeps: list[float] = []

    def monotonic_ms(self) -> int:
        return self.now_ms

    def wall_time_ms(self) -> int:
        return 1_000_000 + self.now_ms

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now_ms += int(seconds * 1000)
        await asyncio.sleep(0)

    def advance(self, seconds: float) -> None:
        self.now_ms += int(seconds * 1000)


class FakeProcess:
    def __init__(
        self,
        pid: int,
        *,
        report: HealthReport | None = None,
        ready_error: Exception | None = None,
        forced_stop: bool = False,
    ) -> None:
        self.pid = pid
        self.report = report
        self.ready = asyncio.Event()
        if report is not None:
            self.ready.set()
        self.ready_error = ready_error
        self.forced_stop = forced_stop
        self.exit: asyncio.Future[int] | None = None
        self.stop_calls = 0

    async def wait_ready(self, timeout_s: float) -> HealthReport:
        del timeout_s
        if self.ready_error is not None:
            raise self.ready_error
        if self.report is not None:
            return self.report
        await self.ready.wait()
        if self.report is None:  # pragma: no cover - event/report are set together
            raise RuntimeError("fake readiness missing")
        return self.report

    async def wait(self) -> int:
        if self.exit is None:
            self.exit = asyncio.get_running_loop().create_future()
        return await self.exit

    async def stop(self, timeout_s: float) -> bool:
        del timeout_s
        self.stop_calls += 1
        if self.exit is None:
            self.exit = asyncio.get_running_loop().create_future()
        if not self.exit.done():
            self.exit.set_result(-9 if self.forced_stop else 0)
        return self.forced_stop

    def crash(self, code: int = 1) -> None:
        if self.exit is None:
            self.exit = asyncio.get_running_loop().create_future()
        if not self.exit.done():
            self.exit.set_result(code)


class FakeLauncher:
    def __init__(self, processes: list[FakeProcess]) -> None:
        self.processes = processes
        self.contexts = []
        self.launch_count = 0

    async def launch(self, spec, context):
        del spec
        process = self.processes[self.launch_count]
        process.report = (
            HealthReport(process.report.state, context.instance_id, process.report.detail)
            if process.report is not None
            else None
        )
        self.launch_count += 1
        self.contexts.append(context)
        return process


async def eventually(predicate, *, attempts: int = 200) -> None:
    for _ in range(attempts):
        if predicate():
            return
        await asyncio.sleep(0)
    raise AssertionError("condition was not reached")


def policy(*, maximum_failures: int = 3, stable_after_s: float = 10) -> RestartPolicy:
    return RestartPolicy(
        startup_timeout_s=1,
        restart_delay_s=0.1,
        maximum_restart_delay_s=0.2,
        crash_window_s=60,
        maximum_failures=maximum_failures,
        stable_after_s=stable_after_s,
        shutdown_timeout_s=0.1,
    )


def spec(tmp_path: Path, *, critical: bool = True, maximum_failures: int = 3) -> ComponentSpec:
    return ComponentSpec(
        "sam-core" if critical else "sam-ui",
        ("trusted-program", "--fixed-config"),
        tmp_path,
        critical=critical,
        restart=policy(maximum_failures=maximum_failures),
    )


def healthy(pid: int) -> FakeProcess:
    return FakeProcess(pid, report=HealthReport(HealthState.HEALTHY, "placeholder"))


def degraded(pid: int) -> FakeProcess:
    return FakeProcess(
        pid,
        report=HealthReport(HealthState.DEGRADED, "placeholder", "provider offline"),
    )


def test_normal_start_readiness_and_idempotent_shutdown(tmp_path: Path) -> None:
    async def scenario() -> None:
        process = healthy(10)
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor((spec(tmp_path),), FakeLauncher([process]), store)
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)

        await supervisor.shutdown()
        await supervisor.shutdown()

        assert process.stop_calls == 1
        assert supervisor.health is HealthState.STOPPED
        assert store.load_status("sam-core").health is HealthState.STOPPED  # type: ignore[union-attr]

    asyncio.run(scenario())


def test_startup_timeout_is_bounded_and_forces_stop(tmp_path: Path) -> None:
    async def scenario() -> None:
        process = FakeProcess(11, ready_error=TimeoutError(), forced_stop=True)
        supervisor = Supervisor(
            (spec(tmp_path, maximum_failures=1),),
            FakeLauncher([process]),
            SupervisorStore(tmp_path / "state.db"),
        )
        await supervisor.start()
        await supervisor.wait_component("sam-core")

        status = supervisor.statuses["sam-core"]
        assert process.stop_calls == 1
        assert status.health is HealthState.CRASH_LOOP
        assert status.last_exit_reason == "startup_timeout"
        assert supervisor.safe_mode is True

    asyncio.run(scenario())


def test_crash_restarts_with_bounded_backoff_and_fresh_instance(tmp_path: Path) -> None:
    async def scenario() -> None:
        first, second = healthy(20), healthy(21)
        clock = VirtualClock()
        launcher = FakeLauncher([first, second])
        supervisor = Supervisor(
            (spec(tmp_path),), launcher, SupervisorStore(tmp_path / "state.db"), clock=clock
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        old_instance = launcher.contexts[0].instance_id
        first.crash()
        await eventually(lambda: launcher.launch_count == 2)
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)

        assert supervisor.statuses["sam-core"].restart_count == 1
        assert clock.sleeps == [0.1]
        assert launcher.contexts[1].instance_id != old_instance
        assert supervisor.accepts_event("sam-core", old_instance) is False
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_trusted_planned_restart_changes_instance_without_counting_a_crash(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        first, second = healthy(22), healthy(23)
        launcher = FakeLauncher([first, second])
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor(
            (spec(tmp_path),), launcher, store, clock=VirtualClock()
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        prior = supervisor.statuses["sam-core"].instance_id
        await supervisor.restart_component("sam-core")
        await eventually(lambda: launcher.launch_count == 2)
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)

        assert supervisor.statuses["sam-core"].instance_id != prior
        assert supervisor.statuses["sam-core"].restart_count == 0
        assert store.crashes() == ()
        assert store.security_state().capabilities_revoked is False
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_repeated_critical_crashes_enter_safe_mode_without_infinite_restart(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        processes = [healthy(30), healthy(31), healthy(32)]
        launcher = FakeLauncher(processes)
        clock = VirtualClock()
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor((spec(tmp_path),), launcher, store, clock=clock)
        await supervisor.start()
        for index, process in enumerate(processes, start=1):
            await eventually(lambda index=index: launcher.launch_count == index)
            await eventually(lambda: supervisor.health is HealthState.HEALTHY)
            process.crash()
        await supervisor.wait_component("sam-core")

        assert launcher.launch_count == 3
        assert supervisor.statuses["sam-core"].health is HealthState.CRASH_LOOP
        assert supervisor.health is HealthState.SAFE_MODE
        assert store.security_state().safe_mode is True
        assert [item.action for item in store.crashes()] == ["restart", "restart", "safe_mode"]

    asyncio.run(scenario())


def test_stable_health_ages_prior_failures_out_of_crash_window(tmp_path: Path) -> None:
    async def scenario() -> None:
        first, second, third = healthy(40), healthy(41), healthy(42)
        clock = VirtualClock()
        launcher = FakeLauncher([first, second, third])
        component = ComponentSpec(
            "sam-core",
            ("trusted",),
            tmp_path,
            restart=policy(maximum_failures=2, stable_after_s=1),
        )
        supervisor = Supervisor(
            (component,), launcher, SupervisorStore(tmp_path / "state.db"), clock=clock
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        clock.advance(2)
        first.crash()
        await eventually(lambda: launcher.launch_count == 2)
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        clock.advance(2)
        second.crash()
        await eventually(lambda: launcher.launch_count == 3)

        assert supervisor.safe_mode is False
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_optional_component_crash_loop_does_not_put_system_in_safe_mode(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        process = healthy(50)
        supervisor = Supervisor(
            (spec(tmp_path, critical=False, maximum_failures=1),),
            FakeLauncher([process]),
            SupervisorStore(tmp_path / "state.db"),
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        process.crash()
        await supervisor.wait_component("sam-ui")

        assert supervisor.safe_mode is False
        assert supervisor.statuses["sam-ui"].health is HealthState.CRASH_LOOP

    asyncio.run(scenario())


def test_degraded_provider_health_keeps_core_alive_without_restart(tmp_path: Path) -> None:
    async def scenario() -> None:
        process = degraded(60)
        launcher = FakeLauncher([process])
        supervisor = Supervisor((spec(tmp_path),), launcher, SupervisorStore(tmp_path / "state.db"))
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.DEGRADED)

        assert launcher.launch_count == 1
        assert supervisor.statuses["sam-core"].last_exit_reason is None
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_core_crash_revokes_authority_and_restart_cannot_reuse_old_lease(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        invocation = ToolInvocation("call", "files.read", {"root_id": "workspace", "path": "x"})
        lease = authority.issue_lease(invocation)
        first, second = healthy(70), healthy(71)
        launcher = FakeLauncher([first, second])
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor(
            (spec(tmp_path),),
            launcher,
            store,
            clock=VirtualClock(),
            revoke_capabilities=authority.revoke,
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        first.crash()
        await eventually(lambda: launcher.launch_count == 2)

        assert authority.is_valid(lease, invocation) is False
        assert launcher.contexts[1].capabilities_revoked is True
        assert launcher.contexts[1].capability_epoch > launcher.contexts[0].capability_epoch
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_persisted_safe_mode_does_not_start_critical_component(tmp_path: Path) -> None:
    async def scenario() -> None:
        store = SupervisorStore(tmp_path / "state.db")
        store.enter_safe_mode("prior crash loop")
        launcher = FakeLauncher([healthy(80)])
        supervisor = Supervisor((spec(tmp_path),), launcher, store)
        await supervisor.start()

        assert launcher.launch_count == 0
        assert supervisor.health is HealthState.SAFE_MODE
        assert supervisor.statuses["sam-core"].health is HealthState.SAFE_MODE
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_restart_window_survives_supervisor_process_restart(tmp_path: Path) -> None:
    async def scenario() -> None:
        store = SupervisorStore(tmp_path / "state.db")
        for timestamp in (999_900, 999_950):
            store.append_crash(CrashRecord(timestamp, "sam-core", 1, "prior", 1, "restart", "old"))
        process = healthy(81)
        supervisor = Supervisor(
            (spec(tmp_path),), FakeLauncher([process]), store, clock=VirtualClock()
        )
        await supervisor.start()
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)
        process.crash()
        await supervisor.wait_component("sam-core")

        assert supervisor.health is HealthState.SAFE_MODE
        assert supervisor.statuses["sam-core"].restart_count == 1

    asyncio.run(scenario())


def test_component_spec_rejects_model_shaped_shell_or_missing_cwd(tmp_path: Path) -> None:
    # The only public construction path is trusted argv; there is no supervisor protocol/tool.
    try:
        ComponentSpec("Bad ID", ("cmd /c model text",), tmp_path)
    except ValueError as error:
        assert "component_id" in str(error)
    else:  # pragma: no cover - assertion guard
        raise AssertionError("invalid model-shaped spec was accepted")
    try:
        ComponentSpec("sam-core", ("trusted",), tmp_path / "missing")
    except FileNotFoundError:
        pass
    else:  # pragma: no cover - assertion guard
        raise AssertionError("missing cwd was accepted")
