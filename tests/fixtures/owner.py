import json


async def authenticate_owner(socket, owner):
    challenge = json.loads(await socket.recv())
    await socket.send(
        json.dumps({"type": "sam.owner.authenticate", "proof": owner.proof(challenge)})
    )
    assert json.loads(await socket.recv())["type"] == "sam.owner.accepted"
