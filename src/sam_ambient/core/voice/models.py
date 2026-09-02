"""Provider-neutral voice and PCM domain models."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class SampleFormat(StrEnum):
    PCM_S16LE = "pcm_s16le"
    PCM_F32LE = "pcm_f32le"

    @property
    def bytes_per_sample(self) -> int:
        return 2 if self is SampleFormat.PCM_S16LE else 4


@dataclass(frozen=True, slots=True)
class AudioFormat:
    sample_rate_hz: int = 16_000
    channels: int = 1
    sample_format: SampleFormat = SampleFormat.PCM_S16LE

    def __post_init__(self) -> None:
        if not isinstance(self.sample_rate_hz, int) or isinstance(self.sample_rate_hz, bool):
            raise TypeError("sample_rate_hz must be an integer")
        if self.sample_rate_hz <= 0:
            raise ValueError("sample_rate_hz must be positive")
        if not isinstance(self.channels, int) or isinstance(self.channels, bool):
            raise TypeError("channels must be an integer")
        if self.channels <= 0:
            raise ValueError("channels must be positive")
        if not isinstance(self.sample_format, SampleFormat):
            raise TypeError("sample_format must be a SampleFormat")

    @property
    def bytes_per_frame(self) -> int:
        return self.channels * self.sample_format.bytes_per_sample

    def samples_for_ms(self, duration_ms: int) -> int:
        if not isinstance(duration_ms, int) or isinstance(duration_ms, bool):
            raise TypeError("duration_ms must be an integer")
        if duration_ms <= 0:
            raise ValueError("duration_ms must be positive")
        samples, remainder = divmod(self.sample_rate_hz * duration_ms, 1000)
        if remainder:
            raise ValueError("duration_ms must map to a whole number of samples")
        return samples


@dataclass(frozen=True, slots=True)
class AudioFrame:
    format: AudioFormat
    data: bytes
    monotonic_ms: int
    sequence: int
    dropped_before: int = 0

    def __post_init__(self) -> None:
        if not isinstance(self.format, AudioFormat):
            raise TypeError("format must be an AudioFormat")
        if not isinstance(self.data, bytes) or not self.data:
            raise ValueError("audio frame data must be non-empty bytes")
        if len(self.data) % self.format.bytes_per_frame:
            raise ValueError("audio frame data is not aligned to its format")
        if not isinstance(self.monotonic_ms, int) or isinstance(self.monotonic_ms, bool):
            raise TypeError("monotonic_ms must be an integer")
        if self.monotonic_ms < 0:
            raise ValueError("monotonic_ms must be non-negative")
        if not isinstance(self.sequence, int) or isinstance(self.sequence, bool):
            raise TypeError("sequence must be an integer")
        if self.sequence < 0:
            raise ValueError("sequence must be non-negative")
        if not isinstance(self.dropped_before, int) or isinstance(self.dropped_before, bool):
            raise TypeError("dropped_before must be an integer")
        if self.dropped_before < 0:
            raise ValueError("dropped_before must be non-negative")

    @property
    def sample_count(self) -> int:
        return len(self.data) // self.format.bytes_per_frame

    @property
    def duration_ms(self) -> float:
        return self.sample_count * 1000 / self.format.sample_rate_hz


@dataclass(frozen=True, slots=True)
class VadResult:
    is_speech: bool
    speech_probability: float

    def __post_init__(self) -> None:
        if not isinstance(self.is_speech, bool):
            raise TypeError("is_speech must be a boolean")
        if not isinstance(self.speech_probability, int | float) or isinstance(
            self.speech_probability, bool
        ):
            raise TypeError("speech_probability must be numeric")
        if not 0.0 <= self.speech_probability <= 1.0:
            raise ValueError("speech_probability must be between 0 and 1")


@dataclass(frozen=True, slots=True)
class Transcript:
    text: str
    is_final: bool
    confidence: float | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.text, str):
            raise TypeError("text must be a string")
        if not isinstance(self.is_final, bool):
            raise TypeError("is_final must be a boolean")
        normalized = " ".join(self.text.split())
        object.__setattr__(self, "text", normalized)
        if self.confidence is not None:
            if not isinstance(self.confidence, int | float) or isinstance(self.confidence, bool):
                raise TypeError("confidence must be numeric")
            if not 0.0 <= self.confidence <= 1.0:
                raise ValueError("confidence must be between 0 and 1")


@dataclass(frozen=True, slots=True)
class VoiceStreamContext:
    session_id: str
    turn_id: str
    cancellation_id: str
    language: str = "auto"

    def __post_init__(self) -> None:
        for name in ("session_id", "turn_id", "cancellation_id", "language"):
            value = getattr(self, name)
            if not isinstance(value, str):
                raise TypeError(f"{name} must be a string")
            if not value.strip():
                raise ValueError(f"{name} must be non-blank")
