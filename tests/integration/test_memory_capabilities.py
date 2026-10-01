import asyncio
import json

from websockets.asyncio.client import connect

from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.core.tools import ToolInvocation, ToolStatus
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.fixtures.owner import authenticate_owner
from tests.unit.test_cli import FakeProvider


async def action(socket, name, args, sequence):
    request = ControlCommand(
        type=ControlCommandType.CAPABILITY_EXECUTE,
        command_id=f"memory-action-{sequence}",
        monotonic_ms=sequence,
        payload={"capability": f"memory.{name}", "arguments": args, "sequence": sequence},
    )
    await socket.send(request.to_json())
    async with asyncio.timeout(3):
        while True:
            event = json.loads(await socket.recv())
            if (
                event["type"] == "capability.state"
                and event["payload"]["request_id"] == request.command_id
            ):
                payload = event["payload"]
                if payload["state"] not in {"queued", "running"}:
                    return payload


def test_owner_crud_real_authenticated_command_path_and_model_denial(tmp_path):
    async def run():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(
                workspace_root=tmp_path,
                model="discovered-model",
                port=0,
                memory_db=tmp_path / "memory.db",
            ),
        )
        await runtime.start()
        try:
            assert not any(
                tool.name.startswith("memory.") for tool in runtime.tools.provider_schemas()
            )
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:8766",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as socket:
                await authenticate_owner(socket, runtime.bridge.owner)
                await socket.recv()
                created = await action(
                    socket,
                    "create",
                    {
                        "kind": "preference",
                        "scope": "personal",
                        "content": "Prefer concise Spanish replies",
                    },
                    1,
                )
                assert created["state"] == "completed"
                record = created["result"]["record"]
                assert record["review"] == "reviewed" and record["source_ref"] == "memory-action-1"
                listed = await action(socket, "list", {"query": "Spanish"}, 2)
                assert listed["result"]["records"][0]["id"] == record["id"]
                inspected = await action(socket, "get", {"id": record["id"]}, 3)
                assert inspected["result"]["record"]["content"] == record["content"]
                corrected = await action(
                    socket,
                    "correct",
                    {
                        "id": record["id"],
                        "revision": 1,
                        "content": "Prefer concise English replies",
                    },
                    4,
                )
                assert corrected["result"]["record"]["revision"] == 2
                conflict = await action(socket, "delete", {"id": record["id"], "revision": 1}, 5)
                assert conflict["state"] == "failed" and "refresh" in conflict["error"]
                deleted = await action(socket, "delete", {"id": record["id"], "revision": 2}, 6)
                assert deleted["state"] == "completed"
                assert not runtime.memory.list(runtime.memory.owner_id)
                assert not runtime.approvals.pending

            # A guessed hidden CRUD name remains denied even under a real model generation.
            runtime._active_generation_id = "model-generation"
            execution = await runtime.tool_executor.execute(
                ToolInvocation(
                    "model-forged-owner-write",
                    "memory.create",
                    {"content": "Model says it is owner", "kind": "fact", "scope": "personal"},
                    generation_id="model-generation",
                ),
                CancellationToken(),
            )
            assert execution.status is ToolStatus.DENIED
            assert not runtime.memory.list(runtime.memory.owner_id)
        finally:
            await runtime.close()

    asyncio.run(run())
