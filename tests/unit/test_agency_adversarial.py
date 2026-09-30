import asyncio
import base64
from unittest.mock import AsyncMock

import pytest

from sam_ambient.core.owner import OwnerConnection, OwnerSession
from sam_ambient.core.protocol import ControlCommand, ControlDispatcher, CoreControlBindings
from sam_ambient.core.tools.agency import CapabilityKind, OwnerActions
from sam_ambient.core.tools.browser import OwnedBrowser, PublicEgress
from sam_ambient.core.tools.models import ToolError, ToolResult, ToolStatus
from sam_ambient.core.turns import CancellationToken
from tests.unit.test_tool_executor import descriptor, executor_for, function_tool, invocation


def test_retirement_during_started_event_never_enters_handler():
    async def run():
        current, calls, events = True, [], []

        async def handler(_args, _token):
            calls.append(True)
            return ToolResult({"ok": True})

        executor = executor_for(
            [function_tool(descriptor(), handler)], events, is_current=lambda _i: current
        )
        original = executor._publish_event

        async def publish(event):
            nonlocal current
            await original(event)
            if event.type == "tool.started":
                current = False

        executor._publish_event = publish
        result = await executor.execute(invocation(), CancellationToken())
        assert result.status is ToolStatus.STALE and not calls
        assert not executor._inflight and not executor._active_cancellable

    asyncio.run(run())


def test_consumer_cancellation_is_terminal_and_owner_action_capacity_is_bounded():
    async def run():
        owner, events, terminals = OwnerSession(), [], []
        entered = asyncio.Event()

        async def handler(_args, _token):
            entered.set()
            await asyncio.Event().wait()

        async def terminal(_action, result):
            terminals.append(result)

        executor = executor_for([function_tool(descriptor("files.read"), handler)], events)
        actions = OwnerActions(
            owner, executor, terminal, supported=frozenset({CapabilityKind.FILES_READ})
        )
        executor._is_current = actions.is_current
        connection = OwnerConnection(owner, "core")
        running = [actions.start(connection, f"r-{i}", i + 1, "files.read", {}) for i in range(4)]
        await entered.wait()
        with pytest.raises(ValueError, match="too many"):
            actions.start(connection, "overflow", 5, "files.read", {})
        running[0].task.cancel()
        await running[0].task
        assert terminals[0].status is ToolStatus.CANCELLED
        await actions.detach(connection)
        assert not actions.active and not actions._tasks
        fresh = OwnerConnection(owner, "core")
        action = actions.start(fresh, "new", 1, "files.read", {})
        await asyncio.sleep(0)
        assert actions.cancel(fresh, "new")
        await action.task
        owner.revoke()
        assert not fresh.active
        await actions.close()

    asyncio.run(run())


def test_retired_command_and_rejection_output_are_bounded():
    async def run():
        calls = []

        async def fail(value):
            calls.append(value)
            raise ValueError("x" * 10000)

        async def noop(*_args):
            pass

        dispatcher = ControlDispatcher(CoreControlBindings(fail, noop, noop))
        connection = OwnerConnection(OwnerSession(), "core")
        command = ControlCommand(
            type="control.microphone.set",
            command_id="cmd",
            monotonic_ms=0,
            payload={"enabled": False},
        )
        result = await dispatcher.dispatch(command, owner_connection=connection)
        assert len(result.payload["error"]) == 500
        connection.retire()
        result = await dispatcher.dispatch(command, owner_connection=connection)
        assert result.type == "control.rejected" and len(calls) == 1
        assert result.payload["error"] == "Owner connection retired"

    asyncio.run(run())


def test_connect_proxy_pins_validated_dns_and_never_re_resolves(monkeypatch):
    async def run():
        proxy = PublicEgress()
        settings = await proxy.start()
        original = asyncio.open_connection
        connections = []

        async def destination(reader, writer):
            data = await reader.read(100)
            writer.write(data)
            await writer.drain()
            writer.close()

        server = await asyncio.start_server(destination, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]

        async def pinned(address, remote_port):
            connections.append((address, remote_port))
            return await original("127.0.0.1", port)

        reader, writer = await original("127.0.0.1", int(settings["server"].rsplit(":", 1)[1]))
        loop = asyncio.get_running_loop()
        resolver = AsyncMock(return_value=[(0, 0, 0, "", ("93.184.216.34", 443))])
        monkeypatch.setattr(loop, "getaddrinfo", resolver)
        monkeypatch.setattr(asyncio, "open_connection", pinned)
        credential = base64.b64encode(f"sam:{settings['password']}".encode())
        writer.write(
            b"CONNECT public.test:443 HTTP/1.1\r\nProxy-Authorization: Basic "
            + credential
            + b"\r\n\r\n"
        )
        await writer.drain()
        assert (await reader.readuntil(b"\r\n\r\n")).startswith(b"HTTP/1.1 200")
        writer.write(b"synthetic TLS bytes")
        await writer.drain()
        assert await reader.read(100) == b"synthetic TLS bytes"
        assert connections == [("93.184.216.34", 443)] and resolver.await_count == 1
        writer.close()
        await writer.wait_closed()
        await proxy.close()
        assert not proxy._tasks
        server.close()
        await server.wait_closed()

    asyncio.run(run())


def test_browser_does_not_accept_arbitrary_javascript_action():
    async def run():
        browser = OwnedBrowser()
        with pytest.raises(ToolError, match="unsupported"):
            await browser.execute(
                "browser.evaluate", {"script": "fetch('/secret')"}, CancellationToken()
            )
        assert browser._driver is None and browser._egress._server is None

    asyncio.run(run())
