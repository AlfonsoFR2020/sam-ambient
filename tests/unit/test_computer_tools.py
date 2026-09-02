import asyncio
from pathlib import Path

from sam_ambient.core.protocol import ProtocolEvent
from sam_ambient.core.tools.computer import (
    AppOpenTool,
    ClipboardReadTool,
    ClipboardWriteTool,
    SystemInfoTool,
)
from sam_ambient.core.tools.executor import ApprovalBroker, ApprovalCorrelation, ToolExecutor
from sam_ambient.core.tools.filesystem import AuthorizedPaths, AuthorizedRoot
from sam_ambient.core.tools.models import ToolInvocation, ToolStatus
from sam_ambient.core.tools.policy import CapabilityPolicy
from sam_ambient.core.tools.registry import ToolRegistry
from sam_ambient.core.turns import CancellationToken


class FakeClipboard:
    def __init__(self, text: str = "") -> None:
        self.text = text
        self.reads = 0
        self.writes: list[str] = []

    async def read_text(self) -> str:
        self.reads += 1
        return self.text

    async def write_text(self, text: str) -> None:
        self.text = text
        self.writes.append(text)


class FakeAppOpen:
    def __init__(self) -> None:
        self.paths: list[str] = []

    async def open_path(self, path: str) -> None:
        self.paths.append(path)


def request(tool_id: str, tool_call_id: str, **arguments: object) -> ToolInvocation:
    return ToolInvocation(tool_call_id, tool_id, arguments, session_id="session")


def test_clipboard_read_and_write_use_fake_adapter_only_after_approval() -> None:
    async def scenario() -> None:
        clipboard = FakeClipboard("private clipboard text")
        approvals = ApprovalBroker()
        events: list[ProtocolEvent] = []
        requested = asyncio.Event()

        async def publish(event: ProtocolEvent) -> None:
            events.append(event)
            if event.type == "tool.approval_requested":
                requested.set()

        executor = ToolExecutor(
            ToolRegistry([ClipboardReadTool(clipboard), ClipboardWriteTool(clipboard)]),
            CapabilityPolicy(),
            approvals,
            publish,
        )

        read_invocation = request("clipboard.read", "read")
        read_task = asyncio.create_task(executor.execute(read_invocation, CancellationToken()))
        await requested.wait()
        assert clipboard.reads == 0
        approvals.resolve(ApprovalCorrelation.from_invocation(read_invocation), approved=True)
        read = await read_task

        requested.clear()
        write_invocation = request("clipboard.write", "write", text="replacement")
        write_task = asyncio.create_task(executor.execute(write_invocation, CancellationToken()))
        await requested.wait()
        assert clipboard.writes == []
        approvals.resolve(ApprovalCorrelation.from_invocation(write_invocation), approved=True)
        written = await write_task

        assert read.status is ToolStatus.COMPLETED
        assert read.result is not None
        assert read.result.data["text"] == "private clipboard text"
        assert written.status is ToolStatus.COMPLETED
        assert clipboard.writes == ["replacement"]

    asyncio.run(scenario())


def test_app_open_validates_authorized_path_but_phase_6a_policy_denies_execution(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        target = tmp_path / "document.txt"
        target.write_text("safe", encoding="utf-8")
        adapter = FakeAppOpen()
        tool = AppOpenTool(
            AuthorizedPaths((AuthorizedRoot("workspace", tmp_path),)),
            adapter,
        )

        direct = await tool.execute(
            {"root": "workspace", "path": "document.txt"},
            CancellationToken(),
        )
        assert direct.data["opened"] is True
        assert adapter.paths == [str(target.resolve())]

        adapter.paths.clear()
        events: list[ProtocolEvent] = []

        async def publish(event: ProtocolEvent) -> None:
            events.append(event)

        executor = ToolExecutor(
            ToolRegistry([tool]),
            CapabilityPolicy(),
            ApprovalBroker(),
            publish,
        )
        denied = await executor.execute(
            request("app.open", "open", root="workspace", path="document.txt"),
            CancellationToken(),
        )

        assert denied.status is ToolStatus.DENIED
        assert adapter.paths == []
        assert events[-1].type == "tool.denied"

    asyncio.run(scenario())


def test_clipboard_read_reports_original_size_and_truncates_content() -> None:
    async def scenario() -> None:
        result = await ClipboardReadTool(FakeClipboard("sensitive"), max_chars=4).execute(
            {}, CancellationToken()
        )

        assert result.truncated is True
        assert result.data == {"text": "sens", "characters": 9}

    asyncio.run(scenario())


def test_system_info_has_a_fixed_schema_and_does_not_expose_environment_or_hostname() -> None:
    async def scenario() -> None:
        result = await SystemInfoTool().execute({}, CancellationToken())

        assert set(result.data) == {
            "os",
            "os_release",
            "architecture",
            "python",
            "python_implementation",
            "sam_version",
            "logical_cpu_count",
        }
        assert "environment" not in result.data
        assert "hostname" not in result.data

    asyncio.run(scenario())
