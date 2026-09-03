"""Structured, approval-gated process execution capability."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from sam_ambient.core.tools.filesystem import AuthorizedPaths
from sam_ambient.core.tools.models import (
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolError,
    ToolResult,
)
from sam_ambient.core.turns import CancellationToken

_PLATFORMS = ("linux", "windows", "darwin")


@dataclass(frozen=True, slots=True)
class ProcessOutcome:
    exit_code: int | None
    stdout: str
    stderr: str
    stdout_bytes: int
    stderr_bytes: int
    stdout_truncated: bool
    stderr_truncated: bool
    duration_ms: int
    timed_out: bool


class ProcessAdapter(Protocol):
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
    ) -> ProcessOutcome: ...


class ProcessRunTool:
    """Run one argv command without invoking a command shell."""

    descriptor = ToolDescriptor(
        id="process.run",
        description=(
            "Run an explicit executable and argument vector in an authorized working directory "
            "after owner approval; no shell parsing is used."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "executable": {"type": "string", "minLength": 1, "maxLength": 1024},
                "args": {
                    "type": "array",
                    "items": {"type": "string", "maxLength": 512},
                    "maxItems": 32,
                },
                "root": {"type": "string", "minLength": 1, "maxLength": 64},
                "cwd": {"type": "string", "maxLength": 4096},
                "timeout_s": {"type": "number", "minimum": 0.05, "maximum": 30},
                "stdout_limit": {"type": "integer", "minimum": 1, "maximum": 131_072},
                "stderr_limit": {"type": "integer", "minimum": 1, "maximum": 131_072},
            },
            "required": ["executable", "root"],
            "additionalProperties": False,
        },
        result_schema={"type": "object"},
        risk=RiskClass.EXTERNAL_SIDE_EFFECT,
        platforms=_PLATFORMS,
        requires_confirmation=True,
        supports_cancellation=True,
        timeout_s=35.0,
        side_effect=SideEffect.EXTERNAL,
    )

    def __init__(self, paths: AuthorizedPaths, adapter: ProcessAdapter) -> None:
        self.paths = paths
        self.adapter = adapter

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        executable = str(arguments["executable"])
        argv = tuple(str(item) for item in arguments.get("args", ()))
        if "\x00" in executable or any("\x00" in item for item in argv):
            raise ToolError("process executable and arguments cannot contain NUL bytes")
        cwd = self.paths.resolve(
            str(arguments["root"]),
            str(arguments.get("cwd", ".")),
        )
        if not cwd.is_dir():
            raise ToolError("process working directory must be a directory")
        cancellation.raise_if_cancelled()
        outcome = await self.adapter.run(
            executable,
            argv,
            cwd=cwd,
            timeout_s=float(arguments.get("timeout_s", 15.0)),
            stdout_limit=int(arguments.get("stdout_limit", 32_768)),
            stderr_limit=int(arguments.get("stderr_limit", 32_768)),
            cancellation=cancellation,
        )
        cancellation.raise_if_cancelled()
        return ToolResult(
            {
                "executable": executable,
                "args": list(argv),
                "cwd": self.paths.relative(str(arguments["root"]), cwd),
                "exit_code": outcome.exit_code,
                "stdout": outcome.stdout,
                "stderr": outcome.stderr,
                "stdout_bytes": outcome.stdout_bytes,
                "stderr_bytes": outcome.stderr_bytes,
                "stdout_truncated": outcome.stdout_truncated,
                "stderr_truncated": outcome.stderr_truncated,
                "duration_ms": outcome.duration_ms,
                "timed_out": outcome.timed_out,
            },
            truncated=outcome.stdout_truncated or outcome.stderr_truncated,
        )
