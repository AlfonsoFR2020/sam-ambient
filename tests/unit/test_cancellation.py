import asyncio

import pytest

from sam_ambient.core.turns import CancellationRegistry, CancellationToken, OperationCancelled


def test_cancellation_is_idempotent_and_preserves_first_reason() -> None:
    token = CancellationToken("cancel-1")
    callbacks: list[str] = []
    token.add_callback(callbacks.append)

    assert token.cancel("user interruption") is True
    assert token.cancel("later timeout") is False
    assert token.reason == "user interruption"
    assert callbacks == ["user interruption"]

    with pytest.raises(OperationCancelled) as raised:
        token.raise_if_cancelled()
    assert raised.value.cancellation_id == "cancel-1"


def test_wait_and_late_callback_observe_cancellation() -> None:
    async def scenario() -> None:
        token = CancellationToken("cancel-2")
        waiter = asyncio.create_task(token.wait())
        await asyncio.sleep(0)
        token.cancel("shutdown")
        assert await waiter == "shutdown"
        callbacks: list[str] = []
        token.add_callback(callbacks.append)
        assert callbacks == ["shutdown"]

    asyncio.run(scenario())


def test_registry_propagates_unknown_cancellation_once() -> None:
    registry = CancellationRegistry()

    assert registry.cancel("cancel-remote", "remote request") is True
    assert registry.cancel("cancel-remote", "duplicate") is False
    assert registry.get_or_create("cancel-remote").reason == "remote request"
