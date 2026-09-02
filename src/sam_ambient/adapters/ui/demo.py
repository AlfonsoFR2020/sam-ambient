"""Deterministic real-protocol producer for browser/core bridge development."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from itertools import count

from sam_ambient.adapters.ui.websocket import (
    DEFAULT_UI_BRIDGE_HOST,
    DEFAULT_UI_BRIDGE_PORT,
    WebSocketCoreBridge,
)
from sam_ambient.core.protocol import (
    CancellationTarget,
    ControlDispatcher,
    CoreControlBindings,
    EventBus,
    EventType,
    ProtocolEvent,
)


@dataclass(slots=True)
class DemoCoreControls:
    microphone_enabled: bool = True
    tts_output_enabled: bool = True
    cancellations: list[tuple[frozenset[CancellationTarget], str]] = field(default_factory=list)

    async def set_microphone_enabled(self, enabled: bool) -> None:
        self.microphone_enabled = enabled

    async def set_tts_output_enabled(self, enabled: bool) -> None:
        self.tts_output_enabled = enabled

    async def cancel_active(
        self,
        targets: frozenset[CancellationTarget],
        reason: str,
    ) -> None:
        self.cancellations.append((targets, reason))


def demo_events(session_id: str = "bridge-demo") -> tuple[ProtocolEvent, ...]:
    def event(
        event_type: str,
        at_ms: int,
        payload: dict[str, object],
        *,
        turn_id: str | None = None,
        generation_id: str | None = None,
    ) -> ProtocolEvent:
        return ProtocolEvent(
            type=event_type,
            monotonic_ms=at_ms,
            session_id=session_id,
            turn_id=turn_id,
            generation_id=generation_id,
            payload=payload,
        )

    return (
        event(EventType.VOICE_STATE_CHANGED, 400, {"from": "IDLE", "to": "LISTENING"}),
        event(
            EventType.VOICE_LEVEL,
            700,
            {"rms": 0.18, "peak": 0.31, "speech_probability": 0.12},
        ),
        event(
            EventType.VOICE_STATE_CHANGED,
            1_000,
            {"from": "LISTENING", "to": "USER_SPEAKING"},
            turn_id="bridge-turn-1",
        ),
        event(
            EventType.TRANSCRIPT_PARTIAL,
            1_250,
            {"role": "user", "text": "Show me the live bridge"},
            turn_id="bridge-turn-1",
        ),
        event(
            EventType.TRANSCRIPT_FINAL,
            1_650,
            {"role": "user", "text": "Show me the live bridge."},
            turn_id="bridge-turn-1",
        ),
        event(
            EventType.VOICE_STATE_CHANGED,
            1_700,
            {"from": "ENDPOINT_CANDIDATE", "to": "THINKING"},
            turn_id="bridge-turn-1",
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.MODEL_DELTA,
            2_050,
            {"role": "assistant", "text": "The Python core "},
            turn_id="bridge-turn-1",
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.MODEL_DELTA,
            2_250,
            {"role": "assistant", "text": "is connected."},
            turn_id="bridge-turn-1",
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.TRANSCRIPT_FINAL,
            2_450,
            {"role": "assistant", "text": "The Python core is connected."},
            turn_id="bridge-turn-1",
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.VOICE_STATE_CHANGED,
            2_500,
            {"from": "THINKING", "to": "SPEAKING"},
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.TTS_LEVEL,
            2_700,
            {"envelope": 0.42},
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.TTS_LEVEL,
            2_900,
            {"envelope": 0.78},
            generation_id="bridge-generation-1",
        ),
        event(
            EventType.TTS_COMPLETED,
            3_250,
            {"spoken_text": "The Python core is connected."},
            generation_id="bridge-generation-1",
        ),
        event(EventType.VOICE_STATE_CHANGED, 3_300, {"from": "SPEAKING", "to": "IDLE"}),
    )


async def run_demo_bridge(port: int = DEFAULT_UI_BRIDGE_PORT) -> None:
    events = EventBus()
    controls = DemoCoreControls()
    dispatcher = ControlDispatcher(
        CoreControlBindings(
            set_microphone_enabled=controls.set_microphone_enabled,
            set_tts_output_enabled=controls.set_tts_output_enabled,
            cancel_active=controls.cancel_active,
        )
    )
    ready_clock = count(start=time.monotonic_ns() // 1_000_000)
    bridge = WebSocketCoreBridge(
        events,
        dispatcher,
        host=DEFAULT_UI_BRIDGE_HOST,
        port=port,
        ready_event=lambda: ProtocolEvent(
            type=EventType.SYSTEM_READY,
            monotonic_ms=next(ready_clock),
            session_id="bridge-demo",
            payload={
                "state": "IDLE",
                "microphone_enabled": controls.microphone_enabled,
                "tts_output_enabled": controls.tts_output_enabled,
            },
        ),
    )
    await bridge.start()
    print(f"Sam core bridge demo listening on ws://{bridge.host}:{bridge.port}")

    async def publish_demo() -> None:
        await bridge.connected.wait()
        previous_ms = 0
        for event in demo_events():
            await asyncio.sleep((event.monotonic_ms - previous_ms) / 1_000)
            await events.publish(event)
            previous_ms = event.monotonic_ms

    publisher = asyncio.create_task(publish_demo())
    try:
        await bridge.serve_forever()
    finally:
        publisher.cancel()
        await asyncio.gather(publisher, return_exceptions=True)
        await bridge.close()
        await events.close()
