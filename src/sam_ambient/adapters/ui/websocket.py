"""Bounded localhost WebSocket bridge between Sam core and presentation clients."""

from __future__ import annotations

import asyncio
import ipaddress
import json
from collections.abc import Awaitable, Callable, Sequence
from uuid import uuid4

from websockets.asyncio.server import Server, ServerConnection, serve
from websockets.exceptions import ConnectionClosed

from sam_ambient.core.owner import OWNER_ACCEPTED, OWNER_AUTHENTICATE, OwnerConnection, OwnerSession
from sam_ambient.core.protocol import (
    ControlCommand,
    ControlDispatcher,
    EventBus,
    EventType,
    ProtocolError,
    ProtocolEvent,
)

DEFAULT_UI_BRIDGE_HOST = "127.0.0.1"
DEFAULT_UI_BRIDGE_PORT = 8765
SAM_PROTOCOL_SUBPROTOCOL = "sam.protocol.v1"
DEFAULT_ALLOWED_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:1420",
    "http://localhost:1420",
    "http://127.0.0.1:8766",
    "http://localhost:8766",
    "http://tauri.localhost",
    "tauri://localhost",
)


class WebSocketCoreBridge:
    """Expose an EventBus and ControlDispatcher on a loopback-only socket."""

    def __init__(
        self,
        events: EventBus,
        controls: ControlDispatcher,
        *,
        host: str = DEFAULT_UI_BRIDGE_HOST,
        port: int = DEFAULT_UI_BRIDGE_PORT,
        subscription_queue: int = 64,
        allowed_origins: Sequence[str] = DEFAULT_ALLOWED_ORIGINS,
        ready_event: Callable[[], ProtocolEvent] | None = None,
        on_shutdown: Callable[[], None] | None = None,
        owner: OwnerSession | None = None,
        owner_session_id: str | None = None,
        on_owner_disconnect: Callable[[OwnerConnection], Awaitable[None]] | None = None,
    ) -> None:
        self._require_loopback(host)
        if not 0 <= port <= 65_535:
            raise ValueError("port must be between 0 and 65535")
        if subscription_queue < 1:
            raise ValueError("subscription_queue must be positive")
        self.events = events
        self.controls = controls
        self._authenticated: set[ServerConnection] = set()
        self.host = host
        self.requested_port = port
        self.subscription_queue = subscription_queue
        self.allowed_origins = tuple(allowed_origins)
        self.ready_event = ready_event
        self.on_shutdown = on_shutdown
        self.owner = owner or OwnerSession()
        self.owner_session_id = owner_session_id or uuid4().hex
        self.on_owner_disconnect = on_owner_disconnect
        self.connected = asyncio.Event()
        self._server: Server | None = None

    @property
    def port(self) -> int:
        if self._server is None or not self._server.sockets:
            return self.requested_port
        return int(self._server.sockets[0].getsockname()[1])

    async def start(self) -> None:
        if self._server is not None:
            return
        self._server = await serve(
            self._handle_connection,
            self.host,
            self.requested_port,
            origins=self.allowed_origins,
            subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            compression=None,
            max_size=64 * 1024,
            max_queue=16,
            write_limit=32 * 1024,
            ping_interval=20,
            ping_timeout=20,
            close_timeout=3,
        )

    async def serve_forever(self) -> None:
        await self.start()
        if self._server is None:  # pragma: no cover - start guarantees this
            raise RuntimeError("bridge failed to start")
        await self._server.serve_forever()

    async def close(self) -> None:
        self.owner.revoke()
        server, self._server = self._server, None
        if server is None:
            return
        server.close()
        await server.wait_closed()

    async def _handle_connection(self, socket: ServerConnection) -> None:
        if socket.subprotocol != SAM_PROTOCOL_SUBPROTOCOL:
            await socket.close(1002, "sam.protocol.v1 is required")
            return
        # Authenticate before state subscription: events include private text and approvals.
        try:
            challenge = self.owner.challenge(self.owner_session_id)
            await socket.send(json.dumps(challenge))
            async with asyncio.timeout(5):
                raw = await socket.recv()
            response = json.loads(raw) if isinstance(raw, str) and len(raw) <= 256 else None
            if (
                not isinstance(response, dict)
                or set(response) != {"type", "proof"}
                or response["type"] != OWNER_AUTHENTICATE
                or not self.owner.verify(challenge, response["proof"])
            ):
                await socket.close(1008, "Owner authentication required")
                return
            await socket.send(json.dumps({"type": OWNER_ACCEPTED}))
        except (ValueError, TimeoutError, ConnectionClosed, RuntimeError):
            await socket.close(1008, "Owner authentication required")
            return
        authenticated_owner = self.owner
        connection = OwnerConnection(authenticated_owner, self.owner_session_id)
        self._authenticated.add(socket)
        subscription = await self.events.subscribe(max_queue=self.subscription_queue)
        self.connected.set()
        try:
            if self.ready_event is not None:
                await socket.send(self.ready_event().to_json())
            producer = asyncio.create_task(self._produce(socket, subscription, authenticated_owner))
            consumer = asyncio.create_task(self._consume(socket, authenticated_owner, connection))
            done, pending = await asyncio.wait(
                {producer, consumer}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)
            for task in done:
                try:
                    task.result()
                except ConnectionClosed:
                    pass
        finally:
            self._authenticated.discard(socket)
            connection.retire()
            if self.on_owner_disconnect is not None:
                await self.on_owner_disconnect(connection)
            await subscription.close()

    async def _produce(self, socket: ServerConnection, subscription, owner: OwnerSession) -> None:
        async for event in subscription:
            if owner is not self.owner or not owner.active:
                await socket.close(1008, "Owner session revoked")
                return
            await socket.send(event.to_json())

    async def _consume(
        self, socket: ServerConnection, owner: OwnerSession, connection: OwnerConnection
    ) -> None:
        async for raw in socket:
            if owner is not self.owner or not owner.active:
                await socket.close(1008, "Owner session revoked")
                return
            if not isinstance(raw, str):
                await socket.close(1003, "binary commands are unsupported")
                return
            try:
                command = ControlCommand.from_json(raw)
            except ProtocolError as error:
                await socket.close(1002, str(error)[:120])
                return
            acknowledgement = await self.controls.dispatch(command, owner_connection=connection)
            if acknowledgement.payload.get("application_stopping") is True:
                # Deliver the direct-user acknowledgement before shutting down the bridge.
                stopping = ProtocolEvent(
                    type=EventType.SYSTEM_STOPPING,
                    monotonic_ms=acknowledgement.monotonic_ms,
                    session_id=acknowledgement.session_id,
                    payload={"reason": "owner_requested_shutdown"},
                )

                async def notify(peer, event):
                    try:
                        async with asyncio.timeout(1):
                            await peer.send(event.to_json())
                    except (ConnectionClosed, TimeoutError):
                        pass

                try:
                    await notify(socket, acknowledgement)
                    if self._server is not None:
                        await asyncio.gather(
                            *(notify(peer, stopping) for peer in tuple(self._authenticated))
                        )
                finally:
                    # An accepted Quit must survive its requesting tab closing
                    # before the acknowledgement can be delivered.
                    if self.on_shutdown is not None:
                        self.on_shutdown()
                return
            await self.events.publish(acknowledgement)

    @staticmethod
    def _require_loopback(host: str) -> None:
        if host == "localhost":
            return
        try:
            address = ipaddress.ip_address(host)
        except ValueError as error:
            raise ValueError("UI bridge host must be localhost or a loopback IP") from error
        if not address.is_loopback:
            raise ValueError("UI bridge must bind to loopback only")
