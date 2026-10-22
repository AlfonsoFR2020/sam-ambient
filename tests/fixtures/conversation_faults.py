"""Bounded, in-memory provider faults; gates are released by each test's cleanup."""

import asyncio
from collections.abc import AsyncIterator, Sequence
from typing import Literal

from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ProviderUnavailable,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken


class GatedProvider(LLMProvider):
    """Gate one preflight/stream, optionally ignoring both cancellation mechanisms.

    Subsequent requests stay independent so tests can prove recovery before the
    old adapter unwinds. No service, wall-clock delay or hardware is involved.
    """

    id = "fault-provider"
    data_boundary = DataBoundary.LOCAL

    def __init__(
        self,
        stage: Literal["inventory", "health", "stream"],
        *,
        ignore_task_cancel: bool = True,
        partial_failure: bool = False,
    ) -> None:
        self.stage = stage
        self.ignore_task_cancel = ignore_task_cancel
        self.partial_failure = partial_failure
        self.entered = asyncio.Event()
        self.release = asyncio.Event()
        self.cancel_observed = asyncio.Event()
        self.models: list[str] = []
        self.health_calls = 0
        self.inventory_calls = 0
        self.stream_calls = 0
        self.close_calls = 0

    async def _gate(self, stage: str, call: int) -> None:
        if stage != self.stage or call != 1:
            return
        self.entered.set()
        while not self.release.is_set():
            try:
                await self.release.wait()
            except asyncio.CancelledError:
                self.cancel_observed.set()
                if not self.ignore_task_cancel:
                    raise

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        del cancellation  # Deliberately uncooperative adapter boundary.
        self.inventory_calls += 1
        await self._gate("inventory", self.inventory_calls)
        return [ModelInfo("exact-model", self.id)]

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        del cancellation
        self.health_calls += 1
        await self._gate("health", self.health_calls)
        return ProviderHealth(True, "ready")

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, cancellation
        self.models.append(model)
        self.stream_calls += 1
        call = self.stream_calls
        if self.partial_failure and call == 1:
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "uncommitted partial")
        await self._gate("stream", call)
        if self.partial_failure and call == 1:
            raise ProviderUnavailable("synthetic stream disconnection")
        yield ModelEvent(ModelEventKind.TEXT_DELTA, f"answer {call}")
        yield ModelEvent(ModelEventKind.COMPLETED)

    async def aclose(self) -> None:
        self.close_calls += 1
