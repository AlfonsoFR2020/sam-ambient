import asyncio
import json

import pytest
from websockets.asyncio.client import connect
from websockets.exceptions import ConnectionClosed, InvalidStatus

from sam_ambient.adapters.ui import SAM_PROTOCOL_SUBPROTOCOL, WebSocketCoreBridge
from sam_ambient.core.owner import OwnerSession
from sam_ambient.core.protocol import ControlDispatcher, CoreControlBindings, EventBus


def test_owner_handshake_blocks_unauthenticated_commands_replay_and_revocation():
    async def scenario():
        calls = []

        async def enabled(value):
            calls.append(value)

        async def cancel(*_args):
            pass

        events = EventBus()
        bridge = WebSocketCoreBridge(
            events, ControlDispatcher(CoreControlBindings(enabled, enabled, cancel)), port=0
        )
        owner = bridge.owner
        await bridge.start()
        url = f"ws://127.0.0.1:{bridge.port}"
        command = json.dumps(
            {
                "protocol": 1,
                "type": "control.microphone.set",
                "command_id": "x",
                "monotonic_ms": 0,
                "payload": {"enabled": False},
            }
        )
        options = {
            "origin": "http://127.0.0.1:8766",
            "subprotocols": [SAM_PROTOCOL_SUBPROTOCOL],
            "proxy": None,
        }
        try:
            async with connect(url, **options) as socket:
                first = json.loads(await socket.recv())
                proof = owner.proof(first)
                await socket.send(command)
                with pytest.raises(ConnectionClosed) as closed:
                    await socket.recv()
                assert closed.value.rcvd.code == 1008
                assert calls == [] and not bridge.connected.is_set()
            for bad in [None, "0" * 64, proof]:
                async with connect(url, **options) as socket:
                    await socket.recv()
                    await socket.send(json.dumps({"type": "sam.owner.authenticate", "proof": bad}))
                    with pytest.raises(ConnectionClosed):
                        await socket.recv()
                    assert calls == []
            async with connect(url, **options) as socket:
                challenge = json.loads(await socket.recv())
                await socket.send(
                    json.dumps({"type": "sam.owner.authenticate", "proof": owner.proof(challenge)})
                )
                assert json.loads(await socket.recv())["type"] == "sam.owner.accepted"
                await socket.send(command)
                acknowledgement = json.loads(await socket.recv())
                assert acknowledgement["type"] == "control.acknowledged"
                assert calls == [False]
                owner.revoke()
                await socket.send(command)
                with pytest.raises(ConnectionClosed):
                    await socket.recv()
                assert calls == [False]
            with pytest.raises(InvalidStatus):
                async with connect(url, **{**options, "origin": "https://evil.test"}):
                    pass
        finally:
            await bridge.close()
            await events.close()

    asyncio.run(scenario())


def test_restart_rejects_old_proof_and_reconnect_requires_new_proof():
    async def scenario():
        async def noop(*_args):
            pass

        owner = OwnerSession()
        events = EventBus()
        old_challenge = owner.challenge("old-core")
        old_proof = owner.proof(old_challenge)
        bridge = WebSocketCoreBridge(
            events,
            ControlDispatcher(CoreControlBindings(noop, noop, noop)),
            port=0,
            owner=owner,
            owner_session_id="new-core",
        )
        await bridge.start()
        try:
            for accepted in [False, True, True]:
                async with connect(
                    f"ws://127.0.0.1:{bridge.port}",
                    proxy=None,
                    origin="http://127.0.0.1:8766",
                    subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
                ) as socket:
                    challenge = json.loads(await socket.recv())
                    await socket.send(
                        json.dumps(
                            {
                                "type": "sam.owner.authenticate",
                                "proof": owner.proof(challenge) if accepted else old_proof,
                            }
                        )
                    )
                    if accepted:
                        assert json.loads(await socket.recv())["type"] == "sam.owner.accepted"
                    else:
                        with pytest.raises(ConnectionClosed):
                            await socket.recv()
        finally:
            await bridge.close()
            await events.close()

    asyncio.run(scenario())
