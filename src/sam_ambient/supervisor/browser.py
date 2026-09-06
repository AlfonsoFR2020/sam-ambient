"""One browser handoff per supervisor lifetime, after HTTP readiness."""

import asyncio
import logging
import threading
import webbrowser
from collections.abc import Callable

log = logging.getLogger(__name__)


async def ui_http_ready(port: int) -> bool:
    writer = None
    try:
        async with asyncio.timeout(2):
            reader, writer = await asyncio.open_connection("127.0.0.1", port)
            writer.write(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
            await writer.drain()
            return (await reader.readline()).startswith(b"HTTP/1.1 200 ")
    except (OSError, TimeoutError, ValueError):
        return False
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass


class BrowserHandoff:
    def __init__(self, port: int, *, opener: Callable[..., bool] = webbrowser.open) -> None:
        self.port = port
        self.opener = opener
        self.attempted = False

    async def open_once(self) -> None:
        if self.attempted:
            return
        self.attempted = True
        url = f"http://127.0.0.1:{self.port}"
        log.info("Sam UI: %s", url)
        if not await ui_http_ready(self.port):
            log.warning("UI HTTP readiness failed; open %s manually when ready", url)
            return
        try:
            async with asyncio.timeout(5):
                opened = await self._open_detached(url)
            if not opened:
                log.warning("Browser did not open; Sam is running. Open %s manually", url)
        except Exception as error:
            log.warning("Browser launch failed (%s); open %s manually", type(error).__name__, url)

    async def _open_detached(self, url: str) -> bool:
        # An OS/browser handler may block until its window exits. This thread
        # must not join asyncio's executor and hold up Sam shutdown.
        loop = asyncio.get_running_loop()
        result = loop.create_future()

        def complete(value, error):
            if not result.done():
                if error is not None:
                    result.set_exception(error)
                else:
                    result.set_result(value)

        def open_url():
            value, error = False, None
            try:
                value = self.opener(url, new=2)
            except Exception as caught:
                error = caught
            try:
                loop.call_soon_threadsafe(complete, value, error)
            except RuntimeError:
                pass

        threading.Thread(target=open_url, name="sam-browser-handoff", daemon=True).start()
        return await result
