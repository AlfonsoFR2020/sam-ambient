import argparse
import json
import logging
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters.local_discovery import CleanupPolicy
from sam_ambient.cli import _exit_cleanup_policy
from sam_ambient.diagnostic_log import (
    DiagnosticHandler,
    diagnostic,
    forward_diagnostic,
    safe_record,
)
from sam_ambient.logging_config import configure_logging
from sam_ambient.supervisor.cli import _trusted_core_command, build_parser, run


@pytest.fixture
def diagnostic_logging():
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    logger = logging.getLogger("sam_ambient.operational")
    disabled = logger.disabled
    yield
    for handler in root.handlers:
        if handler not in handlers:
            handler.close()
    root.handlers, root.level, logger.disabled = handlers, level, disabled


def test_default_and_diagnostic_commands_share_startup(tmp_path):
    normal = build_parser().parse_args([])
    assert not normal.diagnostic and not normal.keep_model and not normal.keep_provider
    command = _trusted_core_command(normal, tmp_path)
    assert "--diagnostic" not in command and "--keep-model" not in command
    args = build_parser().parse_args(["--diagnostic", "--keep-model", "--keep-provider"])
    command = _trusted_core_command(args, tmp_path)
    assert all(
        flag in command
        for flag in ("--diagnostic", "--diagnostic-child", "--keep-model", "--keep-provider")
    )
    root = Path(__file__).resolve().parents[2]
    shared = (root / "Start Sam.cmd").read_text()
    assert 'sam-ambient.exe" %*' in shared and '"%~1"=="--diagnostic"' in shared
    assert 'Start Sam.cmd" --diagnostic %*' in (root / "Diagnose Sam.cmd").read_text()


@pytest.mark.parametrize(
    "model,provider,expected",
    [
        (False, False, ("unload_if_sam_loaded", "stop_if_sam_started")),
        (False, True, ("unload_if_sam_loaded", "keep")),
        (True, False, ("keep", "keep")),
        (True, True, ("keep", "keep")),
    ],
)
def test_retention_overrides_do_not_mutate_preferences(model, provider, expected):
    policy = CleanupPolicy("unload_if_sam_loaded", "stop_if_sam_started")
    result = _exit_cleanup_policy(
        argparse.Namespace(keep_model=model, keep_provider=provider), policy
    )
    assert (result.model_on_exit, result.provider_on_exit) == expected
    assert (policy.model_on_exit, policy.provider_on_exit) == (
        "unload_if_sam_loaded",
        "stop_if_sam_started",
    )


def test_log_positive_schema_rotation_and_warning_redaction(tmp_path, diagnostic_logging):
    configure_logging(
        argparse.Namespace(diagnostic=True, diagnostic_child=False, verbose=False, log_level="INFO")
    )
    handler = DiagnosticHandler(tmp_path / "session.jsonl")
    handler.file.maxBytes = 500
    logging.getLogger().handlers = [handler]
    secret = "ghp_dont_log_this_credential_123456789"
    assert secret not in json.dumps(
        safe_record(
            "fixture.event",
            {"text": secret, "error": secret, "state": secret, "command_id": secret},
        )
    )
    for n in range(30):
        diagnostic("fixture.event", command_id=secret, count=n, text=secret)
    logging.getLogger("sam_ambient.fixture").warning("raw private transcript %s", secret)
    handler.close()
    paths = list(tmp_path.glob("session.jsonl*"))
    assert 1 < len(paths) <= 4
    contents = "".join(path.read_text() for path in paths)
    assert secret not in contents and "raw private transcript" not in contents
    assert "timestamp" in contents and "monotonic_ms" in contents


def test_child_pipe_record_is_revalidated(tmp_path, diagnostic_logging, capsys):
    configure_logging(
        argparse.Namespace(diagnostic=True, diagnostic_child=True, verbose=False, log_level="INFO")
    )
    diagnostic("fixture.child", generation_id="private-generation", elapsed_ms=12)
    line = capsys.readouterr().out.encode()
    assert line.startswith(b"SAM_DIAGNOSTIC ") and b"private-generation" not in line
    handler = DiagnosticHandler(tmp_path / "parent.jsonl")
    logging.getLogger().handlers = [handler]
    forward_diagnostic(line)
    forward_diagnostic(
        b'SAM_DIAGNOSTIC {"stage":"fixture.child","text":"private proof","elapsed_ms":10}\n'
    )
    forward_diagnostic(b"SAM_DIAGNOSTIC broken\n")
    handler.close()
    contents = (tmp_path / "parent.jsonl").read_text()
    assert "private proof" not in contents and '"elapsed_ms":12' in contents


def test_startup_failure_still_has_final_summary(tmp_path, monkeypatch, diagnostic_logging):
    import asyncio

    import sam_ambient.supervisor.cli as cli

    args = build_parser().parse_args(["--diagnostic", "--root", str(tmp_path)])
    configure_logging(args)
    monkeypatch.setattr(cli, "_run_locked", AsyncMock(side_effect=ValueError("private credential")))
    with pytest.raises(ValueError):
        asyncio.run(run(args))
    contents = (tmp_path / ".sam/diagnostics/session.jsonl").read_text()
    assert "supervisor.failed" in contents and "session.summary" in contents
    assert "private credential" not in contents and '"exit_code":2' in contents
    from sam_ambient.supervisor.single_instance import InstanceLock

    lock = InstanceLock(tmp_path / ".sam/supervisor.lock")
    assert lock.acquire()
    lock.release()
