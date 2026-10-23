"""Minimal durable committed conversation state; raw audio is never stored."""

from __future__ import annotations

import json
import sqlite3
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
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


@dataclass(frozen=True, slots=True)
class ConversationSelection:
    session_id: str
    revision: int
    launch_policy: str
    history: tuple[StoredMessage, ...]
    retained: tuple[dict[str, object], ...]


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
                    CREATE TABLE IF NOT EXISTS conversation_sessions (
                        session_id TEXT PRIMARY KEY,
                        created_at_ms INTEGER NOT NULL
                    );
                    """
                )
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("runtime state database is corrupt") from error

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        # sqlite3.Connection.__exit__ commits/rolls back but does not close.
        # Each short transaction owns its handle, including exceptional exits.
        with closing(sqlite3.connect(self.path, timeout=5)) as connection:
            connection.execute("PRAGMA busy_timeout = 5000")
            with connection:
                yield connection

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

    def visual_preferences(self) -> dict[str, object] | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='visual_preferences'"
                ).fetchone()
            value = json.loads(row[0]) if row else None
            return dict(value) if isinstance(value, dict) else None
        except (sqlite3.DatabaseError, ValueError, TypeError):
            return None

    def remember_visual_preferences(self, value: dict[str, object]) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO runtime_metadata(key,value)
                   VALUES ('visual_preferences',?)""",
                (json.dumps(value, sort_keys=True, allow_nan=False),),
            )

    def audio_preferences(self) -> dict[str, object] | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='audio_preferences'"
                ).fetchone()
            value = json.loads(row[0]) if row else None
            return dict(value) if isinstance(value, dict) else None
        except (sqlite3.DatabaseError, ValueError, TypeError):
            return None

    def remember_audio_preferences(self, value: dict[str, object]) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO runtime_metadata(key,value)
                   VALUES ('audio_preferences',?)""",
                (json.dumps(value, sort_keys=True, allow_nan=False),),
            )

    def lifecycle_preferences(self) -> dict[str, object] | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='lifecycle_preferences'"
                ).fetchone()
            value = json.loads(row[0]) if row else None
            return dict(value) if isinstance(value, dict) else None
        except (sqlite3.DatabaseError, ValueError, TypeError):
            return None

    def voice_input_mode(self) -> str:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='voice_input_mode'"
                ).fetchone()
            return "push_to_talk" if row and row[0] == "push_to_talk" else "ordinary"
        except sqlite3.DatabaseError:
            return "ordinary"

    def remember_voice_input_mode(self, mode: str) -> None:
        if mode not in {"ordinary", "push_to_talk"}:
            raise ValueError("unsupported voice input mode")
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO runtime_metadata(key,value) VALUES ('voice_input_mode',?)",
                (mode,),
            )

    def recognition_language(self) -> str | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='recognition_language'"
                ).fetchone()
            return row[0] if row and row[0] in {"auto", "en", "es"} else None
        except sqlite3.DatabaseError:
            return None

    def remember_recognition_language(self, language: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO runtime_metadata(key,value)
                   VALUES ('recognition_language',?)""",
                (language,),
            )

    def remember_lifecycle_preferences(self, value: dict[str, object]) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT OR REPLACE INTO runtime_metadata(key,value)
                   VALUES ('lifecycle_preferences',?)""",
                (json.dumps(value, sort_keys=True, allow_nan=False),),
            )

    def instance_resource_ownership(self, application_instance_id: str) -> dict[str, object]:
        if not application_instance_id.strip() or len(application_instance_id) > 128:
            return {}
        key = "resource_ownership:" + application_instance_id
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key=?", (key,)
                ).fetchone()
            value = json.loads(row[0]) if row else None
            return dict(value) if isinstance(value, dict) else {}
        except (sqlite3.DatabaseError, ValueError, TypeError):
            return {}

    def remember_instance_resource_ownership(
        self, application_instance_id: str, value: dict[str, object]
    ) -> None:
        if not application_instance_id.strip() or len(application_instance_id) > 128:
            raise ValueError("application instance identity is invalid")
        key = "resource_ownership:" + application_instance_id
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO runtime_metadata(key,value) VALUES (?,?)",
                (key, json.dumps(value, sort_keys=True, allow_nan=False)),
            )

    def forget_instance_resource_ownership(self, application_instance_id: str) -> None:
        if not application_instance_id.strip() or len(application_instance_id) > 128:
            return
        with self._connect() as connection:
            connection.execute(
                "DELETE FROM runtime_metadata WHERE key=?",
                ("resource_ownership:" + application_instance_id,),
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
                    "INSERT OR IGNORE INTO conversation_sessions VALUES (?,?)",
                    (session_id, committed_at_ms),
                )
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

    def recent(
        self, *, limit: int = 50, session_id: str | None = None
    ) -> tuple[StoredMessage, ...]:
        if not 1 <= limit <= self.maximum_messages:
            raise ValueError("message limit is outside the configured bound")
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """SELECT session_id, turn_id, role, content, committed_at_ms, truncated
                       FROM committed_messages WHERE (? IS NULL OR session_id = ?)
                       ORDER BY sequence DESC LIMIT ?""",
                    (session_id, session_id, limit),
                ).fetchall()
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("failed to load committed messages") from error
        return tuple(StoredMessage(*row[:-1], bool(row[-1])) for row in reversed(rows))

    @staticmethod
    def _conversation_metadata(connection) -> tuple[int, str]:
        values = dict(
            connection.execute(
                "SELECT key,value FROM runtime_metadata WHERE key IN "
                "('conversation_schema','conversation_revision','conversation_launch_policy')"
            )
        )
        if values.get("conversation_schema", "1") != "1":
            raise RuntimeStateError("unsupported conversation state schema")
        try:
            revision = int(values.get("conversation_revision", "0"))
            if not 0 <= revision < 2**53 - 1:
                raise ValueError
        except ValueError as error:
            raise RuntimeStateError("invalid conversation revision") from error
        policy = values.get("conversation_launch_policy", "resume")
        return revision, policy if policy in {"resume", "new"} else "resume"

    @staticmethod
    def _metadata_set(connection, key: str, value: str) -> None:
        connection.execute(
            "INSERT OR REPLACE INTO runtime_metadata(key,value) VALUES (?,?)", (key, value)
        )

    def _conversation_selection(self, connection, session_id: str) -> ConversationSelection:
        revision, policy = self._conversation_metadata(connection)
        rows = connection.execute(
            """SELECT session_id,turn_id,role,content,committed_at_ms,truncated
               FROM committed_messages WHERE session_id=? ORDER BY sequence DESC LIMIT 50""",
            (session_id,),
        ).fetchall()
        retained = connection.execute(
            """SELECT s.session_id,COUNT(m.sequence),
                      COALESCE(MAX(m.committed_at_ms),s.created_at_ms)
               FROM conversation_sessions s LEFT JOIN committed_messages m
               ON m.session_id=s.session_id GROUP BY s.session_id
               ORDER BY (s.session_id=?) DESC,3 DESC,s.rowid DESC LIMIT 32""",
            (session_id,),
        ).fetchall()
        return ConversationSelection(
            session_id,
            revision,
            policy,
            tuple(StoredMessage(*row[:-1], bool(row[-1])) for row in reversed(rows)),
            tuple(
                {"session_id": row[0], "message_count": row[1], "updated_at_ms": row[2]}
                for row in retained
            ),
        )

    def open_conversation(
        self, application_instance_id: str | None = None
    ) -> ConversationSelection:
        """Additive legacy upgrade; a supervisor launch is distinct from core recovery."""
        current = self.session_id()
        try:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                revision, policy = self._conversation_metadata(connection)
                connection.execute(
                    """INSERT OR IGNORE INTO conversation_sessions
                       SELECT session_id,MIN(committed_at_ms) FROM committed_messages
                       GROUP BY session_id"""
                )
                self._metadata_set(connection, "conversation_schema", "1")
                if application_instance_id:
                    if (
                        len(application_instance_id) > 128
                        or application_instance_id.strip() != application_instance_id
                    ):
                        raise ValueError("invalid application launch identity")
                    row = connection.execute(
                        "SELECT value FROM runtime_metadata "
                        "WHERE key='conversation_launch_instance'"
                    ).fetchone()
                    if (not row or row[0] != application_instance_id) and policy == "new":
                        current = str(uuid4())
                        self._metadata_set(connection, "session_id", current)
                        self._metadata_set(connection, "conversation_revision", str(revision + 1))
                    self._metadata_set(
                        connection, "conversation_launch_instance", application_instance_id
                    )
                connection.execute(
                    "INSERT OR IGNORE INTO conversation_sessions VALUES (?,?)",
                    (current, time.time_ns() // 1_000_000),
                )
                return self._conversation_selection(connection, current)
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("conversation state is unavailable") from error

    def change_conversation(
        self,
        *,
        session_id: str,
        expected_revision: int,
        action: str,
        target: str | None = None,
    ) -> ConversationSelection:
        """Atomic compare-and-select; no message deletion or inference replay."""
        try:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                revision, _ = self._conversation_metadata(connection)
                current = connection.execute(
                    "SELECT value FROM runtime_metadata WHERE key='session_id'"
                ).fetchone()
                if not current or current[0] != session_id or revision != expected_revision:
                    raise ValueError("Conversation changed; refresh before trying again")
                if action == "new":
                    target = str(uuid4())
                    connection.execute(
                        "INSERT INTO conversation_sessions VALUES (?,?)",
                        (target, time.time_ns() // 1_000_000),
                    )
                elif action == "resume":
                    if not connection.execute(
                        "SELECT 1 FROM conversation_sessions WHERE session_id=?", (target,)
                    ).fetchone():
                        raise ValueError("Retained conversation is unavailable")
                elif action == "policy" and target in {"resume", "new"}:
                    self._metadata_set(connection, "conversation_launch_policy", target)
                    target = session_id
                else:
                    raise ValueError("Unsupported conversation operation")
                assert target is not None
                self._metadata_set(connection, "session_id", target)
                self._metadata_set(connection, "conversation_revision", str(revision + 1))
                # Bound empty descriptors; never delete committed text to start a session.
                connection.execute(
                    """DELETE FROM conversation_sessions WHERE session_id != ?
                       AND session_id NOT IN (SELECT session_id FROM committed_messages)
                       AND rowid NOT IN (SELECT rowid FROM conversation_sessions
                                         ORDER BY rowid DESC LIMIT 64)""",
                    (target,),
                )
                return self._conversation_selection(connection, target)
        except sqlite3.DatabaseError as error:
            raise RuntimeStateError("conversation change could not be saved") from error
