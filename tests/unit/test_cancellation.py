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


def test_callback_failure_does_not_block_other_component_cancellation() -> None:
    token = CancellationToken("cancel-components")
    callbacks: list[str] = []

    def broken(_reason: str) -> None:
        callbacks.append("model")
        raise RuntimeError("model callback failed")

    token.add_callback(broken)
    token.add_callback(lambda _reason: callbacks.append("tts"))
    token.add_callback(lambda _reason: callbacks.append("audio"))

    assert token.cancel("barge-in")
    assert callbacks == ["model", "tts", "audio"]
    assert len(token.callback_errors) == 1


def test_cancel_if_registered_does_not_recreate_finished_identity() -> None:
    registry = CancellationRegistry()
    registry.create("finished")
    registry.discard("finished")

    assert registry.cancel_if_registered("finished", "late") is False
    assert registry.get("finished") is None
