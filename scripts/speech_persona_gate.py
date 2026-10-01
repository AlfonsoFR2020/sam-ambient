"""Actual installed TTS → runtime health/PCM meters; output device discards audio.

python -m scripts.speech_persona_gate
Writes only non-personal protocol measurements to ignored .sam, never PCM.
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path

from sam_ambient.adapters.audio import SoundDeviceOutput
from sam_ambient.adapters.tts.system import SystemTextToSpeech
from sam_ambient.core.protocol import EventType
from sam_ambient.core.providers import ModelEvent, ModelEventKind
from sam_ambient.core.turns import CancellationToken
from sam_ambient.core.voice.pipeline import normalized_audio_metrics
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_cli import FakeProvider
from tests.unit.test_sounddevice_audio import FakeOutputStream

ANSWERS = (
    "The next step is simple. Please take a moment before we continue.",
    "El siguiente paso es sencillo. Espera un momento antes de continuar.",
    "Please explain the next step in plain language before we continue.",
    "Por favor, explica el siguiente paso con palabras sencillas antes de continuar.",
)


class Provider(FakeProvider):
    def __init__(self):
        super().__init__()
        self.index = 0

    async def stream_chat(self, messages, tools, *, model, cancellation):
        answer = ANSWERS[self.index]
        self.index += 1
        yield ModelEvent(ModelEventKind.TEXT_DELTA, answer)
        yield ModelEvent(ModelEventKind.COMPLETED)


class PacedDiscard(FakeOutputStream):
    def write(self, data):
        time.sleep(len(data) / 32000)
        # Keep resource flags, but do not retain or play the waveform.
        return False


async def run(root):
    tts, records = SystemTextToSpeech(), []
    runtime = SamRuntime(
        Provider(),
        RuntimeConfig(root, port=0, state_db=root / "state.db", memory_db=root / "memory.db"),
        tts=tts,
        audio_output=SoundDeviceOutput(tts.audio_format, stream_factory=lambda **_: PacedDiscard()),
    )
    subscription = await runtime.events.subscribe(max_queue=1024)

    async def collect():
        async for event in subscription:
            records.append(event)

    collector = asyncio.create_task(collect())
    try:
        await runtime.start()
        for text in ANSWERS:
            runtime.submit_user_message(text)
            await asyncio.wait_for(runtime._active_done.wait(), 30)
        assert len(runtime.state.recent(limit=8)) == 8
        selections = [
            event
            for event in records
            if event.type is EventType.COMPONENT_HEALTH and "tts_selection" in event.payload
        ]
        assert [event.payload["tts_selection"]["requested_language"] for event in selections] == [
            "en",
            "es",
            "en",
            "es",
        ]
        assert {event.payload["tts_selection"]["voice"]["gender"] for event in selections} == {
            "female"
        }
        assert (
            runtime._ready_event().payload["tts_selection"]
            == selections[-1].payload["tts_selection"]
        )
    finally:
        await runtime.close()
        await subscription.close()
        await collector
    assert not runtime._tasks and not tts._processes
    fallback = SystemTextToSpeech()
    peak = 0.0
    try:
        async for frame in fallback.synthesize(
            "Sam está listo para continuar.",
            voice="missing-installed-voice",
            language="es",
            cancellation=CancellationToken(),
        ):
            peak = max(peak, normalized_audio_metrics(frame)[1])
        assert peak > 0
        assert fallback.last_selection.voice.locale == "es-ES"
    finally:
        await fallback.aclose()
    levels = [event for event in records if event.type is EventType.TTS_LEVEL]
    summary = {
        "selections": [event.payload["tts_selection"] for event in selections],
        "meters": len(levels),
        "peak_envelope": max(event.payload["envelope"] for event in levels),
        "fallback": fallback.last_selection.voice.voice_id,
        "closed": True,
        "physical_output": False,
    }
    await asyncio.to_thread(
        Path(".sam/speech-persona-events.json").write_text,
        json.dumps([event.to_dict() for event in records]),
        encoding="utf-8",
    )
    await asyncio.to_thread(
        Path(".sam/speech-persona-summary.json").write_text,
        json.dumps(summary, indent=2),
        encoding="utf-8",
    )
    return summary


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="sam-persona-") as directory:
        print(json.dumps(asyncio.run(run(Path(directory)))))
