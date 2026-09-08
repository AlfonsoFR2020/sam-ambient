import asyncio
from unittest.mock import AsyncMock, Mock

import pytest

from sam_ambient.supervisor import app_window
from sam_ambient.supervisor.browser import BrowserHandoff
from sam_ambient.supervisor.cli import build_parser


def test_app_launch_is_structured_and_profile_is_separate(tmp_path, monkeypatch):
    monkeypatch.setattr(app_window, "find_app_browser", lambda: "browser.exe")
    spawn = Mock(return_value=Mock(pid=42, poll=lambda: None))
    monkeypatch.setattr(app_window.subprocess, "Popen", spawn)
    close = Mock()
    monkeypatch.setattr(app_window, "_request_window_close", close)
    window = app_window.AppWindow(tmp_path)
    assert window.open("http://127.0.0.1:8766")
    argv = spawn.call_args.args[0]
    assert argv[1] == "--app=http://127.0.0.1:8766/?shell=app"
    assert argv[2] == f"--user-data-dir={(tmp_path / '.sam/ui-profile').resolve()}"
    assert spawn.call_args.kwargs["shell"] is False
    window.close()
    window.close()
    assert close.call_count == (1 if app_window.os.name == "nt" else 0)
    assert not spawn.return_value.kill.called
    assert not spawn.return_value.terminate.called


@pytest.mark.parametrize("available", [True, False])
def test_app_handoff_once_with_normal_browser_fallback(tmp_path, monkeypatch, available):
    async def scenario():
        monkeypatch.setattr(
            "sam_ambient.supervisor.browser.ui_http_ready", AsyncMock(return_value=True)
        )
        fallback = Mock(return_value=True)
        handoff = BrowserHandoff(8766, root=tmp_path, mode="app", opener=fallback)
        handoff.window = Mock(open=Mock(return_value=available))
        await asyncio.gather(handoff.open_once(), handoff.open_once())
        await handoff.open_once()
        handoff.window.open.assert_called_once()
        assert fallback.call_count == (0 if available else 1)
        handoff.close()
        handoff.window.close.assert_called_once()

    asyncio.run(scenario())


def test_browser_debug_mode_does_not_create_app_profile(tmp_path):
    args = build_parser().parse_args(["--root", str(tmp_path), "--ui-mode", "browser"])
    assert args.ui_mode == "browser"
    assert BrowserHandoff(8766, root=tmp_path, mode=args.ui_mode).window is None
    assert not (tmp_path / ".sam").exists()


def test_closed_browser_is_not_restarted_or_killed(tmp_path):
    window = app_window.AppWindow(tmp_path)
    process = Mock(poll=lambda: 0)
    window.process = process
    window.close()
    process.kill.assert_not_called()
    process.terminate.assert_not_called()
