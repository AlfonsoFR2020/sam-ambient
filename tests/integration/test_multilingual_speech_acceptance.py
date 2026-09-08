"""Real runtime, language selection, subprocess PCM and audio lifecycle; no hardware."""

import asyncio
import sys

from sam_ambient.adapters.audio import SoundDeviceOutput
from sam_ambient.adapters.tts.system import SystemTextToSpeech
from sam_ambient.core.protocol import EventType
from sam_ambient.core.providers import ModelEvent, ModelEventKind
from sam_ambient.core.voice.speech import SpeechVoice
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_cli import FakeProvider
from tests.unit.test_sounddevice_audio import BlockingOutputStream, FakeOutputStream

_SYNTHESIS = """
import json,sys,wave
request=json.load(sys.stdin)
assert request['voice'] in ('Spanish', 'English')
with wave.open(sys.argv[-1], 'wb') as output:
    output.setnchannels(1); output.setsampwidth(2); output.setframerate(16000)
    output.writeframes(b'\\0\\0'*640)
"""


def test_multi_turn_language_playback_recovery_stale_cancel_and_shutdown(tmp_path):
    class Provider(FakeProvider):
        def __init__(self):
            super().__init__()
            self.contexts = []

        async def stream_chat(self, messages, tools, *, model, cancellation):
            self.contexts.append(messages)
            answer = (
                "Tu fruta favorita es la naranja y lo recordaré durante nuestra conversación."
                if len(self.contexts) == 1
                else "Your favourite fruit is the orange and I remember it from our conversation."
            )
            yield ModelEvent(ModelEventKind.TEXT_DELTA, answer)
            yield ModelEvent(ModelEventKind.COMPLETED)

    async def scenario():
        tts = SystemTextToSpeech(
            (sys.executable, "-c", _SYNTHESIS), backend_id="windows-system-speech"
        )
        tts._voices = (SpeechVoice("Spanish", "es-ES"), SpeechVoice("English", "en-US"))
        streams = [FakeOutputStream(underflow=True), FakeOutputStream(), BlockingOutputStream()]
        stream_iter = iter(streams)
        output = SoundDeviceOutput(tts.audio_format, stream_factory=lambda **_: next(stream_iter))
        provider = Provider()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db"),
            tts=tts,
            audio_output=output,
        )
        subscription = await runtime.events.subscribe(max_queue=128)
        await runtime.start()
        try:
            runtime.submit_user_message("Mi fruta favorita es la naranja.")
            old_token = runtime._active_token
            await asyncio.wait_for(runtime._active_done.wait(), 3)
            assert tts.last_selection.voice.voice_id == "Spanish"
            runtime.submit_user_message("What fruit did I mention? Please answer in English.")
            await asyncio.wait_for(runtime._active_done.wait(), 3)
            assert tts.last_selection.voice.voice_id == "English"
            assert "naranja" in provider.contexts[1][1].content
            assert all(stream.stopped and not stream.aborted for stream in streams[:2])
            assert runtime._ready_event().payload["tts_selection"]["voice"]["locale"] == "en-US"
            runtime.submit_user_message("Tell me more about that fruit.")
            current_token = runtime._active_token
            assert await asyncio.to_thread(streams[2].writing.wait, 2)
            old_token.cancel("late old event")
            assert not current_token.is_cancelled
            assert not streams[2].aborted
            assert current_token.cancel("intentional interruption")
            assert not current_token.cancel("duplicate")
            await asyncio.wait_for(runtime._active_done.wait(), 3)
            assert streams[2].aborted and streams[2].closed
            seen = []
            # All producers have finished. Drain only the finite committed events.
            while True:
                event = await asyncio.wait_for(subscription.get(), 1)
                seen.append(event)
                if event.type is EventType.MODEL_CANCELLED:
                    break
            states = [e.payload.get("to") for e in seen if e.type is EventType.VOICE_STATE_CHANGED]
            assert states[:3] == ["THINKING", "SPEAKING", "IDLE"]
            assert not any(e.type is EventType.COMPONENT_ERROR for e in seen)
        finally:
            await runtime.close()
            await runtime.close()
            await subscription.close()
        assert not tts._processes
        assert not runtime._tasks

    asyncio.run(scenario())
