import asyncio
from collections.abc import AsyncIterator, Sequence

import pytest

from sam_ambient.core.protocol import ControlCommand, ControlCommandType, EventType, ProtocolEvent
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
from sam_ambient.core.turns import CancellationToken, OperationCancelled, TurnManager, VoiceState
from sam_ambient.core.voice import AudioFrame, Transcript
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.integration.test_voice_input_pipeline import FakeStt, SequenceVad
from tests.unit.test_phase9_packaging import _AnswerProvider, _FakeOutput, _FakeTts


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


class StubbornFirstProvider(SupersessionProvider):
    """A stream that does not finish just because its caller cancels it."""

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
            try:
                await self.release_first.wait()
            except asyncio.CancelledError:
                await self.release_first.wait()
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "late first answer")
        else:
            cancellation.raise_if_cancelled()
            yield ModelEvent(ModelEventKind.TEXT_DELTA, "fresh typed answer")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_shutdown_retires_active_generation_without_waiting_for_stubborn_provider(
    tmp_path, monkeypatch
) -> None:
    from sam_ambient import runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_SHUTDOWN_TASK_GRACE_S", 0.02)

    async def scenario() -> None:
        provider = StubbornFirstProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, port=0, model="test-model"))
        runtime.submit_user_message("start a response")
        await asyncio.wait_for(provider.first_started.wait(), 1)
        token = runtime._active_token
        assert token is not None
        await asyncio.wait_for(runtime.close(), 1)
        assert token.is_cancelled
        provider.release_first.set()
        await asyncio.wait_for(asyncio.gather(*runtime._tasks, return_exceptions=True), 1)
        await runtime.close()  # Repeated close is harmless.

    asyncio.run(scenario())


@pytest.mark.parametrize("voice_enabled", [False, True])
def test_typed_control_recovers_after_successive_supersessions_with_open_stream(
    tmp_path, voice_enabled: bool
) -> None:
    class EmptyCapture:
        async def frames(self, cancellation):
            del cancellation
            if False:
                yield None

    async def scenario() -> None:
        provider = StubbornFirstProvider()
        voice = (
            RuntimeVoiceAdapters(EmptyCapture(), SequenceVad(), FakeStt())
            if voice_enabled
            else None
        )
        runtime = SamRuntime(
            provider, RuntimeConfig(tmp_path, port=0, model="test-model"), voice=voice
        )
        subscription = await runtime.events.subscribe()
        try:
            first = runtime.submit_user_message("voice-like first turn")
            await asyncio.wait_for(provider.first_started.wait(), 1)
            if voice_enabled:
                runtime.voice_turns.on_vad(runtime._next_event_ms(), 1.0)
                assert runtime.voice_turns.state.value == "INTERRUPTION_CANDIDATE"
            first_task = runtime._active_response_task
            assert first_task is not None
            second = runtime.submit_user_message("superseded replacement")
            command = ControlCommand(
                type=ControlCommandType.USER_MESSAGE_SUBMIT,
                command_id="typed-recovery-command",
                monotonic_ms=1,
                session_id=runtime.session_id,
                payload={"text": "typed recovery"},
            )
            ack = await runtime.controls.dispatch(command)
            assert ack.type == EventType.CONTROL_ACKNOWLEDGED
            third = runtime.active_generation_id
            assert third not in {None, first, second}

            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(1):
                while not any(
                    event.type == EventType.MODEL_COMPLETED and event.generation_id == third
                    for event in observed
                ):
                    observed.append(await subscription.get())
            assert provider.requests == 2
            assert any(
                event.type == EventType.TRANSCRIPT_FINAL
                and event.payload.get("command_id") == command.command_id
                and event.payload.get("text") == "typed recovery"
                for event in observed
            )
            assert any(
                event.type == EventType.MODEL_CANCELLED and event.generation_id == first
                for event in observed
            )
            assert any(
                event.type == EventType.MODEL_CANCELLED and event.generation_id == second
                for event in observed
            )
            provider.release_first.set()
            await asyncio.wait_for(asyncio.gather(first_task, return_exceptions=True), 1)
            while subscription.pending:
                observed.append(await subscription.get())
            assert (
                sum(
                    event.type == EventType.MODEL_CANCELLED and event.generation_id == first
                    for event in observed
                )
                == 1
            )
            assert not any(
                event.generation_id == first
                and event.type in {EventType.MODEL_DELTA, EventType.MODEL_COMPLETED}
                for event in observed
            )
            assert runtime.active_generation_id is None
        finally:
            provider.release_first.set()
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_late_voice_handoff_cannot_reclaim_generation_after_typed_turn(tmp_path) -> None:
    async def scenario() -> None:
        provider = StubbornFirstProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, port=0, model="test-model"))
        subscription = await runtime.events.subscribe()
        handoff_entered = asyncio.Event()
        release_handoff = asyncio.Event()
        original_retire = runtime._retire_predecessor

        async def gated_retire(owner):
            if owner is not None and not handoff_entered.is_set():
                handoff_entered.set()
                await release_handoff.wait()
            await original_retire(owner)

        runtime._retire_predecessor = gated_retire
        try:
            runtime.submit_user_message("first model request")
            await asyncio.wait_for(provider.first_started.wait(), 1)
            manager = TurnManager(runtime.session_id)
            manager.start_listening(0)
            manager.on_vad(10, 1.0)
            manager.on_vad(210, 1.0)
            manager.on_transcript(220, "voice replacement", is_final=True, confidence=0.99)
            manager.on_vad(230, 0.0)
            manager.on_time(1_330)
            assert manager.state is VoiceState.COMMITTING
            runtime.voice_turns = manager
            assert manager.cancellation_id is not None
            voice_token = runtime.cancellations.create(manager.cancellation_id)
            voice_handoff = asyncio.create_task(
                runtime._start_voice_turn(Transcript("voice replacement", True, 0.99), voice_token)
            )
            await asyncio.wait_for(handoff_entered.wait(), 1)

            command = ControlCommand(
                type=ControlCommandType.USER_MESSAGE_SUBMIT,
                command_id="typed-during-handoff",
                monotonic_ms=1,
                session_id=runtime.session_id,
                payload={"text": "typed recovery"},
            )
            assert (await runtime.controls.dispatch(command)).type == EventType.CONTROL_ACKNOWLEDGED
            typed_generation = runtime.active_generation_id
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(1):
                while not any(
                    event.type == EventType.MODEL_COMPLETED
                    and event.generation_id == typed_generation
                    for event in observed
                ):
                    observed.append(await subscription.get())
            release_handoff.set()
            with pytest.raises(OperationCancelled):
                await voice_handoff
            assert provider.requests == 2
            assert runtime.active_generation_id is None
            assert not any(
                event.type == EventType.MODEL_DELTA and event.turn_id == manager.turn_id
                for event in observed
            )
        finally:
            release_handoff.set()
            provider.release_first.set()
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_ready_snapshot_identifies_active_text_turn_for_reconnect(tmp_path) -> None:
    async def scenario() -> None:
        provider = SupersessionProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, port=0, model="test-model"))
        try:
            generation_id = runtime.submit_user_message("ongoing request")
            await asyncio.wait_for(provider.first_started.wait(), 1)
            ready = runtime._ready_event()
            assert ready.type == EventType.SYSTEM_READY
            assert ready.payload["state"] == "THINKING"
            assert ready.turn_id is not None
            assert ready.generation_id == generation_id
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_text_turn_event_carries_origin_command_for_early_completion(tmp_path) -> None:
    async def scenario() -> None:
        provider = SupersessionProvider()
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, port=0, model="test-model"))
        subscription = await runtime.events.subscribe()
        try:
            await runtime._submit_from_control(
                "owner text",
                ControlCommand(
                    type=ControlCommandType.USER_MESSAGE_SUBMIT,
                    command_id="owner-command",
                    monotonic_ms=1,
                    session_id=runtime.session_id,
                    payload={"text": "owner text"},
                ),
            )
            generation_id = runtime.active_generation_id
            async with asyncio.timeout(1):
                while True:
                    emitted = await subscription.get()
                    if emitted.type == EventType.TRANSCRIPT_FINAL:
                        break
            assert emitted.generation_id == generation_id
            assert emitted.payload["role"] == "user"
            assert emitted.payload["command_id"] == "owner-command"
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_superseded_text_before_acceptance_retains_command_correlation(tmp_path) -> None:
    async def scenario() -> None:
        runtime = SamRuntime(_AnswerProvider(), RuntimeConfig(tmp_path, port=0, model="fake"))
        subscription = await runtime.events.subscribe()
        try:
            first = runtime.submit_user_message("first", origin_command_id="first-command")
            second = runtime.submit_user_message("second", origin_command_id="second-command")
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(
                    event.type == EventType.MODEL_COMPLETED and event.generation_id == second
                    for event in observed
                ):
                    observed.append(await subscription.get())
            cancelled = next(
                event
                for event in observed
                if event.type == EventType.MODEL_CANCELLED and event.generation_id == first
            )
            assert cancelled.payload["command_id"] == "first-command"
            assert not any(
                event.type == EventType.TRANSCRIPT_FINAL and event.generation_id == first
                for event in observed
            )
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("failure_stage", ["synthesis", "playback"])
def test_tts_stage_failure_keeps_committed_text_and_reports_stage(tmp_path, failure_stage) -> None:
    class FailingTts(_FakeTts):
        async def synthesize(self, text, *, voice, language, cancellation):
            raise RuntimeError("synthetic synthesis failure")
            yield None  # pragma: no cover - keep the fake adapter an async generator

    class FailingOutput(_FakeOutput):
        async def play(self, frames, cancellation):
            del frames, cancellation
            raise RuntimeError("synthetic playback failure")

    async def scenario() -> None:
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            tts=FailingTts() if failure_stage == "synthesis" else _FakeTts(),
            audio_output=FailingOutput() if failure_stage == "playback" else _FakeOutput(),
        )
        subscription = await runtime.events.subscribe()
        try:
            generation_id = runtime.submit_user_message("Hello")
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(event.type == EventType.TTS_FAILED for event in observed):
                    observed.append(await subscription.get())
            assert any(
                event.type == EventType.TRANSCRIPT_FINAL
                and event.payload.get("role") == "assistant"
                and event.generation_id == generation_id
                for event in observed
            )
            failure = observed[-1]
            assert failure.type == EventType.TTS_FAILED
            assert failure.payload["status"] == "failed"
            assert "synthetic" in failure.payload["reason"]
            assert failure.generation_id == generation_id
            health = [
                event
                for event in observed
                if event.type == EventType.COMPONENT_HEALTH
                and event.payload.get("state") == "degraded"
            ]
            assert [event.payload["component"] for event in health] == [failure_stage]
            assert [
                event.type
                for event in observed
                if event.type
                in {EventType.MODEL_COMPLETED, EventType.MODEL_CANCELLED, EventType.COMPONENT_ERROR}
            ] == [EventType.MODEL_COMPLETED]
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_unconfigured_speech_still_completes_text_answer(tmp_path) -> None:
    async def scenario() -> None:
        runtime = SamRuntime(_AnswerProvider(), RuntimeConfig(tmp_path, port=0, model="fake"))
        subscription = await runtime.events.subscribe()
        try:
            generation_id = runtime.submit_user_message("typed request")
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(event.type == EventType.TTS_COMPLETED for event in observed):
                    observed.append(await subscription.get())
            assert any(
                event.type == EventType.MODEL_COMPLETED and event.generation_id == generation_id
                for event in observed
            )
            assert any(
                event.type == EventType.TRANSCRIPT_FINAL
                and event.payload.get("role") == "assistant"
                for event in observed
            )
            assert not any(event.type == EventType.TTS_FAILED for event in observed)
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_playback_failure_closes_synthesis_iterator_and_retires_pcm(tmp_path) -> None:
    class HoldingTts(_FakeTts):
        def __init__(self):
            self.closed = False

        async def synthesize(self, text, *, voice, language, cancellation):
            del text, voice, language
            held_pcm = bytearray(1_000_000)
            try:
                for sequence in range(2):
                    cancellation.raise_if_cancelled()
                    yield AudioFrame(
                        self.audio_format, bytes(held_pcm[:40]), sequence * 20, sequence
                    )
            finally:
                held_pcm.clear()
                self.closed = True

    class FailingAfterFirstFrame(_FakeOutput):
        async def play(self, frames, cancellation):
            async for _frame in frames:
                cancellation.raise_if_cancelled()
                raise RuntimeError("synthetic output stopped")

    async def scenario() -> None:
        tts = HoldingTts()
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            tts=tts,
            audio_output=FailingAfterFirstFrame(),
        )
        subscription = await runtime.events.subscribe()
        try:
            runtime.submit_user_message("Hello")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(event.type == EventType.TTS_FAILED for event in observed):
                    observed.append(await subscription.get())
            assert [
                (event.payload["component"], event.payload["state"])
                for event in observed
                if event.type == EventType.COMPONENT_HEALTH
            ] == [("synthesis", "healthy"), ("playback", "degraded")]
            assert tts.closed
            assert runtime.speech_queue.pending == 0
            assert runtime.delivery.active_generation_id is None
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("failure_stage", ["synthesis", "playback"])
def test_speech_failure_does_not_poison_later_text_delivery(tmp_path, failure_stage) -> None:
    class RecoveringTts(_FakeTts):
        def __init__(self) -> None:
            self.fail = failure_stage == "synthesis"

        async def synthesize(self, text, *, voice, language, cancellation):
            if self.fail:
                self.fail = False
                raise RuntimeError("synthetic synthesis unavailable")
            async for frame in super().synthesize(
                text, voice=voice, language=language, cancellation=cancellation
            ):
                yield frame

    class RecoveringOutput(_FakeOutput):
        def __init__(self) -> None:
            super().__init__()
            self.fail = failure_stage == "playback"

        async def play(self, frames, cancellation):
            if self.fail:
                self.fail = False
                raise RuntimeError("synthetic playback unavailable")
            await super().play(frames, cancellation)

    async def scenario() -> None:
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            tts=RecoveringTts(),
            audio_output=RecoveringOutput(),
        )
        subscription = await runtime.events.subscribe()
        try:
            runtime.submit_user_message("first")
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(event.type == EventType.TTS_FAILED for event in observed):
                    observed.append(await subscription.get())
            runtime.submit_user_message("second")
            async with asyncio.timeout(2):
                while not any(event.type == EventType.TTS_COMPLETED for event in observed):
                    observed.append(await subscription.get())
            health = [
                event.payload["state"]
                for event in observed
                if event.type == EventType.COMPONENT_HEALTH
                and event.payload["component"] == failure_stage
            ]
            assert health == ["degraded", "healthy"]
            assert sum(event.type == EventType.MODEL_COMPLETED for event in observed) == 2
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_voice_managed_text_turn_reports_tts_failure_and_reaches_error(tmp_path) -> None:
    class EmptyCapture:
        async def frames(self, cancellation):
            del cancellation
            if False:
                yield None

    class FailingTts(_FakeTts):
        async def synthesize(self, text, *, voice, language, cancellation):
            del text, voice, language, cancellation
            raise RuntimeError("synthetic speech failure")
            yield None  # pragma: no cover - preserve async generator contract

    async def scenario() -> None:
        runtime = SamRuntime(
            _AnswerProvider(),
            RuntimeConfig(tmp_path, port=0, model="fake"),
            voice=RuntimeVoiceAdapters(EmptyCapture(), SequenceVad(), FakeStt()),
            tts=FailingTts(),
            audio_output=_FakeOutput(),
        )
        subscription = await runtime.events.subscribe()
        try:
            generation_id = runtime.submit_user_message("typed while voice enabled")
            observed: list[ProtocolEvent] = []
            async with asyncio.timeout(2):
                while not any(
                    event.type == EventType.VOICE_STATE_CHANGED
                    and event.payload.get("to") == "ERROR"
                    for event in observed
                ):
                    observed.append(await subscription.get())
            assert any(
                event.type == EventType.TTS_FAILED and event.generation_id == generation_id
                for event in observed
            )
            assert runtime.voice_turns.state.value == "ERROR"
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


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
                assert terminals[0].payload["component"] == "model"
                assert terminals[0].payload["outcome"] == expected_outcome
                assert terminals[0].payload["error"]
            finally:
                await subscription.close()
                await runtime.close()

    asyncio.run(scenario())
