"""Small explicit tool registry with bounded JSON-schema validation."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import Any, Protocol

from sam_ambient.core.providers import ToolSchema
from sam_ambient.core.tools.models import (
    MalformedToolArguments,
    ToolDescriptor,
    ToolResult,
    UnknownToolError,
)
from sam_ambient.core.turns import CancellationToken


class ToolHandler(Protocol):
    descriptor: ToolDescriptor

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult: ...


class FunctionTool:
    def __init__(
        self,
        descriptor: ToolDescriptor,
        execute: Callable[[Mapping[str, Any], CancellationToken], Awaitable[ToolResult]],
    ) -> None:
        self.descriptor = descriptor
        self._execute = execute

    async def execute(
        self,
        arguments: Mapping[str, Any],
        cancellation: CancellationToken,
    ) -> ToolResult:
        return await self._execute(arguments, cancellation)


class ToolRegistry:
    def __init__(self, tools: Sequence[ToolHandler] = ()) -> None:
        self._tools: dict[str, ToolHandler] = {}
        for tool in tools:
            self.register(tool)

    def register(self, tool: ToolHandler) -> None:
        tool_id = tool.descriptor.id
        if tool_id in self._tools:
            raise ValueError(f"duplicate tool id: {tool_id}")
        self._tools[tool_id] = tool

    def get(self, tool_id: str) -> ToolHandler:
        try:
            return self._tools[tool_id]
        except KeyError as error:
            raise UnknownToolError(f"unknown tool: {tool_id}") from error

    def descriptors(self) -> tuple[ToolDescriptor, ...]:
        return tuple(tool.descriptor for tool in self._tools.values())

    def provider_schemas(self) -> tuple[ToolSchema, ...]:
        return tuple(descriptor.provider_schema() for descriptor in self.descriptors())

    def validate(self, tool: ToolHandler, arguments: Mapping[str, Any]) -> None:
        _validate_value(dict(tool.descriptor.input_schema), arguments, "arguments")


def _validate_value(schema: Mapping[str, Any], value: Any, path: str) -> None:
    expected = schema.get("type")
    if expected == "object":
        if not isinstance(value, Mapping):
            raise MalformedToolArguments(f"{path} must be an object")
        properties = schema.get("properties", {})
        if not isinstance(properties, Mapping):
            raise RuntimeError("invalid registered tool schema")
        required = schema.get("required", ())
        if not isinstance(required, list):
            raise RuntimeError("invalid registered tool schema")
        missing = [name for name in required if name not in value]
        if missing:
            raise MalformedToolArguments(f"missing required arguments: {', '.join(missing)}")
        if schema.get("additionalProperties") is False:
            unexpected = set(value).difference(properties)
            if unexpected:
                raise MalformedToolArguments(
                    f"unexpected arguments: {', '.join(sorted(str(item) for item in unexpected))}"
                )
        for name, item in value.items():
            item_schema = properties.get(name)
            if isinstance(item_schema, Mapping):
                _validate_value(item_schema, item, f"{path}.{name}")
        return
    if expected == "string":
        if not isinstance(value, str):
            raise MalformedToolArguments(f"{path} must be a string")
        minimum = schema.get("minLength")
        maximum = schema.get("maxLength")
        if isinstance(minimum, int) and len(value) < minimum:
            raise MalformedToolArguments(f"{path} is too short")
        if isinstance(maximum, int) and len(value) > maximum:
            raise MalformedToolArguments(f"{path} is too long")
        enum = schema.get("enum")
        if isinstance(enum, list) and value not in enum:
            raise MalformedToolArguments(f"{path} has an unsupported value")
        return
    if expected == "integer":
        if not isinstance(value, int) or isinstance(value, bool):
            raise MalformedToolArguments(f"{path} must be an integer")
        _validate_number_bounds(schema, value, path)
        return
    if expected == "number":
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise MalformedToolArguments(f"{path} must be a number")
        _validate_number_bounds(schema, value, path)
        return
    if expected == "boolean":
        if not isinstance(value, bool):
            raise MalformedToolArguments(f"{path} must be a boolean")
        return
    if expected == "array":
        if not isinstance(value, list):
            raise MalformedToolArguments(f"{path} must be an array")
        maximum = schema.get("maxItems")
        if isinstance(maximum, int) and len(value) > maximum:
            raise MalformedToolArguments(f"{path} has too many items")
        item_schema = schema.get("items")
        if isinstance(item_schema, Mapping):
            for index, item in enumerate(value):
                _validate_value(item_schema, item, f"{path}[{index}]")


def _validate_number_bounds(schema: Mapping[str, Any], value: float, path: str) -> None:
    minimum = schema.get("minimum")
    maximum = schema.get("maximum")
    if isinstance(minimum, (int, float)) and value < minimum:
        raise MalformedToolArguments(f"{path} is below its minimum")
    if isinstance(maximum, (int, float)) and value > maximum:
        raise MalformedToolArguments(f"{path} exceeds its maximum")
