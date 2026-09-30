"""Owner-only browser bootstrap over Playwright's private process pipes, never HTTP."""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from urllib.parse import urlsplit

from sam_ambient.core.owner import OwnerAuthorityError, OwnerSession
from sam_ambient.supervisor.app_window import find_app_browser


class OwnerWindow:
    def __init__(self, root: Path, owner: OwnerSession, *, headless: bool = False) -> None:
        self.profile = root / ".sam" / "owner-ui-profile"
        self.owner = owner
        self.headless = headless
        self._driver = None
        self._context = None
        self._page = None
        self._closed = asyncio.Event()

    async def open(self, url: str) -> bool:
        from playwright.async_api import async_playwright

        executable = find_app_browser()
        if executable is None:
            return False
        self.profile.mkdir(parents=True, exist_ok=True)
        self._driver = await async_playwright().start()
        try:
            # No debugger TCP listener. Browser gets no provider keys or owner secret.
            environment = {
                name: value
                for name, value in os.environ.items()
                if name.upper()
                in {
                    "SYSTEMROOT",
                    "WINDIR",
                    "PATH",
                    "TEMP",
                    "TMP",
                    "HOME",
                    "USERPROFILE",
                    "LOCALAPPDATA",
                    "APPDATA",
                    "DISPLAY",
                    "WAYLAND_DISPLAY",
                    "XDG_RUNTIME_DIR",
                }
            }
            self._context = await self._driver.chromium.launch_persistent_context(
                str(self.profile),
                executable_path=executable,
                headless=self.headless,
                args=["--app=" + url + "/?shell=app"],
                env=environment,
                accept_downloads=False,
                service_workers="block",
            )
            pages = self._context.pages
            self._page = pages[0] if pages else await self._context.new_page()
            self._page.on("close", lambda: self._closed.set())

            async def prove(source, challenge):
                if (
                    source["page"] is not self._page
                    or source["frame"] is not self._page.main_frame
                    or not self._trusted_url(source["frame"].url, url)
                ):
                    raise OwnerAuthorityError("Owner proof unavailable")
                return self.owner.proof(challenge)

            await self._context.expose_binding("samOwnerProof", prove)

            async def local_only(route):
                if self._trusted_url(route.request.url, url):
                    await route.continue_()
                else:
                    await route.abort()

            await self._context.route("**/*", local_only)
            self._context.on("page", lambda page: asyncio.create_task(page.close()))
            await self._page.goto(url + "/?shell=app", wait_until="domcontentloaded")
            return True
        except BaseException:
            await self.aclose()
            raise

    @staticmethod
    def _trusted_url(value: str, origin: str) -> bool:
        parsed, trusted = urlsplit(value), urlsplit(origin)
        return (
            parsed.scheme == trusted.scheme
            and parsed.netloc == trusted.netloc
            and not parsed.username
            and not parsed.password
        )

    async def wait_closed(self) -> bool:
        await self._closed.wait()
        return True

    async def aclose(self) -> None:
        context, self._context = self._context, None
        driver, self._driver = self._driver, None
        try:
            if context is not None:
                await context.close()
        finally:
            if driver is not None:
                await driver.stop()
            self._closed.set()
