import asyncio

import pytest

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationRegistry, CancellationToken, OperationCancelled
from sam_ambient.core.voice import (
    AssistantDeliveryLedger,
    BoundedSpeechQueue,
    DeliveryLimitExceeded,
    InterruptionCoordinator,
    SpeechChunkState,
)


def make_ledger() -> AssistantDeliveryLedger:
    ledger = AssistantDeliveryLedger()
    ledger.start_generation(
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
    )
    return ledger


def test_delivery_ledger_distinguishes_generated_queued_spoken_and_unspoken() -> None:
    ledger = make_ledger()
    assert ledger.record_generated("generation-1", "First sentence. Second sentence.")
    first = ledger.queue_chunk("generation-1", "First sentence. ", 10)
    second = ledger.queue_chunk("generation-1", "Second sentence.", 20)
    assert first is not None and second is not None
    assert ledger.mark_playing(first, 30)
    assert ledger.mark_spoken(first, 50)

    snapshot = ledger.cancel_unspoken("generation-1", 60)

    assert snapshot is not None
    assert snapshot.generated_text == "First sentence. Second sentence."
    assert snapshot.queued_text == snapshot.generated_text
    assert snapshot.spoken_text == "First sentence. "
    assert snapshot.unspoken_text == "Second sentence."
    assert [chunk.state for chunk in snapshot.chunks] == [
        SpeechChunkState.SPOKEN,
        SpeechChunkState.CANCELLED,
    ]
    assert ledger.mark_spoken(second, 70) is False


def test_bounded_speech_queue_backpressures_without_dropping_chunks() -> None:
    async def scenario() -> None:
        ledger = make_ledger()
        queue = BoundedSpeechQueue(ledger, max_chunks=1)
        token = CancellationToken("cancel-1")
        first = await queue.enqueue(
            "generation-1",
            "one",
            at_ms=1,
            cancellation=token,
        )
        blocked = asyncio.create_task(
            queue.enqueue(
                "generation-1",
                "two",
                at_ms=2,
                cancellation=token,
            )
        )
        await asyncio.sleep(0)
        assert blocked.done() is False

        assert await queue.next_chunk(token) == first
        assert queue.mark_playing(first, 3)
        assert queue.mark_spoken(first, 4)
        second = await blocked
        assert second.text == "two"
        assert queue.pending == 1

    asyncio.run(scenario())


def test_speech_chunks_are_bound_to_turn_generation_and_cancellation_identity() -> None:
    async def scenario() -> None:
        ledger = make_ledger()
        queue = BoundedSpeechQueue(ledger)
        chunk = await queue.enqueue(
            "generation-1",
            "bound",
            at_ms=1,
            cancellation=CancellationToken("cancel-1"),
        )

        assert (chunk.turn_id, chunk.generation_id, chunk.cancellation_id) == (
            "turn-1",
            "generation-1",
            "cancel-1",
        )
        with pytest.raises(ValueError, match="cancellation identity"):
            await queue.enqueue(
                "generation-1",
                "wrong",
                at_ms=2,
                cancellation=CancellationToken("other-cancel"),
            )

    asyncio.run(scenario())


def test_blocked_enqueue_cancels_cleanly_and_queue_remains_bounded() -> None:
    async def scenario() -> None:
        ledger = make_ledger()
        queue = BoundedSpeechQueue(ledger, max_chunks=1)
        token = CancellationToken("cancel-1")
        await queue.enqueue("generation-1", "one", at_ms=1, cancellation=token)
        blocked = asyncio.create_task(
            queue.enqueue("generation-1", "two", at_ms=2, cancellation=token)
        )
        await asyncio.sleep(0)

        token.cancel("barge-in")
        with pytest.raises(OperationCancelled):
            await blocked
        queue.cancel_generation("generation-1", 3)
        assert queue.pending == 0
        assert ledger.snapshot("generation-1") is not None
        assert all(
            chunk.state is SpeechChunkState.CANCELLED
            for chunk in ledger.snapshot("generation-1").chunks  # type: ignore[union-attr]
        )

    asyncio.run(scenario())


def test_stale_delivery_updates_cannot_mutate_authoritative_generation() -> None:
    ledger = make_ledger()
    old = ledger.queue_chunk("generation-1", "old", 1)
    assert old is not None
    ledger.cancel_unspoken("generation-1", 2)
    ledger.start_generation(
        turn_id="turn-2",
        generation_id="generation-2",
        cancellation_id="cancel-2",
    )
    ledger.record_generated("generation-2", "new")

    assert ledger.record_generated("generation-1", "stale") is False
    assert ledger.mark_playing(old, 2) is False
    assert ledger.snapshot("generation-2").generated_text == "new"  # type: ignore[union-attr]


def test_cancellation_after_completed_delivery_is_a_no_op() -> None:
    ledger = make_ledger()
    chunk = ledger.queue_chunk("generation-1", "heard", 1)
    assert chunk is not None
    assert ledger.mark_playing(chunk, 2)
    assert ledger.mark_spoken(chunk, 3)
    assert ledger.finish_generation("generation-1")

    snapshot = ledger.cancel_unspoken("generation-1", 4)

    assert snapshot is not None and snapshot.completed
    assert snapshot.interrupted_at_ms is None
    assert snapshot.spoken_text == "heard"


def test_delivery_history_is_bounded_to_completed_generations() -> None:
    ledger = AssistantDeliveryLedger(max_generations=1)
    ledger.start_generation(
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
    )
    ledger.cancel_unspoken("generation-1", 1)
    ledger.start_generation(
        turn_id="turn-2",
        generation_id="generation-2",
        cancellation_id="cancel-2",
    )

    assert ledger.snapshot("generation-1") is None
    assert ledger.snapshot("generation-2") is not None


def test_per_generation_delivery_limits_are_explicit() -> None:
    ledger = AssistantDeliveryLedger(
        max_chunks_per_generation=1,
        max_generated_chars=3,
    )
    ledger.start_generation(
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
    )
    assert ledger.record_generated("generation-1", "one")
    ledger.queue_chunk("generation-1", "one", 1)

    with pytest.raises(DeliveryLimitExceeded, match="generated assistant text"):
        ledger.record_generated("generation-1", "!")
    with pytest.raises(DeliveryLimitExceeded, match="speech chunks"):
        ledger.queue_chunk("generation-1", "two", 2)


def test_coordinator_cancels_shared_model_tts_and_audio_callbacks_once() -> None:
    registry = CancellationRegistry()
    token = registry.create("cancel-1")
    callbacks: list[str] = []
    for component in ("model", "tts", "audio"):
        token.add_callback(lambda _reason, name=component: callbacks.append(name))
    ledger = make_ledger()
    queue = BoundedSpeechQueue(ledger)
    coordinator = InterruptionCoordinator(registry, queue)
    event = ProtocolEvent(
        type=EventType.TTS_CANCELLED,
        monotonic_ms=10,
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
        payload={"reason": "user_interruption"},
    )

    first = coordinator.apply((event,))
    second = coordinator.apply((event,))

    assert first.cancellation_applied is True
    assert second.cancellation_applied is False
    assert callbacks == ["model", "tts", "audio"]


def test_interruption_coordinator_ignores_unknown_stale_identity() -> None:
    registry = CancellationRegistry()
    ledger = make_ledger()
    queue = BoundedSpeechQueue(ledger)
    coordinator = InterruptionCoordinator(registry, queue)
    stale = ProtocolEvent(
        type=EventType.MODEL_CANCELLED,
        monotonic_ms=10,
        turn_id="old-turn",
        generation_id="old-generation",
        cancellation_id="old-cancel",
        payload={"reason": "stale"},
    )

    effects = coordinator.apply((stale,))

    assert effects.cancellation_applied is False
    assert registry.get("old-cancel") is None
    assert ledger.active_generation_id == "generation-1"
