import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest

from sam_ambient.core.memory import MemoryError, MemoryStore


def add(store, content="I prefer concise Spanish replies", **kwargs):
    return store.create(
        store.owner_id,
        kind="preference",
        scope="personal",
        content=content,
        source_kind=kwargs.pop("source_kind", "owner"),
        source_ref="action-1",
        **kwargs,
    )


def test_crud_restart_provenance_revision_and_actual_deletion(tmp_path):
    path = tmp_path / "memory.sqlite3"
    store = MemoryStore(path)
    item = add(store)
    assert item.review == "reviewed" and item.reviewed_by == store.owner_id
    assert store.get(store.owner_id, item.id) == item
    reopened = MemoryStore(path)
    assert reopened.owner_id == store.owner_id
    assert reopened.list(reopened.owner_id, query="SPANISH") == (item,)
    updated = reopened.correct(
        reopened.owner_id,
        item.id,
        content="Prefer concise English replies",
        expected_revision=1,
        action_ref="action-2",
    )
    assert updated.id == item.id and updated.revision == 2
    assert updated.source_ref == "action-1" and updated.update_ref == "action-2"
    assert not reopened.list(reopened.owner_id, query="Spanish")
    with pytest.raises(MemoryError, match="refresh"):
        reopened.delete(reopened.owner_id, item.id, expected_revision=1)
    reopened.delete(reopened.owner_id, item.id, expected_revision=2)
    assert not MemoryStore(path).list(store.owner_id)
    assert b"Prefer concise English replies" not in path.read_bytes()
    assert b"I prefer concise Spanish replies" not in path.read_bytes()


def test_proposals_require_explicit_review_and_preserve_original_source(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    item = add(store, source_kind="web")
    assert item.review == "proposed" and item.reviewed_by is None
    assert add(store, source_kind="web").id == item.id
    approved = store.approve(store.owner_id, item.id, expected_revision=1, action_ref="owner-2")
    assert approved.review == "reviewed" and approved.source_kind == "web"
    assert approved.reviewed_by == store.owner_id


@pytest.mark.parametrize(
    "secret",
    [
        "api_key=12345",
        "password: abc",
        "Bearer abcdefghijklmnopqrstuvwxyz",
        "sk-abcdefghijklmnopqrstuvwxyz0123456789",
        "https://user:password@example.org",
        "-----BEGIN RSA PRIVATE KEY----- abc",
        "\x00bad",
        "a" * 1201,
    ],
)
def test_secrets_and_oversize_rejected_without_retaining_content(tmp_path, secret):
    store = MemoryStore(tmp_path / "memory.db")
    with pytest.raises(MemoryError):
        add(store, secret)
    assert not store.list(store.owner_id)


def test_owner_scope_query_limits_and_inert_sql_text(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    item = add(store, "<script>attack()</script> '; DROP TABLE memories; --")
    with pytest.raises(MemoryError, match="scope denied"):
        store.get("not-owner", item.id)
    assert store.list(store.owner_id, scope="different") == ()
    assert store.list(store.owner_id, query="DROP") == (item,)
    with pytest.raises(MemoryError):
        store.list(store.owner_id, limit=500)


def test_concurrent_transactions_and_future_schema_fail_closed(tmp_path):
    path = tmp_path / "memory.db"
    store = MemoryStore(path)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = tuple(pool.map(lambda n: add(store, f"Owner preference number {n}"), range(12)))
    assert len({record.id for record in results}) == 12
    assert len(store.list(store.owner_id)) == 12
    with sqlite3.connect(path) as db:
        db.execute("PRAGMA user_version=99")
    before = path.read_bytes()
    with pytest.raises(MemoryError, match="Unsupported"):
        MemoryStore(path)
    assert path.read_bytes() == before


def test_invalid_database_and_locked_write_fail_safely(tmp_path):
    bad = tmp_path / "bad.db"
    bad.write_bytes(b"not a database")
    with pytest.raises(MemoryError, match="unavailable"):
        MemoryStore(bad)
    store = MemoryStore(tmp_path / "memory.db")
    with sqlite3.connect(store.path) as db:
        db.execute("BEGIN EXCLUSIVE")
        with pytest.raises(MemoryError, match="unavailable"):
            add(store)
    assert not store.list(store.owner_id)


def test_failed_schema_initialization_is_transactional_and_preserves_data(tmp_path):
    path = tmp_path / "partial.db"
    with sqlite3.connect(path) as db:
        db.execute("CREATE TABLE memories (id TEXT)")
        db.execute("INSERT INTO memories VALUES ('keep-this')")
    with pytest.raises(MemoryError):
        MemoryStore(path)
    with sqlite3.connect(path) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 0
        assert db.execute("SELECT id FROM memories").fetchone()[0] == "keep-this"
        assert not db.execute("SELECT name FROM sqlite_master WHERE name='memory_meta'").fetchone()


def test_invalid_stored_record_and_page_types_are_sanitized(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    item = add(store)
    with sqlite3.connect(store.path) as db:
        db.execute(
            "UPDATE memories SET review='forged', content=? WHERE id=?",
            ("secret corrupted claim", item.id),
        )
    with pytest.raises(MemoryError, match="Invalid stored"):
        store.get(store.owner_id, item.id)
    for bounds in ({"limit": "many"}, {"offset": True}, {"limit": 1.5}):
        with pytest.raises(MemoryError, match="bounds"):
            store.list(store.owner_id, **bounds)
