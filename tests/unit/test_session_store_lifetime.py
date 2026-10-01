"""Operational state transactions must release Windows handles without GC."""

import sqlite3

import pytest

from sam_ambient.core.storage.sqlite import SQLiteSessionStore


def test_each_state_transaction_closes_its_connection_and_rolls_back(tmp_path, monkeypatch):
    connect = sqlite3.connect
    connections = []

    def tracked(*args, **kwargs):
        connection = connect(*args, **kwargs)
        connections.append(connection)
        return connection

    monkeypatch.setattr(sqlite3, "connect", tracked)
    path = tmp_path / "state.db"
    store = SQLiteSessionStore(path)
    store.remember_local_model("lm-studio", "chat")
    assert store.last_local_model() == ("lm-studio", "chat")
    with pytest.raises(RuntimeError, match="transaction failure"):
        with store._connect() as connection:
            connection.execute("DELETE FROM runtime_metadata")
            raise RuntimeError("transaction failure")
    assert store.last_local_model() == ("lm-studio", "chat")
    # Hold strong references so garbage collection cannot hide the handle leak.
    for connection in connections:
        with pytest.raises(sqlite3.ProgrammingError, match="closed"):
            connection.execute("SELECT 1")
    path.unlink()  # Windows must be able to remove state immediately.
