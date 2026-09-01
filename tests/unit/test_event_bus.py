import asyncio

import pytest

from zev_ambient.core.protocol import EventBus, EventType, ProtocolEvent, SubscriptionClosed


def event(event_type: str, timestamp: int) -> ProtocolEvent:
    return ProtocolEvent(type=event_type, monotonic_ms=timestamp, payload={})


def test_lossy_events_are_replaced_but_durable_events_are_preserved() -> None:
    async def scenario() -> None:
        bus = EventBus()
        subscription = await bus.subscribe(max_queue=1)

        await bus.publish(event(EventType.VOICE_LEVEL, 1))
        await bus.publish(event(EventType.VOICE_LEVEL, 2))
        assert subscription.dropped_lossy == 1
        assert (await subscription.get()).monotonic_ms == 2

        await bus.publish(event(EventType.VOICE_LEVEL, 3))
        await bus.publish(event(EventType.TURN_COMMITTED, 4))
        assert subscription.dropped_lossy == 2
        assert (await subscription.get()).type == EventType.TURN_COMMITTED

    asyncio.run(scenario())


def test_durable_event_applies_backpressure_until_consumed() -> None:
    async def scenario() -> None:
        bus = EventBus()
        subscription = await bus.subscribe(max_queue=1)
        await bus.publish(event(EventType.TURN_COMMITTED, 1))

        blocked_publish = asyncio.create_task(bus.publish(event(EventType.MODEL_COMPLETED, 2)))
        await asyncio.sleep(0)
        assert not blocked_publish.done()
        assert (await subscription.get()).type == EventType.TURN_COMMITTED
        await blocked_publish
        assert (await subscription.get()).type == EventType.MODEL_COMPLETED

    asyncio.run(scenario())


def test_closed_subscription_stops_cleanly() -> None:
    async def scenario() -> None:
        bus = EventBus()
        subscription = await bus.subscribe()
        await subscription.close()
        with pytest.raises(SubscriptionClosed):
            await subscription.get()
        await bus.close()
        await bus.close()

    asyncio.run(scenario())
