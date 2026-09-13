"""Small adapter around the proven WebRTC VAD implementation."""

from __future__ import annotations

from typing import Any

import webrtcvad

from sam_ambient.core.voice import AudioFrame, SampleFormat, VadResult

_SUPPORTED_SAMPLE_RATES = frozenset({8_000, 16_000, 32_000, 48_000})
_SUPPORTED_FRAME_MS = frozenset({10, 20, 30})


class WebRtcVoiceActivityDetector:
    def __init__(
        self,
        aggressiveness: int = 2,
        *,
        detector: Any | None = None,
        activation_frames: int = 3,
        release_frames: int = 4,
    ) -> None:
        if aggressiveness not in {0, 1, 2, 3}:
            raise ValueError("aggressiveness must be 0, 1, 2, or 3")
        self.aggressiveness = aggressiveness
        self._detector = detector or webrtcvad.Vad(aggressiveness)
        if activation_frames < 1 or release_frames < 1:
            raise ValueError("VAD hysteresis frame counts must be positive")
        self._activation_frames = activation_frames
        self._release_frames = release_frames
        self._speech_run = 0
        self._silence_run = 0
        self._active = False

    def analyze(self, frame: AudioFrame) -> VadResult:
        audio_format = frame.format
        if audio_format.sample_format is not SampleFormat.PCM_S16LE:
            raise ValueError("WebRTC VAD requires signed 16-bit PCM")
        if audio_format.channels != 1:
            raise ValueError("WebRTC VAD requires mono PCM")
        if audio_format.sample_rate_hz not in _SUPPORTED_SAMPLE_RATES:
            raise ValueError("unsupported WebRTC VAD sample rate")
        duration_ms = round(frame.duration_ms)
        if duration_ms not in _SUPPORTED_FRAME_MS or frame.duration_ms != duration_ms:
            raise ValueError("WebRTC VAD frames must be exactly 10, 20, or 30 ms")

        raw_speech = bool(self._detector.is_speech(frame.data, audio_format.sample_rate_hz))
        if raw_speech:
            self._speech_run = min(self._activation_frames, self._speech_run + 1)
            self._silence_run = 0
            if self._speech_run >= self._activation_frames:
                self._active = True
        else:
            self._silence_run = min(self._release_frames, self._silence_run + 1)
            self._speech_run = 0
            if self._silence_run >= self._release_frames:
                self._active = False
        if self._active:
            probability = 1.0 - 0.35 * (self._silence_run / self._release_frames)
        else:
            probability = 0.49 * (self._speech_run / self._activation_frames)
        return VadResult(is_speech=self._active, speech_probability=probability)
