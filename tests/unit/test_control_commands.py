import asyncio

import pytest

from sam_ambient.core.protocol import (
    CancellationTarget,
    ControlCommand,
    ControlCommandType,
    ControlDispatcher,
    CoreControlBindings,
    EventType,
    ProtocolError,
)


class RecordingBindings:
    def __init__(self) -> None:
        self.microphone: list[bool] = []
        self.tts_output: list[bool] = []
        self.cancellations: list[tuple[frozenset[CancellationTarget], str]] = []

    async def set_microphone(self, enabled: bool) -> None:
        self.microphone.append(enabled)

    async def set_tts_output(self, enabled: bool) -> None:
        self.tts_output.append(enabled)

    async def cancel(
        self,
        targets: frozenset[CancellationTarget],
        reason: str,
    ) -> None:
        self.cancellations.append((targets, reason))


def command(
    command_type: ControlCommandType,
    command_id: str,
    payload: dict[str, object] | None = None,
) -> ControlCommand:
    return ControlCommand(
        type=command_type,
        command_id=command_id,
        monotonic_ms=10,
        session_id="session",
        payload=payload or {},
    )


def test_control_command_round_trip_and_version_rejection() -> None:
    original = command(ControlCommandType.MICROPHONE_SET, "command-1", {"enabled": False})
    assert ControlCommand.from_json(original.to_json()) == original
    invalid = original.to_dict()
    invalid["protocol"] = 2
    with pytest.raises(ProtocolError, match="unsupported protocol"):
        ControlCommand.from_dict(invalid)


def test_dispatcher_applies_controls_and_deduplicates_emergency_stop() -> None:
    async def scenario() -> None:
        recording = RecordingBindings()
        dispatcher = ControlDispatcher(
            CoreControlBindings(
                set_microphone_enabled=recording.set_microphone,
                set_tts_output_enabled=recording.set_tts_output,
                cancel_active=recording.cancel,
            ),
            clock_ms=lambda: 50,
        )
        mic_event = await dispatcher.dispatch(
            command(ControlCommandType.MICROPHONE_SET, "mic", {"enabled": False})
        )
        emergency = command(ControlCommandType.EMERGENCY_STOP, "stop")
        first = await dispatcher.dispatch(emergency)
        duplicate = await dispatcher.dispatch(emergency)

        assert recording.microphone == [False]
        assert mic_event.type == EventType.CONTROL_ACKNOWLEDGED
        assert mic_event.payload["microphone_enabled"] is False
        assert first is duplicate
        assert recording.cancellations == [
            (
                frozenset(
                    {
                        CancellationTarget.MODEL_GENERATION,
                        CancellationTarget.TTS_QUEUE,
                        CancellationTarget.PLAYBACK,
                    }
                ),
                "ui_emergency_stop",
            )
        ]

    asyncio.run(scenario())


def test_dispatcher_rejects_invalid_toggle_without_calling_adapter() -> None:
    async def scenario() -> None:
        recording = RecordingBindings()
        dispatcher = ControlDispatcher(
            CoreControlBindings(
                set_microphone_enabled=recording.set_microphone,
                set_tts_output_enabled=recording.set_tts_output,
                cancel_active=recording.cancel,
            ),
            clock_ms=lambda: 50,
        )
        rejected = await dispatcher.dispatch(
            command(ControlCommandType.TTS_OUTPUT_SET, "bad", {"enabled": "no"})
        )
        assert rejected.type == EventType.CONTROL_REJECTED
        assert recording.tts_output == []

    asyncio.run(scenario())
