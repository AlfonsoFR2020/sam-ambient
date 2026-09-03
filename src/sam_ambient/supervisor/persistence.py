"""Bounded SQLite operational state for the trusted supervisor."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from pathlib import Path

from sam_ambient.supervisor.models import ComponentStatus, HealthState, SecurityState


class SupervisorStateError(RuntimeError):
    """Operational state is unavailable or corrupt; startup must fail closed."""


@dataclass(frozen=True, slots=True)
class CrashRecord:
    timestamp_ms: int
    component_id: str
    exit_code: int | None
    reason: str
    restart_count: int
    action: str
    instance_id: str | None


class SupervisorStore:
    def __init__(self, path: Path, *, maximum_crash_records: int = 200) -> None:
        if maximum_crash_records < 1:
            raise ValueError("maximum_crash_records must be positive")
        self.path = path.resolve(strict=False)
        self.maximum_crash_records = maximum_crash_records
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with self._connect() as connection:
                connection.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS supervisor_metadata (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS component_status (
                        component_id TEXT PRIMARY KEY,
                        payload TEXT NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS crash_journal (
                        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp_ms INTEGER NOT NULL,
                        component_id TEXT NOT NULL,
                        exit_code INTEGER,
                        reason TEXT NOT NULL,
                        restart_count INTEGER NOT NULL,
                        action TEXT NOT NULL,
                        instance_id TEXT
                    );
                    """
                )
        except sqlite3.DatabaseError as error:
            raise SupervisorStateError("supervisor state database is corrupt") from error

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=5)
        connection.execute("PRAGMA busy_timeout = 5000")
        return connection

    def security_state(self) -> SecurityState:
        values = self._metadata()
        try:
            epoch = int(values.get("capability_epoch", "0"))
            revoked = values.get("capabilities_revoked", "0")
            safe_mode = values.get("safe_mode", "0")
            if epoch < 0 or revoked not in {"0", "1"} or safe_mode not in {"0", "1"}:
                raise ValueError
            return SecurityState(
                capability_epoch=epoch,
                capabilities_revoked=revoked == "1",
                safe_mode=safe_mode == "1",
                reason=values.get("security_reason"),
            )
        except ValueError as error:
            raise SupervisorStateError("invalid supervisor security metadata") from error

    def revoke_capabilities(self, reason: str) -> SecurityState:
        bounded_reason = (reason.strip() or "supervised component failed")[:500]
        try:
            with self._connect() as connection:
                connection.execute("BEGIN IMMEDIATE")
                row = connection.execute(
                    "SELECT value FROM supervisor_metadata WHERE key = 'capability_epoch'"
                ).fetchone()
                epoch = int(row[0]) + 1 if row else 1
                values = {
                    "capability_epoch": str(epoch),
                    "capabilities_revoked": "1",
                    "security_reason": bounded_reason,
                }
                connection.executemany(
                    "INSERT OR REPLACE INTO supervisor_metadata(key, value) VALUES (?, ?)",
                    values.items(),
                )
            return self.security_state()
        except (sqlite3.DatabaseError, ValueError) as error:
            raise SupervisorStateError("failed to persist capability revocation") from error

    def enter_safe_mode(self, reason: str) -> SecurityState:
        state = self.security_state()
        if not state.capabilities_revoked:
            state = self.revoke_capabilities(reason)
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO supervisor_metadata(key, value) VALUES ('safe_mode', '1')"
            )
        return SecurityState(state.capability_epoch, True, True, state.reason)

    def restore_capabilities_trusted(self) -> SecurityState:
        """Explicit local-operator recovery; never exposed to the model or UI protocol."""

        current = self.security_state()
        values = {
            "capability_epoch": str(current.capability_epoch + 1),
            "capabilities_revoked": "0",
            "safe_mode": "0",
            "security_reason": "trusted_local_restore",
        }
        with self._connect() as connection:
            connection.executemany(
                "INSERT OR REPLACE INTO supervisor_metadata(key, value) VALUES (?, ?)",
                values.items(),
            )
            connection.execute("DELETE FROM crash_journal")
        return self.security_state()

    def save_status(self, status: ComponentStatus) -> None:
        payload = asdict(status)
        payload["health"] = status.health.value
        encoded = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        with self._connect() as connection:
            connection.execute(
                "INSERT OR REPLACE INTO component_status(component_id, payload) VALUES (?, ?)",
                (status.component_id, encoded),
            )

    def load_status(self, component_id: str) -> ComponentStatus | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT payload FROM component_status WHERE component_id = ?",
                    (component_id,),
                ).fetchone()
            if row is None:
                return None
            payload = json.loads(row[0])
            payload["health"] = HealthState(payload["health"])
            return ComponentStatus(**payload)
        except (
            sqlite3.DatabaseError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as error:
            raise SupervisorStateError("invalid persisted component status") from error

    def append_crash(self, record: CrashRecord) -> None:
        with self._connect() as connection:
            connection.execute(
                """INSERT INTO crash_journal(
                    timestamp_ms, component_id, exit_code, reason, restart_count,
                    action, instance_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    record.timestamp_ms,
                    record.component_id,
                    record.exit_code,
                    record.reason[:500],
                    record.restart_count,
                    record.action[:100],
                    record.instance_id,
                ),
            )
            connection.execute(
                """DELETE FROM crash_journal WHERE sequence NOT IN (
                    SELECT sequence FROM crash_journal ORDER BY sequence DESC LIMIT ?
                )""",
                (self.maximum_crash_records,),
            )

    def crashes(self) -> tuple[CrashRecord, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                """SELECT timestamp_ms, component_id, exit_code, reason, restart_count,
                          action, instance_id
                   FROM crash_journal ORDER BY sequence"""
            ).fetchall()
        return tuple(CrashRecord(*row) for row in rows)

    def diagnostic_snapshot(self) -> dict[str, object]:
        security = self.security_state()
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT component_id, payload FROM component_status ORDER BY component_id"
            ).fetchall()
        return {
            "security": asdict(security),
            "components": {component_id: json.loads(payload) for component_id, payload in rows},
            "crash_count": len(self.crashes()),
        }

    def _metadata(self) -> dict[str, str]:
        try:
            with self._connect() as connection:
                return dict(connection.execute("SELECT key, value FROM supervisor_metadata"))
        except sqlite3.DatabaseError as error:
            raise SupervisorStateError("failed to read supervisor metadata") from error
