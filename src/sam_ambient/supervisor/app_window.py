"""Optional Chromium app window. Never supervise or kill the user's browser."""

import os
import shutil
import subprocess
from pathlib import Path


def find_app_browser() -> str | None:
    if os.name == "nt":
        for root in (
            os.environ.get("PROGRAMFILES(X86)"),
            os.environ.get("PROGRAMFILES"),
            os.environ.get("LOCALAPPDATA"),
        ):
            if root:
                for relative in (
                    "Microsoft/Edge/Application/msedge.exe",
                    "Google/Chrome/Application/chrome.exe",
                ):
                    candidate = Path(root) / relative
                    if candidate.is_file():
                        return str(candidate)
    for name in ("microsoft-edge", "google-chrome", "chromium", "chromium-browser"):
        if executable := shutil.which(name):
            return executable
    return None


class AppWindow:
    """Private Sam profile isolates app windows from unrelated browsing sessions."""

    def __init__(self, root: Path) -> None:
        self.profile = root / ".sam" / "ui-profile"
        self.process: subprocess.Popen | None = None

    def open(self, url: str) -> bool:
        executable = find_app_browser()
        if executable is None:
            return False
        self.profile.mkdir(parents=True, exist_ok=True)
        self.process = subprocess.Popen(
            [
                executable,
                f"--app={url}/?shell=app",
                f"--user-data-dir={self.profile.resolve()}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-mode",
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            shell=False,
        )
        return True

    def close(self) -> None:
        process, self.process = self.process, None
        if process is None or process.poll() is not None:
            return
        if os.name == "nt":
            _request_window_close(process.pid)
        # No termination fallback: Linux/window-manager refusal leaves a page the
        # owner can close. Neither window loss nor browser exit affects the core.


def _request_window_close(pid: int) -> None:
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    callback_type = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
    user32.PostMessageW.argtypes = [wintypes.HWND, wintypes.UINT, wintypes.WPARAM, wintypes.LPARAM]
    user32.EnumWindows.argtypes = [callback_type, wintypes.LPARAM]

    @callback_type
    def visit(hwnd, _parameter):
        owner = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
        if owner.value == pid:
            user32.PostMessageW(hwnd, 0x0010, 0, 0)  # WM_CLOSE; no process kill.
        return True

    user32.EnumWindows(visit, 0)
