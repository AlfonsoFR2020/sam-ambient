"""Optional speech-provider discovery metadata; synthesis stays a PCM iterator."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class SpeechVoice:
    voice_id: str
    locale: str
    gender: str | None = None


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
    """Language first, then a deterministic installed persona; IDs stay opaque."""
    requested = language.lower().replace("_", "-")
    preferred = next((voice for voice in voices if voice.voice_id == configured), None)
    persona = preferred.gender if preferred else None
    if persona is None:
        # Prefer the installed gender with widest language coverage, instead of
        # an alphabetical en/es choice that changes persona at every switch.
        coverage: dict[str, set[str]] = {}
        for voice in voices:
            if voice.gender in {"female", "male", "neutral"}:
                coverage.setdefault(voice.gender, set()).add(voice.locale.lower().split("-")[0])
        if coverage:
            persona = min(
                coverage,
                key=lambda gender: (-len(coverage[gender]), gender != default.gender, gender),
            )
    compatible = tuple(
        voice
        for voice in voices
        if voice.locale.lower().replace("_", "-").split("-")[0] == requested.split("-")[0]
    )
    if compatible:
        selected = min(
            compatible,
            key=lambda voice: (
                voice.voice_id != configured,
                persona is not None and voice.gender != persona,
                voice.locale.lower().replace("_", "-") != requested,
                voice.voice_id,
            ),
        )
        reason = (
            "exact locale"
            if selected.locale.lower().replace("_", "-") == requested
            else "same-language regional fallback"
        )
        if persona:
            reason += (
                f"; {persona} persona"
                if selected.gender == persona
                else "; preferred persona unavailable in language"
            )
        return VoiceSelection(language, selected, reason)
    for voice in voices:
        if voice.voice_id == configured:
            return VoiceSelection(
                language, voice, "requested language unavailable; configured voice"
            )
    return VoiceSelection(language, default, "requested language unavailable; system default")
