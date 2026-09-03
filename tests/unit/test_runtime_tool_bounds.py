import asyncio
from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any

import pytest

from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ToolSchema,
)
from sam_ambient.core.tools import (
    AuthorizationKind,
    FunctionTool,
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolRegistry,
    ToolResult,
)
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import RuntimeConfig, SamRuntime, _ToolCallAccumulator


class RepeatingToolProvider(LLMProvider):
    id = "bounded-runtime-test"
    data_boundary = DataBoundary.LOCAL

    def __init__(self) -> None:
        self.calls = 0

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        cancellation.raise_if_cancelled()
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        cancellation.raise_if_cancelled()
        return [ModelInfo("bounded-model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model
        cancellation.raise_if_cancelled()
        self.calls += 1
        yield ModelEvent(
            ModelEventKind.TOOL_CALL,
            payload={
                "id": f"repeat-{self.calls}",
                "function": {"name": "test.read", "arguments": {}},
            },
        )
        yield ModelEvent(ModelEventKind.COMPLETED)


def read_descriptor() -> ToolDescriptor:
    return ToolDescriptor(
        id="test.read",
        description="Return one bounded test result.",
        input_schema={
            "type": "object",
            "properties": {},
            "required": [],
            "additionalProperties": False,
        },
        result_schema={"type": "object"},
        risk=RiskClass.READ_ONLY,
        platforms=("linux", "windows", "darwin"),
        requires_confirmation=False,
        supports_cancellation=True,
        timeout_s=1.0,
        side_effect=SideEffect.NONE,
    )


def test_runtime_executes_no_more_than_configured_tool_rounds(tmp_path) -> None:
    async def scenario() -> None:
        provider = RepeatingToolProvider()
        executions = 0

        async def execute(
            _arguments: Mapping[str, Any],
            cancellation: CancellationToken,
        ) -> ToolResult:
            nonlocal executions
            cancellation.raise_if_cancelled()
            executions += 1
            return ToolResult({"round": executions})

        runtime = SamRuntime(
            provider,
            RuntimeConfig(
                workspace_root=tmp_path,
                model="bounded-model",
                max_tool_rounds=2,
            ),
            registry=ToolRegistry([FunctionTool(read_descriptor(), execute)]),
        )
        try:
            runtime.submit_user_message("Keep asking for the test tool")
            await asyncio.gather(*tuple(runtime._tasks))
        finally:
            await runtime.close()

        assert executions == 2
        assert provider.calls == 3

    asyncio.run(scenario())


def test_provider_tool_call_id_is_rejected_before_protocol_propagation() -> None:
    accumulator = _ToolCallAccumulator()

    with pytest.raises(ValueError, match="tool call id exceeds 256"):
        accumulator.add(
            {
                "id": "x" * 257,
                "function": {"name": "test.read", "arguments": {}},
            }
        )


def test_composed_runtime_registers_phase6b_tools_with_explicit_write_scope(tmp_path) -> None:
    runtime = SamRuntime(
        RepeatingToolProvider(),
        RuntimeConfig(
            workspace_root=tmp_path,
            model="bounded-model",
            workspace_writable=True,
        ),
    )
    try:
        descriptors = {item.id: item for item in runtime.tools.descriptors()}
        assert {"files.write", "process.run", "app.open"}.issubset(descriptors)
        assert runtime.paths.root("workspace", write=True).writable is True
        assert (
            runtime.tool_executor.policy.authorize(descriptors["process.run"]).kind
            is AuthorizationKind.REQUIRE_APPROVAL
        )
        assert (
            runtime.tool_executor.policy.authorize(descriptors["files.write"]).kind
            is AuthorizationKind.REQUIRE_APPROVAL
        )
    finally:
        asyncio.run(runtime.close())

    read_only_runtime = SamRuntime(
        RepeatingToolProvider(),
        RuntimeConfig(workspace_root=tmp_path, model="bounded-model"),
    )
    try:
        assert "files.write" not in {item.id for item in read_only_runtime.tools.descriptors()}
    finally:
        asyncio.run(read_only_runtime.close())
