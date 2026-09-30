"""An isolated existing-browser check; no Sam runtime, provider or audio."""

import asyncio

import pytest

from sam_ambient.core.owner import OwnerSession
from sam_ambient.supervisor.owner_window import OwnerWindow


def test_private_owner_binding_and_child_frame_rejection(tmp_path):
    async def run():
        async def serve(reader, writer):
            await reader.readuntil(b"\r\n\r\n")
            content = b"<!doctype html><title>Owner fixture</title><iframe srcdoc='child'></iframe>"
            writer.write(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\n"
                + f"Content-Length: {len(content)}\r\n\r\n".encode()
                + content
            )
            await writer.drain()
            writer.close()
            await writer.wait_closed()

        server = await asyncio.start_server(serve, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        owner = OwnerSession()
        window = OwnerWindow(tmp_path, owner, headless=True)
        try:
            assert await window.open(f"http://127.0.0.1:{port}")
            page = window._page
            challenge = owner.challenge("core-fixture")
            proof = await page.evaluate("c => window.samOwnerProof(c)", challenge)
            assert owner.verify(challenge, proof)
            assert owner.bootstrap_line()[10:-1].decode() not in await page.content()
            child = next(frame for frame in page.frames if frame is not page.main_frame)
            with pytest.raises(Exception, match="Owner proof unavailable"):
                await child.evaluate("c => window.samOwnerProof(c)", challenge)
            # The page cannot use the binding as a general signing oracle.
            with pytest.raises(Exception, match="Invalid owner"):
                await page.evaluate("c => window.samOwnerProof(c)", {"type": "control.shell"})
            owner.revoke()
            with pytest.raises(Exception, match="revoked"):
                await page.evaluate("c => window.samOwnerProof(c)", challenge)
        finally:
            await window.aclose()
            await window.aclose()
            assert window._driver is None and window._context is None
            server.close()
            await server.wait_closed()

    asyncio.run(run())
