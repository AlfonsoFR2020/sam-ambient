from collections.abc import Iterator

from sam_ambient.core.protocol import EventType
from sam_ambient.core.turns import InterruptionMode, TurnConfig, TurnManager, VoiceState


def make_manager(config: TurnConfig | None = None) -> TurnManager:
    ids: Iterator[str] = iter(
        [
            "generated-turn-1",
            "generated-cancel-1",
            "generated-turn-2",
            "generated-cancel-2",
        ]
    )
    return TurnManager("session-1", config=config, id_factory=lambda: next(ids))


def begin_turn(manager: TurnManager) -> None:
    manager.start_listening(0, turn_id="turn-1", cancellation_id="cancel-1")


def begin_agent_speech(manager: TurnManager) -> None:
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "Tell me something.", is_final=True, confidence=0.95)
    manager.on_vad(500, 0.0)
    manager.on_time(850)
    manager.on_model_started(851, generation_id="generation-1", cancellation_id="cancel-1")
    manager.on_tts_started(852)
    assert manager.state is VoiceState.SPEAKING


def test_normal_sentence_commits_after_complete_sentence_silence() -> None:
    manager = make_manager()
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "What time is it?", is_final=True, confidence=0.95)
    manager.on_vad(500, 0.0)

    assert manager.on_time(849) == ()
    events = manager.on_time(850)

    assert manager.state is VoiceState.COMMITTING
    committed = next(event for event in events if event.type == EventType.TURN_COMMITTED)
    assert committed.payload["text"] == "What time is it?"
    assert committed.cancellation_id == "cancel-1"


def test_pause_mid_sentence_does_not_commit_and_speech_can_resume() -> None:
    manager = make_manager()
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    manager.on_transcript(250, "Could you tell me", is_final=False, confidence=0.8)
    manager.on_vad(400, 0.0)

    assert manager.on_time(900) == ()
    assert manager.state is VoiceState.ENDPOINT_CANDIDATE
    manager.on_vad(950, 0.9)
    manager.on_transcript(1050, "Could you tell me the time?", is_final=True, confidence=0.95)
    manager.on_vad(1200, 0.0)
    events = manager.on_time(1550)

    assert (
        next(event for event in events if event.type == EventType.TURN_COMMITTED).payload["text"]
        == "Could you tell me the time?"
    )


def test_sustained_user_speech_interrupts_and_changes_turn_identity() -> None:
    manager = make_manager()
    begin_agent_speech(manager)
    manager.on_vad(900, 0.9)

    events = manager.on_time(1080)

    assert manager.state is VoiceState.USER_SPEAKING
    assert manager.turn_id == "generated-turn-1"
    assert manager.cancellation_id == "generated-cancel-1"
    cancelled = next(event for event in events if event.type == EventType.TTS_CANCELLED)
    assert cancelled.turn_id == "turn-1"
    assert cancelled.generation_id == "generation-1"
    assert cancelled.cancellation_id == "cancel-1"


def test_interruption_mode_changes_confirmation_threshold() -> None:
    aggressive = make_manager(TurnConfig(interruption_mode=InterruptionMode.AGGRESSIVE))
    begin_agent_speech(aggressive)
    aggressive.on_vad(900, 0.9)
    assert aggressive.on_time(1007) == ()
    aggressive.on_time(1008)
    assert aggressive.state is VoiceState.USER_SPEAKING

    conservative = make_manager(TurnConfig(interruption_mode=InterruptionMode.CONSERVATIVE))
    begin_agent_speech(conservative)
    conservative.on_vad(900, 0.9)
    assert conservative.on_time(1187) == ()
    conservative.on_time(1188)
    assert conservative.state is VoiceState.USER_SPEAKING


def test_credible_transcript_confirms_interruption_before_duration_threshold() -> None:
    manager = make_manager()
    begin_agent_speech(manager)
    manager.on_vad(900, 0.9)

    events = manager.on_transcript(950, "Stop please", is_final=False, confidence=0.9)

    assert manager.state is VoiceState.USER_SPEAKING
    assert any(event.type == EventType.TTS_CANCELLED for event in events)
    assert manager.transcript == "Stop please"


def test_cough_during_agent_speech_recovers_without_cancelling() -> None:
    manager = make_manager()
    begin_agent_speech(manager)
    manager.on_vad(900, 0.9)
    events = manager.on_vad(960, 0.0)
    assert manager.state is VoiceState.RECOVERING
    assert all(event.type != EventType.TTS_CANCELLED for event in events)

    assert manager.on_time(1859) == ()
    events = manager.on_time(1860)
    assert manager.state is VoiceState.SPEAKING
    assert all(event.type != EventType.TTS_CANCELLED for event in events)


def test_short_low_confidence_backchannel_does_not_interrupt() -> None:
    manager = make_manager()
    begin_agent_speech(manager)
    manager.on_vad(900, 0.9)
    manager.on_transcript(940, "mm-hm", is_final=True, confidence=0.4)
    manager.on_vad(1000, 0.0)
    events = manager.on_time(1900)

    assert manager.state is VoiceState.SPEAKING
    assert all(event.type != EventType.TTS_CANCELLED for event in events)


def test_echo_spike_does_not_interrupt() -> None:
    manager = make_manager()
    begin_agent_speech(manager)
    manager.on_vad(900, 0.99)
    manager.on_vad(925, 0.0)
    manager.on_time(1825)

    assert manager.state is VoiceState.SPEAKING


def test_user_resumes_after_false_endpoint() -> None:
    manager = make_manager()
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    manager.on_transcript(300, "I was thinking", is_final=False, confidence=0.8)
    manager.on_vad(400, 0.0)
    manager.on_vad(800, 0.9)

    assert manager.state is VoiceState.USER_SPEAKING


def test_noise_shorter_than_minimum_speech_is_not_an_endpoint() -> None:
    manager = make_manager()
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    events = manager.on_vad(279, 0.0)

    assert manager.state is VoiceState.LISTENING
    assert any(event.payload.get("reason") == "speech_too_short" for event in events)


def test_stt_partial_revision_commits_only_latest_final_text() -> None:
    manager = make_manager()
    begin_turn(manager)
    manager.on_vad(100, 0.9)
    manager.on_transcript(200, "open the read me", is_final=False, confidence=0.65)
    manager.on_transcript(300, "Open the README.", is_final=True, confidence=0.96)
    manager.on_vad(500, 0.0)
    events = manager.on_time(850)

    committed = next(event for event in events if event.type == EventType.TURN_COMMITTED)
    assert committed.payload["text"] == "Open the README."


def test_audio_device_loss_enters_offline_and_can_recover() -> None:
    manager = make_manager()
    begin_turn(manager)

    events = manager.on_audio_lost(100)
    assert manager.state is VoiceState.OFFLINE
    assert events[0].type == EventType.COMPONENT_ERROR
    manager.on_audio_restored(200)
    assert manager.state is VoiceState.IDLE


def test_timestamps_must_be_monotonic() -> None:
    manager = make_manager()
    begin_turn(manager)

    try:
        manager.on_time(0)
        manager.on_time(1)
        manager.on_time(0)
    except ValueError as error:
        assert "monotonic" in str(error)
    else:
        raise AssertionError("non-monotonic timestamp was accepted")
