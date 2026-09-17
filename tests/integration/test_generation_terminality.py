import asyncio
from collections.abc import AsyncIterator, Sequence

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ProviderTimeout,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import RuntimeConfig, SamRuntime


class SupersessionProvider(LLMProvider):
    id = "supersession-test"
    data_boundary = DataBoundary.LOCAL

    def __init__(self) -> None:
        self.first_started = asyncio.Event()
        self.release_first = asyncio.Event()
        self.requests = 0

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        cancellation.raise_if_cancelled()
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        cancellation.raise_if_cancelled()
        return [ModelInfo("test-model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model
        self.requests += 1
        if self.requests == 1:
            self.first_started.set()
            await self.release_first.wait()
            # Simulate a provider that has already received a late chunk when
            # cancellation becomes observable to the runtime.
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "stale answer")
            yield ModelEvent(ModelEventKind.COMPLETED)
            return
        cancellation.raise_if_cancelled()
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "replacement answer")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_pending_generation_is_terminal_before_replacement_becomes_authoritative(tmp_path) -> None:
    async def scenario() -> None:
        provider = SupersessionProvider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0, model="test-model"),
        )
        subscription = await runtime.events.subscribe()
        try:
            first_generation = runtime.submit_user_message("first request")
            await asyncio.wait_for(provider.first_started.wait(), 1)

            replacement_generation = runtime.submit_user_message("replacement request")
            provider.release_first.set()

            events: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(
                    event.type == EventType.MODEL_COMPLETED
                    and event.generation_id == replacement_generation
                    for event in events
                ):
                    events.append(await subscription.get())

            old_terminal = [
                event
                for event in events
                if event.generation_id == first_generation
                and event.type
                in {EventType.MODEL_COMPLETED, EventType.MODEL_CANCELLED, EventType.COMPONENT_ERROR}
            ]
            replacement_authority = next(
                index
                for index, event in enumerate(events)
                if event.generation_id == replacement_generation
            )

            assert len(old_terminal) == 1
            assert old_terminal[0].type == EventType.MODEL_CANCELLED
            assert old_terminal[0].payload["reason"] == "superseded_by_new_user_turn"
            assert events.index(old_terminal[0]) < replacement_authority
            assert not any(
                event.type == EventType.MODEL_DELTA
                and event.generation_id == first_generation
                and event.payload.get("text") == "stale answer"
                for event in events
            )
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


class TerminalFailureProvider(SupersessionProvider):
    def __init__(self, *, timeout: bool) -> None:
        super().__init__()
        self.timeout = timeout

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model
        cancellation.raise_if_cancelled()
        if self.timeout:
            raise ProviderTimeout("stream timed out waiting for first usable content")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_empty_and_first_content_timeout_are_single_actionable_terminals(tmp_path) -> None:
    async def scenario() -> None:
        for timeout, expected_outcome in ((False, "empty_response"), (True, "timeout")):
            runtime = SamRuntime(
                TerminalFailureProvider(timeout=timeout),
                RuntimeConfig(tmp_path, port=0, model="test-model"),
            )
            subscription = await runtime.events.subscribe()
            try:
                generation_id = runtime.submit_user_message("request")
                observed: list[ProtocolEvent] = []
                async with asyncio.timeout(1):
                    while not any(
                        event.type == EventType.COMPONENT_ERROR
                        and event.generation_id == generation_id
                        for event in observed
                    ):
                        observed.append(await subscription.get())
                terminals = [
                    event
                    for event in observed
                    if event.generation_id == generation_id
                    and event.type
                    in {
                        EventType.MODEL_COMPLETED,
                        EventType.MODEL_CANCELLED,
                        EventType.COMPONENT_ERROR,
                    }
                ]
                assert len(terminals) == 1
                assert terminals[0].type == EventType.COMPONENT_ERROR
                assert terminals[0].payload["outcome"] == expected_outcome
                assert terminals[0].payload["error"]
            finally:
                await subscription.close()
                await runtime.close()

    asyncio.run(scenario())
