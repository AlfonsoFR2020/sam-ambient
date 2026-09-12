from __future__ import annotations

import asyncio
import functools
import sys
from pathlib import Path

import pytest

from sam_ambient.adapters.mcp import McpClient, McpError, StdioMcpTransport
from sam_ambient.configuration import McpServerSettings
from sam_ambient.core.protocol import EventType
from sam_ambient.core.tools import (
    ApprovalBroker,
    ApprovalCorrelation,
    CapabilityAuthority,
    CapabilityPolicy,
    RiskClass,
    ToolExecutor,
    ToolInvocation,
    ToolRegistry,
    ToolStatus,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled

FIXTURE = Path(__file__).parents[1] / "fixtures" / "fake_mcp_server.py"


def async_test(function):
    @functools.wraps(function)
    def run(*args, **kwargs):
        return asyncio.run(function(*args, **kwargs))

    return run


def settings(mode: str = "normal", *, timeout: float = 1, limit: int = 131_072):
    return McpServerSettings(
        "fixture",
        (sys.executable, str(FIXTURE), mode),
        timeout_s=timeout,
        result_limit_bytes=limit,
    )


@async_test
async def test_stdio_discovery_and_call_preserve_provenance_and_arguments():
    client = McpClient(settings())
    process = None
    try:
        (tool,) = await client.start()
        assert isinstance(client.transport, StdioMcpTransport)
        process = client.transport._process
        assert tool.descriptor.id == "mcp.fixture.echo"
        assert tool.descriptor.risk is RiskClass.EXTERNAL_SIDE_EFFECT
        assert tool.descriptor.requires_confirmation
        arguments = {"text": "$(whoami); & echo"}
        result = await tool.execute(arguments, CancellationToken())
        assert result.data["provider"] == "fixture"
        assert result.data["structured_content"]["received"] == arguments
        assert result.data["content_trust"] == "untrusted_data"
    finally:
        await client.close()
    assert process is not None and process.returncode is not None


@async_test
async def test_external_tool_uses_existing_exact_approval_and_epoch_revocation():
    client = McpClient(settings())
    events = []
    approvals = ApprovalBroker()
    authority = CapabilityAuthority()
    try:
        tools = await client.start()

        async def publish(event):
            events.append(event)
            if event.type is EventType.TOOL_APPROVAL_REQUESTED:
                approvals.resolve(ApprovalCorrelation("s", "t", "g", "call"), approved=True)

        invocation = ToolInvocation(
            "call", tools[0].descriptor.id, {"text": "approved"}, "s", "t", "g", "cancel"
        )
        executor = ToolExecutor(
            ToolRegistry(tools),
            CapabilityPolicy(allow_external_side_effects=True),
            approvals,
            publish,
            authority=authority,
        )
        execution = await executor.execute(invocation, CancellationToken("cancel"))
        assert execution.status is ToolStatus.COMPLETED
        authority.revoke("emergency_stop")
        denied = await executor.execute(
            ToolInvocation("new", tools[0].descriptor.id, {"text": "x"}, "s", "t", "g", "c2"),
            CancellationToken("c2"),
        )
        assert denied.status is ToolStatus.DENIED
        assert sum(event.type is EventType.TOOL_APPROVAL_REQUESTED for event in events) == 1
    finally:
        await client.close()


@pytest.mark.parametrize("mode", ["bad-schema", "collision"])
@async_test
async def test_malformed_or_colliding_discovery_fails_closed(mode):
    client = McpClient(settings(mode))
    with pytest.raises(McpError):
        await client.start()
    await client.close()


@pytest.mark.parametrize("mode", ["timeout", "crash", "malformed", "oversized"])
@async_test
async def test_bounded_server_failures(mode):
    client = McpClient(settings(mode, timeout=0.1 if mode == "timeout" else 1, limit=1024))
    try:
        (tool,) = await client.start()
        with pytest.raises(McpError):
            await tool.execute({"text": "x"}, CancellationToken())
    finally:
        await client.close()


@async_test
async def test_cancellation_stops_waiting_without_granting_authority():
    client = McpClient(settings("timeout", timeout=5))
    try:
        (tool,) = await client.start()
        token = CancellationToken()
        task = asyncio.create_task(tool.execute({"text": "x"}, token))
        await asyncio.sleep(0.05)
        token.cancel("owner_cancelled")
        with pytest.raises(OperationCancelled):
            await task
    finally:
        await client.close()


@async_test
async def test_tool_list_change_rejects_stale_discovery_before_call():
    client = McpClient(settings("mutate"))
    try:
        (tool,) = await client.start()
        with pytest.raises(McpError, match="fresh authority"):
            await tool.execute({"text": "must not execute"}, CancellationToken())
    finally:
        await client.close()


@async_test
async def test_server_does_not_inherit_unrelated_secret(monkeypatch):
    monkeypatch.setenv("SAM_TEST_SECRET", "must-not-cross-boundary")
    client = McpClient(settings("environment"))
    try:
        (tool,) = await client.start()
        result = await tool.execute({"text": "x"}, CancellationToken())
        assert result.data["content"][0]["text"] == "absent"
    finally:
        await client.close()
