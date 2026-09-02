"""Authoritative handling for versioned UI control commands."""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum

from sam_ambient.core.protocol.models import (
    ControlCommand,
    ControlCommandType,
    EventType,
    ProtocolEvent,
)


class CancellationTarget(StrEnum):
    MODEL_GENERATION = "model_generation"
    TTS_QUEUE = "tts_queue"
    PLAYBACK = "playback"


SetEnabled = Callable[[bool], Awaitable[None]]
CancelActive = Callable[[frozenset[CancellationTarget], str], Awaitable[None]]
SubmitUserMessage = Callable[[str, ControlCommand], Awaitable[None]]
ResolveToolApproval = Callable[[ControlCommand, bool], Awaitable[bool]]
RevokeCapabilities = Callable[[str], Awaitable[Mapping[str, object]]]


@dataclass(frozen=True, slots=True)
class CoreControlBindings:
    set_microphone_enabled: SetEnabled
    set_tts_output_enabled: SetEnabled
    cancel_active: CancelActive
    submit_user_message: SubmitUserMessage | None = None
    resolve_tool_approval: ResolveToolApproval | None = None
    revoke_capabilities: RevokeCapabilities | None = None


class ControlDispatcher:
    """Validate, deduplicate, and apply UI requests inside the core boundary."""

    def __init__(
        self,
        bindings: CoreControlBindings,
        *,
        max_history: int = 256,
        clock_ms: Callable[[], int] | None = None,
    ) -> None:
        if max_history < 1:
            raise ValueError("max_history must be positive")
        self._bindings = bindings
        self._max_history = max_history
        self._clock_ms = clock_ms or (lambda: time.monotonic_ns() // 1_000_000)
        self._history: OrderedDict[str, ProtocolEvent] = OrderedDict()
        self._lock = asyncio.Lock()
        self.microphone_enabled = True
        self.tts_output_enabled = True

    async def dispatch(self, command: ControlCommand) -> ProtocolEvent:
        async with self._lock:
            prior = self._history.get(command.command_id)
            if prior is not None:
                return prior
            try:
                event = await self._apply(command)
            except Exception as error:
                event = self._event(
                    EventType.CONTROL_REJECTED,
                    command,
                    {"error": str(error), "status": "rejected"},
                )
            self._history[command.command_id] = event
            while len(self._history) > self._max_history:
                self._history.popitem(last=False)
            return event

    async def _apply(self, command: ControlCommand) -> ProtocolEvent:
        command_type = ControlCommandType(command.type)
        payload: dict[str, object] = {"status": "applied"}
        if command_type is ControlCommandType.MICROPHONE_SET:
            enabled = self._required_bool(command, "enabled")
            await self._bindings.set_microphone_enabled(enabled)
            self.microphone_enabled = enabled
            payload["microphone_enabled"] = enabled
        elif command_type is ControlCommandType.TTS_OUTPUT_SET:
            enabled = self._required_bool(command, "enabled")
            await self._bindings.set_tts_output_enabled(enabled)
            self.tts_output_enabled = enabled
            payload["tts_output_enabled"] = enabled
        elif command_type is ControlCommandType.STOP_SPEAKING:
            targets = frozenset({CancellationTarget.TTS_QUEUE, CancellationTarget.PLAYBACK})
            await self._bindings.cancel_active(targets, "ui_stop_speaking")
            payload["requested_targets"] = sorted(target.value for target in targets)
        elif command_type is ControlCommandType.EMERGENCY_STOP:
            targets = frozenset(CancellationTarget)
            await self._bindings.cancel_active(targets, "ui_emergency_stop")
            payload["requested_targets"] = sorted(target.value for target in targets)
        elif command_type is ControlCommandType.USER_MESSAGE_SUBMIT:
            text = command.payload.get("text")
            if not isinstance(text, str) or not text.strip():
                raise ValueError("user message requires non-blank payload.text")
            if len(text) > 4_000:
                raise ValueError("user message exceeds 4000 characters")
            if self._bindings.submit_user_message is None:
                raise RuntimeError("user message submission is unavailable")
            await self._bindings.submit_user_message(text.strip(), command)
        elif command_type in {ControlCommandType.TOOL_APPROVE, ControlCommandType.TOOL_DENY}:
            if not command.tool_call_id:
                raise ValueError("tool approval requires tool_call_id")
            if self._bindings.resolve_tool_approval is None:
                raise RuntimeError("tool approval is unavailable")
            approved = command_type is ControlCommandType.TOOL_APPROVE
            if not await self._bindings.resolve_tool_approval(command, approved):
                raise ValueError("tool approval is not pending")
            payload["approved"] = approved
        elif command_type is ControlCommandType.CAPABILITIES_REVOKE_ALL:
            if command.payload:
                raise ValueError("global capability revocation does not accept model data")
            if self._bindings.revoke_capabilities is None:
                raise RuntimeError("global capability revocation is unavailable")
            payload.update(await self._bindings.revoke_capabilities("ui_global_capability_revoke"))
        return self._event(EventType.CONTROL_ACKNOWLEDGED, command, payload)

    def _event(
        self,
        event_type: EventType,
        command: ControlCommand,
        payload: dict[str, object],
    ) -> ProtocolEvent:
        return ProtocolEvent(
            type=event_type,
            monotonic_ms=self._clock_ms(),
            session_id=command.session_id,
            turn_id=command.turn_id,
            generation_id=command.generation_id,
            cancellation_id=command.cancellation_id,
            tool_call_id=command.tool_call_id,
            payload={
                "command_id": command.command_id,
                "command_type": command.type,
                **payload,
            },
        )

    @staticmethod
    def _required_bool(command: ControlCommand, name: str) -> bool:
        value = command.payload.get(name)
        if not isinstance(value, bool):
            raise ValueError(f"{command.type} requires boolean payload.{name}")
        return value
