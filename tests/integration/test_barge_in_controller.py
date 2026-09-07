import asyncio
from collections.abc import Callable

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import CancellationRegistry, TurnManager, VoiceState
from sam_ambient.core.voice import (
    AssistantDeliveryLedger,
    AudioFormat,
    AudioFrame,
    BargeInController,
    BoundedSpeechQueue,
    InterruptionCoordinator,
    Transcript,
    VadResult,
)


class DataVad:
    def analyze(self, frame: AudioFrame) -> VadResult:
        speech = any(frame.data)
        return VadResult(speech, 1.0 if speech else 0.0)


def begin_speaking(manager: TurnManager) -> None:
    manager.start_listening(0, turn_id="turn-1", cancellation_id="cancel-1")
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "Explain this.", is_final=True, confidence=0.95)
    manager.on_vad(500, 0.0)
    manager.on_time(850)
    manager.on_model_started(851, generation_id="generation-1", cancellation_id="cancel-1")
    manager.on_tts_started(852, generation_id="generation-1")


def test_model_finishes_during_false_candidate_can_start_tts_and_recover():
    manager = TurnManager("session")
    manager.start_listening(0, cancellation_id="c")
    manager.on_vad(20, 1)
    manager.on_transcript(200, "Hello.", is_final=True, confidence=0.9)
    manager.on_vad(250, 0)
    manager.on_time(1000)
    manager.on_model_started(1001, generation_id="g")
    manager.on_vad(1020, 1)
    manager.on_vad(1080, 0)
    manager.on_model_completed(1081, generation_id="g")
    assert manager.on_tts_started(1082, generation_id="g")[0].type == EventType.TTS_STARTED
    manager.on_time(1980)
    assert manager.state is VoiceState.SPEAKING


def make_controller(
    manager: TurnManager,
    events: list[ProtocolEvent],
    observer: Callable[[ProtocolEvent, CancellationRegistry], None] | None = None,
) -> tuple[BargeInController, CancellationRegistry]:
    cancellations = CancellationRegistry()
    cancellations.create("cancel-1")
    ledger = AssistantDeliveryLedger()
    ledger.start_generation(
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
    )
    queue = BoundedSpeechQueue(ledger)

    async def publish(event: ProtocolEvent) -> None:
        if observer is not None:
            observer(event, cancellations)
        events.append(event)

    return (
        BargeInController(
            vad=DataVad(),
            turn_manager=manager,
            interruptions=InterruptionCoordinator(cancellations, queue),
            publish=publish,
        ),
        cancellations,
    )


def frame(at_ms: int, *, speech: bool) -> AudioFrame:
    return AudioFrame(
        AudioFormat(sample_rate_hz=1_000),
        (b"\1\0" if speech else b"\0\0") * 20,
        monotonic_ms=at_ms,
        sequence=at_ms // 20,
    )


def test_continuous_audio_confirms_barge_in_and_cancels_before_publish() -> None:
    async def scenario() -> None:
        manager = TurnManager(
            "session",
            id_factory=iter(("candidate-turn", "candidate-cancel")).__next__,
        )
        begin_speaking(manager)
        published: list[ProtocolEvent] = []
        cancellation_seen_by_publish: list[bool] = []

        def observe_publish(event: ProtocolEvent, cancellations: CancellationRegistry) -> None:
            if event.type in {EventType.MODEL_CANCELLED, EventType.TTS_CANCELLED}:
                cancellation_seen_by_publish.append(
                    cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]
                )

        controller, _cancellations = make_controller(manager, published, observe_publish)
        await controller.process_audio_frame(frame(900, speech=True))
        result = await controller.process_audio_frame(frame(1080, speech=True))

        assert manager.state is VoiceState.USER_SPEAKING
        assert result.effects.cancellation_applied
        assert result.effects.response_cancellation_applied
        assert result.effects.candidate_cancellation_applied is False
        assert result.effects.logical_stop_latency_ms == 0
        assert cancellation_seen_by_publish == [True, True]
        tts_cancelled = next(
            event for event in result.events if event.type == EventType.TTS_CANCELLED
        )
        assert tts_cancelled.payload["spoken_text"] == ""
        assert tts_cancelled.payload["unspoken_text"] == ""

    asyncio.run(scenario())


def test_candidate_transcript_can_confirm_before_duration_threshold() -> None:
    async def scenario() -> None:
        manager = TurnManager(
            "session",
            id_factory=iter(("candidate-turn", "candidate-cancel")).__next__,
        )
        begin_speaking(manager)
        published: list[ProtocolEvent] = []
        controller, cancellations = make_controller(manager, published)
        await controller.process_audio_frame(frame(900, speech=True))

        stale = await controller.process_transcript(
            940,
            Transcript("stale", is_final=True, confidence=0.99),
            cancellation_id="old-candidate",
        )
        assert stale.events == ()
        assert manager.state is VoiceState.INTERRUPTION_CANDIDATE

        result = await controller.process_transcript(
            950,
            Transcript("Stop please", is_final=False, confidence=0.9),
            cancellation_id=manager.candidate_cancellation_id or "",
        )

        assert manager.state is VoiceState.USER_SPEAKING
        assert result.effects.cancellation_applied
        assert cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]
        assert any(event.type == EventType.TRANSCRIPT_PARTIAL for event in published)

    asyncio.run(scenario())


def test_false_candidate_cleanup_does_not_cancel_current_speech():
    async def scenario():
        manager = TurnManager(
            "session", id_factory=iter(("candidate-turn", "candidate-cancel")).__next__
        )
        begin_speaking(manager)
        events = []
        controller, cancellations = make_controller(manager, events)
        response = cancellations.get("cancel-1")
        assert response is not None

        await controller.process_audio_frame(frame(900, speech=True))
        candidate = cancellations.create("candidate-cancel")
        await controller.process_audio_frame(frame(960, speech=False))
        recovered = await controller.process_audio_frame(frame(1860, speech=False))

        assert recovered.effects.candidate_cancellation_applied
        assert candidate.is_cancelled
        assert not recovered.effects.response_cancellation_applied
        assert not response.is_cancelled
        assert manager.state is VoiceState.SPEAKING
        completed = manager.on_tts_completed(1880, generation_id="generation-1")
        assert any(event.type is EventType.TTS_COMPLETED for event in completed)
        assert not any(event.type is EventType.TTS_CANCELLED for event in events)
        assert manager.state is VoiceState.IDLE

    asyncio.run(scenario())
