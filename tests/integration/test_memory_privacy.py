import asyncio
import json
import threading
from contextlib import contextmanager

import pytest
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.memory import MemoryStore
from sam_ambient.core.owner import OwnerConnection
from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.fixtures.owner import authenticate_owner
from tests.integration.test_memory_capabilities import action
from tests.unit.test_cli import FakeProvider


def test_memory_content_not_retained_in_executor_replay_history_or_logs(tmp_path, caplog):
    async def run():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(
                workspace_root=tmp_path,
                memory_db=tmp_path / "memory.db",
                model="discovered-model",
                port=0,
            ),
        )
        await runtime.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:8766",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as socket:
                await authenticate_owner(socket, runtime.bridge.owner)
                await socket.recv()
                result = await action(
                    socket,
                    "create",
                    {
                        "content": "PRIVATE_CANARY_OWNER_PREFERENCE",
                        "kind": "preference",
                        "scope": "personal",
                    },
                    1,
                )
                record = result["result"]["record"]
                await action(socket, "get", {"id": record["id"]}, 2)
                await action(socket, "delete", {"id": record["id"], "revision": 1}, 3)
            assert "PRIVATE_CANARY" not in repr(runtime.tool_executor._history)
            assert "PRIVATE_CANARY" not in caplog.text
        finally:
            await runtime.close()

    asyncio.run(run())


def test_large_unicode_overview_remains_structured_and_can_be_paged(tmp_path):
    async def run():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(
                workspace_root=tmp_path,
                memory_db=tmp_path / "memory.db",
                model="discovered-model",
                port=0,
            ),
        )
        store = runtime.memory
        for n in range(12):
            store.create(
                store.owner_id,
                kind="fact",
                scope="personal",
                content=f"Claim {n} " + "🦊" * 1180,
                source_kind="owner",
                source_ref="owner",
            )
        await runtime.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:8766",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as socket:
                await authenticate_owner(socket, runtime.bridge.owner)
                await socket.recv()
                offset, seen = 0, []
                for sequence in range(1, 10):
                    page = await action(socket, "list", {"offset": offset}, sequence)
                    assert not page.get("truncated")
                    assert len(json.dumps(page["result"]).encode()) < 16_384
                    seen.extend(row["id"] for row in page["result"]["records"])
                    offset = page["result"]["next_offset"]
                    if not page["result"]["has_more"]:
                        break
                assert len(seen) == len(set(seen)) == 12
        finally:
            await runtime.close()

    asyncio.run(run())


@pytest.mark.parametrize("credential", ["absent", "wrong"])
def test_unauthenticated_client_never_reads_memory(tmp_path, credential):
    async def run():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(workspace_root=tmp_path, memory_db=tmp_path / "memory.db", port=0),
        )
        runtime.memory.create(
            runtime.memory.owner_id,
            kind="fact",
            scope="personal",
            content="Private owner fact",
            source_kind="owner",
            source_ref="owner",
        )
        await runtime.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:8766",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as socket:
                assert json.loads(await socket.recv())["type"] == "sam.owner.challenge"
                if credential == "wrong":
                    await socket.send(
                        json.dumps({"type": "sam.owner.authenticate", "proof": "0" * 64})
                    )
                else:
                    await socket.send(
                        ControlCommand(
                            type=ControlCommandType.CAPABILITY_EXECUTE,
                            command_id="untrusted-read",
                            monotonic_ms=1,
                            payload={"capability": "memory.list", "arguments": {}, "sequence": 1},
                        ).to_json()
                    )
                with pytest.raises(ConnectionClosed):
                    await asyncio.wait_for(socket.recv(), 2)
        finally:
            await runtime.close()

    asyncio.run(run())


def test_cancelled_owner_write_rolls_back_before_commit(tmp_path, monkeypatch):
    async def run():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(workspace_root=tmp_path, memory_db=tmp_path / "memory.db", port=0),
        )
        connection = OwnerConnection(runtime.bridge.owner, "owner-session")
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()
        original = MemoryStore._record
        original_db = MemoryStore._db

        @contextmanager
        def tracked_db(store):
            try:
                with original_db(store) as db:
                    yield db
            finally:
                finished.set()

        monkeypatch.setattr(MemoryStore, "_db", tracked_db)

        def paused_record(row):
            entered.set()
            assert release.wait(3)
            return original(row)

        monkeypatch.setattr(MemoryStore, "_record", staticmethod(paused_record))
        action_record = runtime.owner_actions.start(
            connection,
            "cancel-write",
            1,
            "memory.create",
            {"content": "This must roll back", "kind": "fact", "scope": "personal"},
        )
        try:
            assert await asyncio.to_thread(entered.wait, 2)
            runtime.owner_actions.cancel(connection, "cancel-write")
            await asyncio.wait_for(action_record.task, 2)
            release.set()
            assert await asyncio.to_thread(finished.wait, 2)
            monkeypatch.setattr(MemoryStore, "_record", staticmethod(original))
            assert not runtime.memory.list(runtime.memory.owner_id)
            assert not runtime.owner_actions.active
        finally:
            release.set()
            await runtime.close()

    asyncio.run(run())
