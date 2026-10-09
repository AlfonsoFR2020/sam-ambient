"""An isolated existing-browser check; no Sam runtime, provider or audio."""

import asyncio
import json
import os
import subprocess

import pytest

from sam_ambient.core.owner import OwnerSession
from sam_ambient.supervisor.owner_window import OwnerWindow

pytestmark = pytest.mark.skipif(os.name != "nt", reason="Windows owner app acceptance gate")


@pytest.mark.skipif(os.name != "nt", reason="Windows source app presentation gate")
def test_sandboxed_app_window_resizes_and_fullscreen_uses_real_viewport(tmp_path):
    async def run():
        assets = tmp_path / "static"
        assets.mkdir()
        (assets / "index.html").write_text(
            "<!doctype html><title>Sam fixture</title>"
            '<button onclick="document.documentElement.requestFullscreen()">Fullscreen</button>',
            encoding="utf-8",
        )
        window = OwnerWindow(tmp_path, OwnerSession(), asset_root=assets)
        try:
            assert await window.open("http://127.0.0.1:8766")
            page = window._page
            session = await window._context.new_cdp_session(page)
            # Current Edge does not expose Browser.getBrowserCommandLine without
            # an extra automation flag. Inspect only this temporary owned profile.
            profile = str(window.profile.resolve()).replace("'", "''")
            result = await asyncio.to_thread(
                subprocess.run,
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-Command",
                    "Get-CimInstance Win32_Process | Where-Object { "
                    f"$_.CommandLine -and $_.CommandLine.Contains('{profile}') "
                    "} | Select-Object -ExpandProperty CommandLine | ConvertTo-Json -Compress",
                ],
                capture_output=True,
                text=True,
                check=True,
                timeout=15,
            )
            commands = json.loads(result.stdout)
            if isinstance(commands, str):
                commands = [commands]
            assert commands and all("--no-sandbox" not in command for command in commands)
            assert any("--app=data:text/html," in command for command in commands)
            # App titlebar is allowed; ordinary browser tabs/address/toolbars are not.
            assert await page.evaluate("outerHeight - innerHeight") < 100
            target = await session.send("Browser.getWindowForTarget")
            for width, height in ((980, 720), (1300, 900)):
                await session.send(
                    "Browser.setWindowBounds",
                    {
                        "windowId": target["windowId"],
                        "bounds": {"windowState": "normal", "width": width, "height": height},
                    },
                )
                await page.wait_for_function("w => Math.abs(outerWidth-w) < 10", arg=width)
                assert await page.evaluate("outerWidth-innerWidth") < 40
            await page.get_by_role("button", name="Fullscreen").click()
            await page.wait_for_function("Boolean(document.fullscreenElement)")
            await page.evaluate("document.exitFullscreen()")
            challenge = window.owner.challenge("fixture")
            assert window.owner.verify(
                challenge,
                await page.evaluate(
                    "c => window.samOwnerProof(c)",
                    challenge,
                ),
            )
        finally:
            await window.aclose()

    asyncio.run(run())


def test_shipped_owner_ui_connects_and_submits_text(tmp_path):
    """Exercise the real shipped UI, including Chromium loopback permission."""
    from sam_ambient.runtime import RuntimeConfig, SamRuntime
    from tests.unit.test_cli import FakeProvider

    async def run():
        owner = OwnerSession()
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(workspace_root=tmp_path, model="discovered-model"),
            owner_session=owner,
        )
        window = OwnerWindow(tmp_path, owner, headless=True)
        try:
            await runtime.start()
            assert await window.open("http://127.0.0.1:8766")
            page = window._page
            await page.get_by_role("button", name="Controls", exact=True).click()
            await page.get_by_placeholder("Ask Sam…").fill("hello")
            await page.get_by_role("button", name="Send", exact=True).click(timeout=10_000)
            await page.get_by_text("Hello Sam", exact=True).wait_for(timeout=10_000)
            assert runtime.bridge.connected.is_set()
        finally:
            await window.aclose()
            await runtime.close()

    asyncio.run(run())


def test_private_owner_binding_and_child_frame_rejection(tmp_path):
    async def run():
        requested = []

        async def serve(reader, writer):
            try:
                await reader.readuntil(b"\r\n\r\n")
            except asyncio.IncompleteReadError:
                writer.close()  # Chromium may preconnect; no HTTP content was requested.
                return
            requested.append(True)
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
        assets = tmp_path / "static"
        assets.mkdir()
        (assets / "index.html").write_text(
            "<!doctype html><title>Private shipped fixture</title><iframe srcdoc='child'></iframe>",
            encoding="utf-8",
        )
        window = OwnerWindow(tmp_path, owner, headless=True, asset_root=assets)
        try:
            assert await window.open(f"http://127.0.0.1:{port}")
            page = window._page
            assert await page.title() == "Private shipped fixture"
            assert not requested  # even a same-port impostor never supplies signer-bearing code
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
