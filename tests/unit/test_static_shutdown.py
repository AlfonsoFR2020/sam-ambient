"""UI shutdown retires incomplete clients before releasing packaged resources."""

import asyncio
import json
import sys
from contextlib import suppress

import pytest

from sam_ambient.static_server import StaticUiServer


@pytest.mark.parametrize("payload", [b"", b"GET / HTTP/1.1\r\nHost:"])
def test_shutdown_closes_idle_or_partial_http_client(payload):
    async def scenario():
        server = StaticUiServer(port=0)
        accepted = asyncio.Event()
        original = server._handle

        async def observed(reader, writer):
            accepted.set()
            await original(reader, writer)

        server._handle = observed
        await server.start()
        reader, writer = await asyncio.open_connection("127.0.0.1", server.port)
        try:
            writer.write(payload)
            await writer.drain()
            await asyncio.wait_for(accepted.wait(), 1)
            await asyncio.wait_for(server.close(), 0.5)
            with suppress(ConnectionResetError):
                assert await asyncio.wait_for(reader.read(), 0.5) == b""
            assert server._root is None and server._resource_context is None
            assert not server._clients
            await server.close()
        finally:
            writer.close()
            with suppress(ConnectionError):
                await writer.wait_closed()
            await server.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("payload", [b"", b"GET / HTTP/1.1\r\nHost:"])
def test_ui_child_exits_on_parent_stop_with_incomplete_client(payload, tmp_path):
    async def scenario():
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "sam_ambient",
            "ui",
            "--port",
            "0",
            "--runtime-instance-id",
            "shutdown-fixture",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            cwd=tmp_path,
        )
        writer = None
        try:
            line = await asyncio.wait_for(process.stdout.readline(), 10)
            assert line.startswith(b"SAM_READY ")
            ready = json.loads(line[len(b"SAM_READY ") :])
            reader, writer = await asyncio.open_connection("127.0.0.1", ready["port"])
            writer.write(payload)
            await writer.drain()
            process.stdin.write(b"SAM_STOP quit\n")
            await process.stdin.drain()
            process.stdin.close()
            assert await asyncio.wait_for(process.wait(), 3) == 0
            # Windows may reset a socket with unread partial request bytes.
            # Either EOF or reset is terminal; the child must still exit zero.
            with suppress(ConnectionResetError):
                assert await asyncio.wait_for(reader.read(), 1) == b""
        finally:
            if writer is not None:
                writer.close()
                with suppress(ConnectionError):
                    await writer.wait_closed()
            if process.returncode is None:
                process.kill()
                await process.wait()

    asyncio.run(scenario())
