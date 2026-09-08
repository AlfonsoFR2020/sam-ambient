import asyncio

import pytest

from sam_ambient.adapters.tts.system import SystemTextToSpeech
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
