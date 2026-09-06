"""Narrow parent-to-child graceful stop channel, independent of model tools."""

import asyncio
import sys
import threading
from collections.abc import Awaitable


def parent_stop_event() -> asyncio.Event:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()

    def read_parent() -> None:
        # A daemon thread avoids Windows Proactor read-pipe limitations and never
        # prevents exit. Only a fixed instruction (or parent EOF) is accepted.
        while True:
            line = sys.stdin.readline(64)
            if not line or line == "SAM_STOP\n":
                try:
                    loop.call_soon_threadsafe(stop.set)
                except RuntimeError:
                    pass
                return

    threading.Thread(target=read_parent, name="sam-parent-stop", daemon=True).start()
    return stop


async def serve_until_stop(service: Awaitable[None], stop: asyncio.Event) -> None:
    serving = asyncio.create_task(service)
    stopping = asyncio.create_task(stop.wait())
    try:
        done, _ = await asyncio.wait((serving, stopping), return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    finally:
        serving.cancel()
        stopping.cancel()
        await asyncio.gather(serving, stopping, return_exceptions=True)
