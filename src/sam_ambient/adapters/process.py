"""Cross-platform structured subprocess adapter with bounded output."""

from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import time
from collections.abc import Sequence
from pathlib import Path

from sam_ambient.core.tools.process import ProcessOutcome
from sam_ambient.core.turns import CancellationToken

_SAFE_ENVIRONMENT = frozenset(
    {
        "COMSPEC",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "PATH",
        "PATHEXT",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
        "TMPDIR",
        "WINDIR",
    }
)


class SubprocessAdapter:
    async def run(
        self,
        executable: str,
        arguments: Sequence[str],
        *,
        cwd: Path,
        timeout_s: float,
        stdout_limit: int,
        stderr_limit: int,
        cancellation: CancellationToken,
    ) -> ProcessOutcome:
        cancellation.raise_if_cancelled()
        started = time.monotonic_ns()
        platform_options: dict[str, object] = {}
        if os.name == "nt":
            platform_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            platform_options["start_new_session"] = True
        process = await asyncio.create_subprocess_exec(
            executable,
            *arguments,
            cwd=str(cwd),
            env=_safe_environment(),
            stdin=subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            **platform_options,
        )
        if process.stdout is None or process.stderr is None:
            await _stop_process(process)
            raise RuntimeError("subprocess pipes were not created")
        stdout_task = asyncio.create_task(_drain(process.stdout, stdout_limit))
        stderr_task = asyncio.create_task(_drain(process.stderr, stderr_limit))
        wait_task = asyncio.create_task(process.wait())
        cancellation_task = asyncio.create_task(cancellation.wait())
        timed_out = False
        try:
            done, _pending = await asyncio.wait(
                {wait_task, cancellation_task},
                timeout=timeout_s,
                return_when=asyncio.FIRST_COMPLETED,
            )
            if cancellation_task in done:
                await _stop_process(process)
                cancellation.raise_if_cancelled()
            if wait_task not in done:
                timed_out = True
                await _stop_process(process)
            exit_code = await wait_task
            stdout, stderr = await asyncio.gather(stdout_task, stderr_task)
        except BaseException:
            await asyncio.shield(_stop_process(process))
            await asyncio.gather(stdout_task, stderr_task, return_exceptions=True)
            raise
        finally:
            cancellation_task.cancel()
            await asyncio.gather(cancellation_task, return_exceptions=True)
        duration_ms = max(0, (time.monotonic_ns() - started) // 1_000_000)
        return ProcessOutcome(
            exit_code=exit_code,
            stdout=stdout.data.decode("utf-8", errors="replace"),
            stderr=stderr.data.decode("utf-8", errors="replace"),
            stdout_bytes=stdout.total_bytes,
            stderr_bytes=stderr.total_bytes,
            stdout_truncated=stdout.truncated,
            stderr_truncated=stderr.truncated,
            duration_ms=duration_ms,
            timed_out=timed_out,
        )


class _CapturedOutput:
    __slots__ = ("data", "total_bytes", "truncated")

    def __init__(self, data: bytes, total_bytes: int, truncated: bool) -> None:
        self.data = data
        self.total_bytes = total_bytes
        self.truncated = truncated


def _safe_environment() -> dict[str, str]:
    if os.name == "nt":
        return {
            name: value for name, value in os.environ.items() if name.upper() in _SAFE_ENVIRONMENT
        }
    return {name: value for name, value in os.environ.items() if name in _SAFE_ENVIRONMENT}


async def _drain(reader: asyncio.StreamReader, limit: int) -> _CapturedOutput:
    captured = bytearray()
    total = 0
    while chunk := await reader.read(16_384):
        total += len(chunk)
        if len(captured) < limit:
            captured.extend(chunk[: limit - len(captured)])
    return _CapturedOutput(bytes(captured), total, total > limit)


async def _stop_process(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    try:
        if os.name == "nt":
            process.terminate()
        else:
            os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        await asyncio.wait_for(process.wait(), timeout=0.5)
        return
    except TimeoutError:
        pass
    try:
        if os.name == "nt":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return
    await process.wait()
