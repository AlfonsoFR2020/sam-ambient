"""SQLite persistence for update transactions and last-known-good metadata."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from pathlib import Path

from sam_ambient.supervisor.update_models import (
    ComponentVersionState,
    UpdateError,
    UpdateState,
    UpdateTransaction,
)


class UpdateStore:
    def __init__(self, path: Path) -> None:
        self.path = path.resolve(strict=False)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with self._connect() as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS update_transactions (
                        update_tx_id TEXT PRIMARY KEY,
                        state TEXT NOT NULL,
                        payload TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS component_versions (
                        component_id TEXT PRIMARY KEY,
                        payload TEXT NOT NULL
                    );
                    """
                )
        except sqlite3.DatabaseError as error:
            raise UpdateError("update state database is corrupt") from error

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def save_transaction(self, transaction: UpdateTransaction) -> None:
        payload = json.dumps(
            transaction.to_dict(), allow_nan=False, separators=(",", ":"), sort_keys=True
        )
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO update_transactions(update_tx_id, state, payload)
                   VALUES (?, ?, ?)""",
                (transaction.update_tx_id, transaction.state.value, payload),
            )

    def transaction(self, update_tx_id: str) -> UpdateTransaction:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT payload FROM update_transactions WHERE update_tx_id = ?",
                    (update_tx_id,),
                ).fetchone()
            if row is None:
                raise UpdateError("unknown update transaction")
            return UpdateTransaction.from_dict(json.loads(row[0]))
        except (
            sqlite3.DatabaseError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise UpdateError("persisted update transaction is invalid") from error

    def incomplete(self) -> tuple[UpdateTransaction, ...]:
        terminal = tuple(
            state.value
            for state in (UpdateState.COMMITTED, UpdateState.ROLLED_BACK, UpdateState.FAILED)
        )
        placeholders = ",".join("?" for _ in terminal)
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    f"SELECT payload FROM update_transactions WHERE state NOT IN ({placeholders})",
                    terminal,
                ).fetchall()
            return tuple(UpdateTransaction.from_dict(json.loads(row[0])) for row in rows)
        except (
            sqlite3.DatabaseError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise UpdateError("persisted incomplete update state is invalid") from error

    def save_component(self, state: ComponentVersionState) -> None:
        payload = json.dumps(asdict(state), separators=(",", ":"), sort_keys=True)
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO component_versions(component_id, payload) VALUES (?, ?)",
                (state.component_id, payload),
            )

    def component(self, component_id: str) -> ComponentVersionState:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT payload FROM component_versions WHERE component_id = ?",
                    (component_id,),
                ).fetchone()
            if row is None:
                raise UpdateError("component has no registered known-good version")
            return ComponentVersionState(**json.loads(row[0]))
        except (sqlite3.DatabaseError, json.JSONDecodeError, TypeError, ValueError) as error:
            raise UpdateError("persisted component version state is invalid") from error
