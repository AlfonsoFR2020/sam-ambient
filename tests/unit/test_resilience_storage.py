from __future__ import annotations

import asyncio
import sqlite3
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

import pytest

from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ToolSchema,
)
from sam_ambient.core.storage import SQLiteSessionStore
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from sam_ambient.supervisor import (
    ComponentStatus,
    CrashRecord,
    HealthState,
    SupervisorStateError,
    SupervisorStore,
)


def test_committed_session_text_and_identity_are_recoverable_and_bounded(tmp_path: Path) -> None:
    path = tmp_path / "sam.db"
    first = SQLiteSessionStore(path, maximum_messages=2)
    session_id = first.session_id()
    first.append(
        session_id=session_id,
        turn_id="turn-1",
        role="user",
        content="hello",
        committed_at_ms=1,
    )
    first.append(
        session_id=session_id,
        turn_id="turn-1",
        role="assistant",
        content="a" * 20_000,
        committed_at_ms=2,
    )
    first.append(
        session_id=session_id,
        turn_id="turn-2",
        role="user",
        content="again",
        committed_at_ms=3,
    )

    recovered = SQLiteSessionStore(path, maximum_messages=2)
    messages = recovered.recent(limit=2)
    assert recovered.session_id() == session_id
    assert [(item.role, item.turn_id) for item in messages] == [
        ("assistant", "turn-1"),
        ("user", "turn-2"),
    ]
    assert messages[0].truncated is True


def test_persistence_schema_never_contains_raw_microphone_audio(tmp_path: Path) -> None:
    path = tmp_path / "sam.db"
    SQLiteSessionStore(path)
    SupervisorStore(path)
    with sqlite3.connect(path) as connection:
        schema = " ".join(
            row[0]
            for row in connection.execute("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL")
        ).lower()
    assert "microphone" not in schema
    assert "raw_audio" not in schema


def test_crash_journal_and_component_status_are_bounded_and_recoverable(tmp_path: Path) -> None:
    store = SupervisorStore(tmp_path / "sam.db", maximum_crash_records=2)
    status = ComponentStatus("sam-core", HealthState.DEGRADED, "instance", 123)
    store.save_status(status)
    for index in range(3):
        store.append_crash(
            CrashRecord(index, "sam-core", index, f"failure-{index}", index, "restart", "i")
        )

    assert store.load_status("sam-core") == status
    assert [item.reason for item in store.crashes()] == ["failure-1", "failure-2"]
    assert store.diagnostic_snapshot()["crash_count"] == 2


def test_corrupt_optional_state_fails_closed_instead_of_launching(tmp_path: Path) -> None:
    path = tmp_path / "corrupt.db"
    path.write_bytes(b"not sqlite")
    with pytest.raises(SupervisorStateError, match="corrupt"):
        SupervisorStore(path)


def test_invalid_persisted_security_state_fails_closed(tmp_path: Path) -> None:
    store = SupervisorStore(tmp_path / "state.db")
    with sqlite3.connect(store.path) as connection:
        connection.execute(
            "INSERT INTO supervisor_metadata(key, value) VALUES ('safe_mode', 'maybe')"
        )
    with pytest.raises(SupervisorStateError, match="security"):
        store.security_state()


def test_only_explicit_trusted_restore_leaves_persisted_safe_mode(tmp_path: Path) -> None:
    store = SupervisorStore(tmp_path / "state.db")
    store.append_crash(CrashRecord(1, "sam-core", 1, "crash", 1, "safe_mode", "old"))
    revoked = store.enter_safe_mode("crash loop")
    restored = store.restore_capabilities_trusted()

    assert revoked.safe_mode is True
    assert restored.safe_mode is False
    assert restored.capabilities_revoked is False
    assert restored.capability_epoch > revoked.capability_epoch
    assert store.crashes() == ()


class ReadyProvider(LLMProvider):
    id = "ready"
    data_boundary = DataBoundary.LOCAL

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        del cancellation
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        del cancellation
        return [ModelInfo("model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model, cancellation
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "durable answer")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_runtime_recovers_session_and_committed_turn_but_not_old_authority(
    tmp_path: Path,
) -> None:
    async def scenario() -> None:
        state_db = tmp_path / "sam.db"
        first = SamRuntime(
            ReadyProvider(),
            RuntimeConfig(tmp_path, port=0, model="model", state_db=state_db),
        )
        first_session = first.session_id
        first.submit_user_message("remember this")
        await asyncio.gather(*tuple(first._tasks))
        await first.close()

        restarted = SamRuntime(
            ReadyProvider(),
            RuntimeConfig(
                tmp_path,
                port=0,
                model="model",
                state_db=state_db,
                runtime_instance_id="fresh-instance",
                capability_epoch=4,
                capabilities_active=False,
                capability_reason="supervisor_revoked_after_failure",
            ),
        )
        assert restarted.session_id == first_session
        assert restarted.capability_authority.snapshot.active is False
        assert restarted.capability_authority.snapshot.epoch == 4
        assert [message.content for message in restarted.state.recent()] == [  # type: ignore[union-attr]
            "remember this",
            "durable answer",
        ]
        assert restarted._ready_event().payload["recovered_message_count"] == 2
        await restarted.close()

    asyncio.run(scenario())
