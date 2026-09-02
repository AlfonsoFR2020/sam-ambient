import struct

import pytest

from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    SampleFormat,
    SentenceChunker,
    Transcript,
    VadResult,
    VoiceStreamContext,
    normalized_audio_level,
)


def test_audio_frame_validates_alignment_and_reports_level() -> None:
    audio_format = AudioFormat(sample_rate_hz=16_000)
    frame = AudioFrame(
        format=audio_format,
        data=struct.pack("<hh", 0, 16_384),
        monotonic_ms=10,
        sequence=2,
    )

    assert frame.sample_count == 2
    assert frame.duration_ms == pytest.approx(0.125)
    assert normalized_audio_level(frame) == pytest.approx(0.353553, rel=1e-5)

    with pytest.raises(ValueError, match="aligned"):
        AudioFrame(audio_format, b"x", monotonic_ms=0, sequence=0)

    with pytest.raises(TypeError, match="sample_rate_hz"):
        AudioFormat(sample_rate_hz=True)
    with pytest.raises(TypeError, match="sample_format"):
        AudioFormat(sample_format="pcm_s16le")  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="duration_ms"):
        audio_format.samples_for_ms(20.0)  # type: ignore[arg-type]
    with pytest.raises(TypeError, match="AudioFormat"):
        AudioFrame("pcm", b"\0\0", monotonic_ms=0, sequence=0)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="non-negative"):
        AudioFrame(audio_format, b"\0\0", monotonic_ms=-1, sequence=0)


def test_voice_metadata_validation_and_normalization() -> None:
    assert Transcript("  hello   Sam  ", is_final=True).text == "hello Sam"
    assert VadResult(True, 0.5).speech_probability == 0.5
    assert VoiceStreamContext("session", "turn", "cancel").language == "auto"

    with pytest.raises(TypeError, match="is_speech"):
        VadResult(1, 0.5)  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="between 0 and 1"):
        Transcript("hello", is_final=False, confidence=1.1)
    with pytest.raises(ValueError, match="non-blank"):
        VoiceStreamContext("session", "turn", " ")


def test_float_audio_level_is_bounded() -> None:
    frame = AudioFrame(
        AudioFormat(sample_rate_hz=1_000, sample_format=SampleFormat.PCM_F32LE),
        struct.pack("<ff", 2.0, -2.0),
        monotonic_ms=0,
        sequence=0,
    )

    assert normalized_audio_level(frame) == 1.0


def test_sentence_chunker_handles_stream_boundaries_abbreviations_and_decimals() -> None:
    chunker = SentenceChunker(min_chars=8, max_chars=80)

    assert chunker.push("Ask Dr. Smith about version 3.14.") == ()
    assert chunker.push(" Then continue?") == ("Ask Dr. Smith about version 3.14.",)
    assert chunker.flush() == ("Then continue?",)


def test_sentence_chunker_bounds_long_unpunctuated_text() -> None:
    chunker = SentenceChunker(min_chars=5, max_chars=12)

    chunks = chunker.push("alpha beta gamma delta")

    assert chunks == ("alpha beta",)
    assert chunker.flush() == ("gamma delta",)
