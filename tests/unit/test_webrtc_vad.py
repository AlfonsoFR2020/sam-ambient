import pytest

from sam_ambient.adapters.vad import WebRtcVoiceActivityDetector
from sam_ambient.core.voice import AudioFormat, AudioFrame, SampleFormat

DEFAULT_AUDIO_FORMAT = AudioFormat()


class FakeDetector:
    def __init__(self, result: bool) -> None:
        self.result = result
        self.calls: list[tuple[bytes, int]] = []

    def is_speech(self, data: bytes, sample_rate: int) -> bool:
        self.calls.append((data, sample_rate))
        return self.result


def frame_for(
    audio_format: AudioFormat = DEFAULT_AUDIO_FORMAT,
    *,
    duration_ms: int = 20,
) -> AudioFrame:
    data = b"\0" * (audio_format.samples_for_ms(duration_ms) * audio_format.bytes_per_frame)
    return AudioFrame(audio_format, data, monotonic_ms=0, sequence=0)


def test_webrtc_vad_maps_native_decision_without_inventing_probability() -> None:
    native = FakeDetector(True)
    detector = WebRtcVoiceActivityDetector(2, detector=native)

    result = detector.analyze(frame_for())

    assert result.is_speech is True
    assert result.speech_probability == 1.0
    assert native.calls[0][1] == 16_000


def test_webrtc_vad_rejects_incompatible_frames() -> None:
    detector = WebRtcVoiceActivityDetector(detector=FakeDetector(False))

    with pytest.raises(ValueError, match="16-bit"):
        detector.analyze(frame_for(AudioFormat(sample_format=SampleFormat.PCM_F32LE)))
    with pytest.raises(ValueError, match="10, 20, or 30"):
        detector.analyze(frame_for(duration_ms=40))


def test_real_webrtc_vad_classifies_silence_as_non_speech() -> None:
    result = WebRtcVoiceActivityDetector(2).analyze(frame_for())

    assert result.is_speech is False
