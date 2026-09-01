"""Bounded in-process event bus with explicit loss and backpressure policy."""

from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import AsyncIterator

from sam_ambient.core.protocol.models import ProtocolEvent


class SubscriptionClosed(RuntimeError):
    """Raised when reading from a closed event subscription."""


class EventSubscription:
    def __init__(self, bus: EventBus, max_queue: int) -> None:
        self._bus = bus
        self._max_queue = max_queue
        self._items: deque[ProtocolEvent] = deque()
        self._condition = asyncio.Condition()
        self._closed = False
        self.dropped_lossy = 0

    @property
    def pending(self) -> int:
        return len(self._items)

    async def _deliver(self, event: ProtocolEvent) -> None:
        async with self._condition:
            if self._closed:
                return
            if event.is_lossy:
                for index in range(len(self._items) - 1, -1, -1):
                    queued = self._items[index]
                    if queued.type == event.type:
                        del self._items[index]
                        self.dropped_lossy += 1
                        break
                if len(self._items) >= self._max_queue:
                    self.dropped_lossy += 1
                    return
            else:
                while len(self._items) >= self._max_queue and not self._closed:
                    lossy_index = next(
                        (index for index, queued in enumerate(self._items) if queued.is_lossy),
                        None,
                    )
                    if lossy_index is not None:
                        del self._items[lossy_index]
                        self.dropped_lossy += 1
                        break
                    await self._condition.wait()
                if self._closed:
                    return

            self._items.append(event)
            self._condition.notify_all()

    async def get(self) -> ProtocolEvent:
        async with self._condition:
            while not self._items and not self._closed:
                await self._condition.wait()
            if not self._items:
                raise SubscriptionClosed("event subscription is closed")
            event = self._items.popleft()
            self._condition.notify_all()
            return event

    async def close(self) -> None:
        await self._bus._unsubscribe(self)

    def __aiter__(self) -> AsyncIterator[ProtocolEvent]:
        return self

    async def __anext__(self) -> ProtocolEvent:
        try:
            return await self.get()
        except SubscriptionClosed as error:
            raise StopAsyncIteration from error

    async def _mark_closed(self) -> None:
        async with self._condition:
            self._closed = True
            self._condition.notify_all()


class EventBus:
    """Fan-out bus whose durable events apply subscriber backpressure."""

    def __init__(self) -> None:
        self._subscriptions: set[EventSubscription] = set()
        self._lock = asyncio.Lock()
        self._closed = False

    async def subscribe(self, *, max_queue: int = 64) -> EventSubscription:
        if max_queue < 1:
            raise ValueError("max_queue must be positive")
        async with self._lock:
            if self._closed:
                raise RuntimeError("event bus is closed")
            subscription = EventSubscription(self, max_queue)
            self._subscriptions.add(subscription)
            return subscription

    async def publish(self, event: ProtocolEvent) -> None:
        async with self._lock:
            if self._closed:
                raise RuntimeError("event bus is closed")
            subscriptions = tuple(self._subscriptions)
        for subscription in subscriptions:
            await subscription._deliver(event)

    async def _unsubscribe(self, subscription: EventSubscription) -> None:
        async with self._lock:
            self._subscriptions.discard(subscription)
        await subscription._mark_closed()

    async def close(self) -> None:
        async with self._lock:
            if self._closed:
                return
            self._closed = True
            subscriptions = tuple(self._subscriptions)
            self._subscriptions.clear()
        for subscription in subscriptions:
            await subscription._mark_closed()
