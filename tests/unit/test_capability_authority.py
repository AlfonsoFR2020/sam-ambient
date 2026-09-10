import asyncio
from collections.abc import Mapping
from types import MappingProxyType
from typing import Any

from sam_ambient.core.protocol import ProtocolEvent
from sam_ambient.core.tools import ApprovalCorrelation, CapabilityAuthority
from sam_ambient.core.tools.executor import (
    ApprovalBroker,
    ToolExecutor,
)
from sam_ambient.core.tools.models import (
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolInvocation,
    ToolResult,
    ToolStatus,
)
from sam_ambient.core.tools.policy import CapabilityPolicy
from sam_ambient.core.tools.registry import FunctionTool, ToolRegistry
from sam_ambient.core.turns import CancellationToken


def descriptor(
    *,
    risk: RiskClass = RiskClass.READ_ONLY,
    supports_cancellation: bool = True,
    allow_restore_metadata: bool = False,
) -> ToolDescriptor:
    properties: dict[str, Any] = {}
    if allow_restore_metadata:
        properties = {
            "capability_authority": {"type": "string"},
            "trusted": {"type": "boolean"},
        }
    return ToolDescriptor(
        id="test.capability",
        description="Capability-authority test tool",
        input_schema={
            "type": "object",
            "properties": properties,
            "required": [],
            "additionalProperties": False,
        },
        result_schema={"type": "object"},
        risk=risk,
        platforms=("linux", "windows", "darwin"),
        requires_confirmation=risk is RiskClass.REVERSIBLE_WRITE,
        supports_cancellation=supports_cancellation,
        timeout_s=1.0,
        side_effect=(SideEffect.NONE if risk is RiskClass.READ_ONLY else SideEffect.LOCAL_STATE),
    )


def invocation(tool_call_id: str, **arguments: object) -> ToolInvocation:
    return ToolInvocation(
        tool_call_id=tool_call_id,
        tool_id="test.capability",
        arguments=arguments,
        session_id="session-1",
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id=f"cancel-{tool_call_id}",
    )


def make_executor(
    handler,
    events: list[ProtocolEvent],
    authority: CapabilityAuthority,
    *,
    approvals: ApprovalBroker | None = None,
    tool_descriptor: ToolDescriptor | None = None,
) -> ToolExecutor:
    async def publish(event: ProtocolEvent) -> None:
        events.append(event)

    return ToolExecutor(
        ToolRegistry([FunctionTool(tool_descriptor or descriptor(), handler)]),
        CapabilityPolicy(),
        approvals or ApprovalBroker(),
        publish,
        authority=authority,
    )


def test_revoked_authority_blocks_new_tool_starts() -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        events: list[ProtocolEvent] = []
        calls = 0

        async def run(_arguments: Mapping[str, Any], _cancellation: CancellationToken):
            nonlocal calls
            calls += 1
            return ToolResult({"ok": True})

        executor = make_executor(run, events, authority)
        assert authority.revoke("owner emergency stop") is True
        result = await executor.execute(invocation("blocked"), CancellationToken("blocked"))

        assert result.status is ToolStatus.DENIED
        assert calls == 0
        assert all(event.type != "tool.started" for event in events)
        assert events[-1].type == "tool.denied"

    asyncio.run(scenario())


def test_nested_request_and_descriptor_metadata_cannot_be_mutated_after_validation() -> None:
    source_args = ["before"]
    request = invocation("immutable", args=source_args)
    source_args.append("after")

    assert request.arguments["args"] == ("before",)
    assert isinstance(request.arguments, MappingProxyType)
    try:
        request.arguments["args"].append("model mutation")
    except AttributeError:
        pass
    else:  # pragma: no cover - explicit security assertion
        raise AssertionError("nested invocation arguments must be immutable")

    registered = descriptor(allow_restore_metadata=True)
    properties = registered.input_schema["properties"]
    assert isinstance(properties, MappingProxyType)
    try:
        properties["trusted"]["type"] = "number"
    except TypeError:
        pass
    else:  # pragma: no cover - explicit security assertion
        raise AssertionError("nested registered schemas must be immutable")
    assert registered.provider_schema().parameters["properties"]["trusted"] == {"type": "boolean"}


def test_revocation_invalidates_old_leases_across_trusted_restoration() -> None:
    authority = CapabilityAuthority()
    original = invocation("original")
    old_lease = authority.issue_lease(original)

    assert authority.is_valid(old_lease, original) is True
    assert authority.revoke("lock down") is True
    assert authority.revoke("duplicate") is False
    assert authority.is_valid(old_lease, original) is False
    assert authority.restore_trusted() is True
    assert authority.restore_trusted() is False
    assert authority.is_valid(old_lease, original) is False

    replacement = invocation("replacement")
    new_lease = authority.issue_lease(replacement)
    assert authority.is_valid(new_lease, replacement) is True
    assert authority.is_valid(new_lease, original) is False


def test_revocation_invalidates_pending_approval_and_late_approval_is_stale() -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        approvals = ApprovalBroker()
        events: list[ProtocolEvent] = []
        requested = asyncio.Event()
        calls = 0

        async def run(_arguments: Mapping[str, Any], _cancellation: CancellationToken):
            nonlocal calls
            calls += 1
            return ToolResult({"written": True})

        async def publish(event: ProtocolEvent) -> None:
            events.append(event)
            if event.type == "tool.approval_requested":
                requested.set()

        executor = ToolExecutor(
            ToolRegistry(
                [
                    FunctionTool(
                        descriptor(risk=RiskClass.REVERSIBLE_WRITE),
                        run,
                    )
                ]
            ),
            CapabilityPolicy(),
            approvals,
            publish,
            authority=authority,
        )
        task = asyncio.create_task(
            executor.execute(invocation("pending"), CancellationToken("pending"))
        )
        await requested.wait()
        assert approvals.pending == ("pending",)

        assert authority.revoke("global stop") is True
        result = await task

        assert result.status is ToolStatus.DENIED
        assert calls == 0
        assert approvals.pending == ()
        assert (
            approvals.resolve(
                ApprovalCorrelation.from_invocation(invocation("pending")),
                approved=True,
            )
            is False
        )
        assert all(event.type != "tool.started" for event in events)

    asyncio.run(scenario())


def test_revocation_cancels_active_cancellable_tool_once() -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        events: list[ProtocolEvent] = []
        started = asyncio.Event()

        async def run(_arguments: Mapping[str, Any], cancellation: CancellationToken):
            started.set()
            await cancellation.wait()
            cancellation.raise_if_cancelled()
            raise AssertionError("cancelled work must not continue")

        executor = make_executor(run, events, authority)
        token = CancellationToken("active")
        task = asyncio.create_task(executor.execute(invocation("active"), token))
        await started.wait()

        assert authority.revoke("global stop") is True
        assert authority.revoke("duplicate stop") is False
        result = await task

        assert token.is_cancelled is True
        assert token.reason == "global stop"
        assert result.status is ToolStatus.CANCELLED
        assert [event.type for event in events].count("tool.cancelled") == 1

    asyncio.run(scenario())


def test_model_arguments_cannot_restore_authority_but_trusted_path_can() -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        events: list[ProtocolEvent] = []
        calls = 0

        async def run(_arguments: Mapping[str, Any], _cancellation: CancellationToken):
            nonlocal calls
            calls += 1
            return ToolResult({"ok": True})

        executor = make_executor(
            run,
            events,
            authority,
            tool_descriptor=descriptor(allow_restore_metadata=True),
        )
        authority.revoke("owner stop")
        attempted = await executor.execute(
            invocation(
                "model-attempt",
                capability_authority="restore",
                trusted=True,
            ),
            CancellationToken("model-attempt"),
        )
        still_blocked = await executor.execute(
            invocation("still-blocked"),
            CancellationToken("still-blocked"),
        )

        assert attempted.status is ToolStatus.DENIED
        assert still_blocked.status is ToolStatus.DENIED
        assert calls == 0

        assert authority.restore_trusted() is True
        restored = await executor.execute(
            invocation("trusted-restoration"),
            CancellationToken("trusted-restoration"),
        )
        assert restored.status is ToolStatus.COMPLETED
        assert calls == 1

    asyncio.run(scenario())


def test_mismatched_approval_never_authorizes_pending_invocation() -> None:
    async def scenario() -> None:
        authority = CapabilityAuthority()
        approvals = ApprovalBroker()
        requested = asyncio.Event()
        calls = 0

        async def run(_arguments: Mapping[str, Any], _cancellation: CancellationToken):
            nonlocal calls
            calls += 1
            return ToolResult({"written": True})

        async def publish(event: ProtocolEvent) -> None:
            if event.type == "tool.approval_requested":
                requested.set()

        executor = ToolExecutor(
            ToolRegistry([FunctionTool(descriptor(risk=RiskClass.REVERSIBLE_WRITE), run)]),
            CapabilityPolicy(),
            approvals,
            publish,
            authority=authority,
        )
        task = asyncio.create_task(
            executor.execute(invocation("expected"), CancellationToken("expected"))
        )
        await requested.wait()

        expected = ApprovalCorrelation.from_invocation(invocation("expected"))
        mismatched = ApprovalCorrelation(
            "other-session",
            expected.turn_id,
            expected.generation_id,
            expected.tool_call_id,
        )
        assert approvals.resolve(mismatched, approved=True) is False
        await asyncio.sleep(0)
        assert task.done() is False
        assert approvals.resolve(expected, approved=False) is True
        result = await task

        assert result.status is ToolStatus.DENIED
        assert calls == 0
        assert approvals.resolve(expected, approved=True) is False

    asyncio.run(scenario())
