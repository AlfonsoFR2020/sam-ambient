import asyncio
import sys

import pytest

from sam_ambient.adapters.tts.system import SystemTextToSpeech, TextToSpeechError
from sam_ambient.core.turns import CancellationToken
from sam_ambient.core.voice.language import response_language
from sam_ambient.core.voice.speech import SpeechVoice, select_voice


@pytest.mark.parametrize(
    ("text", "fallback", "expected"),
    [
        ("La capital de España es Madrid y tiene muchos museos interesantes.", "en", "es"),
        ("The capital of Spain is Madrid and there are many interesting museums.", "es", "en"),
        ("La capitale de la France est Paris et cette ville est très intéressante.", "es", "fr"),
        ("Sí.", "es-MX", "es-MX"),
        ("1234 {}", "auto", "auto"),
        ("Your favourite fruit is the orange and I remember it from our conversation.", "es", "en"),
        ("La capital de España es Madrid y tiene muchos museos interesantes.", "es-MX", "es-MX"),
    ],
)
def test_response_evidence_and_short_text_context(text, fallback, expected):
    assert response_language(text, fallback) == expected
    assert response_language(text, fallback) == expected


@pytest.mark.parametrize(
    ("language", "configured", "expected", "reason"),
    [
        ("es-MX", "English", "Mexican", "exact locale"),
        ("es-AR", "English", "Mexican", "same-language regional fallback"),
        ("ja", "English", "English", "requested language unavailable; configured voice"),
        ("ja", "missing", "Default", "requested language unavailable; system default"),
    ],
)
def test_installed_voice_selection(language, configured, expected, reason):
    voices = (SpeechVoice("English", "en-US"), SpeechVoice("Mexican", "es-MX"))
    selection = select_voice(voices, language, configured, SpeechVoice("Default", "en-GB"))
    assert selection.voice.voice_id == expected
    assert selection.reason == reason


def test_windows_passes_selected_voice_and_unicode_as_data(monkeypatch):
    async def scenario():
        adapter = SystemTextToSpeech(("unused",), backend_id="windows-system-speech")
        adapter._voices = (SpeechVoice("Installed Spanish", "es-ES"),)
        calls = []

        async def synthesize(text, token, *, selection):
            calls.append((text, selection))
            return b"wave"

        monkeypatch.setattr(adapter, "_synthesize_wave", synthesize)
        monkeypatch.setattr(adapter, "_decode_wave", lambda data: b"\0\0" * 320)
        frames = [
            frame
            async for frame in adapter.synthesize(
                "¡Buenos días!",
                voice="absent",
                language="es-MX",
                cancellation=CancellationToken("speak"),
            )
        ]
        assert frames
        assert calls[0][0] == "¡Buenos días!"
        assert calls[0][1].voice.voice_id == "Installed Spanish"
        assert adapter.last_selection == calls[0][1]
        await adapter.aclose()

    asyncio.run(scenario())


def test_espeak_receives_locale_as_an_argument():
    from tests.unit.test_phase9_packaging import _WAVE_WRITER

    async def scenario():
        adapter = SystemTextToSpeech(
            (
                sys.executable,
                "-c",
                "import sys; assert sys.argv[1:] == ['-v', 'es-MX'];\n" + _WAVE_WRITER,
            ),
            backend_id="espeak-ng",
        )
        try:
            frames = [
                frame
                async for frame in adapter.synthesize(
                    "Hola",
                    voice="default",
                    language="es-MX",
                    cancellation=CancellationToken("espeak"),
                )
            ]
            assert frames
        finally:
            await adapter.aclose()

    asyncio.run(scenario())


def test_cloud_llm_permission_does_not_authorize_cloud_speech(tmp_path):
    from sam_ambient.core.voice.speech import SpeechCapabilities
    from sam_ambient.runtime import RuntimeConfig, SamRuntime
    from tests.unit.test_cli import FakeProvider
    from tests.unit.test_phase9_packaging import _FakeOutput, _FakeTts

    class NetworkTts(_FakeTts):
        capabilities = SpeechCapabilities(local=False)

    async def scenario():
        runtime = SamRuntime(
            FakeProvider(),
            RuntimeConfig(tmp_path, allow_cloud=True),
            tts=NetworkTts(),
            audio_output=_FakeOutput(),
        )
        try:
            with pytest.raises(RuntimeError, match="explicit trusted opt-in"):
                async for _ in runtime._metered_tts_frames(
                    "A response",
                    session_id=runtime.session_id,
                    turn_id="turn",
                    generation_id="generation",
                    cancellation=CancellationToken("network"),
                ):
                    pass
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_synthesis_timeout_covers_stdin_backpressure_and_reaps_readers(monkeypatch):
    class Input:
        def write(self, data):
            pass

        async def drain(self):
            await asyncio.Future()

    class Process:
        returncode = None
        stdin = Input()

        def __init__(self):
            self.stdout = asyncio.StreamReader()
            self.stderr = asyncio.StreamReader()

        def kill(self):
            self.returncode = -1

        async def wait(self):
            return self.returncode

    async def scenario():
        process = Process()

        async def spawn(*args, **kwargs):
            return process

        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
        adapter = SystemTextToSpeech(("unused",), timeout_s=0.01)
        with pytest.raises(TextToSpeechError, match="timed out"):
            async for _ in adapter.synthesize(
                "hello", voice="default", language="en", cancellation=CancellationToken("timeout")
            ):
                pass
        assert process.returncode == -1
        assert not adapter._processes
        assert not [task for task in asyncio.all_tasks() if task is not asyncio.current_task()]
        await adapter.aclose()

    asyncio.run(scenario())
