import asyncio
import sqlite3
import threading

from sam_ambient.core.memory import MemoryStore
from sam_ambient.core.owner import OwnerConnection
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.integration.test_memory_context import CapturingProvider, turn


def test_repaired_database_can_be_reopened_by_owner_without_runtime_restart(tmp_path):
    async def run():
        path = tmp_path / "memory.db"
        path.write_bytes(b"corrupt fixture")
        provider = CapturingProvider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(
                workspace_root=tmp_path, model="discovered-model", memory_db=path, port=0
            ),
        )
        try:
            assert runtime.memory is None
            await turn(runtime, "Hello")
            assert provider.requests and runtime._active_generation_id is None
            # Fixture repairs explicitly, just as an owner may restore a valid backup.
            path.unlink()
            repaired = MemoryStore(path)
            repaired.create(
                repaired.owner_id,
                kind="preference",
                scope="personal",
                content="Preferred language Spanish",
                source_kind="owner",
                source_ref="restored",
            )
            owner = OwnerConnection(runtime.bridge.owner, "recovered-owner")
            action = runtime.owner_actions.start(owner, "refresh", 1, "memory.list", {})
            await asyncio.wait_for(action.task, 2)
            assert runtime.memory is not None and runtime.memory_error is None
            await turn(runtime, "Preferred language?")
            assert any(m.name == "sam_memory" for m in provider.requests[-1])
            with sqlite3.connect(path) as lock:
                lock.execute("BEGIN EXCLUSIVE")
                await turn(runtime, "Preferred language?")
                assert not any(m.name == "sam_memory" for m in provider.requests[-1])
            await turn(runtime, "Preferred language?")
            assert any(m.name == "sam_memory" for m in provider.requests[-1])
        finally:
            await runtime.close()

    asyncio.run(run())


def test_cancelled_search_retires_without_late_result_and_next_read_succeeds(tmp_path, monkeypatch):
    async def run():
        runtime = SamRuntime(
            CapturingProvider(),
            RuntimeConfig(
                workspace_root=tmp_path,
                model="discovered-model",
                memory_db=tmp_path / "memory.db",
                port=0,
            ),
        )
        owner = OwnerConnection(runtime.bridge.owner, "search-owner")
        entered, release, finished = threading.Event(), threading.Event(), threading.Event()
        original = MemoryStore.list
        terminals = []

        async def terminal(action, execution):
            terminals.append(execution)

        runtime.owner_actions.terminal = terminal

        def blocked(store, *args, **kwargs):
            entered.set()
            try:
                assert release.wait(3)
                return original(store, *args, **kwargs)
            finally:
                finished.set()

        monkeypatch.setattr(MemoryStore, "list", blocked)
        try:
            pending = runtime.owner_actions.start(owner, "search", 1, "memory.list", {})
            assert await asyncio.to_thread(entered.wait, 2)
            runtime.owner_actions.cancel(owner, "search")
            await asyncio.wait_for(pending.task, 2)
            release.set()
            assert await asyncio.to_thread(finished.wait, 2)
            assert len(terminals) == 1 and terminals[0].status == "cancelled"
            assert terminals[0].result is None
            monkeypatch.setattr(MemoryStore, "list", original)
            healthy = runtime.owner_actions.start(owner, "healthy-read", 2, "memory.list", {})
            await asyncio.wait_for(healthy.task, 2)
            assert terminals[-1].status == "completed"
            assert not runtime.owner_actions.active
        finally:
            release.set()
            await runtime.close()

    asyncio.run(run())
