"""One composed owner/provider/voice/speech/state/cleanup scenario; no hardware."""

import asyncio
import json
import math
import struct
import time
from pathlib import Path
from unittest.mock import patch

from websockets.asyncio.client import connect

from sam_ambient.adapters.audio import SoundDeviceOutput
from sam_ambient.adapters.local_discovery import (
    CleanupPolicy,
    Discovery,
    LifecycleIntent,
    LocalService,
    cleanup_discoveries,
)
from sam_ambient.adapters.stt.whisper_cpp import SpeechRecognitionUnavailable
from sam_ambient.adapters.ui import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.core.owner import OwnerSession
from sam_ambient.core.protocol import ControlCommand, ControlCommandType, EventType
from sam_ambient.core.voice import AudioFormat, AudioFrame, Transcript, VadResult
from sam_ambient.core.voice.speech import SpeechVoice, select_voice
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.fixtures.owner import authenticate_owner
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_sounddevice_audio import FakeOutputStream


class Capture:
    def __init__(self):
        self.utterances = asyncio.Queue()

    async def frames(self, cancellation):
        # A real capture stream also produces silent frames. Blocking until an
        # entire utterance exists would falsely strand the delivery monitor.
        sequence, remaining = 0, 0
        while True:
            cancellation.raise_if_cancelled()
            await asyncio.sleep(0.02)
            if not remaining and not self.utterances.empty():
                self.utterances.get_nowait()
                remaining = 20
            level = 1600 if remaining else 0
            yield AudioFrame(
                AudioFormat(),
                struct.pack("<h", level) * 320,
                time.monotonic_ns() // 1_000_000,
                sequence,
            )
            remaining = max(0, remaining - 1)
            sequence += 1


class Vad:
    def analyze(self, frame):
        speaking = frame.data != b"\0" * len(frame.data)
        return VadResult(speaking, 1.0 if speaking else 0.0)


class Stt:
    def __init__(self):
        self.fail = False
        self.contexts = []
        self.closed = False

    async def start_stream(self, context, cancellation):
        self.contexts.append(context)
        fail = self.fail

        class Stream:
            async def push_audio(self, frame, token):
                token.raise_if_cancelled()

            async def partial_transcript(self):
                return Transcript("Synthetic voice", False, 0.99)

            async def finalize(self, token):
                token.raise_if_cancelled()
                if fail:
                    raise SpeechRecognitionUnavailable("synthetic recognizer unavailable")
                return Transcript("Synthetic voice request.", True, 0.99)

            async def cancel(self, cancellation_id, reason="cancelled"):
                return (
                    cancellation.cancel(reason)
                    if cancellation_id == context.cancellation_id
                    else False
                )

        return Stream()

    async def aclose(self):
        self.closed = True


class Speech:
    audio_format = AudioFormat()
    backend_id = "synthetic-local-speech"
    last_selection = None
    closed = False

    async def synthesize(self, text, *, voice, language, cancellation):
        voices = (
            SpeechVoice("English", "en-US", "female"),
            SpeechVoice("Spanish", "es-ES", "female"),
        )
        self.last_selection = select_voice(voices, language, voice, voices[0])
        pcm = b"".join(struct.pack("<h", int(5000 * math.sin(index * 0.2))) for index in range(320))
        for sequence in range(8):
            cancellation.raise_if_cancelled()
            yield AudioFrame(self.audio_format, pcm, time.monotonic_ns() // 1_000_000, sequence)

    async def aclose(self):
        self.closed = True


async def core_experience_scenario(root: Path, language="es"):
    provider = ConversationProvider()
    capture, stt, speech = Capture(), Stt(), Speech()
    output_streams = []

    def output_factory(**_options):
        stream = FakeOutputStream()
        output_streams.append(stream)
        return stream

    service = LocalService(
        "lm-studio",
        "http://127.0.0.1:1234/v1",
        "lms",
        True,
        ["chat"],
        started_by_sam=True,
        models_loaded_by_sam=["chat"],
    )
    snapshots = [Discovery([service], service, "chat", "synthetic bootstrap")]

    async def refresh(_provider, _model):
        service.models = ["chat"]
        service.models_loaded_by_sam = ["chat"]
        return ProviderRefresh(
            provider,
            "chat",
            "confirmed fixture route",
            (
                {
                    "id": provider.id,
                    "running": True,
                    "models": ["chat"],
                    "installed_models": ["chat"],
                    "detail": "ready",
                },
            ),
        )

    async def unload(_provider, _model):
        assert _provider == provider.id and _model == "chat"
        service.models.clear()
        service.models_loaded_by_sam.clear()
        return ProviderRefresh(
            None,
            None,
            "confirmed owner unload",
            (
                {
                    "id": provider.id,
                    "running": True,
                    "models": [],
                    "installed_models": ["chat"],
                    "detail": "ready",
                },
            ),
        )

    owner = OwnerSession()
    runtime = SamRuntime(
        provider,
        RuntimeConfig(
            root,
            port=0,
            model="chat",
            language=language,
            state_db=root / "state.db",
            memory_db=root / "memory.db",
            stt_status=f"synthetic ready; {language}",
        ),
        voice=RuntimeVoiceAdapters(capture, Vad(), stt),
        tts=speech,
        audio_output=SoundDeviceOutput(AudioFormat(), stream_factory=output_factory),
        provider_refresher=refresh,
        provider_unloader=unload,
        owner_session=owner,
    )
    records = []
    subscription = await runtime.events.subscribe(max_queue=1024)

    async def collect():
        async for event in subscription:
            records.append(event)

    collector = asyncio.create_task(collect())

    async def until(predicate):
        async with asyncio.timeout(8):
            while not predicate():  # noqa: ASYNC110 -- bounded observation of several independent owners
                await asyncio.sleep(0.01)

    try:
        await runtime.start()
        assert runtime.memory is not None
        async with connect(
            f"ws://127.0.0.1:{runtime.bridge.port}",
            origin="http://127.0.0.1:8766",
            subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            proxy=None,
        ) as socket:
            await authenticate_owner(socket, owner)
            ready = json.loads(await socket.recv())
            assert ready["type"] == "system.ready"
            records.insert(0, runtime._ready_event())

            async def send(kind, command_id, payload=None):
                await socket.send(
                    ControlCommand(
                        type=kind,
                        command_id=command_id,
                        monotonic_ms=time.monotonic_ns() // 1_000_000,
                        session_id=runtime.session_id,
                        payload=payload or {},
                    ).to_json()
                )

            await until(lambda: runtime.voice_turns.state.value == "LISTENING")
            await send(
                ControlCommandType.RECOGNITION_LANGUAGE_SET,
                "recognition-initial",
                {"language": language},
            )
            await until(lambda: runtime.config.language == language)

            await send(
                ControlCommandType.USER_MESSAGE_SUBMIT,
                "typed-one",
                {"text": "Typed first request."},
            )
            await until(lambda: len(provider.contexts) == 1 and runtime._active_done.is_set())
            await until(
                lambda: (
                    runtime._voice_ordinary_capture_enabled.is_set()
                    and runtime.voice_turns.state.value == "LISTENING"
                )
            )
            capture.utterances.put_nowait(True)
            await until(lambda: len(provider.contexts) == 2 and runtime._active_done.is_set())
            assert stt.contexts and all(context.language == language for context in stt.contexts)
            assert any(event.type is EventType.TURN_COMMITTED for event in records)
            assert any(
                event.type is EventType.TTS_LEVEL and event.payload["envelope"] > 0.05
                for event in records
            )
            assert runtime.state.recent(limit=4)[-2].content == "Synthetic voice request."

            await until(lambda: runtime.voice_turns.state.value == "LISTENING")
            other_language = "en" if language == "es" else "es"
            old_listen = runtime._voice_listen_token
            await send(
                ControlCommandType.RECOGNITION_LANGUAGE_SET,
                "recognition-switch",
                {"language": other_language},
            )
            await until(
                lambda: (
                    runtime.config.language == other_language
                    and runtime._voice_listen_token is not old_listen
                    and runtime.voice_turns.state.value == "LISTENING"
                )
            )
            capture.utterances.put_nowait(True)
            await until(lambda: len(provider.contexts) == 3 and runtime._active_done.is_set())
            assert stt.contexts[-1].language == other_language

            stt.fail = True
            await until(
                lambda: (
                    runtime.voice_turns.state.value == "LISTENING"
                    and runtime._voice_ordinary_capture_enabled.is_set()
                )
            )
            capture.utterances.put_nowait(True)
            await until(
                lambda: any(
                    event.type is EventType.COMPONENT_HEALTH
                    and event.payload.get("component") == "stt"
                    and event.payload.get("state") == "degraded"
                    for event in records
                )
            )
            await send(ControlCommandType.MICROPHONE_SET, "retire-voice", {"enabled": False})
            await send(
                ControlCommandType.USER_MESSAGE_SUBMIT,
                "typed-recovery",
                {"text": "Typed recovery request."},
            )
            await until(lambda: len(provider.contexts) == 4 and runtime._active_done.is_set())
            await send(ControlCommandType.PROVIDERS_RESCAN, "rescan-core")
            await until(
                lambda: any(
                    event.type == "provider.discovery" and event.payload.get("state") == "ready"
                    for event in records
                )
            )
            assert runtime._model == "chat"
            assert [item.role for item in runtime.state.recent(limit=8)] == [
                "user",
                "assistant",
            ] * 4
            await send(
                ControlCommandType.MODEL_UNLOAD,
                "explicit-unload",
                {"provider": provider.id, "model": "chat"},
            )
            await until(lambda: runtime._provider_phase == "unloaded")
            assert runtime._model is None and runtime._desired_model == "chat"
            await send(
                ControlCommandType.MODEL_SELECT,
                "exact-reload",
                {"provider": provider.id, "model": "chat", "remember": False},
            )
            await until(lambda: runtime._model == "chat" and not runtime._provider_scan_active)
            assert runtime.memory is not None
            await send(ControlCommandType.APPLICATION_QUIT, "quit-core")
            await until(runtime.shutdown_requested.is_set)
    finally:
        await runtime.close()
        await runtime.close()
        await subscription.close()
        await collector
    assert stt.closed and speech.closed and all(stream.closed for stream in output_streams)
    assert not runtime.owner_actions.owner.active
    assert not runtime._tasks
    commands = []

    async def command(argv, **_options):
        commands.append(argv[1:])
        service.models.clear()

    async def probe(item):
        item.running = True
        item.models = service.models.copy()

    async def status(*_args):
        return {"running": False}

    with (
        patch("sam_ambient.adapters.local_discovery._local_command", command),
        patch("sam_ambient.adapters.local_discovery.probe_service", probe),
        patch("sam_ambient.adapters.local_discovery.lms_status", status),
    ):
        result = await cleanup_discoveries(
            snapshots,
            intent=LifecycleIntent.QUIT,
            policy=CleanupPolicy("unload_if_sam_loaded", "stop_if_sam_started"),
        )
    assert commands == [("unload", "chat"), ("server", "stop")]
    assert all(item.status.value == "succeeded" for item in result)
    return [event.to_dict() for event in records]


def test_composed_core_experience_and_shutdown(tmp_path):
    records = asyncio.run(core_experience_scenario(tmp_path))
    assert sum(event["type"] == "model.completed" for event in records) == 4


def test_core_restart_changes_recognition_language_without_stale_session_ownership(tmp_path):
    async def scenario():
        # Reuse real isolated stores, but replace session authority/capture owners
        # at the normal configured-language restart boundary. No live setting invented.
        english = await core_experience_scenario(tmp_path, "en")
        spanish = await core_experience_scenario(tmp_path, "es")
        # Durable conversation identity is preserved; ephemeral owner authority
        # is newly authenticated and revoked in each scenario.
        assert english[0]["session_id"] == spanish[0]["session_id"]
        for records in (english, spanish):
            assert sum(event["type"] == "model.completed" for event in records) == 4
            assert any(
                event["type"] == EventType.CAPABILITY_AUTHORITY_CHANGED
                and event["payload"].get("active") is False
                and event["payload"].get("reason") == "owner_requested_shutdown"
                for event in records
            )

    asyncio.run(scenario())


if __name__ == "__main__":
    import logging
    import tempfile

    logging.disable(logging.CRITICAL)  # The browser consumes protocol JSON only.
    with tempfile.TemporaryDirectory(prefix="sam-core-simulator-") as directory:
        print(json.dumps(asyncio.run(core_experience_scenario(Path(directory)))))
