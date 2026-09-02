import asyncio
from collections.abc import Iterator

from sam_ambient.core.protocol import EventBus, EventType, ProtocolEvent
from sam_ambient.core.turns import (
    CancellationRegistry,
    InterruptionMode,
    TurnConfig,
    TurnManager,
    VoiceState,
)
from sam_ambient.core.voice import (
    AssistantDeliveryLedger,
    BoundedSpeechQueue,
    InterruptionCoordinator,
    SpeechChunkState,
)


def make_manager(mode: InterruptionMode = InterruptionMode.BALANCED) -> TurnManager:
    ids: Iterator[str] = iter(
        (
            "candidate-turn-1",
            "candidate-cancel-1",
            "candidate-turn-2",
            "candidate-cancel-2",
            "candidate-turn-3",
            "candidate-cancel-3",
        )
    )
    return TurnManager(
        "session-1",
        config=TurnConfig(interruption_mode=mode),
        id_factory=lambda: next(ids),
    )


def begin_thinking(manager: TurnManager) -> None:
    manager.start_listening(0, turn_id="turn-1", cancellation_id="cancel-1")
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "Explain this.", is_final=True, confidence=0.95)
    manager.on_vad(500, 0.0)
    manager.on_time(850)
    manager.on_model_started(851, generation_id="generation-1", cancellation_id="cancel-1")
    assert manager.state is VoiceState.THINKING


def begin_speaking(manager: TurnManager) -> None:
    begin_thinking(manager)
    manager.on_tts_started(852, generation_id="generation-1")
    assert manager.state is VoiceState.SPEAKING


def make_runtime() -> tuple[
    CancellationRegistry,
    AssistantDeliveryLedger,
    BoundedSpeechQueue,
    InterruptionCoordinator,
]:
    cancellations = CancellationRegistry()
    cancellations.create("cancel-1")
    ledger = AssistantDeliveryLedger()
    ledger.start_generation(
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
    )
    queue = BoundedSpeechQueue(ledger, max_chunks=4)
    return cancellations, ledger, queue, InterruptionCoordinator(cancellations, queue)


def test_01_normal_assistant_speech_without_interruption() -> None:
    manager = make_manager()
    begin_speaking(manager)

    assert manager.on_model_completed(900, generation_id="generation-1")[0].type == (
        EventType.MODEL_COMPLETED
    )
    events = manager.on_tts_completed(1000, generation_id="generation-1")

    assert manager.state is VoiceState.IDLE
    assert [event.type for event in events] == [
        EventType.TTS_COMPLETED,
        EventType.VOICE_STATE_CHANGED,
    ]


def test_02_genuine_mid_sentence_interruption_preserves_spoken_prefix() -> None:
    async def scenario() -> None:
        manager = make_manager()
        begin_speaking(manager)
        cancellations, ledger, queue, coordinator = make_runtime()
        ledger.record_generated("generation-1", "One. Two. Three.")
        chunks = [
            await queue.enqueue(
                "generation-1",
                text,
                at_ms=860 + index,
                cancellation=cancellations.get("cancel-1"),  # type: ignore[arg-type]
            )
            for index, text in enumerate(("One. ", "Two. ", "Three."))
        ]
        first = await queue.next_chunk(cancellations.get("cancel-1"))  # type: ignore[arg-type]
        queue.mark_playing(first, 870)
        queue.mark_spoken(first, 880)

        manager.on_vad(900, 0.9)
        events = manager.on_time(1080)
        effects = coordinator.apply(events)

        assert manager.state is VoiceState.USER_SPEAKING
        assert cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]
        assert effects.logical_stop_latency_ms == 0
        assert effects.delivery is not None
        assert effects.delivery.spoken_text == "One. "
        assert effects.delivery.unspoken_text == "Two. Three."
        assert [chunk.state for chunk in effects.delivery.chunks] == [
            SpeechChunkState.SPOKEN,
            SpeechChunkState.CANCELLED,
            SpeechChunkState.CANCELLED,
        ]
        assert chunks[0] == first

    asyncio.run(scenario())


def test_03_interruption_during_active_model_generation() -> None:
    manager = make_manager()
    begin_thinking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    manager.on_vad(900, 0.9)

    events = manager.on_transcript(950, "Stop please", is_final=False, confidence=0.9)
    effects = coordinator.apply(events)

    assert any(event.type == EventType.MODEL_CANCELLED for event in events)
    assert all(event.type != EventType.TTS_CANCELLED for event in events)
    assert effects.cancellation_applied
    assert cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]


def test_04_interruption_cancels_every_queued_tts_chunk() -> None:
    async def scenario() -> None:
        manager = make_manager()
        begin_speaking(manager)
        cancellations, ledger, queue, coordinator = make_runtime()
        token = cancellations.get("cancel-1")
        for index, text in enumerate(("one", "two", "three")):
            await queue.enqueue(
                "generation-1",
                text,
                at_ms=860 + index,
                cancellation=token,  # type: ignore[arg-type]
            )
        manager.on_vad(900, 0.9)

        coordinator.apply(manager.on_time(1080))
        snapshot = ledger.snapshot("generation-1")

        assert queue.pending == 0
        assert snapshot is not None
        assert all(chunk.state is SpeechChunkState.CANCELLED for chunk in snapshot.chunks)

    asyncio.run(scenario())


def test_05_cough_during_speech_recovers_without_cancellation() -> None:
    manager = make_manager()
    begin_speaking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    candidate_events = manager.on_vad(900, 0.9)
    candidate_id = next(
        event.cancellation_id
        for event in candidate_events
        if event.payload.get("reason") == "possible_user_interruption"
    )
    assert candidate_id is not None
    candidate_token = cancellations.create(candidate_id)
    manager.on_transcript(930, "cough", is_final=True, confidence=0.95)
    coordinator.apply(manager.on_vad(950, 0.0))

    events = manager.on_time(1850)
    effects = coordinator.apply(events)

    assert manager.state is VoiceState.SPEAKING
    assert all(event.type != EventType.TTS_CANCELLED for event in events)
    assert cancellations.get("cancel-1").is_cancelled is False  # type: ignore[union-attr]
    assert candidate_token.is_cancelled
    assert effects.candidate_cancellation_applied
    assert effects.response_cancellation_applied is False
    assert effects.logical_stop_latency_ms is None


def test_06_short_backchannel_does_not_interrupt() -> None:
    manager = make_manager()
    begin_speaking(manager)
    manager.on_vad(900, 0.9)
    manager.on_transcript(940, "mm-hm", is_final=True, confidence=0.95)
    manager.on_vad(1000, 0.0)

    events = manager.on_time(1900)

    assert manager.state is VoiceState.SPEAKING
    assert all(
        event.type not in {EventType.MODEL_CANCELLED, EventType.TTS_CANCELLED} for event in events
    )


def test_07_false_interruption_resumes_without_replaying_spoken_audio() -> None:
    async def scenario() -> None:
        manager = make_manager()
        begin_speaking(manager)
        cancellations, ledger, queue, coordinator = make_runtime()
        token = cancellations.get("cancel-1")
        first = await queue.enqueue(
            "generation-1",
            "heard",
            at_ms=860,
            cancellation=token,  # type: ignore[arg-type]
        )
        second = await queue.enqueue(
            "generation-1",
            "remaining",
            at_ms=861,
            cancellation=token,  # type: ignore[arg-type]
        )
        assert await queue.next_chunk(token) == first  # type: ignore[arg-type]
        queue.mark_playing(first, 870)
        queue.mark_spoken(first, 880)
        manager.on_vad(900, 0.9)
        coordinator.apply(manager.on_vad(940, 0.0))
        coordinator.apply(manager.on_time(1840))

        resumed = await queue.next_chunk(token)  # type: ignore[arg-type]

        assert manager.state is VoiceState.SPEAKING
        assert resumed == second
        assert ledger.snapshot("generation-1").spoken_text == "heard"  # type: ignore[union-attr]

    asyncio.run(scenario())


def test_08_brief_pause_inside_interruption_preserves_candidate() -> None:
    manager = make_manager()
    begin_speaking(manager)
    manager.on_vad(900, 0.9)
    manager.on_vad(1000, 0.0)
    manager.on_vad(1050, 0.9)

    assert manager.on_time(1129) == ()
    manager.on_time(1130)

    assert manager.state is VoiceState.USER_SPEAKING
    assert manager.turn_id == "candidate-turn-1"


def test_09_user_starts_speaking_exactly_as_tts_finishes() -> None:
    manager = make_manager()
    begin_speaking(manager)
    manager.on_vad(900, 0.9)

    events = manager.on_tts_completed(900, generation_id="generation-1")

    assert manager.state is VoiceState.USER_SPEAKING
    assert manager.turn_id == "candidate-turn-1"
    assert all(event.type != EventType.TTS_CANCELLED for event in events)


def test_10_model_finishes_exactly_as_interruption_is_confirmed() -> None:
    manager = make_manager()
    begin_speaking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    manager.on_vad(900, 0.9)
    manager.on_model_completed(1080, generation_id="generation-1")

    events = manager.on_time(1080)
    coordinator.apply(events)

    assert all(event.type != EventType.MODEL_CANCELLED for event in events)
    assert any(event.type == EventType.TTS_CANCELLED for event in events)
    assert cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]


def test_11_tts_chunk_finishes_exactly_as_cancellation_arrives() -> None:
    async def scenario() -> None:
        manager = make_manager()
        begin_speaking(manager)
        cancellations, ledger, queue, coordinator = make_runtime()
        token = cancellations.get("cancel-1")
        first = await queue.enqueue(
            "generation-1",
            "heard",
            at_ms=860,
            cancellation=token,  # type: ignore[arg-type]
        )
        await queue.enqueue(
            "generation-1",
            "not heard",
            at_ms=861,
            cancellation=token,  # type: ignore[arg-type]
        )
        assert await queue.next_chunk(token) == first  # type: ignore[arg-type]
        queue.mark_playing(first, 870)
        manager.on_vad(900, 0.9)
        assert queue.mark_spoken(first, 1080)

        effects = coordinator.apply(manager.on_time(1080))

        assert effects.delivery is not None
        assert effects.delivery.spoken_text == "heard"
        assert effects.delivery.unspoken_text == "not heard"
        assert ledger.mark_spoken(first, 1081) is False

    asyncio.run(scenario())


def test_12_duplicate_cancellation_request_is_idempotent() -> None:
    manager = make_manager()
    begin_speaking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    manager.on_vad(900, 0.9)
    events = manager.on_time(1080)

    first = coordinator.apply(events)
    second = coordinator.apply(events)

    assert first.cancellation_applied is True
    assert second.cancellation_applied is False
    assert cancellations.get("cancel-1").reason == "user_interruption"  # type: ignore[union-attr]


def test_13_stale_model_and_tts_completion_cannot_mutate_new_turn() -> None:
    manager = make_manager()
    begin_speaking(manager)
    manager.on_vad(900, 0.9)
    manager.on_time(1080)
    new_turn = manager.turn_id

    assert manager.on_model_completed(1081, generation_id="generation-1") == ()
    assert manager.on_tts_completed(1081, generation_id="generation-1") == ()
    assert manager.turn_id == new_turn
    assert manager.state is VoiceState.USER_SPEAKING


def test_14_final_stt_revision_after_candidate_silence_confirms_turn() -> None:
    manager = make_manager()
    begin_speaking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    candidate_events = manager.on_vad(900, 0.9)
    candidate_cancellation_id = next(
        event.cancellation_id
        for event in candidate_events
        if event.payload.get("reason") == "possible_user_interruption"
    )
    assert candidate_cancellation_id is not None
    candidate_token = cancellations.create(candidate_cancellation_id)
    finalizing_callbacks: list[str] = []
    candidate_token.add_callback(finalizing_callbacks.append)
    manager.on_transcript(940, "stap", is_final=False, confidence=0.4)
    manager.on_vad(1000, 0.0)

    events = manager.on_transcript(1050, "Stop please.", is_final=True, confidence=0.95)
    coordinator.apply(events)

    assert any(event.type == EventType.TTS_CANCELLED for event in events)
    assert manager.state is VoiceState.ENDPOINT_CANDIDATE
    assert manager.transcript == "Stop please."
    assert candidate_token.is_cancelled is False
    assert finalizing_callbacks == []


def test_15_audio_event_burst_respects_bounded_queue_pressure() -> None:
    async def scenario() -> None:
        bus = EventBus()
        subscription = await bus.subscribe(max_queue=2)
        for timestamp in range(20):
            await bus.publish(
                ProtocolEvent(type=EventType.VOICE_LEVEL, monotonic_ms=timestamp, payload={})
            )
        await bus.publish(ProtocolEvent(type=EventType.VOICE_VAD, monotonic_ms=20, payload={}))
        durable = asyncio.create_task(
            bus.publish(ProtocolEvent(type=EventType.TTS_CANCELLED, monotonic_ms=21, payload={}))
        )
        await asyncio.sleep(0)
        assert durable.done() is True
        assert subscription.pending == 2
        assert subscription.dropped_lossy == 20

        await durable
        remaining = [await subscription.get(), await subscription.get()]
        assert [event.type for event in remaining] == [
            EventType.VOICE_VAD,
            EventType.TTS_CANCELLED,
        ]

    asyncio.run(scenario())


def test_16_provider_error_during_interruption_cancels_bound_work() -> None:
    manager = make_manager()
    begin_speaking(manager)
    cancellations, _ledger, _queue, coordinator = make_runtime()
    manager.on_vad(900, 0.9)

    events = manager.on_component_error(
        950,
        component="model",
        reason="provider_unavailable",
        generation_id="generation-1",
    )
    effects = coordinator.apply(events)

    assert manager.state is VoiceState.ERROR
    assert effects.cancellation_applied
    assert cancellations.get("cancel-1").is_cancelled  # type: ignore[union-attr]


def test_17_immediate_second_interruption_after_recovery() -> None:
    manager = make_manager()
    begin_speaking(manager)
    manager.on_vad(900, 0.9)
    manager.on_vad(940, 0.0)
    manager.on_time(1840)
    assert manager.state is VoiceState.SPEAKING

    manager.on_vad(1841, 0.9)
    manager.on_transcript(1850, "Actually stop", is_final=True, confidence=0.95)

    assert manager.state is VoiceState.USER_SPEAKING
    assert manager.turn_id == "candidate-turn-2"


def test_18_aggressive_balanced_conservative_policy_differences() -> None:
    aggressive = make_manager(InterruptionMode.AGGRESSIVE)
    balanced = make_manager(InterruptionMode.BALANCED)
    conservative = make_manager(InterruptionMode.CONSERVATIVE)
    for manager in (aggressive, balanced, conservative):
        begin_speaking(manager)
        manager.on_vad(900, 0.9)

    aggressive.on_transcript(950, "Wait", is_final=False, confidence=0.6)
    balanced.on_transcript(950, "Wait", is_final=False, confidence=0.6)
    conservative.on_transcript(950, "Wait", is_final=False, confidence=0.9)

    assert aggressive.state is VoiceState.USER_SPEAKING
    assert balanced.state is VoiceState.INTERRUPTION_CANDIDATE
    assert conservative.state is VoiceState.INTERRUPTION_CANDIDATE
    balanced.on_time(1080)
    assert balanced.state is VoiceState.USER_SPEAKING
    assert conservative.on_time(1187) == ()
    conservative.on_time(1188)
    assert conservative.state is VoiceState.USER_SPEAKING


def test_tts_completion_during_false_candidate_cancels_only_candidate_stt() -> None:
    manager = make_manager()
    begin_speaking(manager)
    candidate_events = manager.on_vad(900, 0.9)
    candidate_id = next(
        event.cancellation_id
        for event in candidate_events
        if event.payload.get("reason") == "possible_user_interruption"
    )
    manager.on_vad(950, 0.0)

    events = manager.on_tts_completed(960, generation_id="generation-1")

    cancelled = next(event for event in events if event.type == EventType.STT_CANCELLED)
    assert cancelled.cancellation_id == candidate_id
    assert all(event.type != EventType.TTS_CANCELLED for event in events)
    assert manager.state is VoiceState.IDLE
