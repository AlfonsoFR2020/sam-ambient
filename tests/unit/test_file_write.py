import asyncio
from pathlib import Path

import pytest

import sam_ambient.core.tools.filesystem as filesystem_module
from sam_ambient.core.protocol import ProtocolEvent
from sam_ambient.core.tools import (
    ApprovalBroker,
    ApprovalCorrelation,
    AuthorizedPaths,
    AuthorizedRoot,
    CapabilityAuthority,
    CapabilityPolicy,
    FilesWriteTool,
    MalformedToolArguments,
    PathAuthorizationError,
    ToolError,
    ToolExecutor,
    ToolInvocation,
    ToolRegistry,
    ToolStatus,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled


def paths(root: Path, *, writable: bool = True) -> AuthorizedPaths:
    return AuthorizedPaths((AuthorizedRoot("workspace", root, writable=writable),))


def write(tool: FilesWriteTool, **arguments: object):
    return asyncio.run(
        tool.execute(
            {"root": "workspace", **arguments},
            CancellationToken("write-direct"),
        )
    )


def invocation(call_id: str, path: str, content: str) -> ToolInvocation:
    return ToolInvocation(
        tool_call_id=call_id,
        tool_id="files.write",
        arguments={"root": "workspace", "path": path, "content": content},
        session_id="session-1",
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id=f"cancel-{call_id}",
    )


def test_authorized_create_and_explicit_atomic_overwrite(tmp_path: Path) -> None:
    tool = FilesWriteTool(paths(tmp_path))
    created = write(tool, path="notes.txt", content="first")
    assert created.data["created"] is True
    assert created.data["atomic_replace"] is True
    assert (tmp_path / "notes.txt").read_text(encoding="utf-8") == "first"

    with pytest.raises(ToolError, match="already exists"):
        write(tool, path="notes.txt", content="implicit overwrite")
    replaced = write(tool, path="notes.txt", content="second", overwrite=True)
    assert replaced.data["overwritten"] is True
    assert (tmp_path / "notes.txt").read_text(encoding="utf-8") == "second"


def test_write_rejects_read_only_root_and_parent_traversal(tmp_path: Path) -> None:
    read_only = FilesWriteTool(paths(tmp_path, writable=False))
    with pytest.raises(PathAuthorizationError, match="not writable"):
        write(read_only, path="blocked.txt", content="blocked")

    writable = FilesWriteTool(paths(tmp_path))
    with pytest.raises(PathAuthorizationError, match="parent traversal"):
        write(writable, path="../escape.txt", content="blocked")
    assert not (tmp_path.parent / "escape.txt").exists()


def test_write_schema_and_utf8_byte_bounds_are_enforced(tmp_path: Path) -> None:
    tool = FilesWriteTool(paths(tmp_path))
    registry = ToolRegistry((tool,))
    with pytest.raises(MalformedToolArguments, match="too long"):
        registry.validate(
            tool,
            {"root": "workspace", "path": "large.txt", "content": "x" * 60_001},
        )
    with pytest.raises(ToolError, match="64 KiB"):
        write(tool, path="multibyte.txt", content="🙂" * 20_000)


def test_atomic_replace_failure_preserves_original_and_cleans_temporary_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    target = tmp_path / "stable.txt"
    target.write_text("stable", encoding="utf-8")
    tool = FilesWriteTool(paths(tmp_path))

    def fail_replace(_source: Path, _target: Path) -> None:
        raise OSError("simulated replacement failure")

    monkeypatch.setattr(filesystem_module.os, "replace", fail_replace)
    with pytest.raises(ToolError, match="atomic replacement failed"):
        write(tool, path="stable.txt", content="partial", overwrite=True)

    assert target.read_text(encoding="utf-8") == "stable"
    assert list(tmp_path.glob(".sam-write-*.tmp")) == []


def test_cancelled_or_globally_revoked_write_never_starts(tmp_path: Path) -> None:
    tool = FilesWriteTool(paths(tmp_path))
    cancelled = CancellationToken("cancel-before-write")
    cancelled.cancel("owner cancelled")
    with pytest.raises(OperationCancelled):
        asyncio.run(
            tool.execute(
                {"root": "workspace", "path": "cancelled.txt", "content": "no"},
                cancelled,
            )
        )
    assert not (tmp_path / "cancelled.txt").exists()

    async def revoked_scenario() -> None:
        authority = CapabilityAuthority()

        async def publish(_event: ProtocolEvent) -> None:
            return None

        executor = ToolExecutor(
            ToolRegistry((tool,)),
            CapabilityPolicy(),
            ApprovalBroker(),
            publish,
            authority=authority,
        )
        authority.revoke("global kill switch")
        result = await executor.execute(
            invocation("revoked", "revoked.txt", "no"),
            CancellationToken("revoked"),
        )
        assert result.status is ToolStatus.DENIED

    asyncio.run(revoked_scenario())
    assert not (tmp_path / "revoked.txt").exists()


def test_write_executes_only_after_exact_approval_and_denial_is_safe(tmp_path: Path) -> None:
    async def scenario() -> None:
        tool = FilesWriteTool(paths(tmp_path))
        approvals = ApprovalBroker()
        requested = asyncio.Event()
        events: list[ProtocolEvent] = []

        async def publish(event: ProtocolEvent) -> None:
            events.append(event)
            if event.type == "tool.approval_requested":
                requested.set()

        executor = ToolExecutor(
            ToolRegistry((tool,)),
            CapabilityPolicy(),
            approvals,
            publish,
        )
        allowed = invocation("allowed", "allowed.txt", "approved")
        task = asyncio.create_task(executor.execute(allowed, CancellationToken("allowed")))
        await requested.wait()
        approval_event = next(event for event in events if event.type == "tool.approval_requested")
        assert approval_event.payload["summary"] == "Create workspace:allowed.txt"
        assert approval_event.payload["arguments"]["content"] == "<8 characters>"
        assert approvals.resolve(ApprovalCorrelation.from_invocation(allowed), approved=True)
        assert (await task).status is ToolStatus.COMPLETED
        assert (tmp_path / "allowed.txt").read_text(encoding="utf-8") == "approved"

        requested.clear()
        denied = invocation("denied", "denied.txt", "blocked")
        task = asyncio.create_task(executor.execute(denied, CancellationToken("denied")))
        await requested.wait()
        assert approvals.resolve(ApprovalCorrelation.from_invocation(denied), approved=False)
        assert (await task).status is ToolStatus.DENIED
        assert not (tmp_path / "denied.txt").exists()

    asyncio.run(scenario())
