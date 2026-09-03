from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from sam_ambient.core.tools import CapabilityAuthority, ToolInvocation
from sam_ambient.supervisor import (
    ComponentSpec,
    HealthState,
    RestartPolicy,
    SubprocessLauncher,
    Supervisor,
    SupervisorStore,
)


async def eventually(predicate, *, attempts: int = 500) -> None:
    for _ in range(attempts):
        if predicate():
            return
        await asyncio.sleep(0.01)
    raise AssertionError("condition was not reached")


def component(tmp_path: Path, mode: str, maximum_failures: int) -> ComponentSpec:
    fixture = Path(__file__).parents[1] / "fixtures/supervised_child.py"
    return ComponentSpec(
        "sam-core",
        (
            sys.executable,
            str(fixture),
            "--mode",
            mode,
            "--counter",
            str(tmp_path / "starts.txt"),
        ),
        tmp_path,
        restart=RestartPolicy(
            startup_timeout_s=2,
            restart_delay_s=0.01,
            maximum_restart_delay_s=0.02,
            crash_window_s=10,
            maximum_failures=maximum_failures,
            stable_after_s=5,
            shutdown_timeout_s=0.5,
        ),
    )


def test_real_child_crash_revokes_and_restarts_with_fresh_instance(tmp_path: Path) -> None:
    async def scenario() -> None:
        store = SupervisorStore(tmp_path / "state.db")
        authority = CapabilityAuthority()
        invocation = ToolInvocation("old-call", "files.read", {})
        lease = authority.issue_lease(invocation)
        supervisor = Supervisor(
            (component(tmp_path, "crash-once", 3),),
            SubprocessLauncher(),
            store,
            revoke_capabilities=authority.revoke,
        )
        await supervisor.start()
        await eventually(lambda: supervisor.statuses["sam-core"].restart_count == 1)
        await eventually(lambda: supervisor.health is HealthState.HEALTHY)

        assert int((tmp_path / "starts.txt").read_text(encoding="utf-8")) == 2
        assert authority.is_valid(lease, invocation) is False
        assert store.security_state().capabilities_revoked is True
        assert supervisor.statuses["sam-core"].instance_id is not None
        await supervisor.shutdown()

    asyncio.run(scenario())


def test_real_repeated_crashes_stop_at_threshold_and_enter_safe_mode(tmp_path: Path) -> None:
    async def scenario() -> None:
        store = SupervisorStore(tmp_path / "state.db")
        supervisor = Supervisor(
            (component(tmp_path, "always-crash", 3),),
            SubprocessLauncher(),
            store,
        )
        await supervisor.start()
        await supervisor.wait_component("sam-core")

        assert int((tmp_path / "starts.txt").read_text(encoding="utf-8")) == 3
        assert supervisor.health is HealthState.SAFE_MODE
        assert supervisor.statuses["sam-core"].restart_count == 3
        assert len(store.crashes()) == 3

    asyncio.run(scenario())
