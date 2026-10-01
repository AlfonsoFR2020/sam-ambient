"""Paced bilingual turns, STT failure, owner text recovery and voice re-entry.

Opt-in actual installed recognizer: python -m tests.integration.test_voice_sequence --real
No microphone, speakers or inference provider. Real mode generates PCM in memory.
"""

import asyncio
import json
import struct
import tempfile
import time
from pathlib import Path

from websockets.asyncio.client import connect

from sam_ambient.adapters.audio import SoundDeviceOutput
from sam_ambient.adapters.stt.whisper_cpp import SpeechRecognitionUnavailable
from sam_ambient.adapters.tts.system import SystemTextToSpeech
from sam_ambient.adapters.ui import SAM_PROTOCOL_SUBPROTOCOL
from sam_ambient.adapters.vad.webrtc import WebRtcVoiceActivityDetector
from sam_ambient.core.protocol import ControlCommand, ControlCommandType, EventType
from sam_ambient.core.voice import AudioFormat, AudioFrame
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from scripts.speech_baseline import CORPUS, ObservedSTT, generated, score
from tests.fixtures.owner import authenticate_owner
from tests.integration.test_core_experience import Speech, Stt, Vad
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_sounddevice_audio import FakeOutputStream


class PacedQueueCapture:
    def __init__(self):
        self.clips = asyncio.Queue()

    async def frames(self, cancellation):
        sequence, pending = 0, b""
        while True:
            cancellation.raise_if_cancelled()
            await asyncio.sleep(0.02)
            if not pending and not self.clips.empty():
                pending = self.clips.get_nowait()
            data, pending = pending[:640].ljust(640, b"\0"), pending[640:]
            yield AudioFrame(AudioFormat(), data, time.monotonic_ns() // 1_000_000, sequence)
            sequence += 1


class Recognizer:
    """Fault injection is around the actual stream, not a fake recognition result."""

    def __init__(self, delegate):
        self.delegate, self.fail = delegate, False
        self.contexts = []

    async def start_stream(self, context, cancellation):
        self.contexts.append(context)
        stream = await self.delegate.start_stream(context, cancellation)
        fail = self.fail

        class Stream:
            async def push_audio(self, frame, token):
                return await stream.push_audio(frame, token)

            async def partial_transcript(self):
                return await stream.partial_transcript()

            async def finalize(self, token):
                if fail:
                    raise SpeechRecognitionUnavailable("sequence fault injection")
                return await stream.finalize(token)

            async def cancel(self, cancellation_id, reason="cancelled"):
                return await stream.cancel(cancellation_id, reason)

        return Stream()

    async def aclose(self):
        await self.delegate.aclose()


async def phase(root, language, clips, *, real=False):
    delegate = ObservedSTT() if real else Stt()
    if real:
        await delegate.ensure_ready(Path.cwd())
    stt, capture, provider = Recognizer(delegate), PacedQueueCapture(), ConversationProvider()
    runtime = SamRuntime(
        provider,
        RuntimeConfig(
            root,
            port=0,
            model="chat",
            language=language,
            state_db=root / "state.db",
            memory_db=root / "memory.db",
        ),
        voice=RuntimeVoiceAdapters(capture, WebRtcVoiceActivityDetector() if real else Vad(), stt),
        tts=Speech(),
        audio_output=SoundDeviceOutput(
            AudioFormat(), stream_factory=lambda **_: FakeOutputStream()
        ),
    )
    records = []
    subscription = await runtime.events.subscribe(max_queue=1024)

    async def collect():
        async for event in subscription:
            records.append(event)

    collector = asyncio.create_task(collect())

    async def until(predicate):
        try:
            async with asyncio.timeout(45 if real else 8):
                while not predicate():  # noqa: ASYNC110 -- bounded observation across independent owners
                    await asyncio.sleep(0.01)
        except TimeoutError as error:
            raise AssertionError(
                {
                    "language": language,
                    "generations": len(provider.contexts),
                    "state": runtime.voice_turns.state.value,
                    "streams": [c.language for c in stt.contexts],
                    "health": [e.payload for e in records if e.type is EventType.COMPONENT_HEALTH][
                        -8:
                    ],
                }
            ) from error

    async def listening():
        await until(
            lambda: (
                runtime._voice_ordinary_capture_enabled.is_set()
                and runtime.voice_turns.state.value == "LISTENING"
            )
        )

    try:
        await runtime.start()
        async with connect(
            f"ws://127.0.0.1:{runtime.bridge.port}",
            origin="http://127.0.0.1:8766",
            subprotocols=[SAM_PROTOCOL_SUBPROTOCOL],
            proxy=None,
        ) as socket:
            await authenticate_owner(socket, runtime.bridge.owner)

            # A normal owner UI continuously consumes updates. An unread client
            # eventually applies transport backpressure during real paced clips.
            async def drain():
                async for _message in socket:
                    pass

            reader = asyncio.create_task(drain())

            async def command(kind, identity, payload):
                await socket.send(
                    ControlCommand(
                        type=kind,
                        command_id=identity,
                        monotonic_ms=time.monotonic_ns() // 1_000_000,
                        session_id=runtime.session_id,
                        payload=payload,
                    ).to_json()
                )

            transcripts = []
            for reference, pcm in clips:
                await listening()
                expected = len(provider.contexts) + 1
                capture.clips.put_nowait(pcm)
                await until(
                    lambda expected=expected: (
                        len(provider.contexts) == expected and runtime._active_done.is_set()
                    )
                )
                text = runtime.state.recent(limit=2)[0].content
                transcripts.append({"reference": reference, "text": text, **score(reference, text)})
            if language == "en":
                await listening()
                stt.fail = True
                capture.clips.put_nowait(clips[0][1])
                await until(
                    lambda: any(
                        event.type is EventType.COMPONENT_HEALTH
                        and event.payload.get("component") == "stt"
                        and event.payload.get("state") == "degraded"
                        for event in records
                    )
                )
                await command(
                    ControlCommandType.MICROPHONE_SET, "retire-failed-capture", {"enabled": False}
                )
                expected = len(provider.contexts) + 1
                await command(
                    ControlCommandType.USER_MESSAGE_SUBMIT,
                    "typed-recovery",
                    {"text": "Typed recovery."},
                )
                await until(
                    lambda: len(provider.contexts) == expected and runtime._active_done.is_set()
                )
                stt.fail = False
                await command(ControlCommandType.MICROPHONE_SET, "resume-voice", {"enabled": True})
                await listening()
                expected += 1
                capture.clips.put_nowait(clips[0][1])
                await until(
                    lambda: len(provider.contexts) == expected and runtime._active_done.is_set()
                )
            assert all(context.language == language for context in stt.contexts)
            assert len({context.cancellation_id for context in stt.contexts}) == len(stt.contexts)
            assert [item.role for item in runtime.state.recent(limit=20)] == [
                "user",
                "assistant",
            ] * len(provider.contexts)
            reader.cancel()
            await asyncio.gather(reader, return_exceptions=True)
            return {
                "language": language,
                "transcripts": transcripts,
                "generations": len(provider.contexts),
                "stream_languages": [c.language for c in stt.contexts],
                "stream_ids_unique": True,
                "typed_then_voice_recovery": language == "en",
                "input_levels": [
                    [
                        event.monotonic_ms,
                        event.payload["rms"],
                        event.payload["peak"],
                        event.payload["speech_probability"],
                    ]
                    for event in records
                    if event.type is EventType.VOICE_LEVEL
                ],
            }
    finally:
        await runtime.close()
        await subscription.close()
        await collector
        assert not runtime._tasks
        assert not runtime.bridge.owner.active


async def sequence(root, real=False):
    speech = SystemTextToSpeech() if real else None
    try:
        reports = []
        for language, indices in (("es", (0, 1)), ("en", (0, 5))):
            target = root / language
            target.mkdir()
            clips = [
                (
                    CORPUS[language][index],
                    await generated(speech, CORPUS[language][index], language)
                    if real
                    else struct.pack("<h", 1600) * 320 * 20,
                )
                for index in indices
            ]
            reports.append(await phase(target, language, clips, real=real))
        return reports
    finally:
        if speech is not None:
            await speech.aclose()


def test_sequential_language_restart_stt_failure_text_recovery_and_voice_reentry(tmp_path):
    reports = asyncio.run(sequence(tmp_path))
    assert [report["generations"] for report in reports] == [2, 4]
    assert reports[1]["typed_then_voice_recovery"]


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--real", action="store_true")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="sam-voice-sequence-") as directory:
        result = asyncio.run(sequence(Path(directory), args.real))
        if args.real:
            Path(".sam/voice-sequence.json").write_text(
                json.dumps(result, indent=2), encoding="utf-8"
            )
        print(
            json.dumps(
                [
                    {key: value for key, value in report.items() if key != "input_levels"}
                    for report in result
                ]
            )
        )
