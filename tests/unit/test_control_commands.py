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
        self.messages: list[str] = []
        self.approvals: list[tuple[str, bool]] = []
        self.revocations: list[str] = []

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

    async def submit(self, text: str, _command: ControlCommand) -> None:
        self.messages.append(text)

    async def resolve_approval(self, command: ControlCommand, approved: bool) -> bool:
        if command.tool_call_id != "pending-tool":
            return False
        self.approvals.append((command.tool_call_id, approved))
        return True

    async def revoke_capabilities(self, reason: str) -> dict[str, object]:
        self.revocations.append(reason)
        return {
            "capability_authority_active": False,
            "capability_authority_epoch": 1,
        }


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


def test_dispatcher_routes_text_exact_approval_and_global_revocation() -> None:
    async def scenario() -> None:
        recording = RecordingBindings()
        dispatcher = ControlDispatcher(
            CoreControlBindings(
                set_microphone_enabled=recording.set_microphone,
                set_tts_output_enabled=recording.set_tts_output,
                cancel_active=recording.cancel,
                submit_user_message=recording.submit,
                resolve_tool_approval=recording.resolve_approval,
                revoke_capabilities=recording.revoke_capabilities,
            ),
            clock_ms=lambda: 50,
        )
        submitted = await dispatcher.dispatch(
            command(ControlCommandType.USER_MESSAGE_SUBMIT, "message", {"text": "  hello  "})
        )
        approval = ControlCommand(
            type=ControlCommandType.TOOL_APPROVE,
            command_id="approval",
            monotonic_ms=10,
            session_id="session",
            generation_id="generation",
            tool_call_id="pending-tool",
        )
        approved = await dispatcher.dispatch(approval)
        revoked = await dispatcher.dispatch(
            command(ControlCommandType.CAPABILITIES_REVOKE_ALL, "revoke")
        )

        assert submitted.type == EventType.CONTROL_ACKNOWLEDGED
        assert recording.messages == ["hello"]
        assert approved.type == EventType.CONTROL_ACKNOWLEDGED
        assert approved.tool_call_id == "pending-tool"
        assert recording.approvals == [("pending-tool", True)]
        assert revoked.type == EventType.CONTROL_ACKNOWLEDGED
        assert revoked.payload["capability_authority_active"] is False
        assert recording.revocations == ["ui_global_capability_revoke"]

    asyncio.run(scenario())


def test_global_revocation_rejects_payload_and_mismatched_approval() -> None:
    async def scenario() -> None:
        recording = RecordingBindings()
        dispatcher = ControlDispatcher(
            CoreControlBindings(
                recording.set_microphone,
                recording.set_tts_output,
                recording.cancel,
                resolve_tool_approval=recording.resolve_approval,
                revoke_capabilities=recording.revoke_capabilities,
            )
        )
        bad_revoke = await dispatcher.dispatch(
            command(
                ControlCommandType.CAPABILITIES_REVOKE_ALL,
                "bad-revoke",
                {"restore": True},
            )
        )
        wrong_approval = await dispatcher.dispatch(
            ControlCommand(
                type=ControlCommandType.TOOL_APPROVE,
                command_id="wrong-approval",
                monotonic_ms=10,
                session_id="session",
                tool_call_id="not-pending",
            )
        )

        assert bad_revoke.type == EventType.CONTROL_REJECTED
        assert wrong_approval.type == EventType.CONTROL_REJECTED
        assert recording.revocations == []
        assert recording.approvals == []

    asyncio.run(scenario())
