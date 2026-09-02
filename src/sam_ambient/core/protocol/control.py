"""Authoritative handling for versioned UI control commands."""

from __future__ import annotations

import asyncio
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable
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


@dataclass(frozen=True, slots=True)
class CoreControlBindings:
    set_microphone_enabled: SetEnabled
    set_tts_output_enabled: SetEnabled
    cancel_active: CancelActive


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
