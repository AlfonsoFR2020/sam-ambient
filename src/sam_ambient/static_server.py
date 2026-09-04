"""Small loopback-only HTTP server for Sam's packaged ambient UI."""

from __future__ import annotations

import asyncio
import mimetypes
import webbrowser
from importlib.resources import as_file, files
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

_MAX_REQUEST_LINE = 8 * 1024
_MAX_HEADERS = 32 * 1024


class StaticUiUnavailable(RuntimeError):
    pass


class StaticUiServer:
    def __init__(self, *, host: str = "127.0.0.1", port: int = 8766) -> None:
        if host not in {"127.0.0.1", "::1", "localhost"}:
            raise ValueError("static UI must bind to loopback")
        if not 0 <= port <= 65_535:
            raise ValueError("UI port must be between 0 and 65535")
        self.host = host
        self.requested_port = port
        self._server: asyncio.Server | None = None
        self._resource_context = None
        self._root: Path | None = None

    @property
    def port(self) -> int:
        if self._server is None or not self._server.sockets:
            return self.requested_port
        return int(self._server.sockets[0].getsockname()[1])

    async def start(self) -> None:
        if self._server is not None:
            return
        resource = files("sam_ambient").joinpath("static")
        self._resource_context = as_file(resource)
        self._root = self._resource_context.__enter__().resolve(strict=True)
        if not (self._root / "index.html").is_file():
            self._resource_context.__exit__(None, None, None)
            self._resource_context = None
            self._root = None
            raise StaticUiUnavailable("packaged frontend assets are missing; run the UI build")
        self._server = await asyncio.start_server(self._handle, self.host, self.requested_port)

    async def serve_forever(self) -> None:
        await self.start()
        assert self._server is not None
        async with self._server:
            await self._server.serve_forever()

    async def close(self) -> None:
        server, self._server = self._server, None
        if server is not None:
            server.close()
            await server.wait_closed()
        if self._resource_context is not None:
            self._resource_context.__exit__(None, None, None)
            self._resource_context = None
            self._root = None

    def open_browser(self) -> None:
        webbrowser.open(f"http://127.0.0.1:{self.port}", new=1)

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            request_line = await reader.readline()
            if not request_line or len(request_line) > _MAX_REQUEST_LINE:
                await self._respond(writer, 400, b"Bad Request", "text/plain")
                return
            header_bytes = 0
            while True:
                line = await reader.readline()
                header_bytes += len(line)
                if not line or line in {b"\r\n", b"\n"}:
                    break
                if header_bytes > _MAX_HEADERS:
                    await self._respond(writer, 431, b"Headers Too Large", "text/plain")
                    return
            try:
                method, raw_target, _version = request_line.decode("ascii").strip().split(" ", 2)
            except (UnicodeDecodeError, ValueError):
                await self._respond(writer, 400, b"Bad Request", "text/plain")
                return
            if method not in {"GET", "HEAD"}:
                await self._respond(writer, 405, b"Method Not Allowed", "text/plain")
                return
            target = self._target(raw_target)
            if target is None:
                await self._respond(writer, 404, b"Not Found", "text/plain")
                return
            data = await asyncio.to_thread(target.read_bytes)
            media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            await self._respond(writer, 200, b"" if method == "HEAD" else data, media_type)
        except (ConnectionError, OSError):
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    def _target(self, raw_target: str) -> Path | None:
        assert self._root is not None
        try:
            decoded = unquote(urlsplit(raw_target).path)
        except ValueError:
            return None
        relative = PurePosixPath(decoded.lstrip("/"))
        if ".." in relative.parts or "\\" in decoded or "\x00" in decoded:
            return None
        requested = self._root.joinpath(*relative.parts)
        if requested.is_dir():
            requested /= "index.html"
        if not requested.exists() and "." not in relative.name:
            requested = self._root / "index.html"
        try:
            resolved = requested.resolve(strict=True)
        except OSError:
            return None
        return resolved if resolved.is_file() and resolved.is_relative_to(self._root) else None

    @staticmethod
    async def _respond(
        writer: asyncio.StreamWriter,
        status: int,
        body: bytes,
        media_type: str,
    ) -> None:
        reasons = {
            200: "OK",
            400: "Bad Request",
            404: "Not Found",
            405: "Method Not Allowed",
            431: "Request Header Fields Too Large",
        }
        headers = (
            f"HTTP/1.1 {status} {reasons[status]}\r\n"
            f"Content-Type: {media_type}\r\n"
            f"Content-Length: {len(body)}\r\n"
            "Cache-Control: no-cache\r\n"
            "X-Content-Type-Options: nosniff\r\n"
            "Content-Security-Policy: default-src 'self'; "
            "connect-src ws://127.0.0.1:8765 ws://localhost:8765; "
            "style-src 'self' 'unsafe-inline'\r\n"
            "Connection: close\r\n\r\n"
        ).encode("ascii")
        writer.write(headers + body)
        await writer.drain()
