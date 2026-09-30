"""A read-oriented owned browser. Public HTTPS egress is pinned at connection time."""

from __future__ import annotations

import asyncio
import base64
import hmac
import ipaddress
import os
import secrets
import socket
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from sam_ambient.core.tools.models import (
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolError,
    ToolResult,
)
from sam_ambient.core.turns import CancellationToken
from sam_ambient.supervisor.app_window import find_app_browser


def navigation_target(
    value: str, fixture_origins: frozenset[str] = frozenset()
) -> tuple[str, str, int]:
    try:
        if not isinstance(value, str) or len(value) > 2048 or any(ord(c) <= 32 for c in value):
            raise ValueError
        parsed = urlsplit(value)
        host = parsed.hostname
        if not host or parsed.username or parsed.password or "\\" in value:
            raise ValueError
        origin = f"{parsed.scheme}://{parsed.netloc}"
        fixture = origin in fixture_origins
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        if not fixture and (parsed.scheme != "https" or port != 443):
            raise ValueError
        if fixture and parsed.scheme != "http":
            raise ValueError
        return origin, host.encode("idna").decode("ascii"), port
    except (ValueError, UnicodeError):
        raise ToolError(
            "Browser requires a public HTTPS URL without embedded credentials"
        ) from None


class PublicEgress:
    """Small owned proxy: validate DNS then connect that literal IP, never re-resolve.

    CONNECT is HTTPS/443 only. Plain HTTP is reserved for exact test fixture origins.
    No source configuration or action argument can enable a fixture exception.
    """

    def __init__(self, *, fixture_origins: frozenset[str] = frozenset()) -> None:
        self.fixture_origins = fixture_origins
        self._credential = secrets.token_urlsafe(32)
        self._server = None
        self._tasks: set[asyncio.Task] = set()
        self.accepted_connections = 0
        self.truncated = False

    async def start(self) -> dict[str, str]:
        self._server = await asyncio.start_server(self._handle, "127.0.0.1", 0, limit=8192)
        port = self._server.sockets[0].getsockname()[1]
        return {
            "server": f"http://127.0.0.1:{port}",
            "username": "sam",
            "password": self._credential,
            "bypass": "<-loopback>",
        }

    async def destination(self, url: str) -> tuple[str, int]:
        origin, host, port = navigation_target(url, self.fixture_origins)
        records = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
        addresses = {record[4][0] for record in records}
        if not addresses:
            raise ToolError("Browser destination unavailable")
        for value in addresses:
            address = ipaddress.ip_address(value)
            fixture = origin in self.fixture_origins and address.is_loopback
            if not fixture and (
                not address.is_global or address.is_multicast or address.is_reserved
            ):
                raise ToolError("Browser private/local destination blocked")
        return sorted(addresses)[0], port

    async def _handle(self, reader, writer) -> None:
        task = asyncio.current_task()
        if len(self._tasks) >= 8:
            writer.close()
            return
        self._tasks.add(task)
        remote = None
        try:
            async with asyncio.timeout(30):
                raw = await reader.readuntil(b"\r\n\r\n")
                if len(raw) > 8192:
                    raise ToolError("Browser proxy request too large")
                lines = raw.decode("ascii").split("\r\n")
                method, target, version = lines[0].split(" ", 2)
                headers = {}
                for line in lines[1:]:
                    if line:
                        key, val = line.split(":", 1)
                        headers[key.lower()] = val.strip()
                expected = "Basic " + base64.b64encode(f"sam:{self._credential}".encode()).decode()
                if not hmac.compare_digest(headers.get("proxy-authorization", ""), expected):
                    writer.write(
                        b"HTTP/1.1 407 Proxy Authentication Required\r\n"
                        b"Proxy-Authenticate: Basic realm=Sam\r\nContent-Length: 0\r\n\r\n"
                    )
                    await writer.drain()
                    return
                url = "https://" + target if method == "CONNECT" else target
                address, port = await self.destination(url)
                self.accepted_connections += 1
                if method != "CONNECT" and (
                    method not in {"GET", "HEAD"}
                    or navigation_target(url, self.fixture_origins)[0] not in self.fixture_origins
                ):
                    raise ToolError("Browser proxy method unsupported")
                upstream, remote = await asyncio.open_connection(address, port)
                if method == "CONNECT":
                    writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                else:
                    parsed = urlsplit(url)
                    path = parsed.path or "/"
                    if parsed.query:
                        path += "?" + parsed.query
                    safe_headers = {
                        k: v
                        for k, v in headers.items()
                        if k
                        not in {
                            "proxy-authorization",
                            "proxy-connection",
                            "content-length",
                            "transfer-encoding",
                        }
                    }
                    safe_headers["connection"] = "close"
                    request = (
                        f"{method} {path} {version}\r\n"
                        + "".join(f"{k}: {v}\r\n" for k, v in safe_headers.items())
                        + "\r\n"
                    )
                    remote.write(request.encode("ascii"))
                    await remote.drain()
                await writer.drain()

                async def pipe(source, sink):
                    retained = 0
                    while data := await source.read(16_384):
                        retained += len(data)
                        if retained > 2 * 1024 * 1024:
                            self.truncated = True
                            return
                        sink.write(data)
                        await sink.drain()

                pipes = {
                    asyncio.create_task(pipe(reader, remote)),
                    asyncio.create_task(pipe(upstream, writer)),
                }
                try:
                    await asyncio.wait(pipes, return_when=asyncio.FIRST_COMPLETED)
                finally:
                    for child in pipes:
                        child.cancel()
                    await asyncio.gather(*pipes, return_exceptions=True)
        except (
            ValueError,
            OSError,
            ToolError,
            TimeoutError,
            asyncio.IncompleteReadError,
            asyncio.LimitOverrunError,
        ):
            pass  # Never expose supplied URLs, proxy credentials or request headers in logs.
        finally:
            if remote is not None:
                remote.close()
            writer.close()
            self._tasks.discard(task)

    async def close(self) -> None:
        server, self._server = self._server, None
        if server:
            server.close()
            await server.wait_closed()
        tasks = tuple(self._tasks)
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._credential = secrets.token_urlsafe(32)


class OwnedBrowser:
    def __init__(self, *, fixture_origins: frozenset[str] = frozenset()) -> None:
        self._fixtures = fixture_origins
        self._egress = PublicEgress(fixture_origins=fixture_origins)
        self._driver = self._browser = self._context = self._page = None
        self._origin = None
        self._navigating = False
        self._requests = 0
        self._lock = asyncio.Lock()
        self.owner_connection: str | None = None

    async def _start(self) -> None:
        from playwright.async_api import async_playwright

        executable = find_app_browser()
        if executable is None:
            raise ToolError("Owned browser unavailable: install Edge or Chrome separately")
        self._driver = await async_playwright().start()
        proxy = await self._egress.start()
        environment = {
            k: v
            for k, v in os.environ.items()
            if k.upper()
            in {
                "SYSTEMROOT",
                "WINDIR",
                "PATH",
                "TEMP",
                "TMP",
                "USERPROFILE",
                "LOCALAPPDATA",
                "APPDATA",
            }
        }
        self._browser = await self._driver.chromium.launch(
            executable_path=executable,
            headless=True,
            proxy=proxy,
            env=environment,
            args=["--force-webrtc-ip-handling-policy=disable_non_proxied_udp", "--mute-audio"],
        )
        self._context = await self._browser.new_context(
            java_script_enabled=False,
            accept_downloads=False,
            service_workers="block",
            permissions=[],
        )

        async def guard(route):
            try:
                origin, _, _ = navigation_target(route.request.url, self._fixtures)
                self._requests += 1
                if (
                    origin != self._origin
                    or route.request.method not in {"GET", "HEAD"}
                    or self._requests > 20
                    or route.request.resource_type not in {"document", "stylesheet"}
                    or (
                        route.request.resource_type == "document"
                        and (
                            not self._navigating or route.request.frame is not self._page.main_frame
                        )
                    )
                ):
                    raise ToolError("Browser request blocked")
                await route.continue_()
            except ToolError:
                await route.abort()

        await self._context.route("**/*", guard)
        await self._context.route_web_socket("**/*", lambda socket: socket.close())
        self._page = await self._context.new_page()
        self._context.on("page", lambda page: asyncio.create_task(page.close()))

    async def execute(
        self, kind: str, arguments: Mapping[str, Any], token: CancellationToken
    ) -> ToolResult:
        if kind not in {"browser.navigate", "browser.read", "browser.close"}:
            raise ToolError("Browser capability unsupported")
        async with self._lock:
            token.raise_if_cancelled()
            if not token.cancellation_id.startswith("action-"):
                self.owner_connection = None
            if kind == "browser.close":
                await self._close_resources()
                return ToolResult({"closed": True})
            try:
                if kind == "browser.navigate":
                    url = str(arguments["url"])
                    origin, _, _ = navigation_target(url, self._fixtures)
                    await self._egress.destination(
                        url
                    )  # reject private routes before any browser startup
                    if self._page is None:
                        await self._start()
                    self._origin = origin
                    self._navigating = True
                    self._requests = 0
                    await self._page.goto(url, wait_until="domcontentloaded", timeout=10_000)
                if self._page is None:
                    raise ToolError("No owned browser page is open")
                if navigation_target(self._page.url, self._fixtures)[0] != self._origin:
                    raise ToolError("Browser navigation left its authorized origin")
                # Fixed trusted extraction, never page/model-supplied JavaScript. Bound before IPC.
                data = await self._page.evaluate("""() => ({title: document.title.slice(0, 300),
                    text: (document.body?.innerText || '').slice(0, 8000),
                    truncated: (document.body?.innerText || '').length > 8000})""")
                token.raise_if_cancelled()
                return ToolResult(
                    {
                        "url": self._page.url[:2048],
                        "title": data["title"],
                        "text": data["text"],
                        "content_trust": "untrusted_data",
                    },
                    data["truncated"] or self._egress.truncated or self._requests > 20,
                )
            except asyncio.CancelledError:
                await self._close_resources()
                raise
            except ToolError:
                await self._close_resources()
                raise
            except Exception:
                await self._close_resources()
                raise ToolError("Owned browser operation failed or timed out") from None
            finally:
                self._navigating = False

    async def close(self, *, owner_connection: str | None = None) -> None:
        async with self._lock:
            if owner_connection is not None and self.owner_connection != owner_connection:
                return
            await self._close_resources()

    async def _close_resources(self) -> None:
        browser, self._browser = self._browser, None
        driver, self._driver = self._driver, None
        self._context = self._page = self._origin = None
        try:
            if browser:
                await browser.close()
        finally:
            try:
                if driver:
                    await driver.stop()
            finally:
                await self._egress.close()


class BrowserTool:
    def __init__(self, browser: OwnedBrowser, kind: str) -> None:
        self.browser, self.kind = browser, kind
        navigate = kind == "browser.navigate"
        self.descriptor = ToolDescriptor(
            id=kind,
            description="Inspect a public HTTPS page in Sam's isolated read-only browser."
            if navigate
            else "Read or close Sam's isolated browser page.",
            input_schema={
                "type": "object",
                "properties": {"url": {"type": "string", "maxLength": 2048}} if navigate else {},
                "required": ["url"] if navigate else [],
                "additionalProperties": False,
            },
            result_schema={"type": "object"},
            risk=RiskClass.READ_ONLY,
            platforms=("windows", "linux", "darwin"),
            requires_confirmation=navigate,
            supports_cancellation=True,
            timeout_s=15.0,
            side_effect=SideEffect.EXTERNAL if navigate else SideEffect.NONE,
        )

    async def execute(self, arguments, cancellation):
        return await self.browser.execute(self.kind, arguments, cancellation)
