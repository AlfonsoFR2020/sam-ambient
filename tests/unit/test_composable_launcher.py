import asyncio
import json
import logging
from argparse import Namespace
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters.local_discovery import CleanupPolicy
from sam_ambient.cli import _exit_cleanup_policy
from sam_ambient.configuration import configure_namespace
from sam_ambient.diagnostic_log import DiagnosticLogError, diagnostic, open_session_log
from sam_ambient.logging_config import configure_logging, operational_enabled
from sam_ambient.supervisor import cli
from tests.unit.test_diagnostic_launch import diagnostic_logging as diagnostic_logging


@pytest.mark.parametrize(
    "flags",
    [
        ["--verbose", "--keep-console"],
        ["--keep-console", "--verbose"],
        ["--keep-model", "--verbose", "--log-file", "logs with spaces/session.jsonl"],
        ["--keep-provider", "--keep-console"],
        ["--verbose", "--diagnostic", "--no-keep-console"],
    ],
)
def test_flags_are_composable_and_only_diagnostic_data_reaches_children(flags, tmp_path):
    args = cli.build_parser().parse_args(flags)
    for command in [cli._trusted_core_command(args, tmp_path), cli._trusted_ui_command(args)]:
        assert "--keep-console" not in command and "--no-keep-console" not in command
        assert "--log-file" not in command and "logs with spaces/session.jsonl" not in command
        assert ("--diagnostic-child" in command) == operational_enabled(args)
        assert ("--verbose" in command) == args.verbose


@pytest.mark.parametrize(
    "flags",
    [
        ["--unknown"],
        ["--verb"],
        ["--log-file"],
        ["--log-file", ""],
        ["--log-file", "bad\0name"],
        ["--keep-console", "--no-keep-console"],
    ],
)
def test_malformed_and_contradictory_arguments_are_rejected(flags):
    with pytest.raises(SystemExit) as error:
        cli.build_parser().parse_args(flags)
    assert error.value.code == 2


@pytest.mark.parametrize(
    "flags,exit_code,wrapper,tty,holds",
    [
        ([], 0, False, True, 0),
        (["--verbose"], 0, False, True, 0),
        (["--log-file", "test.jsonl"], 0, False, True, 0),
        (["--keep-console"], 0, True, True, 1),
        (["--diagnostic"], 0, True, True, 1),
        (["--diagnostic", "--no-keep-console"], 0, True, True, 0),
        (["--keep-console"], 2, True, True, 0),
        (["--keep-console"], 2, False, True, 1),
        (["--keep-console"], 0, False, False, 0),
    ],
)
def test_console_policy_is_independent_and_never_double_pauses(
    flags, exit_code, wrapper, tty, holds, monkeypatch
):
    args = cli.build_parser().parse_args(flags)
    monkeypatch.setenv("SAM_CMD_WRAPPER", "1" if wrapper else "0")
    monkeypatch.setattr(cli.sys, "stdin", Namespace(isatty=lambda: tty))
    messages = []
    monkeypatch.setattr("builtins.input", lambda message: messages.append(message))
    cli._hold_console(args, exit_code)
    assert len(messages) == holds


def test_help_with_flags_never_configures_or_starts_sam(monkeypatch, capsys):
    monkeypatch.setattr(
        cli, "configure_namespace", lambda *_a, **_kw: pytest.fail("help configured Sam")
    )
    monkeypatch.setattr(cli.sys, "stdin", Namespace(isatty=lambda: True))
    calls = []
    monkeypatch.setattr("builtins.input", lambda text: calls.append(text))
    assert cli.main(["--help", "--verbose", "--keep-console"]) == 0
    assert "--log-file" in capsys.readouterr().out and len(calls) == 1


def test_cli_environment_saved_precedence_and_retention_never_write(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path / "user"))
    monkeypatch.setenv("SAM_MODEL", "environment-model")
    path = tmp_path / "explicit.toml"
    original = (
        'schema_version=1\n[provider]\nmodel="saved-model"\n'
        '[lifecycle]\nmodel_on_exit="unload_if_sam_loaded"\n'
        'provider_on_exit="stop_if_sam_started"\n'
    )
    path.write_text(original)
    argv = ["--root", str(tmp_path), "--config", str(path), "--keep-model", "--model", "cli-model"]
    args = cli.build_parser().parse_args(argv)
    settings = configure_namespace(args, argv, supervisor=True)
    assert args.model == "cli-model"
    assert settings.lifecycle.model_on_exit == "unload_if_sam_loaded"
    policy = CleanupPolicy(settings.lifecycle.model_on_exit, settings.lifecycle.provider_on_exit)
    assert _exit_cleanup_policy(args, policy) == CleanupPolicy("keep", "keep")
    # Reapply after a live settings change: the session flag still wins.
    assert _exit_cleanup_policy(
        args, CleanupPolicy("keep", "stop_if_sam_started")
    ) == CleanupPolicy("keep", "keep")
    assert path.read_text() == original
    argv = argv[:-2]
    args = cli.build_parser().parse_args(argv)
    configure_namespace(args, argv, supervisor=True)
    assert args.model == "environment-model"


def test_verbose_adds_metadata_without_file_or_private_messages(
    tmp_path, monkeypatch, diagnostic_logging, capsys
):
    args = cli.build_parser().parse_args(["--verbose", "--root", str(tmp_path)])
    configure_logging(args)

    async def work(*_args):
        logging.getLogger("sam_ambient.fixture").debug("private model text and token=secret")
        return 0

    monkeypatch.setattr(cli, "_run_locked", work)
    assert asyncio.run(cli.run(args)) == 0
    output = capsys.readouterr().err
    assert (
        '"stage":"log.debug"' in output
        and "private model text" not in output
        and "token=secret" not in output
    )
    assert not (tmp_path / ".sam/diagnostics").exists()


def test_custom_log_file_and_failed_startup_keep_summary_and_release_lock(
    tmp_path, monkeypatch, diagnostic_logging
):
    args = cli.build_parser().parse_args(
        ["--root", str(tmp_path), "--log-file", "logs & spaces/output.jsonl"]
    )
    configure_logging(args)
    monkeypatch.setattr(
        cli, "_run_locked", AsyncMock(side_effect=ValueError("private model content"))
    )
    with pytest.raises(ValueError):
        asyncio.run(cli.run(args))
    path = tmp_path / "logs & spaces/output.jsonl"
    contents = path.read_text()
    assert "session.summary" in contents and '"exit_code":2' in contents
    assert "private model content" not in contents
    assert not (tmp_path / ".sam/diagnostics/session.jsonl").exists()
    handler = open_session_log(tmp_path, path=path)
    handler.close()


def test_single_writer_for_shared_explicit_log_and_invalid_directory(tmp_path, diagnostic_logging):
    path = tmp_path / "shared.jsonl"
    first = open_session_log(tmp_path, path=path)
    before = path.read_bytes()
    try:
        with pytest.raises(DiagnosticLogError, match="already owned"):
            open_session_log(tmp_path / "another-root", path=path)
        assert path.read_bytes() == before
    finally:
        first.close()
    next_handler = open_session_log(tmp_path, path=path)
    next_handler.close()
    with pytest.raises(DiagnosticLogError, match="not a directory"):
        open_session_log(tmp_path, path=tmp_path)


def test_verbose_file_uses_same_redaction_and_single_writer(tmp_path, diagnostic_logging):
    args = cli.build_parser().parse_args(["--verbose", "--log-file", "out.jsonl"])
    configure_logging(args)
    handler = open_session_log(tmp_path, path=tmp_path / "out.jsonl", verbose=True)
    try:
        logging.getLogger("sam_ambient.fixture").info("Bearer private-owner-proof")
        logging.getLogger("httpx").debug("private-api-key")
        diagnostic("fixture.safe", command_id="private-id", text="private transcript")
    finally:
        handler.close()
    records = [json.loads(line) for line in (tmp_path / "out.jsonl").read_text().splitlines()]
    text = json.dumps(records)
    assert all(
        secret not in text
        for secret in ["private-owner-proof", "private-api-key", "private-id", "private transcript"]
    )
    assert any(r["stage"] == "log.info" for r in records)


def test_log_creation_failure_releases_both_locks_before_any_component_starts(
    tmp_path, monkeypatch, diagnostic_logging
):
    import sam_ambient.diagnostic_log as logs
    from sam_ambient.supervisor.single_instance import InstanceLock

    args = cli.build_parser().parse_args(["--root", str(tmp_path), "--log-file", "out.jsonl"])
    configure_logging(args)
    work = AsyncMock(return_value=0)
    monkeypatch.setattr(cli, "_run_locked", work)

    def failure(*_args, **_kwargs):
        raise PermissionError("private injected detail")

    monkeypatch.setattr(logs, "DiagnosticHandler", failure)
    with pytest.raises(PermissionError):
        asyncio.run(cli.run(args))
    work.assert_not_awaited()
    for path in [tmp_path / ".sam/supervisor.lock", tmp_path / "out.jsonl.lock"]:
        lock = InstanceLock(path)
        assert lock.acquire()
        lock.release()


def test_option_looking_values_do_not_enable_modes():
    args = cli.build_parser().parse_args(["--model=--keep-model", "--log-file=--diagnostic"])
    assert not args.keep_model and not args.diagnostic and args.keep_console is None
    assert str(args.log_file) == "--diagnostic"
