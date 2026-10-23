"""Authoritative conversation isolation/recovery with temporary stores and fake models."""

import asyncio
import json
import sqlite3
import threading
from contextlib import contextmanager
from uuid import uuid4

import pytest

from sam_ambient.conversation_diagnostics import ConversationTrace
from sam_ambient.core.owner import OwnerConnection, OwnerSession
from sam_ambient.core.protocol import ControlCommand, EventType
from sam_ambient.core.storage.sqlite import RuntimeStateError, SQLiteSessionStore
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.integration.test_voice_stream_lifecycle import BlockingFirstOutput
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_local_controls import RecordingProvider
from tests.unit.test_phase9_packaging import _FakeTts
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
            again = runtime._ready_event()
            assert again.session_id == ready.session_id
            assert again.payload["conversation"]["revision"] == snapshot["revision"]
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


def test_partial_generation_recovers_as_incomplete_without_reissuing_or_saving_draft(tmp_path):
    class PartialProvider(ConversationProvider):
        def __init__(self):
            super().__init__()
            self.gate = asyncio.Event()

        async def stream_chat(self, messages, tools, *, model, cancellation):
            from sam_ambient.core.providers import ModelEvent, ModelEventKind

            self.contexts.append(list(messages))
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "Unfinished draft")
            await self.gate.wait()
            cancellation.raise_if_cancelled()
            yield ModelEvent(ModelEventKind.COMPLETED)

    async def scenario():
        config = RuntimeConfig(
            tmp_path, state_db=tmp_path / "state.db", application_instance_id="same-launch"
        )
        runtime = SamRuntime(PartialProvider(), config)
        session = runtime.session_id
        try:
            runtime.submit_user_message("Committed before interruption")
            await until(lambda: runtime.conversations.draft is not None)
            live = runtime._ready_event().payload["conversation"]
            assert live["draft"]["text"] == "Unfinished draft"
            assert live["incomplete_turns"] == []
        finally:
            await runtime.close()
        provider = ConversationProvider()
        recovered = SamRuntime(provider, config)
        try:
            snapshot = recovered._ready_event().payload["conversation"]
            assert recovered.session_id == session
            assert snapshot["draft"] is None and len(snapshot["incomplete_turns"]) == 1
            assert [(item["role"], item["text"]) for item in snapshot["history"]] == [
                ("user", "Committed before interruption")
            ]
            assert not provider.contexts and recovered.active_generation_id is None
        finally:
            await recovered.close()

    asyncio.run(scenario())


def test_speech_delivery_blocks_switch_and_stopped_committed_answer_survives_restart(tmp_path):
    async def scenario():
        output = BlockingFirstOutput()
        config = RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        runtime = SamRuntime(ConversationProvider(), config, tts=_FakeTts(), audio_output=output)
        owner = OwnerConnection(OwnerSession(), "owner")
        original = runtime.session_id
        try:
            runtime.submit_user_message("A spoken request")
            await asyncio.wait_for(output.first_started.wait(), 2)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_REJECTED
            stored = runtime.state.recent(session_id=original)
            assert [item.role for item in stored] == ["user", "assistant"]
            await runtime._cancel_active_playback("stop_speaking")
            output.release_first.set()
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert (await select(runtime, owner, "new")).type == EventType.CONTROL_ACKNOWLEDGED
            assert (
                await select(runtime, owner, "resume", original)
            ).type == EventType.CONTROL_ACKNOWLEDGED
            assert (
                runtime._ready_event().payload["conversation"]["history"][-1]["text"]
                == "Your color is green."
            )
        finally:
            output.release_first.set()
            await runtime.close()
        recovered = SamRuntime(ConversationProvider(), config)
        try:
            assert recovered._ready_event().generation_id is None
            assert len(recovered.conversations.history) == 2
            assert recovered.delivery.snapshot("unknown-old-generation") is None
        finally:
            await recovered.close()

    asyncio.run(scenario())


def test_reloaded_history_does_not_restore_or_substitute_an_unavailable_model(tmp_path):
    store = SQLiteSessionStore(tmp_path / "state.db")
    original = store.open_conversation()
    store.append(
        session_id=original.session_id,
        turn_id="saved",
        role="user",
        content="Retained",
        committed_at_ms=1,
    )

    async def scenario():
        provider = ConversationProvider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(
                tmp_path,
                state_db=store.path,
                model="owner-exact-model",
                model_unavailable_reason="selected_model_unavailable",
            ),
        )
        try:
            ready = runtime._ready_event()
            assert ready.payload["provider"] is None and ready.payload["model"] is None
            assert ready.payload["conversation"]["history"][0]["text"] == "Retained"
            assert runtime._model == "owner-exact-model" and not provider.contexts
            runtime.submit_user_message("No silent route substitution")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert not provider.contexts
            assert runtime.state.recent(session_id=runtime.session_id)[-1].role == "user"
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_application_launch_and_storage_retention_are_bounded_without_deleting_saved_sessions(
    tmp_path,
):
    store = SQLiteSessionStore(tmp_path / "state.db", maximum_messages=5)
    first = store.open_conversation("app-0")
    store.append(
        session_id=first.session_id,
        turn_id="retained",
        role="user",
        content="Retained",
        committed_at_ms=1,
    )
    store.change_conversation(
        session_id=first.session_id, expected_revision=0, action="policy", target="new"
    )
    for index in range(1, 70):
        current = store.open_conversation(f"app-{index}")
    with store._connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM conversation_sessions").fetchone()[0] <= 65
    assert store.recent(limit=5, session_id=first.session_id)[0].content == "Retained"
    assert len(current.retained) <= 32
    for index in range(8):
        store.append(
            session_id=current.session_id,
            turn_id=str(index),
            role="user",
            content="Bounded",
            committed_at_ms=index + 2,
        )
    assert len(store.recent(limit=5)) == 5


def test_snapshot_bounds_and_launch_preference_preserve_uncommitted_draft(tmp_path):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        try:
            runtime.conversations.draft = {
                "turn_id": "cancelled",
                "generation_id": "g",
                "text": "Interrupted draft",
                "interrupted": True,
                "complete": False,
            }
            command = ControlCommand(
                type="control.conversation.launch_policy.set",
                command_id=str(uuid4()),
                monotonic_ms=1,
                session_id=runtime.session_id,
                payload={"policy": "new", "expected_revision": 0},
            )
            assert (
                await runtime.controls.dispatch(command, owner_connection=owner)
            ).type == EventType.CONTROL_ACKNOWLEDGED
            assert runtime.conversations.draft["text"] == "Interrupted draft"
            from sam_ambient.core.storage.sqlite import StoredMessage

            for index in range(55):
                runtime.conversations.remember(
                    StoredMessage(runtime.session_id, str(index), "user", "x" * 16_384, 1, False)
                )
            snapshot = runtime._ready_event().payload["conversation"]
            assert len(runtime.conversations.history) == 50
            assert sum(len(item["text"]) for item in snapshot["history"]) <= 48_000
            assert snapshot["history_limited"] and snapshot["history"][0]["truncated"]
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_live_history_and_retained_counts_follow_actual_message_retention(tmp_path):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        runtime.state.maximum_messages = 12
        try:
            for index in range(7):
                runtime.submit_user_message(f"Request {index}")
                await asyncio.wait_for(runtime._active_done.wait(), 2)
            snapshot = runtime._ready_event().payload["conversation"]
            saved = runtime.state.recent(limit=12, session_id=runtime.session_id)
            assert [(item["role"], item["text"]) for item in snapshot["history"]] == [
                (item.role, item.content) for item in saved
            ]
            active = next(
                item for item in snapshot["retained"] if item["session_id"] == runtime.session_id
            )
            assert active["message_count"] == len(saved) == 12
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_private_ready_history_and_session_ids_never_enter_conversation_diagnostics(tmp_path):
    runtime = SamRuntime(
        ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
    )
    trace = ConversationTrace()
    event = runtime._ready_event()
    event.payload["conversation"]["history"] = [{"text": "Private retained fixture text"}]
    trace.event(event)
    encoded = json.dumps(list(trace.history))
    assert "Private retained fixture text" not in encoded and runtime.session_id not in encoded
    asyncio.run(runtime.close())


@pytest.mark.parametrize(
    "payload",
    [
        {"action": "new", "expected_revision": True},
        {"action": "new", "expected_revision": 0, "erase_history": True},
        {"action": "resume", "expected_revision": 0, "target_session_id": "not-retained"},
    ],
)
def test_invalid_session_commands_do_not_change_context_or_delete_history(tmp_path, payload):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        owner = OwnerConnection(OwnerSession(), "owner")
        original = runtime.session_id
        try:
            response = await runtime.controls.dispatch(
                ControlCommand(
                    type="control.conversation.select",
                    command_id=str(uuid4()),
                    monotonic_ms=1,
                    session_id=original,
                    payload=payload,
                ),
                owner_connection=owner,
            )
            assert response.type == EventType.CONTROL_REJECTED
            assert runtime.session_id == runtime.state.session_id() == original
            assert runtime.conversations.revision == 0
        finally:
            await runtime.close()

    asyncio.run(scenario())
