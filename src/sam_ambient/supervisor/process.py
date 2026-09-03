"""Portable trusted subprocess adapter for supervised components."""

from __future__ import annotations

import asyncio
import json
import os
import signal
from typing import Protocol

from sam_ambient.supervisor.models import (
    ComponentSpec,
    HealthReport,
    HealthState,
    LaunchContext,
)

_READY_PREFIX = b"SAM_READY "
_MAX_READY_LINE = 8 * 1024


class ManagedProcess(Protocol):
    @property
    def pid(self) -> int: ...

    async def wait_ready(self, timeout_s: float) -> HealthReport: ...

    async def wait(self) -> int: ...

    async def stop(self, timeout_s: float) -> bool:
        """Stop the process and return whether a forced kill was required."""


class ProcessLauncher(Protocol):
    async def launch(self, spec: ComponentSpec, context: LaunchContext) -> ManagedProcess: ...


class SubprocessLauncher:
    """Launch only trusted argv specifications, never shell strings."""

    async def launch(self, spec: ComponentSpec, context: LaunchContext) -> ManagedProcess:
        command = list(spec.command)
        if spec.component_id == "sam-core":
            command.extend(
                (
                    "--runtime-instance-id",
                    context.instance_id,
                    "--capability-epoch",
                    str(context.capability_epoch),
                    "--state-db",
                    str(context.state_db),
                )
            )
            if context.capabilities_revoked:
                command.append("--capabilities-revoked")
            if context.safe_mode:
                command.append("--safe-mode")
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=spec.cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=None,
            limit=_MAX_READY_LINE,
            start_new_session=os.name != "nt",
        )
        return SubprocessManagedProcess(process)


class SubprocessManagedProcess:
    def __init__(self, process: asyncio.subprocess.Process) -> None:
        self._process = process
        self._drain_task: asyncio.Task[None] | None = None

    @property
    def pid(self) -> int:
        return self._process.pid

    async def wait_ready(self, timeout_s: float) -> HealthReport:
        if self._process.stdout is None:  # pragma: no cover - launcher always pipes stdout
            raise RuntimeError("supervised process has no readiness channel")
        try:
            async with asyncio.timeout(timeout_s):
                while True:
                    line = await self._process.stdout.readline()
                    if not line:
                        raise RuntimeError("component exited before readiness")
                    if not line.startswith(_READY_PREFIX):
                        continue
                    if len(line) > _MAX_READY_LINE:
                        raise RuntimeError("component readiness record is too large")
                    payload = json.loads(line[len(_READY_PREFIX) :])
                    report = HealthReport(
                        HealthState(payload["health"]),
                        payload["instance_id"],
                        str(payload.get("detail", ""))[:500],
                    )
                    self._drain_task = asyncio.create_task(self._drain_stdout())
                    return report
        except TimeoutError:
            raise TimeoutError("component startup timed out") from None
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as error:
            raise RuntimeError("component emitted invalid readiness data") from error

    async def _drain_stdout(self) -> None:
        if self._process.stdout is None:
            return
        try:
            while await self._process.stdout.readline():
                pass
        except (ValueError, asyncio.CancelledError):
            pass

    async def wait(self) -> int:
        return await self._process.wait()

    async def stop(self, timeout_s: float) -> bool:
        if self._process.returncode is not None:
            await self._finish_drain()
            return False
        self._signal(signal.SIGTERM)
        try:
            async with asyncio.timeout(timeout_s):
                await self._process.wait()
            forced = False
        except TimeoutError:
            self._signal(signal.SIGKILL)
            await self._process.wait()
            forced = True
        await self._finish_drain()
        return forced

    def _signal(self, requested: signal.Signals) -> None:
        if os.name != "nt":
            try:
                os.killpg(self._process.pid, requested)
                return
            except ProcessLookupError:
                return
        if requested is signal.SIGTERM:
            try:
                self._process.terminate()
            except ProcessLookupError:
                pass
        else:
            try:
                self._process.kill()
            except ProcessLookupError:
                pass

    async def _finish_drain(self) -> None:
        if self._drain_task is None:
            return
        self._drain_task.cancel()
        await asyncio.gather(self._drain_task, return_exceptions=True)
        self._drain_task = None
