import asyncio
import json
import sys
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

from websockets.asyncio.client import connect

from sam_ambient.adapters.ui import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType, EventType, ProtocolEvent
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    MessageRole,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import RuntimeConfig, SamRuntime


class ToolCallingProvider(LLMProvider):
    id = "runtime-test"
    data_boundary = DataBoundary.LOCAL

    def __init__(self) -> None:
        self.requests: list[tuple[tuple[Message, ...], tuple[ToolSchema, ...]]] = []
        self.closed = False

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        cancellation.raise_if_cancelled()
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        cancellation.raise_if_cancelled()
        return [ModelInfo("runtime-model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        cancellation.raise_if_cancelled()
        assert model == "runtime-model"
        self.requests.append((tuple(messages), tuple(tools)))
        if len(self.requests) == 1:
            assert "files.read" in {tool.name for tool in tools}
            yield ModelEvent(
                ModelEventKind.TOOL_CALL,
                payload={
                    "id": "provider-read-1",
                    "index": 0,
                    "function": {
                        "name": "files.read",
                        "arguments": '{"root":"workspace",',
                    },
                },
            )
            yield ModelEvent(
                ModelEventKind.TOOL_CALL,
                payload={
                    "index": 0,
                    "function": {"arguments": '"path":"fixture.txt"}'},
                },
            )
        else:
            tool_message = next(message for message in messages if message.role is MessageRole.TOOL)
            result = json.loads(tool_message.content)
            assert result["content_trust"] == "untrusted_data"
            assert result["result"]["content"] == "workspace data\n"
            assert tool_message.tool_call_id == "provider-read-1"
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "Read safely.")
        yield ModelEvent(ModelEventKind.COMPLETED)

    async def aclose(self) -> None:
        self.closed = True


class ProcessCallingProvider(ToolCallingProvider):
    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        cancellation.raise_if_cancelled()
        assert model == "runtime-model"
        self.requests.append((tuple(messages), tuple(tools)))
        if len(self.requests) == 1:
            names = {tool.name for tool in tools}
            assert {"process.run", "files.write"}.issubset(names)
            yield ModelEvent(
                ModelEventKind.TOOL_CALL,
                payload={
                    "id": "provider-process-1",
                    "function": {
                        "name": "process.run",
                        "arguments": {
                            "root": "workspace",
                            "cwd": ".",
                            "executable": sys.executable,
                            "args": ["-c", "print('runtime process')"],
                            "timeout_s": 2,
                        },
                    },
                },
            )
        else:
            tool_message = next(message for message in messages if message.role is MessageRole.TOOL)
            result = json.loads(tool_message.content)
            assert result["content_trust"] == "untrusted_data"
            assert result["result"]["exit_code"] == 0
            assert result["result"]["stdout"].strip() == "runtime process"
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "Process completed safely.")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_ui_to_runtime_provider_tool_policy_event_path_and_global_revoke(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        (tmp_path / "fixture.txt").write_bytes(b"workspace data\n")
        provider = ToolCallingProvider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(workspace_root=tmp_path, port=0, model="runtime-model"),
        )
        await runtime.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:1420",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                proxy=None,
            ) as socket:
                ready = ProtocolEvent.from_json(await socket.recv())
                assert ready.type == EventType.SYSTEM_READY
                assert ready.payload["capability_authority_active"] is True

                await socket.send(
                    ControlCommand(
                        type=ControlCommandType.USER_MESSAGE_SUBMIT,
                        command_id="request-1",
                        monotonic_ms=1,
                        session_id=ready.session_id,
                        payload={"text": "Read fixture.txt"},
                    ).to_json()
                )
                events: list[ProtocolEvent] = []
                async with asyncio.timeout(3):
                    while not any(
                        event.type in {EventType.MODEL_COMPLETED, EventType.COMPONENT_ERROR}
                        for event in events
                    ):
                        events.append(ProtocolEvent.from_json(await socket.recv()))
                errors = [
                    event.payload for event in events if event.type == EventType.COMPONENT_ERROR
                ]
                assert errors == []

                tool_events = [event for event in events if event.type.startswith("tool.")]
                assert [event.type for event in tool_events] == [
                    EventType.TOOL_REQUESTED,
                    EventType.TOOL_AUTHORIZING,
                    EventType.TOOL_STARTED,
                    EventType.TOOL_COMPLETED,
                ]
                assert all(event.tool_call_id == "provider-read-1" for event in tool_events)
                assert all(event.session_id and event.turn_id for event in tool_events)
                assert all(event.generation_id and event.cancellation_id for event in tool_events)
                completed = tool_events[-1]
                assert completed.payload["content_trust"] == "untrusted_data"
                assert completed.payload["result"]["content"] == "workspace data\n"
                assert len(provider.requests) == 2

                await socket.send(
                    ControlCommand(
                        type=ControlCommandType.CAPABILITIES_REVOKE_ALL,
                        command_id="revoke-1",
                        monotonic_ms=2,
                        session_id=ready.session_id,
                    ).to_json()
                )
                revoke_events: list[ProtocolEvent] = []
                async with asyncio.timeout(3):
                    while not any(
                        event.payload.get("command_id") == "revoke-1" for event in revoke_events
                    ):
                        revoke_events.append(ProtocolEvent.from_json(await socket.recv()))

                authority_event = next(
                    event
                    for event in revoke_events
                    if event.type == EventType.CAPABILITY_AUTHORITY_CHANGED
                )
                assert authority_event.payload["active"] is False
                assert runtime.capability_authority.snapshot.active is False
        finally:
            await runtime.close()
        assert provider.closed is True

    asyncio.run(scenario())


def test_ui_approval_runs_structured_process_through_composed_runtime(tmp_path: Path) -> None:
    async def scenario() -> None:
        provider = ProcessCallingProvider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(
                workspace_root=tmp_path,
                workspace_writable=True,
                port=0,
                model="runtime-model",
            ),
        )
        await runtime.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:1420",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                proxy=None,
            ) as socket:
                ready = ProtocolEvent.from_json(await socket.recv())
                await socket.send(
                    ControlCommand(
                        type=ControlCommandType.USER_MESSAGE_SUBMIT,
                        command_id="process-request",
                        monotonic_ms=1,
                        session_id=ready.session_id,
                        payload={"text": "Run the harmless runtime process"},
                    ).to_json()
                )
                events: list[ProtocolEvent] = []
                approval: ProtocolEvent | None = None
                async with asyncio.timeout(3):
                    while approval is None:
                        event = ProtocolEvent.from_json(await socket.recv())
                        events.append(event)
                        if event.type == EventType.TOOL_APPROVAL_REQUESTED:
                            approval = event

                assert approval.tool_call_id == "provider-process-1"
                assert sys.executable in approval.payload["summary"]
                await socket.send(
                    ControlCommand(
                        type=ControlCommandType.TOOL_APPROVE,
                        command_id="approve-process",
                        monotonic_ms=2,
                        session_id=approval.session_id,
                        turn_id=approval.turn_id,
                        generation_id=approval.generation_id,
                        cancellation_id=approval.cancellation_id,
                        tool_call_id=approval.tool_call_id,
                    ).to_json()
                )
                async with asyncio.timeout(3):
                    while not any(event.type == EventType.MODEL_COMPLETED for event in events):
                        events.append(ProtocolEvent.from_json(await socket.recv()))

                assert [event.type for event in events if event.type.startswith("tool.")] == [
                    EventType.TOOL_REQUESTED,
                    EventType.TOOL_AUTHORIZING,
                    EventType.TOOL_APPROVAL_REQUESTED,
                    EventType.TOOL_STARTED,
                    EventType.TOOL_COMPLETED,
                ]
                assert (tmp_path / "runtime-process-unexpected").exists() is False
                assert len(provider.requests) == 2
        finally:
            await runtime.close()

    asyncio.run(scenario())
