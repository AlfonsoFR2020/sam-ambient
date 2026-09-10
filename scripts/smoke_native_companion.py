"""Exercise the frozen supervisor/core lifecycle without local AI or audio services."""

from __future__ import annotations

import argparse
import asyncio
import json
import socket
import time
from pathlib import Path

from websockets.asyncio.client import connect

from sam_ambient.adapters.ui.websocket import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.protocol import ControlCommand, ControlCommandType


def _available_port() -> int:
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return int(reservation.getsockname()[1])


async def _run(executable: Path, data_root: Path, timeout_s: float) -> None:
    port = _available_port()
    process = await asyncio.create_subprocess_exec(
        str(executable),
        "--root",
        str(data_root),
        "--no-ui",
        "--no-voice",
        "--no-tts",
        "--provider",
        "ollama",
        "--base-url",
        "http://127.0.0.1:1",
        "--port",
        str(port),
        cwd=executable.parent,
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )
    output = bytearray()

    async def drain_output() -> None:
        assert process.stdout is not None
        while chunk := await process.stdout.read(4096):
            output.extend(chunk)
            if len(output) > 256 * 1024:
                del output[: len(output) - 256 * 1024]

    drain_task = asyncio.create_task(drain_output())
    deadline = time.monotonic() + timeout_s
    failure: BaseException | None = None
    try:
        while True:
            if process.returncode is not None:
                raise RuntimeError(
                    f"companion exited before readiness ({process.returncode}): "
                    + output.decode(errors="replace")
                )
            try:
                async with connect(
                    f"ws://127.0.0.1:{port}",
                    origin="http://tauri.localhost",
                    subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                ) as websocket:
                    ready = json.loads(await asyncio.wait_for(websocket.recv(), 2))
                    await websocket.send(
                        ControlCommand(
                            type=ControlCommandType.APPLICATION_QUIT,
                            command_id="native-companion-smoke",
                            monotonic_ms=1,
                            session_id=ready["session_id"],
                        ).to_json()
                    )
                    while time.monotonic() < deadline:
                        event = json.loads(await asyncio.wait_for(websocket.recv(), 2))
                        if event["type"] == "system.stopping":
                            break
                    else:
                        raise TimeoutError("companion never acknowledged shutdown")
                break
            except (OSError, TimeoutError):
                if time.monotonic() >= deadline:
                    raise TimeoutError("companion WebSocket did not become ready") from None
                await asyncio.sleep(0.1)
        await asyncio.wait_for(process.wait(), 15)
        if process.returncode != 0:
            raise RuntimeError(
                f"companion shutdown failed ({process.returncode}): "
                + output.decode(errors="replace")
            )
    except BaseException as error:
        failure = error
        raise
    finally:
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), 5)
            except TimeoutError:
                process.kill()
                await process.wait()
        await drain_task
        if failure is not None and output:
            print(output.decode(errors="replace"), end="")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--companion", required=True, type=Path)
    parser.add_argument("--data-root", required=True, type=Path)
    parser.add_argument("--timeout", type=float, default=30)
    args = parser.parse_args()
    executable = args.companion.resolve(strict=True)
    data_root = args.data_root.resolve(strict=False)
    data_root.mkdir(parents=True, exist_ok=True)
    asyncio.run(_run(executable, data_root, args.timeout))
    print("native companion smoke: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
