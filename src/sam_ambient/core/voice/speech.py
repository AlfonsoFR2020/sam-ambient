"""Optional speech-provider discovery metadata; synthesis stays a PCM iterator."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SpeechVoice:
    voice_id: str
    locale: str


@dataclass(frozen=True, slots=True)
class SpeechCapabilities:
    # Network adapters must declare this and require separate trusted opt-in.
    local: bool = True
    streaming_synthesis: bool = False
    voice_enumeration: bool = False


@dataclass(frozen=True, slots=True)
class VoiceSelection:
    requested_language: str
    voice: SpeechVoice
    reason: str


def select_voice(
    voices: tuple[SpeechVoice, ...], language: str, configured: str, default: SpeechVoice
) -> VoiceSelection:
    """Language wins over a mismatched configured voice; names are opaque IDs."""
    requested = language.lower().replace("_", "-")
    ordered = sorted(voices, key=lambda voice: (voice.voice_id != configured, voice.voice_id))
    for voice in ordered:
        if voice.locale.lower().replace("_", "-") == requested:
            return VoiceSelection(language, voice, "exact locale")
    for voice in ordered:
        if voice.locale.lower().split("-")[0] == requested.split("-")[0]:
            return VoiceSelection(language, voice, "same-language regional fallback")
    for voice in voices:
        if voice.voice_id == configured:
            return VoiceSelection(
                language, voice, "requested language unavailable; configured voice"
            )
    return VoiceSelection(language, default, "requested language unavailable; system default")
