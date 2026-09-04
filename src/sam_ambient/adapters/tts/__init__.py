"""Text-to-speech adapters."""

from sam_ambient.adapters.tts.system import (
    SystemTextToSpeech,
    TextToSpeechError,
    TextToSpeechUnavailable,
    system_tts_status,
)

__all__ = [
    "SystemTextToSpeech",
    "TextToSpeechError",
    "TextToSpeechUnavailable",
    "system_tts_status",
]
