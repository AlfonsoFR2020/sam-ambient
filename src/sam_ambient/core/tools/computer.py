"""Low-risk system, clipboard, and validated app-open capability boundaries."""

from __future__ import annotations

import os
import platform
from collections.abc import Mapping
from typing import Any, Protocol

from sam_ambient import __version__
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
_OBJECT_RESULT = {"type": "object"}


class ClipboardAdapter(Protocol):
    async def read_text(self) -> str: ...

    async def write_text(self, text: str) -> None: ...


class AppOpenAdapter(Protocol):
    async def open_path(self, path: str) -> None: ...


class SystemInfoTool:
    descriptor = ToolDescriptor(
        id="system.info",
        description="Return a fixed, low-risk summary of the local Sam runtime.",
        input_schema={
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.READ_ONLY,
        platforms=_PLATFORMS,
        requires_confirmation=False,
        supports_cancellation=False,
        timeout_s=2.0,
        side_effect=SideEffect.NONE,
    )

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        del arguments
        cancellation.raise_if_cancelled()
        return ToolResult(
            {
                "os": platform.system(),
                "os_release": platform.release(),
                "architecture": platform.machine(),
                "python": platform.python_version(),
                "python_implementation": platform.python_implementation(),
                "sam_version": __version__,
                "logical_cpu_count": os.cpu_count(),
            }
        )


class ClipboardReadTool:
    descriptor = ToolDescriptor(
        id="clipboard.read",
        description="Read bounded clipboard text after explicit owner approval.",
        input_schema={
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.READ_ONLY,
        platforms=_PLATFORMS,
        requires_confirmation=True,
        supports_cancellation=False,
        timeout_s=2.0,
        side_effect=SideEffect.NONE,
    )

    def __init__(self, adapter: ClipboardAdapter, *, max_chars: int = 32_768) -> None:
        self.adapter = adapter
        self.max_chars = max_chars

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        del arguments
        cancellation.raise_if_cancelled()
        text = await self.adapter.read_text()
        cancellation.raise_if_cancelled()
        if not isinstance(text, str):
            raise ToolError("clipboard adapter returned non-text data")
        truncated = len(text) > self.max_chars
        return ToolResult({"text": text[: self.max_chars], "characters": len(text)}, truncated)


class ClipboardWriteTool:
    descriptor = ToolDescriptor(
        id="clipboard.write",
        description="Replace clipboard text after explicit owner approval.",
        input_schema={
            "type": "object",
            "properties": {"text": {"type": "string", "maxLength": 32_768}},
            "required": ["text"],
            "additionalProperties": False,
        },
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.REVERSIBLE_WRITE,
        platforms=_PLATFORMS,
        requires_confirmation=True,
        supports_cancellation=False,
        timeout_s=2.0,
        side_effect=SideEffect.LOCAL_STATE,
    )

    def __init__(self, adapter: ClipboardAdapter) -> None:
        self.adapter = adapter

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        cancellation.raise_if_cancelled()
        text = str(arguments["text"])
        await self.adapter.write_text(text)
        cancellation.raise_if_cancelled()
        return ToolResult({"written": True, "characters": len(text)})


class AppOpenTool:
    descriptor = ToolDescriptor(
        id="app.open",
        description="Open an authorized local path; disabled by Phase 6A policy.",
        input_schema={
            "type": "object",
            "properties": {
                "root": {"type": "string", "minLength": 1, "maxLength": 64},
                "path": {"type": "string", "minLength": 1, "maxLength": 4096},
            },
            "required": ["root", "path"],
            "additionalProperties": False,
        },
        result_schema=_OBJECT_RESULT,
        risk=RiskClass.EXTERNAL_SIDE_EFFECT,
        platforms=_PLATFORMS,
        requires_confirmation=True,
        supports_cancellation=False,
        timeout_s=3.0,
        side_effect=SideEffect.EXTERNAL,
    )

    def __init__(self, paths: AuthorizedPaths, adapter: AppOpenAdapter) -> None:
        self.paths = paths
        self.adapter = adapter

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        cancellation.raise_if_cancelled()
        target = self.paths.resolve(str(arguments["root"]), str(arguments["path"]))
        await self.adapter.open_path(str(target))
        cancellation.raise_if_cancelled()
        return ToolResult({"opened": True})
