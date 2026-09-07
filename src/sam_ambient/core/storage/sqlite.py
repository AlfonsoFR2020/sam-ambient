"""Minimal durable committed conversation state; raw audio is never stored."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

_MAX_MESSAGE_CHARS = 16_384


class RuntimeStateError(RuntimeError):
    """Durable runtime state is invalid or unavailable."""


@dataclass(frozen=True, slots=True)
class StoredMessage:
    session_id: str
    turn_id: str
    role: str
    content: str
    committed_at_ms: int
    truncated: bool


class SQLiteSessionStore:
    """Small SQLite seam for committed text and stable session identity."""

    def __init__(self, path: Path, *, maximum_messages: int = 500) -> None:
        if maximum_messages < 1:
            raise ValueError("maximum_messages must be positive")
        self.path = path.resolve(strict=False)
        self.maximum_messages = maximum_messages
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with self._connect() as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS runtime_metadata (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS committed_messages (
                        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id TEXT NOT NULL,
                        turn_id TEXT NOT NULL,
                        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                        content TEXT NOT NULL,
                        committed_at_ms INTEGER NOT NULL,
                        truncated INTEGER NOT NULL CHECK(truncated IN (0, 1)),
                        UNIQUE(session_id, turn_id, role)
                    );
                    """
                )
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("runtime state database is corrupt") from error

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def last_local_model(self) -> tuple[str, str] | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='last_local_model'"
                ).fetchone()
            value = json.loads(row[0]) if row else None
            if (
                isinstance(value, list)
                and len(value) == 2
                and value[0] in {"ollama", "lm-studio", "openai-compatible"}
                and isinstance(value[1], str)
                and 0 < len(value[1]) <= 256
                and not value[1].startswith("-")
                and all(ord(c) >= 32 for c in value[1])
            ):
                return value[0], value[1]
        except (sqlite3.DatabaseError, ValueError, TypeError):
            pass  # Optional preference must never block startup.
        return None

    def remember_local_model(self, provider: str, model: str) -> None:
        if provider not in {"ollama", "lm-studio", "openai-compatible"}:
            return
        if (
            not model
            or len(model) > 256
            or model.startswith("-")
            or any(ord(c) < 32 for c in model)
        ):
            return
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO runtime_metadata(key,value) VALUES ('last_local_model',?)",
                (json.dumps([provider, model]),),
            )

    def session_id(self) -> str:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key = 'session_id'"
                ).fetchone()
                if row is not None:
                    persisted = str(row[0])
                    if not persisted.strip() or len(persisted) > 128:
                        raise RuntimeStateError("invalid durable session identity")
                    return persisted
                session_id = str(uuid4())
                connection.execute(
                    "INSERT INTO runtime_metadata(key, value) VALUES ('session_id', ?)",
                    (session_id,),
                )
                return session_id
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("failed to load durable session identity") from error

    def append(
        self,
        *,
        session_id: str,
        turn_id: str,
        role: str,
        content: str,
        committed_at_ms: int,
    ) -> StoredMessage:
        if role not in {"user", "assistant"}:
            raise ValueError("only committed user/assistant text may be persisted")
        bounded = content[:_MAX_MESSAGE_CHARS]
        truncated = len(bounded) != len(content)
        try:
            with self._connect() as connection:
                connection.execute(
                    """INSERT OR IGNORE INTO committed_messages(
                        session_id, turn_id, role, content, committed_at_ms, truncated
                    ) VALUES (?, ?, ?, ?, ?, ?)""",
                    (session_id, turn_id, role, bounded, committed_at_ms, int(truncated)),
                )
                connection.execute(
                    """DELETE FROM committed_messages WHERE sequence NOT IN (
                        SELECT sequence FROM committed_messages ORDER BY sequence DESC LIMIT ?
                    )""",
                    (self.maximum_messages,),
                )
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("failed to persist committed message") from error
        return StoredMessage(session_id, turn_id, role, bounded, committed_at_ms, truncated)

    def recent(self, *, limit: int = 50) -> tuple[StoredMessage, ...]:
        if not 1 <= limit <= self.maximum_messages:
            raise ValueError("message limit is outside the configured bound")
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """SELECT session_id, turn_id, role, content, committed_at_ms, truncated
                       FROM committed_messages ORDER BY sequence DESC LIMIT ?""",
                    (limit,),
                ).fetchall()
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("failed to load committed messages") from error
        return tuple(StoredMessage(*row[:-1], bool(row[-1])) for row in reversed(rows))
