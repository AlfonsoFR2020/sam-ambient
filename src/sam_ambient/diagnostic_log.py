"""Content-free operational records on the existing logging/process channels."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import sys
import time
from contextvars import ContextVar
from datetime import UTC, datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

PREFIX = b"SAM_DIAGNOSTIC "
MAX_RECORD_BYTES = 4096
LOG_BYTES = 1_048_576
LOG_BACKUPS = 3
correlation: ContextVar[dict | None] = ContextVar("diagnostic_correlation", default=None)
_LOGGER = logging.getLogger("sam_ambient.operational")
_TAG = re.compile(r"[a-zA-Z][a-zA-Z0-9_.:-]{0,63}\Z")
_NUMBERS = frozenset(
    {
        "elapsed_ms",
        "pending",
        "failures",
        "warnings",
        "forced",
        "exit_code",
        "attempt",
        "count",
        "nonterminal",
        "oscillations",
        "longest_inference_ms",
        "longest_stt_ms",
        "longest_command_ms",
        "longest_stream_ms",
        "longest_delivery_ms",
        "longest_commit_ms",
        "longest_synthesis_ms",
        "longest_output_wait_ms",
        "longest_playback_ms",
        "dropped",
        "active_generation",
        "active_delivery",
        "tasks",
        "nonempty",
        "source_ms",
        "keep_model",
        "keep_provider",
    }
)
_TAGS = frozenset({"state", "component", "intent", "resource", "error_class", "policy"})
_IDS = frozenset({"turn_id", "generation_id", "command_id", "operation_id", "instance_id"})
_STATES = frozenset(
    {
        "ready",
        "disabled",
        "starting_provider",
        "loading_model",
        "unloading_model",
        "healthy",
        "unhealthy",
        "unsupported",
        "unloaded",
        "starting",
        "stopping",
        "stopped",
        "failed",
        "cancelled",
        "completed",
        "accepted",
        "rejected",
        "applied",
        "pending",
        "blocked",
        "available",
        "empty",
        "scanning",
        "stale",
        "unavailable",
        "degraded",
        "loading",
        "unloading",
        "success",
        "skipped",
        "succeeded",
        "IDLE",
        "LISTENING",
        "USER_SPEAKING",
        "ENDPOINT_CANDIDATE",
        "TRANSCRIBING",
        "THINKING",
        "SPEAKING",
        "INTERRUPTION_CANDIDATE",
        "RECOVERING",
        "INTERRUPTED",
        "ERROR",
        "OFFLINE",
        "HEALTHY",
        "DEGRADED",
        "STOPPED",
    }
)


class DiagnosticLogError(ValueError):
    """An actionable, content-free log ownership failure."""


def identity(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:16]


def safe_record(stage: str, fields: dict) -> dict:
    """Positive allowlist: arbitrary text/payload/error/URL can never enter a record."""
    if not isinstance(stage, str) or not _TAG.fullmatch(stage):
        raise ValueError("invalid diagnostic stage")
    result: dict = {"stage": stage}
    for key, value in fields.items():
        if key in _NUMBERS and type(value) in {int, bool}:
            result[key] = max(-1, min(int(value), 2**53 - 1))
        elif key in _TAGS and isinstance(value, str) and _TAG.fullmatch(value):
            if key != "state" or value in _STATES:
                result[key] = value
        elif key in _IDS and isinstance(value, str):
            result[key] = identity(value)
    return result


def diagnostic(stage: str, **fields: object) -> None:
    _LOGGER.info(
        stage, extra={"sam_diagnostic": safe_record(stage, {**(correlation.get() or {}), **fields})}
    )


class DiagnosticHandler(logging.Handler):
    """Supervisor is the only rotating-file writer; children emit bounded pipe records."""

    def __init__(
        self, path: Path | None = None, *, child: bool = False, verbose: bool = False
    ) -> None:
        super().__init__(logging.DEBUG if verbose else logging.INFO)
        self.child = child
        self.verbose = verbose
        self.writer_lock = None
        self.path = path
        self.started = time.monotonic()
        self.failures = self.warnings = self.dropped = 0
        self._second = 0
        self._rate = 0
        self.file = None
        if path is not None:
            path.parent.mkdir(parents=True, exist_ok=True)
            self.file = RotatingFileHandler(
                path, maxBytes=LOG_BYTES, backupCount=LOG_BACKUPS, encoding="utf-8"
            )
            self.file.setFormatter(logging.Formatter("%(message)s"))

    def emit(self, record: logging.LogRecord) -> None:
        data = getattr(record, "sam_diagnostic", None)
        if data is None:
            # Raw exception messages may contain prompts, URLs or credentials.
            if record.levelno < (
                logging.DEBUG if self.verbose else logging.WARNING
            ) or not record.name.startswith("sam_ambient"):
                return
            data = {"stage": "log." + record.levelname.lower(), "component": record.name[:64]}
            if record.levelno >= logging.ERROR:
                data.update(stage="log.error", state="failed")
        try:
            second = int(time.monotonic())
            if self._second != second:
                self._second, self._rate = second, 0
            self._rate += 1
            if self._rate > 100 and not str(data.get("stage", "")).endswith("summary"):
                self.dropped += 1
                return
            data = dict(data)
            data["timestamp"] = datetime.now(UTC).isoformat(timespec="milliseconds")
            data["monotonic_ms"] = time.monotonic_ns() // 1_000_000
            self.failures += int(record.levelno >= logging.ERROR or data.get("state") == "failed")
            self.warnings += int(
                record.levelno == logging.WARNING or data.get("stage") == "log.warning"
            )
            line = json.dumps(data, separators=(",", ":"), sort_keys=True)
            if len(line.encode()) > MAX_RECORD_BYTES:
                self.dropped += 1
                return
            if self.child:
                print(PREFIX.decode() + line, file=sys.stdout, flush=True)
            else:
                print(line, file=sys.stderr, flush=True)
                if self.file is not None:
                    self.file.emit(logging.makeLogRecord({"msg": line, "levelno": record.levelno}))
        except (OSError, ValueError):
            self.dropped += 1

    def close(self) -> None:
        if self.file is not None:
            self.file.close()
        if self.writer_lock is not None:
            self.writer_lock.release()
        super().close()


def forward_diagnostic(line: bytes) -> None:
    """Revalidate child records. Ignore unknown fields, never relay raw stdout."""
    if not line.startswith(PREFIX) or len(line) > MAX_RECORD_BYTES + len(PREFIX):
        return
    try:
        data = json.loads(line[len(PREFIX) :])
        if not isinstance(data, dict):
            return
        stage = data.pop("stage")
        if type(data.get("monotonic_ms")) is int:
            data["source_ms"] = data["monotonic_ms"]
        # Child IDs already contain only pseudonyms; preserve correlation.
        ids = {k: v for k, v in data.items() if k in _IDS and re.fullmatch(r"[a-f0-9]{16}", str(v))}
        clean = safe_record(stage, {k: v for k, v in data.items() if k not in _IDS})
        clean.update(ids)
        _LOGGER.info(stage, extra={"sam_diagnostic": clean})
    except (ValueError, KeyError, TypeError):
        return


def open_session_log(
    root: Path, *, path: Path | None = None, console_only: bool = False, verbose: bool = False
) -> DiagnosticHandler:
    from sam_ambient.supervisor.single_instance import InstanceLock

    target = None if console_only else (path or root / ".sam/diagnostics/session.jsonl")
    lock = None
    if target is not None:
        target = target.expanduser().resolve(strict=False)
        print(f"Sam diagnostic log: {target}", file=sys.stderr, flush=True)
        if target.is_dir():
            raise DiagnosticLogError("--log-file must name a file, not a directory")
        lock = InstanceLock(target.with_name(target.name + ".lock"))
        if not lock.acquire():
            raise DiagnosticLogError(
                "Diagnostic log is already owned by another Sam session; choose another --log-file"
            )
    else:
        print(
            "Sam operational diagnostics: console only (no persistent log).",
            file=sys.stderr,
            flush=True,
        )
    try:
        handler = DiagnosticHandler(target, verbose=verbose)
    except BaseException:
        if lock is not None:
            lock.release()
        raise
    handler.writer_lock = lock
    logging.getLogger().handlers = [handler]
    diagnostic("session.start")
    return handler


def finish_session(handler: DiagnosticHandler, exit_code: int) -> None:
    diagnostic(
        "session.summary",
        exit_code=exit_code,
        elapsed_ms=int((time.monotonic() - handler.started) * 1000),
        failures=handler.failures,
        warnings=handler.warnings,
        dropped=handler.dropped,
    )
    if handler.path is not None:
        print(f"Sam diagnostic log: {handler.path}", file=sys.stderr, flush=True)
    handler.close()
