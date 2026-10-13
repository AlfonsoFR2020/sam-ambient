"""One isolated real supervisor/core/UI pipe and owner-window evidence path."""

import asyncio
import json
import os
import socket
import sys
from pathlib import Path

import pytest

from sam_ambient.logging_config import configure_logging
from sam_ambient.supervisor import cli
from sam_ambient.supervisor.browser import BrowserHandoff
from scripts.owner_lifecycle_probe import ObservedWindow, Observer, system_tab
from tests.unit.test_diagnostic_launch import diagnostic_logging as diagnostic_logging


@pytest.mark.skipif(os.name != "nt", reason="Windows authenticated source owner window")
def test_real_diagnostic_supervisor_owner_ui_and_shutdown(
    tmp_path, monkeypatch, diagnostic_logging
):
    # Do not disturb an already-running owner session to claim a smoke pass.
    for port in (8765, 8766):
        with socket.socket() as reservation:
            try:
                reservation.bind(("127.0.0.1", port))
            except OSError:
                pytest.skip("Normal Sam ports occupied; no external process changed")
    fixture = Path(__file__).resolve().parents[1] / "fixtures/first_run_core.py"
    original_command = cli._trusted_core_command
    windows = []
    observer = Observer()
    secret = []

    def core_command(args, root):
        trusted = original_command(args, root)
        arguments = trusted[trusted.index("--") + 1 :]
        return (sys.executable, str(fixture), *arguments)

    def handoff(port, **options):
        browser = BrowserHandoff(port, **options)
        browser.window = ObservedWindow(
            options["root"], options["owner_session"], observer=observer
        )
        secret.append(options["owner_session"].bootstrap_line().split()[1].decode())
        windows.append(browser.window)
        return browser

    monkeypatch.setattr(cli, "_trusted_core_command", core_command)
    monkeypatch.setattr(cli, "BrowserHandoff", handoff)
    configuration = tmp_path / "fixture.toml"
    original = (
        '[lifecycle]\nmodel_on_exit="unload_if_sam_loaded"\n'
        'provider_on_exit="stop_if_sam_started"\n'
    )
    configuration.write_text(original)
    args = cli.build_parser().parse_args(
        [
            "--diagnostic",
            "--keep-model",
            "--root",
            str(tmp_path),
            "--config",
            str(configuration),
            "--open-ui",
            "--no-voice",
            "--no-tts",
        ]
    )
    configure_logging(args)

    async def scenario():
        task = asyncio.create_task(cli.run(args))
        try:
            async with asyncio.timeout(40):
                await observer.wait(lambda r: r["type"] == "system.ready", deadline_s=20)
                kinds = [r["type"] for r in observer.records]
                assert kinds.index("sam.owner.accepted") < kinds.index("system.ready")
                page = windows[0]._page
                await system_tab(page)
                await page.get_by_role("button", name="Conversation", exact=True).click()
                await page.get_by_role("textbox", name="Text request", exact=True).fill(
                    "private diagnostic smoke sentinel"
                )
                await page.get_by_role("button", name="Send", exact=True).click()
                await observer.wait(lambda r: r["type"] == "model.completed", deadline_s=10)
                await system_tab(page)
                await page.get_by_role("button", name="Quit Sam", exact=True).click()
                await page.get_by_role("button", name="Confirm quit", exact=True).click()
                assert await task == 0
        finally:
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)
        assert windows[0]._context is None and windows[0]._driver is None

    asyncio.run(scenario())
    content = (tmp_path / ".sam/diagnostics/session.jsonl").read_text()
    records = [json.loads(line) for line in content.splitlines()]
    stages = {r["stage"] for r in records}
    assert {
        "session.start",
        "command.queued",
        "command.acknowledged",
        "model.first_token",
        "model.completed",
        "conversation.summary",
        "cleanup.complete",
        "component.stopped",
        "session.summary",
    } <= stages
    assert all(
        value not in content
        for value in [
            *secret,
            "private diagnostic smoke sentinel",
            "Hello Sam",
            "sam.owner.authenticate",
        ]
    )
    summary = next(r for r in records if r["stage"] == "conversation.summary")
    assert (
        summary["nonterminal"] == 0
        and summary["active_generation"] == 0
        and summary["active_delivery"] == 0
    )
    assert records[-1]["stage"] == "session.summary" and records[-1]["exit_code"] == 0
    assert configuration.read_text() == original
    assert next(r for r in records if r["stage"] == "cleanup.begin")["policy"] == "keep"
    assert all(r["forced"] == 0 for r in records if r["stage"] == "component.stopped")
    print("Real isolated supervisor/owner UI/log/cleanup: PASS; records=", len(records))
