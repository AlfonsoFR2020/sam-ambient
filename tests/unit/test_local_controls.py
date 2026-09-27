import asyncio

from sam_ambient.core.protocol import (
    ControlCommand,
    ControlCommandType,
    EventType,
    LocalControlIntent,
    LocalControlKind,
    LocalControlOutcome,
)
from sam_ambient.core.providers import ModelEvent, ModelEventKind
from sam_ambient.core.turns import CancellationToken, VoiceState
from sam_ambient.core.voice import AudioFormat, AudioFrame, VoiceInputPipeline
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, SamRuntime
from tests.integration.test_voice_input_pipeline import FakeCapture, FinalOnlyStt, SequenceVad
from tests.unit.test_conversation_context import ConversationProvider


class RecordingProvider(ConversationProvider):
    def __init__(self, provider_id: str, gate: asyncio.Event | None = None) -> None:
        super().__init__()
        self.id = provider_id
        self.gate = gate
        self.started = asyncio.Event()
        self.models_used: list[str] = []

    async def stream_chat(self, messages, tools, *, model, cancellation):
        self.models_used.append(model)
        self.started.set()
        if self.gate is not None:
            await self.gate.wait()
        cancellation.raise_if_cancelled()
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "synthetic answer")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_switch_blocks_active_turn_then_following_turn_uses_exact_new_route(tmp_path):
    async def scenario():
        release = asyncio.Event()
        first = RecordingProvider("provider-a", release)
        second = RecordingProvider("provider-b")

        async def refresh(provider, model):
            assert (provider, model) == ("provider-b", "model-b")
            return ProviderRefresh(second, "model-b", "explicit selection")

        runtime = SamRuntime(
            first, RuntimeConfig(tmp_path, model="model-a"), provider_refresher=refresh
        )
        intent = LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "provider-b", "model-b")
        try:
            runtime.submit_user_message("first")
            await asyncio.wait_for(first.started.wait(), 2)
            blocked = await runtime.execute_local_control(intent)
            assert blocked.outcome is LocalControlOutcome.BLOCKED
            blocked_command = await runtime.controls.dispatch(
                ControlCommand(
                    type=ControlCommandType.MODEL_SELECT,
                    command_id="blocked-switch",
                    monotonic_ms=1,
                    session_id=runtime.session_id,
                    payload={"provider": "provider-b", "model": "model-b", "remember": False},
                )
            )
            assert blocked_command.type == EventType.CONTROL_REJECTED
            assert blocked_command.payload["outcome"] == "blocked"
            assert runtime.provider is first and runtime._model == "model-a"
            release.set()
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            selected = await runtime.execute_local_control(intent)
            assert selected.outcome is LocalControlOutcome.SUCCESS
            assert (selected.provider_id, selected.model_id) == ("provider-b", "model-b")
            runtime.submit_user_message("second")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert first.models_used == ["model-a"]
            assert second.models_used == ["model-b"]
        finally:
            release.set()
            await runtime.close()

    asyncio.run(scenario())


def test_unavailable_or_mismatched_switch_preserves_valid_route(tmp_path):
    async def scenario():
        first = RecordingProvider("provider-a")
        wrong = RecordingProvider("provider-c")

        async def refresh(provider, model):
            if model == "throws":
                raise RuntimeError("synthetic provider failure")
            if model == "missing":
                return ProviderRefresh(None, None, "target unavailable")
            return ProviderRefresh(wrong, "model-c", "wrong target")

        runtime = SamRuntime(
            first, RuntimeConfig(tmp_path, model="model-a"), provider_refresher=refresh
        )
        try:
            for model in ("missing", "model-b"):
                result = await runtime.execute_local_control(
                    LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "provider-b", model)
                )
                assert result.outcome is LocalControlOutcome.UNAVAILABLE
                assert runtime.provider is first and runtime._model == "model-a"
                assert runtime._model_unavailable_reason is None
            failed = await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "provider-b", "throws")
            )
            assert failed.outcome is LocalControlOutcome.FAILED
            assert runtime.provider is first and runtime._model == "model-a"
            incomplete = await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "provider-b")
            )
            assert incomplete.outcome is LocalControlOutcome.AMBIGUOUS
            runtime.submit_user_message("still on A")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert first.models_used == ["model-a"]
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_new_explicit_switch_supersedes_pending_rescan(tmp_path):
    async def scenario():
        first = RecordingProvider("provider-a")
        second = RecordingProvider("provider-b")
        started = asyncio.Event()
        cancelled = asyncio.Event()

        async def refresh(provider, model):
            if provider is None:
                started.set()
                try:
                    await asyncio.Event().wait()
                finally:
                    cancelled.set()
            return ProviderRefresh(second, "model-b", "explicit selection")

        runtime = SamRuntime(
            first, RuntimeConfig(tmp_path, model="model-a"), provider_refresher=refresh
        )
        try:
            await runtime._refresh_providers(None, None, False, "older-scan")
            await asyncio.wait_for(started.wait(), 2)
            selected = await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "provider-b", "model-b"),
                "newer-choice",
            )
            assert cancelled.is_set()
            assert selected.outcome is LocalControlOutcome.STARTED
            assert runtime._provider_refresh_task is not None
            assert (await runtime._provider_refresh_task).outcome is LocalControlOutcome.SUCCESS
            assert runtime.provider is second and runtime._model == "model-b"
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_synthetic_voice_control_is_consumed_before_turn_commitment(tmp_path):
    async def scenario():
        first = RecordingProvider("provider-a")
        second = RecordingProvider("provider-b")

        async def refresh(provider, model):
            return ProviderRefresh(second, "model-b", "voice-selected route")

        def recognize(transcript):
            if transcript.text == "local route command":
                return LocalControlIntent(
                    LocalControlKind.SWITCH_INFERENCE, "provider-b", "model-b"
                )
            return None

        runtime = SamRuntime(
            first,
            RuntimeConfig(tmp_path, model="model-a"),
            provider_refresher=refresh,
            local_control_recognizer=recognize,
        )
        subscription = await runtime.events.subscribe()
        audio_format = AudioFormat(sample_rate_hz=1_000)

        def frames(offset):
            return [
                AudioFrame(audio_format, b"\0" * 40, monotonic_ms=offset + time, sequence=index)
                for index, time in enumerate((0, 20, 220, 620, 1020, 1320))
            ]

        try:
            control = VoiceInputPipeline(
                capture=FakeCapture(frames(0)),
                vad=SequenceVad(),
                stt=FinalOnlyStt("local route command"),
                turn_manager=runtime.voice_turns,
                publish=runtime.events.publish,
                on_final_transcript=runtime._consume_voice_control,
            )
            consumed = await control.run(CancellationToken("voice-control"))
            assert consumed.control_consumed
            assert runtime.voice_turns.state is VoiceState.IDLE
            assert runtime.provider is second
            assert not first.models_used and not second.models_used
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert not any(event.type == EventType.TURN_COMMITTED for event in observed)
            assert any(event.type == EventType.LOCAL_CONTROL for event in observed)

            ordinary = VoiceInputPipeline(
                capture=FakeCapture(frames(2000)),
                vad=SequenceVad(),
                stt=FinalOnlyStt("ordinary request"),
                turn_manager=runtime.voice_turns,
                publish=runtime.events.publish,
                on_final_transcript=runtime._consume_voice_control,
            )
            token = CancellationToken("ordinary-voice")
            result = await ordinary.run(token)
            assert not result.control_consumed
            response = await runtime._start_voice_turn(result.transcript, token)
            await asyncio.wait_for(response, 2)
            assert second.models_used == ["model-b"]
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert any(event.type == EventType.TURN_COMMITTED for event in observed)
        finally:
            await subscription.close()
            await runtime.close()

    asyncio.run(scenario())


def test_stop_speaking_uses_typed_control_and_is_idempotent(tmp_path):
    async def scenario():
        runtime = SamRuntime(RecordingProvider("provider-a"), RuntimeConfig(tmp_path))
        intent = LocalControlIntent(LocalControlKind.STOP_SPEAKING)
        try:
            first = await runtime.execute_local_control(intent)
            second = await runtime.execute_local_control(intent)
            assert first.outcome is second.outcome is LocalControlOutcome.SUCCESS
            command = ControlCommand(
                type=ControlCommandType.STOP_SPEAKING,
                command_id="stop-ui",
                monotonic_ms=1,
                session_id=runtime.session_id,
            )
            acknowledgement = await runtime.controls.dispatch(command)
            assert acknowledgement.type == EventType.CONTROL_ACKNOWLEDGED
            assert acknowledgement.payload["outcome"] == "success"
        finally:
            await runtime.close()

    asyncio.run(scenario())
