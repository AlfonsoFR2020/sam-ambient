"""Replaceable desktop adapters kept outside the capability policy domain."""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys


class TkClipboardAdapter:
    """Standard-library clipboard adapter; display failures remain bounded tool errors."""

    async def read_text(self) -> str:
        return await asyncio.to_thread(self._read)

    async def write_text(self, text: str) -> None:
        await asyncio.to_thread(self._write, text)

    @staticmethod
    def _read() -> str:
        import tkinter

        root = tkinter.Tk()
        root.withdraw()
        try:
            return str(root.clipboard_get())
        finally:
            root.destroy()

    @staticmethod
    def _write(text: str) -> None:
        import tkinter

        root = tkinter.Tk()
        root.withdraw()
        try:
            root.clipboard_clear()
            root.clipboard_append(text)
            root.update()
        finally:
            root.destroy()


class PlatformAppOpenAdapter:
    """Open one validated path without a shell or model-controlled arguments."""

    async def open_path(self, path: str) -> None:
        await asyncio.to_thread(self._open, path)

    @staticmethod
    def _open(path: str) -> None:
        if sys.platform == "win32":
            os.startfile(path)  # type: ignore[attr-defined]
            return
        command = ["open", path] if sys.platform == "darwin" else ["xdg-open", path]
        subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
