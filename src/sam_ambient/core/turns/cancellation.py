"""Idempotent cancellation primitives shared by pipeline stages."""

from __future__ import annotations

import asyncio
from collections.abc import Callable
from dataclasses import dataclass, field
from uuid import uuid4


class OperationCancelled(asyncio.CancelledError):
    def __init__(self, cancellation_id: str, reason: str) -> None:
        super().__init__(f"operation {cancellation_id} cancelled: {reason}")
        self.cancellation_id = cancellation_id
        self.reason = reason


@dataclass(slots=True)
class CancellationToken:
    """One cancellation identity passed through STT, model, TTS, and tools."""

    cancellation_id: str = field(default_factory=lambda: str(uuid4()))
    _event: asyncio.Event = field(default_factory=asyncio.Event, init=False, repr=False)
    _reason: str | None = field(default=None, init=False, repr=False)
    _callbacks: list[Callable[[str], None]] = field(default_factory=list, init=False, repr=False)

    def __post_init__(self) -> None:
        if not self.cancellation_id.strip():
            raise ValueError("cancellation_id must be non-blank")

    @property
    def is_cancelled(self) -> bool:
        return self._event.is_set()

    @property
    def reason(self) -> str | None:
        return self._reason

    def add_callback(self, callback: Callable[[str], None]) -> Callable[[], None]:
        if self.is_cancelled:
            callback(self._reason or "cancelled")
            return lambda: None
        self._callbacks.append(callback)

        def remove() -> None:
            try:
                self._callbacks.remove(callback)
            except ValueError:
                pass

        return remove

    def cancel(self, reason: str = "cancelled") -> bool:
        """Cancel once, preserving the first reason and callback execution."""

        if self.is_cancelled:
            return False
        normalized_reason = reason.strip() or "cancelled"
        self._reason = normalized_reason
        self._event.set()
        callbacks, self._callbacks = self._callbacks, []
        for callback in callbacks:
            callback(normalized_reason)
        return True

    async def wait(self) -> str:
        await self._event.wait()
        return self._reason or "cancelled"

    def raise_if_cancelled(self) -> None:
        if self.is_cancelled:
            raise OperationCancelled(self.cancellation_id, self._reason or "cancelled")


class CancellationRegistry:
    """Local identity registry used by adapters receiving cancellation events."""

    def __init__(self) -> None:
        self._tokens: dict[str, CancellationToken] = {}

    def create(self, cancellation_id: str | None = None) -> CancellationToken:
        token = CancellationToken(cancellation_id or str(uuid4()))
        if token.cancellation_id in self._tokens:
            raise ValueError(f"duplicate cancellation_id: {token.cancellation_id}")
        self._tokens[token.cancellation_id] = token
        return token

    def get_or_create(self, cancellation_id: str) -> CancellationToken:
        token = self._tokens.get(cancellation_id)
        if token is None:
            token = self.create(cancellation_id)
        return token

    def cancel(self, cancellation_id: str, reason: str = "cancelled") -> bool:
        return self.get_or_create(cancellation_id).cancel(reason)

    def discard(self, cancellation_id: str) -> CancellationToken | None:
        return self._tokens.pop(cancellation_id, None)
