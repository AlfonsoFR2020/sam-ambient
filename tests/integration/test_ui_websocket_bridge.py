import asyncio

from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed

from sam_ambient.adapters.ui import SAM_PROTOCOL_SUBPROTOCOL, WebSocketCoreBridge
from sam_ambient.core.protocol import (
    CancellationTarget,
    ControlCommand,
    ControlCommandType,
    ControlDispatcher,
    CoreControlBindings,
    EventBus,
    EventType,
    ProtocolEvent,
)


async def noop_enabled(_enabled: bool) -> None:
    return None


async def noop_cancel(_targets: frozenset[CancellationTarget], _reason: str) -> None:
    return None


def test_websocket_bridge_streams_events_and_accepts_control_commands() -> None:
    async def scenario() -> None:
        events = EventBus()
        dispatcher = ControlDispatcher(
            CoreControlBindings(noop_enabled, noop_enabled, noop_cancel),
            clock_ms=lambda: 30,
        )
        bridge = WebSocketCoreBridge(
            events,
            dispatcher,
            port=0,
            ready_event=lambda: ProtocolEvent(
                type=EventType.SYSTEM_READY,
                monotonic_ms=0,
                session_id="session",
                payload={"state": "IDLE"},
            ),
        )
        await bridge.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{bridge.port}",
                origin="http://127.0.0.1:1420",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                proxy=None,
            ) as socket:
                ready = ProtocolEvent.from_json(await socket.recv())
                assert ready.type == EventType.SYSTEM_READY

                spoken = ProtocolEvent(
                    type=EventType.TTS_LEVEL,
                    monotonic_ms=10,
                    session_id="session",
                    payload={"envelope": 0.6},
                )
                await events.publish(spoken)
                assert ProtocolEvent.from_json(await socket.recv()) == spoken

                await socket.send(
                    ControlCommand(
                        type=ControlCommandType.STOP_SPEAKING,
                        command_id="stop-1",
                        monotonic_ms=20,
                        session_id="session",
                    ).to_json()
                )
                acknowledgement = ProtocolEvent.from_json(await socket.recv())
                assert acknowledgement.type == EventType.CONTROL_ACKNOWLEDGED
                assert acknowledgement.payload["command_id"] == "stop-1"
        finally:
            await bridge.close()
            await events.close()

    asyncio.run(scenario())


def test_websocket_bridge_rejects_protocol_mismatch_and_remote_binding() -> None:
    async def scenario() -> None:
        events = EventBus()
        dispatcher = ControlDispatcher(CoreControlBindings(noop_enabled, noop_enabled, noop_cancel))
        bridge = WebSocketCoreBridge(events, dispatcher, port=0)
        await bridge.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{bridge.port}",
                origin="http://127.0.0.1:1420",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                proxy=None,
            ) as socket:
                await socket.send(
                    '{"protocol":2,"type":"control.emergency_stop",'
                    '"command_id":"bad","monotonic_ms":0,"payload":{}}'
                )
                try:
                    await socket.recv()
                except ConnectionClosed as error:
                    assert error.rcvd is not None
                    assert error.rcvd.code == 1002
                else:  # pragma: no cover - a close is required
                    raise AssertionError("bridge accepted an unsupported protocol")
        finally:
            await bridge.close()
            await events.close()

        try:
            WebSocketCoreBridge(events, dispatcher, host="0.0.0.0")
        except ValueError as error:
            assert "loopback" in str(error)
        else:  # pragma: no cover - remote binding must be impossible
            raise AssertionError("bridge accepted a remote bind address")

    asyncio.run(scenario())


def test_websocket_bridge_accepts_tauri_windows_origin() -> None:
    async def scenario() -> None:
        events = EventBus()
        dispatcher = ControlDispatcher(CoreControlBindings(noop_enabled, noop_enabled, noop_cancel))
        bridge = WebSocketCoreBridge(events, dispatcher, port=0)
        await bridge.start()
        try:
            async with connect(
                f"ws://127.0.0.1:{bridge.port}",
                origin="http://tauri.localhost",
                subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                proxy=None,
            ):
                assert bridge.connected.is_set()
        finally:
            await bridge.close()
            await events.close()

    asyncio.run(scenario())
