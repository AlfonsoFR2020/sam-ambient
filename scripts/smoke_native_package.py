"""Exercise the packaged Tauri shell and frozen companion over the real protocol."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from pathlib import Path

from websockets.asyncio.client import connect

from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType


async def _connect_and_quit(timeout_s: float) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            async with connect(
                "ws://127.0.0.1:8765",
                origin="http://tauri.localhost",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            ) as websocket:
                ready = json.loads(await asyncio.wait_for(websocket.recv(), 2))
                await websocket.send(
                    ControlCommand(
                        type=ControlCommandType.APPLICATION_QUIT,
                        command_id="native-package-smoke",
                        monotonic_ms=1,
                        session_id=ready["session_id"],
                    ).to_json()
                )
                while time.monotonic() < deadline:
                    event = json.loads(await asyncio.wait_for(websocket.recv(), 2))
                    if event["type"] == "system.stopping":
                        return
        except (OSError, TimeoutError):
            await asyncio.sleep(0.1)
    raise TimeoutError("packaged Sam protocol did not become ready")


async def _run(executable: Path, timeout_s: float) -> None:
    environment = os.environ.copy()
    environment.update(
        {
            "SAM_PROVIDER": "ollama",
            "SAM_BASE_URL": "http://127.0.0.1:1",
            "SAM_STT_ENABLED": "false",
            "SAM_TTS_ENABLED": "false",
        }
    )
    process = await asyncio.create_subprocess_exec(
        str(executable),
        env=environment,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    try:
        await _connect_and_quit(timeout_s)
        await asyncio.wait_for(process.wait(), 15)
        if process.returncode != 0:
            output = await process.stdout.read() if process.stdout else b""
            raise RuntimeError(
                f"native shell shutdown failed ({process.returncode}): "
                + output.decode(errors="replace")
            )
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), 5)
            except TimeoutError:
                process.kill()
                await process.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executable", required=True, type=Path)
    parser.add_argument("--timeout", default=45, type=float)
    args = parser.parse_args()
    asyncio.run(_run(args.executable.resolve(strict=True), args.timeout))
    print("native package smoke: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
