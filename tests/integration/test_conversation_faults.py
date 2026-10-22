"""Committed-turn fault matrix without starting Sam, a server or audio devices."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from sam_ambient.core.protocol import (
    CancellationTarget,
    ControlCommand,
    ControlCommandType,
    EventType,
)
from sam_ambient.core.providers import ProviderRegistry, ProviderRouter, RoutingPolicy
from sam_ambient.core.turns import CancellationToken, OperationCancelled, VoiceState
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.fixtures.conversation_faults import GatedProvider
from tests.integration.test_voice_input_pipeline import FakeStt, SequenceVad
from tests.unit.test_phase9_packaging import _FakeOutput, _FakeTts


class EmptyCapture:
    async def frames(self, cancellation):
        del cancellation
        if False:
            yield None


@pytest.mark.parametrize("stage", ["inventory", "health", "stream"])
@pytest.mark.parametrize("voice_enabled", [False, True])
def test_explicit_stop_retires_stalled_owner_before_adapter_returns(
    tmp_path, stage, voice_enabled
) -> None:
    async def scenario() -> None:
        provider = GatedProvider(stage)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, model=None if stage == "inventory" else "exact-model"),
            voice=RuntimeVoiceAdapters(EmptyCapture(), SequenceVad(), FakeStt())
            if voice_enabled
            else None,
        )
        events = await runtime.events.subscribe()
        try:
            generation = runtime.submit_user_message("first request")
            await asyncio.wait_for(provider.entered.wait(), 1)
            old_owner = runtime._active_generation_owner()
            assert old_owner is not None
            stop = ControlCommand(
                type=ControlCommandType.EMERGENCY_STOP,
                command_id="stop-stalled-request",
                monotonic_ms=1,
                session_id=runtime.session_id,
            )
            ack = await asyncio.wait_for(runtime.controls.dispatch(stop), 1)
            assert ack.type is EventType.CONTROL_ACKNOWLEDGED, ack.payload
            assert old_owner.token.is_cancelled
            assert runtime.active_generation_id is None
            assert runtime._active_done.is_set()
            assert old_owner.response_done.is_set()
            assert old_owner.terminal.is_set()
            assert not old_owner.task.done()  # Logical retirement does not await the adapter.
            assert runtime.voice_turns.state is VoiceState.IDLE
            if voice_enabled:
                # An exhausted in-memory capture must also relinquish monitoring
                # after logical retirement, without waiting on the stubborn model.
                await asyncio.sleep(0)
                await asyncio.sleep(0)
                assert runtime._voice_ordinary_capture_enabled.is_set()

            replacement = runtime.submit_user_message("recover through typing")
            new_task = runtime._active_response_task
            assert new_task is not None
            await asyncio.wait_for(asyncio.shield(new_task), 1)
            assert runtime.active_generation_id is None
            provider.release.set()
            await asyncio.wait_for(asyncio.shield(old_owner.task), 1)
            observed = []
            while events.pending:
                observed.append(await events.get())
            assert (
                sum(
                    event.type is EventType.MODEL_CANCELLED and event.generation_id == generation
                    for event in observed
                )
                == 1
            )
            assert not any(
                event.type in {EventType.MODEL_COMPLETED, EventType.MODEL_DELTA}
                and event.generation_id == generation
                for event in observed
            )
            assert (
                sum(
                    event.type is EventType.MODEL_COMPLETED and event.generation_id == replacement
                    for event in observed
                )
                == 1
            )
            assert provider.models == ["exact-model"] * (2 if stage == "stream" else 1)
        finally:
            provider.release.set()
            await events.close()
            await runtime.close()

    asyncio.run(scenario())


def test_stop_before_commit_has_one_terminal_with_origin_command(tmp_path) -> None:
    async def scenario() -> None:
        provider = GatedProvider("stream")
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, model="exact-model"))
        events = await runtime.events.subscribe()
        try:
            generation = runtime.submit_user_message("queued", origin_command_id="queued-command")
            # No scheduler yield: the generation has not reached commitment.
            owner = runtime._active_generation_owner()
            assert owner is not None and not owner.started.is_set()
            await runtime._cancel_active(frozenset(CancellationTarget), "ui_emergency_stop")
            await runtime._cancel_active(frozenset(CancellationTarget), "ui_emergency_stop")
            await asyncio.wait_for(owner.task, 1)
            observed = []
            while events.pending:
                observed.append(await events.get())
            terminals = [event for event in observed if event.type is EventType.MODEL_CANCELLED]
            assert len(terminals) == 1
            assert terminals[0].generation_id == generation
            assert terminals[0].payload["command_id"] == "queued-command"
            assert provider.stream_calls == 0
            assert runtime.active_generation_id is None
        finally:
            provider.release.set()
            await events.close()
            await runtime.close()

    asyncio.run(scenario())


def test_stop_speaking_does_not_cancel_a_stalled_model_request(tmp_path) -> None:
    async def scenario() -> None:
        provider = GatedProvider("stream")
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, model="exact-model"))
        try:
            generation = runtime.submit_user_message("still generating")
            await asyncio.wait_for(provider.entered.wait(), 1)
            owner = runtime._active_generation_owner()
            command = ControlCommand(
                type=ControlCommandType.STOP_SPEAKING,
                command_id="speech-only-stop",
                monotonic_ms=1,
                session_id=runtime.session_id,
            )
            assert (await runtime.controls.dispatch(command)).type is EventType.CONTROL_ACKNOWLEDGED
            assert owner is not None and not owner.token.is_cancelled
            assert runtime.active_generation_id == generation
            provider.release.set()
            await asyncio.wait_for(owner.task, 1)
        finally:
            provider.release.set()
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("voice_enabled", [False, True])
@pytest.mark.parametrize(
    "control", [ControlCommandType.STOP_SPEAKING, ControlCommandType.EMERGENCY_STOP]
)
def test_stop_between_completed_text_and_speech_preparation_preserves_answer(
    tmp_path, voice_enabled, control
) -> None:
    async def scenario() -> None:
        provider = GatedProvider("stream")
        provider.release.set()
        output = _FakeOutput()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, model="exact-model"),
            voice=RuntimeVoiceAdapters(EmptyCapture(), SequenceVad(), FakeStt())
            if voice_enabled
            else None,
            tts=_FakeTts(),
            audio_output=output,
        )
        events = await runtime.events.subscribe()
        gap = GatedProvider("stream")
        original_publish = runtime._publish_generation

        async def delay_assistant_commit(event_type, generation_id, **fields):
            if (
                event_type is EventType.TRANSCRIPT_FINAL
                and fields.get("payload", {}).get("role") == "assistant"
            ):
                # Model completion is already published; no TTS has begun. Model
                # adapters are done, but the post-model boundary can still yield.
                await gap._gate("stream", 1)
            await original_publish(event_type, generation_id, **fields)

        runtime._publish_generation = delay_assistant_commit
        try:
            generation = runtime.submit_user_message("complete text before delivery")
            await asyncio.wait_for(gap.entered.wait(), 1)
            owner = runtime._active_generation_owner()
            assert owner is not None and owner.terminal.is_set()
            assert runtime._active_playback_generation_id is None
            command = ControlCommand(
                type=control,
                command_id="stop-before-tts",
                monotonic_ms=1,
                session_id=runtime.session_id,
            )
            assert (await runtime.controls.dispatch(command)).type is EventType.CONTROL_ACKNOWLEDGED
            assert runtime._active_done.is_set()
            assert runtime.voice_turns.state is VoiceState.IDLE
            gap.release.set()
            await asyncio.wait_for(owner.task, 1)
            observed = []
            while events.pending:
                observed.append(await events.get())
            assert (
                sum(
                    event.type is EventType.MODEL_COMPLETED
                    and event.generation_id == generation
                    and event.payload.get("text") == "answer 1"
                    for event in observed
                )
                == 1
            )
            assert not any(event.type is EventType.MODEL_CANCELLED for event in observed)
            assert sum(event.type is EventType.TTS_CANCELLED for event in observed) == 1
            assert not any(
                event.type in {EventType.TTS_STARTED, EventType.TTS_FAILED} for event in observed
            )
            assert output.frames == 0
            snapshot = runtime.delivery.snapshot(generation)
            assert snapshot is not None and snapshot.generated_text == "answer 1"
        finally:
            gap.release.set()
            await events.close()
            await runtime.close()

    asyncio.run(scenario())


def test_partial_failure_is_not_a_committed_answer_and_new_typing_recovers(tmp_path) -> None:
    async def scenario() -> None:
        provider = GatedProvider("stream", partial_failure=True)
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, model="exact-model"))
        events = await runtime.events.subscribe()
        try:
            first = runtime.submit_user_message("partial failure", origin_command_id="first")
            await asyncio.wait_for(provider.entered.wait(), 1)
            task = runtime._active_response_task
            provider.release.set()
            await asyncio.wait_for(task, 1)
            second = runtime.submit_user_message("recover", origin_command_id="second")
            await asyncio.wait_for(runtime._active_response_task, 1)
            observed = []
            while events.pending:
                observed.append(await events.get())
            assert (
                sum(
                    event.type is EventType.COMPONENT_ERROR and event.generation_id == first
                    for event in observed
                )
                == 1
            )
            answers = [
                event
                for event in observed
                if event.type is EventType.TRANSCRIPT_FINAL
                and event.payload.get("role") == "assistant"
            ]
            assert len(answers) == 1 and answers[0].generation_id == second
            assert answers[0].payload["text"] == "answer 2"
            assert provider.models == ["exact-model", "exact-model"]
            assert runtime._active_done.is_set()
        finally:
            provider.release.set()
            await events.close()
            await runtime.close()

    asyncio.run(scenario())


def test_cancelled_late_inventory_cannot_install_a_model(tmp_path) -> None:
    async def scenario() -> None:
        provider = GatedProvider("inventory")
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path))
        token = CancellationToken()
        selection = asyncio.create_task(runtime._select_model(token))
        try:
            await asyncio.wait_for(provider.entered.wait(), 1)
            token.cancel("superseded_by_new_user_turn")
            provider.release.set()
            with pytest.raises(OperationCancelled):
                await asyncio.wait_for(selection, 1)
            assert runtime._model is None
        finally:
            provider.release.set()
            await asyncio.gather(selection, return_exceptions=True)
            await runtime.close()

    asyncio.run(scenario())


def test_cancelled_health_result_cannot_dispatch_model_request() -> None:
    async def scenario() -> None:
        provider = GatedProvider("health")
        registry = ProviderRegistry()
        registry.register(provider)
        router = ProviderRouter(registry)
        token = CancellationToken()

        async def request():
            return [
                event
                async for event in router.stream_chat(
                    [],
                    [],
                    model="exact-model",
                    cancellation=token,
                    policy=RoutingPolicy.EXPLICIT,
                    explicit_provider=provider.id,
                )
            ]

        task = asyncio.create_task(request())
        try:
            await asyncio.wait_for(provider.entered.wait(), 1)
            token.cancel("user_cancelled")
            provider.release.set()
            with pytest.raises(OperationCancelled):
                await asyncio.wait_for(task, 1)
            assert provider.stream_calls == 0
        finally:
            provider.release.set()
            await asyncio.gather(task, return_exceptions=True)

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["rescan", "disconnect"])
@pytest.mark.parametrize("late_outcome", ["result", "error"])
def test_noncooperative_discovery_does_not_hold_command_or_disconnect_cleanup(
    tmp_path, monkeypatch, operation, late_outcome
) -> None:
    from sam_ambient import runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_CANCEL_GRACE_S", 0.01, raising=False)

    async def scenario() -> None:
        current = GatedProvider("stream")
        late = GatedProvider("inventory")
        calls = []

        async def refresh(provider, model):
            calls.append((provider, model))
            if len(calls) == 1:
                await late._gate("inventory", 1)
                if late_outcome == "error":
                    raise RuntimeError("synthetic late discovery failure")
                return ProviderRefresh(late, "late-model", "late")
            return ProviderRefresh(current, "exact-model", "recovered")

        runtime = SamRuntime(
            current, RuntimeConfig(tmp_path, model="exact-model"), provider_refresher=refresh
        )
        events = await runtime.events.subscribe()
        operation_task = None
        try:
            await runtime._refresh_providers(None, None, False, "old-scan")
            await asyncio.wait_for(late.entered.wait(), 1)
            old_task = runtime._provider_refresh_task
            if operation == "rescan":
                # Rescan owns the dispatcher lock; a stuck join would also block typing/Quit.
                command = ControlCommand(
                    type=ControlCommandType.PROVIDERS_RESCAN,
                    command_id="rescan",
                    monotonic_ms=1,
                    session_id=runtime.session_id,
                )
                operation_task = asyncio.create_task(runtime.controls.dispatch(command))
                done, _ = await asyncio.wait((operation_task,), timeout=0.2)
                assert done, (
                    "Rescan held command admission while the old discovery ignored cancellation"
                )
                ack = operation_task.result()
                assert ack.type is EventType.CONTROL_REJECTED
                assert "retiring" in str(ack.payload)
            else:
                runtime.owner_actions.detach = AsyncMock()
                runtime.owned_browser.close = AsyncMock()
                operation_task = asyncio.create_task(
                    runtime._detach_owner(SimpleNamespace(connection_id="old-owner"))
                )
                done, _ = await asyncio.wait((operation_task,), timeout=0.2)
                assert done, "Disconnect waited indefinitely for a canceled discovery"
                operation_task.result()
                runtime.owner_actions.detach.assert_awaited_once()
            assert old_task is not None and not old_task.done()
            assert runtime._provider_scan_active  # External operation still retiring.
            assert runtime._ready_event().payload["model"] is None
            assert len(calls) == 1  # No overlapping external model operation.
            # Typed admission remains prompt and truthfully fails the unconfirmed route.
            typed = ControlCommand(
                type=ControlCommandType.USER_MESSAGE_SUBMIT,
                command_id="typed-recovery",
                monotonic_ms=2,
                session_id=runtime.session_id,
                payload={"text": "try typing"},
            )
            assert (
                await asyncio.wait_for(runtime.controls.dispatch(typed), 0.2)
            ).type is EventType.CONTROL_ACKNOWLEDGED
            await asyncio.wait_for(runtime._active_response_task, 0.2)
            assert runtime._active_done.is_set()
            late.release.set()
            await asyncio.wait_for(asyncio.gather(old_task, return_exceptions=True), 0.2)
            assert late.close_calls == int(late_outcome == "result")
            assert runtime.provider is current and runtime._model == "exact-model"
            await runtime._refresh_providers(None, None, False, "confirmed-rescan")
            await asyncio.wait_for(runtime._provider_refresh_task, 0.2)
            assert runtime._ready_event().payload["model"] == "exact-model"
            assert not runtime._provider_scan_active
            assert current.close_calls == 0
            observed = []
            while events.pending:
                observed.append(await events.get())
            assert any(
                event.type is EventType.COMPONENT_ERROR
                and event.payload.get("command_id") == "typed-recovery"
                for event in observed
            )
        finally:
            late.release.set()
            if operation_task is not None:
                await asyncio.gather(operation_task, return_exceptions=True)
            await events.close()
            await runtime.close()

    asyncio.run(scenario())
