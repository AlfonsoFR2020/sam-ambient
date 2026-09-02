"""Provider-neutral capability metadata and invocation results."""

from __future__ import annotations

import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from enum import StrEnum
from types import MappingProxyType
from typing import Any

from sam_ambient.core.providers import ToolSchema

_TOOL_ID = re.compile(r"^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$")


class RiskClass(StrEnum):
    READ_ONLY = "READ_ONLY"
    REVERSIBLE_WRITE = "REVERSIBLE_WRITE"
    EXTERNAL_SIDE_EFFECT = "EXTERNAL_SIDE_EFFECT"
    PRIVILEGED = "PRIVILEGED"
    DESTRUCTIVE = "DESTRUCTIVE"


class SideEffect(StrEnum):
    NONE = "none"
    LOCAL_STATE = "local_state"
    EXTERNAL = "external"
    PRIVILEGED = "privileged"
    DESTRUCTIVE = "destructive"


class ToolStatus(StrEnum):
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    DENIED = "denied"
    STALE = "stale"


class ToolError(RuntimeError):
    """A bounded, user-safe tool execution failure."""


class UnknownToolError(ToolError):
    pass


class MalformedToolArguments(ToolError):
    pass


@dataclass(frozen=True, slots=True)
class ToolDescriptor:
    id: str
    description: str
    input_schema: Mapping[str, Any]
    result_schema: Mapping[str, Any]
    risk: RiskClass
    platforms: tuple[str, ...]
    requires_confirmation: bool
    supports_cancellation: bool
    timeout_s: float
    side_effect: SideEffect

    def __post_init__(self) -> None:
        if not _TOOL_ID.fullmatch(self.id):
            raise ValueError("tool id must be a stable namespaced identifier")
        if not self.description.strip():
            raise ValueError("tool description must be non-blank")
        if not self.platforms or any(not item.strip() for item in self.platforms):
            raise ValueError("tool platforms must be non-empty")
        if self.timeout_s <= 0:
            raise ValueError("tool timeout must be positive")
        for name, schema in (("input", self.input_schema), ("result", self.result_schema)):
            if not isinstance(schema, Mapping):
                raise ValueError(f"tool {name} schema must be an object")
            try:
                json.dumps(dict(schema), allow_nan=False)
            except (TypeError, ValueError) as error:
                raise ValueError(f"tool {name} schema must be JSON-compatible") from error
        object.__setattr__(self, "input_schema", MappingProxyType(dict(self.input_schema)))
        object.__setattr__(self, "result_schema", MappingProxyType(dict(self.result_schema)))

    def provider_schema(self) -> ToolSchema:
        return ToolSchema(self.id, self.description, self.input_schema)


@dataclass(frozen=True, slots=True)
class ToolInvocation:
    tool_call_id: str
    tool_id: str
    arguments: Mapping[str, Any] = field(default_factory=dict)
    session_id: str | None = None
    turn_id: str | None = None
    generation_id: str | None = None
    cancellation_id: str | None = None

    def __post_init__(self) -> None:
        if not self.tool_call_id.strip():
            raise ValueError("tool_call_id must be non-blank")
        if len(self.tool_call_id) > 256:
            raise ValueError("tool_call_id exceeds 256 characters")
        if not _TOOL_ID.fullmatch(self.tool_id):
            raise ValueError("tool_id must be a namespaced identifier")
        if not isinstance(self.arguments, Mapping):
            raise ValueError("tool arguments must be an object")
        for name in ("session_id", "turn_id", "generation_id", "cancellation_id"):
            value = getattr(self, name)
            if value is not None and not value.strip():
                raise ValueError(f"{name} must be non-blank when present")
        copied = dict(self.arguments)
        try:
            encoded = json.dumps(copied, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise ValueError("tool arguments must be finite JSON data") from error
        if len(encoded.encode("utf-8")) > 64 * 1024:
            raise ValueError("tool arguments exceed 64 KiB")
        object.__setattr__(self, "arguments", MappingProxyType(copied))

    @property
    def authority_identity(
        self,
    ) -> tuple[
        str | None,
        str | None,
        str | None,
        str | None,
        str,
        str,
        str,
    ]:
        arguments = json.dumps(
            dict(self.arguments),
            allow_nan=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        return (
            self.session_id,
            self.turn_id,
            self.generation_id,
            self.cancellation_id,
            self.tool_call_id,
            self.tool_id,
            arguments,
        )


@dataclass(frozen=True, slots=True)
class ToolResult:
    data: Mapping[str, Any]
    truncated: bool = False

    def __post_init__(self) -> None:
        if not isinstance(self.data, Mapping):
            raise ToolError("tool result must be an object")
        copied = dict(self.data)
        try:
            encoded = json.dumps(copied, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise ToolError("tool result must be finite JSON data") from error
        if len(encoded.encode("utf-8")) > 512 * 1024:
            raise ToolError("tool result exceeds the hard 512 KiB boundary")
        object.__setattr__(self, "data", MappingProxyType(copied))


@dataclass(frozen=True, slots=True)
class ToolExecution:
    invocation: ToolInvocation
    status: ToolStatus
    result: ToolResult | None = None
    error: str | None = None
