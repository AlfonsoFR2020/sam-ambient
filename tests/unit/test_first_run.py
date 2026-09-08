import asyncio
import json
import threading
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters import local_discovery as discovery
from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from sam_ambient.static_server import StaticUiServer
from sam_ambient.supervisor.browser import BrowserHandoff
from sam_ambient.supervisor.cli import _trusted_ui_command, build_parser
from sam_ambient.supervisor.process import SubprocessManagedProcess
from tests.unit.test_cli import FakeProvider


def test_browser_waits_for_http_and_opens_once_even_after_restart(monkeypatch):
    async def scenario():
        called = []
        server = StaticUiServer(port=0)
        await server.start()
        try:
            handoff = BrowserHandoff(
                server.port, opener=lambda url, **kw: called.append(url) or True
            )
            await asyncio.gather(handoff.open_once(), handoff.open_once())
            await handoff.open_once()
            assert called == [f"http://127.0.0.1:{server.port}"]
            args = build_parser().parse_args(["--root", ".", "--open-ui"])
            assert "--open-browser" not in _trusted_ui_command(args)
        finally:
            await server.close()
        monkeypatch.setattr(
            "sam_ambient.supervisor.browser.ui_http_ready", AsyncMock(return_value=False)
        )
        unopened = BrowserHandoff(8766, opener=lambda *a, **kw: pytest.fail("HTTP not ready"))
        await unopened.open_once()

    asyncio.run(scenario())


def test_browser_failure_is_nonfatal_and_reports_manual_url(monkeypatch, caplog):
    async def scenario():
        monkeypatch.setattr(
            "sam_ambient.supervisor.browser.ui_http_ready", AsyncMock(return_value=True)
        )

        def broken(*args, **kwargs):
            raise OSError("private browser details")

        handoff = BrowserHandoff(8766, opener=broken)
        await handoff.open_once()
        await handoff.open_once()
        assert "http://127.0.0.1:8766" in caplog.text
        assert "private browser details" not in caplog.text

    asyncio.run(scenario())


def test_blocked_browser_handler_does_not_hold_application_shutdown(monkeypatch):
    entered, release = threading.Event(), threading.Event()

    def blocking_browser(*args, **kwargs):
        entered.set()
        release.wait(5)
        return True

    async def scenario():
        monkeypatch.setattr(
            "sam_ambient.supervisor.browser.ui_http_ready", AsyncMock(return_value=True)
        )
        handoff = BrowserHandoff(8766, opener=blocking_browser)
        task = asyncio.create_task(handoff.open_once())
        assert await asyncio.to_thread(entered.wait, 2)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        assert not release.is_set()

    try:
        asyncio.run(scenario())  # Must finish while the browser handler is blocked.
        assert not release.is_set()
    finally:
        release.set()


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/v1",
        "http://192.168.1.1/v1",
        "http://user:secret@localhost/v1",
        "http://localhost/v1?key=x",
    ],
)
def test_discovery_rejects_nonlocal_and_secret_urls(url):
    with pytest.raises(ValueError):
        discovery.local_url(url)


def test_discovery_priority_explicit_selection_and_no_model(monkeypatch):
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    monkeypatch.setattr(discovery, "find_lms", lambda: None)

    async def probe(service):
        service.running = True
        service.models = ["alpha", "zeta"]

    monkeypatch.setattr(discovery, "probe_service", probe)

    async def scenario():
        auto = await discovery.discover_local()
        assert auto.selected.id == "ollama" and auto.model == "alpha"
        explicit = await discovery.discover_local(provider="lm-studio", model="zeta")
        assert explicit.selected.id == "lm-studio" and explicit.model == "zeta"
        missing = await discovery.discover_local(provider="lm-studio", model="missing")
        assert missing.selected is None  # Never silently override an explicit selection.

        async def only_lm(service):
            if service.id == "lm-studio":
                await probe(service)

        monkeypatch.setattr(discovery, "probe_service", only_lm)
        assert (await discovery.discover_local()).selected.id == "lm-studio"

    asyncio.run(scenario())


def test_lms_headless_custom_port_and_stopped_actionable_status(monkeypatch):
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    monkeypatch.setattr(discovery, "find_lms", lambda: "lms")
    calls = []

    async def status(executable, subject):
        calls.append(subject)
        return {"status": "running"} if subject == "daemon" else {"running": True, "port": 1240}

    monkeypatch.setattr(discovery, "lms_status", status)
    monkeypatch.setattr(discovery, "probe_service", AsyncMock())
    result = asyncio.run(discovery.discover_local())
    lm = result.services[1]
    assert lm.endpoint == "http://127.0.0.1:1240/v1" and lm.daemon_running
    assert "lms server start" in lm.detail
    assert sorted(calls) == ["daemon", "server"]  # No ps/ls/load/start commands.


def test_lm_loaded_models_filtered_and_advertised_models_recorded(monkeypatch):
    async def request(self, method, url, **kwargs):
        rows = [
            {"id": "loaded", "type": "llm", "state": "loaded"},
            {"id": "unloaded", "type": "llm", "state": "not-loaded"},
            {"id": "embedding", "type": "embeddings", "state": "loaded"},
        ]
        return {"data": rows}

    monkeypatch.setattr(discovery.HttpxJsonTransport, "request_json", request)
    service = discovery.LocalService("lm-studio", discovery.LM_STUDIO_URL)
    asyncio.run(discovery.probe_service(service))
    assert service.models == ["loaded"]
    assert service.available_models == ["loaded", "unloaded"]


def test_quit_is_direct_user_control_idempotent_and_not_a_tool(tmp_path):
    from websockets.asyncio.client import connect

    async def scenario():
        runtime = SamRuntime(FakeProvider(), RuntimeConfig(tmp_path, port=0))
        assert runtime._ready_event().payload["cloud_allowed"] is False
        await runtime.start()
        try:
            assert "control.application.quit" not in [
                item.id for item in runtime.tools.descriptors()
            ]
            async with connect(
                f"ws://127.0.0.1:{runtime.bridge.port}",
                origin="http://127.0.0.1:8766",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as socket:
                ready = json.loads(await socket.recv())
                invalid = ControlCommand(
                    type=ControlCommandType.APPLICATION_QUIT,
                    command_id="stale",
                    monotonic_ms=1,
                    session_id="old",
                )
                assert (await runtime.controls.dispatch(invalid)).payload["status"] == "rejected"
                command = ControlCommand(
                    type=ControlCommandType.APPLICATION_QUIT,
                    command_id="quit",
                    monotonic_ms=2,
                    session_id=ready["session_id"],
                )
                await socket.send(command.to_json())
                async with asyncio.timeout(2):
                    while True:
                        event = json.loads(await socket.recv())
                        if event["type"] == "control.acknowledged":
                            assert event["payload"]["application_stopping"]
                            break
                    await runtime.shutdown_requested.wait()
                ack = await runtime.controls.dispatch(command)
                assert ack.payload["application_stopping"]
                assert not runtime.capability_authority.snapshot.active
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_supervisor_shutdown_channel_rejects_stale_instance():
    async def scenario():
        reader = asyncio.StreamReader()
        reader.feed_data(b'SAM_SHUTDOWN {"instance_id":"old"}\n')
        reader.feed_data(b'SAM_SHUTDOWN {"instance_id":"current"}\n')
        reader.feed_eof()
        called = []

        class Process:
            stdout = reader

        managed = SubprocessManagedProcess(
            Process(), instance_id="current", request_shutdown=lambda: called.append("quit")
        )
        await managed._drain_stdout()
        assert called == ["quit"]

    asyncio.run(scenario())


def test_quit_survives_requester_disconnecting_before_ack(tmp_path):
    from websockets.exceptions import ConnectionClosed

    async def scenario():
        runtime = SamRuntime(FakeProvider(), RuntimeConfig(tmp_path, port=0))
        command = ControlCommand(
            type=ControlCommandType.APPLICATION_QUIT,
            command_id="closed-tab",
            monotonic_ms=1,
            session_id=runtime.session_id,
        )

        class ClosedTab:
            async def __aiter__(self):
                yield command.to_json()

            async def send(self, _message):
                raise ConnectionClosed(None, None)

        try:
            await runtime.bridge._consume(ClosedTab())
            assert runtime.shutdown_requested.is_set()
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_verbose_keeps_http_credential_logging_disabled():
    # Preserve pytest's handlers: configure_logging is tested in an isolated child.
    import subprocess
    import sys

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from argparse import Namespace; import logging; "
            "from sam_ambient.logging_config import configure_logging; "
            "configure_logging(Namespace(verbose=True,log_level='INFO')); "
            "logging.getLogger('sam_ambient').debug('diagnostic'); "
            "logging.getLogger('httpx').debug('api-key-must-not-log')",
        ],
        capture_output=True,
        text=True,
        timeout=5,
    )
    assert "diagnostic" in result.stderr and "api-key-must-not-log" not in result.stderr
