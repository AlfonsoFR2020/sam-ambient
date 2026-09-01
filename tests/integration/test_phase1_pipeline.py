import asyncio

from sam_ambient.core.protocol import EventBus, EventType
from sam_ambient.core.turns import CancellationRegistry, TurnManager


def test_turn_events_flow_through_bounded_bus_in_order() -> None:
    async def scenario() -> None:
        manager = TurnManager("session-integration")
        bus = EventBus()
        subscription = await bus.subscribe(max_queue=16)

        event_groups = (
            manager.start_listening(0, turn_id="turn-1", cancellation_id="cancel-1"),
            manager.on_vad(100, 0.9),
            manager.on_transcript(300, "Hello Sam.", is_final=True, confidence=0.99),
            manager.on_vad(500, 0.0),
            manager.on_time(850),
        )
        expected = [event for group in event_groups for event in group]
        for emitted in expected:
            await bus.publish(emitted)

        received = [await subscription.get() for _ in expected]
        assert received == expected
        assert received[-1].type == EventType.TURN_COMMITTED
        assert received[-1].cancellation_id == "cancel-1"

    asyncio.run(scenario())


def test_interruption_event_cancels_bound_pipeline_identity() -> None:
    manager = TurnManager("session-integration")
    cancellations = CancellationRegistry()
    token = cancellations.create("cancel-1")
    manager.start_listening(0, turn_id="turn-1", cancellation_id=token.cancellation_id)
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "Explain this.", is_final=True, confidence=0.99)
    manager.on_vad(500, 0.0)
    manager.on_time(850)
    manager.on_model_started(851, generation_id="generation-1", cancellation_id="cancel-1")
    manager.on_tts_started(852)
    manager.on_vad(900, 0.9)

    events = manager.on_time(1080)
    cancellation_event = next(event for event in events if event.type == EventType.TTS_CANCELLED)
    cancellations.cancel(
        cancellation_event.cancellation_id or "", cancellation_event.payload["reason"]
    )

    assert token.is_cancelled
    assert token.reason == "user_interruption"
