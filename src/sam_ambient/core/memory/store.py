"""Transactional, content-removing single-owner SQLite memory storage."""

from __future__ import annotations

import os
import re
import sqlite3
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

SCHEMA_VERSION = 1
MAX_CONTENT = 1200
KINDS = ("fact", "preference", "project")
SOURCES = ("owner", "model", "conversation", "tool", "web")
MAX_PROPOSED = 100
_WORD = re.compile(r"[^\W_]+", re.UNICODE)
_GUARD: ContextVar[Callable[[], None]] = ContextVar(
    "memory_transaction_guard", default=lambda: None
)
_SECRET = re.compile(
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)[-_][\w-]{16,}"
    r"|\b(?:password|passwd|api[_ -]?key|auth[_ -]?token|secret)\s*[:=]\s*\S+"
    r"|\bBearer\s+[\w./+-]{12,}|https?://[^\s/@]+:[^\s/@]+@",
    re.IGNORECASE,
)


class MemoryError(ValueError):
    """A sanitized memory failure, safe to report without content or SQL details."""


@contextmanager
def guarded_transaction(check: Callable[[], None]) -> Iterator[None]:
    handle = _GUARD.set(check)
    try:
        yield
    finally:
        _GUARD.reset(handle)


def default_memory_path() -> Path:
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "Sam" / "memory.sqlite3"


def terms(text: str) -> tuple[str, ...]:
    return tuple(dict.fromkeys(_WORD.findall(text.casefold())))


def validate_content(content: str) -> str:
    if not isinstance(content, str) or not content.strip() or len(content) > MAX_CONTENT:
        raise MemoryError(f"Memory must contain 1-{MAX_CONTENT} characters")
    if "\x00" in content or _SECRET.search(content):
        raise MemoryError("Credentials or secret-like material cannot be ordinary memory")
    return content.strip()


def _text(value: str, maximum: int, name: str) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum or "\x00" in value:
        raise MemoryError(f"Invalid memory {name}")
    if _SECRET.search(value):
        raise MemoryError("Credentials cannot be memory metadata")
    return value.strip()


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="microseconds")


@dataclass(frozen=True, slots=True)
class MemoryRecord:
    id: str
    owner_id: str
    kind: str
    scope: str
    content: str
    source_kind: str
    source_ref: str
    review: str
    reviewed_by: str | None
    revision: int
    created_at: str
    updated_at: str
    update_ref: str | None

    def to_data(self) -> dict:
        return asdict(self)


class MemoryStore:
    """No shared connection, transcript import, deleted-content audit or background loop."""

    def __init__(self, path: Path) -> None:
        self.path = path.resolve()
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self._db() as db:
                version = db.execute("PRAGMA user_version").fetchone()[0]
                if version not in {0, SCHEMA_VERSION}:
                    raise MemoryError("Unsupported memory schema; database left unchanged")
                db.execute(
                    "CREATE TABLE IF NOT EXISTS memory_meta "
                    "(key TEXT PRIMARY KEY, value TEXT NOT NULL)"
                )
                db.execute(
                    "CREATE TABLE IF NOT EXISTS memories ("
                    "id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL, "
                    "scope TEXT NOT NULL, content TEXT NOT NULL, source_kind TEXT NOT NULL, "
                    "source_ref TEXT NOT NULL, review TEXT NOT NULL, reviewed_by TEXT, "
                    "revision INTEGER NOT NULL, created_at TEXT NOT NULL, "
                    "updated_at TEXT NOT NULL, "
                    "update_ref TEXT, search_text TEXT NOT NULL)"
                )
                db.execute(
                    "CREATE INDEX IF NOT EXISTS memory_scope ON memories(owner_id, scope, review)"
                )
                db.execute("INSERT OR IGNORE INTO memory_meta VALUES ('owner', ?)", (str(uuid4()),))
                self.owner_id = db.execute(
                    "SELECT value FROM memory_meta WHERE key='owner'"
                ).fetchone()[0]
                UUID(self.owner_id)
                db.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
        except (OSError, ValueError, sqlite3.Error) as error:
            if isinstance(error, MemoryError):
                raise
            raise MemoryError("Memory database unavailable or invalid") from None

    @contextmanager
    def _db(self) -> Iterator[sqlite3.Connection]:
        db = None
        try:
            db = sqlite3.connect(self.path, timeout=0.25)
            db.row_factory = sqlite3.Row
            db.execute("PRAGMA secure_delete=ON")
            db.execute("PRAGMA foreign_keys=ON")
            with db:
                _GUARD.get()()
                yield db
                _GUARD.get()()
        except sqlite3.Error:
            raise MemoryError(
                "Memory database unavailable; text conversation remains usable"
            ) from None
        finally:
            if db is not None:
                db.close()

    def _owner(self, owner: str) -> None:
        if owner != self.owner_id:
            raise MemoryError("Memory owner scope denied")

    @staticmethod
    def _record(row: sqlite3.Row) -> MemoryRecord:
        return MemoryRecord(**{field: row[field] for field in MemoryRecord.__dataclass_fields__})

    def create(
        self,
        owner: str,
        *,
        kind: str,
        scope: str,
        content: str,
        source_kind: str,
        source_ref: str,
    ) -> MemoryRecord:
        self._owner(owner)
        content = validate_content(content)
        scope = _text(scope, 128, "scope")
        source_ref = _text(source_ref, 256, "source reference")
        if kind not in KINDS or source_kind not in SOURCES:
            raise MemoryError("Unsupported memory kind or provenance")
        reviewed = source_kind == "owner"
        now, record_id = _now(), str(uuid4())
        with self._db() as db:
            db.execute("BEGIN IMMEDIATE")
            # Repeated proposals do not accumulate duplicate unreviewed claims.
            prior = db.execute(
                "SELECT * FROM memories WHERE owner_id=? AND scope=? AND kind=? "
                "AND content=? AND source_kind=? ORDER BY created_at LIMIT 1",
                (owner, scope, kind, content, source_kind),
            ).fetchone()
            if prior is not None:
                return self._record(prior)
            if (
                not reviewed
                and db.execute(
                    "SELECT count(*) FROM memories WHERE owner_id=? AND review='proposed'", (owner,)
                ).fetchone()[0]
                >= MAX_PROPOSED
            ):
                raise MemoryError("Proposal inbox full; review or delete existing claims first")
            db.execute(
                "INSERT INTO memories VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    record_id,
                    owner,
                    kind,
                    scope,
                    content,
                    source_kind,
                    source_ref,
                    "reviewed" if reviewed else "proposed",
                    owner if reviewed else None,
                    1,
                    now,
                    now,
                    None,
                    " " + " ".join(terms(content)) + " ",
                ),
            )
            return self._record(
                db.execute("SELECT * FROM memories WHERE id=?", (record_id,)).fetchone()
            )

    def get(self, owner: str, record_id: str) -> MemoryRecord:
        self._owner(owner)
        with self._db() as db:
            row = db.execute(
                "SELECT * FROM memories WHERE owner_id=? AND id=?", (owner, record_id)
            ).fetchone()
            if row is None:
                raise MemoryError("Memory not found")
            return self._record(row)

    def list(
        self,
        owner: str,
        *,
        query: str = "",
        scope: str | None = None,
        review: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[MemoryRecord, ...]:
        self._owner(owner)
        if isinstance(limit, bool) or not 1 <= limit <= 20 or not 0 <= offset <= 100_000:
            raise MemoryError("Invalid memory page bounds")
        if not isinstance(query, str) or len(query) > 256:
            raise MemoryError("Memory query exceeds its bound")
        sql = "SELECT * FROM memories WHERE owner_id=?"
        values: list = [owner]
        if scope is not None:
            sql += " AND scope=?"
            values.append(_text(scope, 128, "scope"))
        if review is not None:
            if review not in {"reviewed", "proposed"}:
                raise MemoryError("Invalid memory review filter")
            sql += " AND review=?"
            values.append(review)
        words = terms(query)[:12]
        if words:
            sql += " AND (" + " OR ".join("instr(search_text,?)>0" for _ in words) + ")"
            values.extend(" " + word + " " for word in words)
        sql += " ORDER BY updated_at DESC,id LIMIT ? OFFSET ?"
        values.extend((limit, offset))
        with self._db() as db:
            return tuple(self._record(row) for row in db.execute(sql, values))

    def correct(
        self,
        owner: str,
        record_id: str,
        *,
        content: str,
        expected_revision: int,
        action_ref: str,
    ) -> MemoryRecord:
        self._owner(owner)
        content = validate_content(content)
        action_ref = _text(action_ref, 256, "action reference")
        with self._db() as db:
            changed = db.execute(
                "UPDATE memories SET content=?, search_text=?, review='reviewed', "
                "reviewed_by=?, revision=revision+1, updated_at=?, update_ref=? "
                "WHERE id=? AND owner_id=? AND revision=?",
                (
                    content,
                    " " + " ".join(terms(content)) + " ",
                    owner,
                    _now(),
                    action_ref,
                    record_id,
                    owner,
                    expected_revision,
                ),
            ).rowcount
            if not changed:
                raise MemoryError("Memory changed or missing; refresh before correcting")
            return self._record(
                db.execute("SELECT * FROM memories WHERE id=?", (record_id,)).fetchone()
            )

    def approve(
        self, owner: str, record_id: str, *, expected_revision: int, action_ref: str
    ) -> MemoryRecord:
        self._owner(owner)
        action_ref = _text(action_ref, 256, "action reference")
        with self._db() as db:
            if not db.execute(
                "UPDATE memories SET review='reviewed', reviewed_by=?, revision=revision+1, "
                "updated_at=?, update_ref=? WHERE id=? AND owner_id=? AND revision=?",
                (owner, _now(), action_ref, record_id, owner, expected_revision),
            ).rowcount:
                raise MemoryError("Memory changed or missing; refresh before approving")
            return self._record(
                db.execute("SELECT * FROM memories WHERE id=?", (record_id,)).fetchone()
            )

    def delete(self, owner: str, record_id: str, *, expected_revision: int) -> None:
        self._owner(owner)
        with self._db() as db:
            if not db.execute(
                "DELETE FROM memories WHERE owner_id=? AND id=? AND revision=?",
                (owner, record_id, expected_revision),
            ).rowcount:
                raise MemoryError("Memory changed or missing; refresh before deleting")
