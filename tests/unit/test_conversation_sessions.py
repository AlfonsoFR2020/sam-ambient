"""Authoritative conversation isolation/recovery with temporary stores and fake models."""

import asyncio
import sqlite3
import threading
from contextlib import contextmanager
from uuid import uuid4

import pytest

from sam_ambient.core.owner import OwnerConnection, OwnerSession
from sam_ambient.core.protocol import ControlCommand, EventType
from sam_ambient.core.storage.sqlite import RuntimeStateError, SQLiteSessionStore
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_local_controls import RecordingProvider
from tests.unit.test_push_to_talk import arm, fixture, gesture, until


def test_ready_rehydrates_committed_history_without_reissuing_generation(tmp_path):
    store = SQLiteSessionStore(tmp_path / "state.db")
    session = store.session_id()
    store.append(
        session_id=session,
        turn_id="saved",
        role="user",
        content="Saved question",
        committed_at_ms=1,
    )

    async def scenario():
        provider = ConversationProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, state_db=store.path))
        try:
            ready = runtime._ready_event()
            snapshot = ready.payload["conversation"]
            assert ready.session_id == session
            assert snapshot["history"][0]["text"] == "Saved question"
            assert snapshot["incomplete_turns"] == ["saved"]
            assert not provider.contexts and runtime.active_generation_id is None
        finally:
            await runtime.close()

    asyncio.run(scenario())


async def select(runtime, owner, action, target=None, *, revision=None, identity=None):
    payload = {
        "action": action,
        "expected_revision": runtime.conversations.revision if revision is None else revision,
    }
    if target is not None:
        payload["target_session_id"] = target
    return await runtime.controls.dispatch(
        ControlCommand(
            type="control.conversation.select",
            command_id=identity or str(uuid4()),
            monotonic_ms=1,
            session_id=runtime.session_id,
            payload=payload,
        ),
        owner_connection=owner,
    )


def test_new_and_resume_keep_records_but_isolate_actual_inference_context(tmp_path):
    async def scenario():
        provider = ConversationProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, state_db=tmp_path / "state.db"))
        owner = OwnerConnection(OwnerSession(), "owner")
        try:
            first = runtime.session_id
            runtime.submit_user_message("Only first conversation")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            changed = await select(runtime, owner, "new")
            assert changed.type == EventType.CONTROL_ACKNOWLEDGED
            assert runtime.session_id != first
            runtime.submit_user_message("Only second conversation")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert [item.content for item in provider.contexts[-1][1:]] == [
                "Only second conversation"
            ]
            assert (
                await select(runtime, owner, "resume", first)
            ).type == EventType.CONTROL_ACKNOWLEDGED
            context = await runtime._conversation_context(first, "next")
            assert [item.content for item in context] == [
                "Only first conversation",
                "Your color is green.",
            ]
            assert len(runtime.state.recent()) == 4
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_launch_policy_runs_once_per_supervisor_application_not_reload_or_core_restart(tmp_path):
    store = SQLiteSessionStore(tmp_path / "state.db")
    initial = store.open_conversation("app-a")
    assert initial.launch_policy == "resume" and not initial.history
    store.append(
        session_id=initial.session_id,
        turn_id="prior",
        role="user",
        content="Keep me",
        committed_at_ms=1,
    )
    pref = store.change_conversation(
        session_id=initial.session_id,
        expected_revision=initial.revision,
        action="policy",
        target="new",
    )
    assert pref.session_id == initial.session_id
    assert store.open_conversation("app-a").session_id == initial.session_id
    assert store.open_conversation().session_id == initial.session_id
    next_launch = store.open_conversation("app-b")
    assert next_launch.session_id != initial.session_id and not next_launch.history
    assert store.open_conversation("app-b").session_id == next_launch.session_id
    restored = store.change_conversation(
        session_id=next_launch.session_id,
        expected_revision=next_launch.revision,
        action="resume",
        target=initial.session_id,
    )
    assert [item.content for item in restored.history] == ["Keep me"]


def test_legacy_upgrade_session_filtering_and_root_separation(tmp_path):
    first = SQLiteSessionStore(tmp_path / "one" / "state.db")
    session = first.session_id()
    first.append(
        session_id=session,
        turn_id="old",
        role="user",
        content="Older active context",
        committed_at_ms=1,
    )
    for index in range(15):
        first.append(
            session_id="foreign",
            turn_id=str(index),
            role="user",
            content="Other context",
            committed_at_ms=2 + index,
        )
    with first._connect() as connection:
        connection.execute("DROP TABLE conversation_sessions")  # Actual pre-V-E schema.
    upgraded = SQLiteSessionStore(first.path)
    selected = upgraded.open_conversation()
    assert selected.session_id == session and len(upgraded.recent()) == 16
    assert [item.content for item in upgraded.recent(limit=12, session_id=session)] == [
        "Older active context"
    ]
    other = SQLiteSessionStore(tmp_path / "two" / "state.db").open_conversation()
    assert other.session_id != session and not other.history


def test_duplicate_and_reordered_commands_cannot_switch_again_even_after_return_to_same_session(
    tmp_path,
):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        try:
            original, revision, identity = (
                runtime.session_id,
                runtime.conversations.revision,
                str(uuid4()),
            )
            ack = await select(runtime, owner, "new", identity=identity)
            second = runtime.session_id
            assert (await select(runtime, owner, "new", identity=identity)) == ack
            assert runtime.session_id == second
            assert (
                await select(runtime, owner, "resume", original)
            ).type == EventType.CONTROL_ACKNOWLEDGED
            assert (
                await select(runtime, owner, "new", revision=revision)
            ).type == EventType.CONTROL_REJECTED
            assert runtime.session_id == original
            assert len(runtime.conversations.retained) == 2
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("owner_kind", ["absent", "retired", "wrong-session"])
def test_session_commands_require_current_authenticated_ownership(tmp_path, owner_kind):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        if owner_kind == "retired":
            owner.retire()
        try:
            original = runtime.session_id
            command = ControlCommand(
                type="control.conversation.select",
                command_id=str(uuid4()),
                monotonic_ms=1,
                session_id="old" if owner_kind == "wrong-session" else original,
                payload={"action": "new", "expected_revision": runtime.conversations.revision},
            )
            response = await runtime.controls.dispatch(
                command, owner_connection=None if owner_kind == "absent" else owner
            )
            assert response.type == EventType.CONTROL_REJECTED
            assert runtime.session_id == original and runtime.state.session_id() == original
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_generation_blocks_switch_then_typing_and_switch_recover(tmp_path):
    async def scenario():
        gate = asyncio.Event()
        provider = RecordingProvider("fake", gate)
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, state_db=tmp_path / "state.db"))
        owner = OwnerConnection(OwnerSession(), "owner")
        try:
            original = runtime.session_id
            runtime.submit_user_message("Current request")
            await asyncio.wait_for(provider.started.wait(), 2)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_REJECTED
            assert runtime.session_id == original
            gate.set()
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_ACKNOWLEDGED
        finally:
            gate.set()
            await runtime.close()

    asyncio.run(scenario())


def test_pending_voice_finalization_and_cleanup_block_switch_without_late_commit(tmp_path):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        stt.gate, stt.ignore_cancel = asyncio.Event(), True
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: stt.final_calls == 1)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_REJECTED
            await gesture(runtime, owner, "cancel", identity)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_REJECTED
            stt.gate.set()
            await until(lambda: runtime._ptt_task is None)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_ACKNOWLEDGED
            runtime.submit_user_message("New context typed recovery")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert not any(
                e.type == EventType.TURN_COMMITTED and e.payload.get("text") == stt.result.text
                for e in events
            )
            assert (
                runtime.state.recent(session_id=runtime.session_id)[0].content
                == "New context typed recovery"
            )
        finally:
            stt.gate.set()
            await runtime.close()

    asyncio.run(scenario())


def test_disconnect_cancellation_cannot_split_durable_and_live_selection(tmp_path, monkeypatch):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        gate, entered = threading.Event(), threading.Event()
        change = runtime.state.change_conversation

        def delayed(**kwargs):
            entered.set()
            assert gate.wait(2)
            return change(**kwargs)

        monkeypatch.setattr(runtime.state, "change_conversation", delayed)
        task = asyncio.create_task(select(runtime, owner, "new"))
        try:
            await until(entered.is_set)
            old = runtime.session_id
            task.cancel()
            await asyncio.sleep(0)
            assert runtime._session_changing and runtime.session_id == old
            with pytest.raises(RuntimeError, match="conversation change"):
                runtime.submit_user_message("Cannot race the transaction")
            gate.set()
            await asyncio.gather(task, return_exceptions=True)
            assert runtime.session_id != old
            assert runtime.session_id == runtime.state.session_id()
            assert not runtime._session_changing
        finally:
            gate.set()
            await asyncio.gather(task, return_exceptions=True)
            await runtime.close()

    asyncio.run(scenario())


def test_locked_storage_rejects_change_without_losing_typed_recovery(tmp_path, monkeypatch):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        original, connect = runtime.session_id, runtime.state._connect

        @contextmanager
        def locked():
            raise sqlite3.OperationalError("database is locked")
            yield  # pragma: no cover

        try:
            monkeypatch.setattr(runtime.state, "_connect", locked)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_REJECTED
            assert runtime.session_id == original and not runtime._session_changing
            monkeypatch.setattr(runtime.state, "_connect", connect)
            runtime.submit_user_message("Still usable")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert len(runtime.state.recent(session_id=original)) == 2
        finally:
            monkeypatch.setattr(runtime.state, "_connect", connect)
            await runtime.close()

    asyncio.run(scenario())


def test_corrupt_or_future_state_is_not_replaced_with_empty_history(tmp_path):
    corrupt = tmp_path / "corrupt.db"
    corrupt.write_bytes(b"not a database")
    with pytest.raises(RuntimeStateError):
        SQLiteSessionStore(corrupt)
    assert corrupt.read_bytes() == b"not a database"
    store = SQLiteSessionStore(tmp_path / "future.db")
    initial = store.open_conversation()
    with store._connect() as connection:
        store._metadata_set(connection, "conversation_schema", "99")
    with pytest.raises(RuntimeStateError, match="schema"):
        store.open_conversation()
    assert store.session_id() == initial.session_id
