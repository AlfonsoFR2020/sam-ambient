"""Speech-to-text adapters."""

from sam_ambient.adapters.stt.whisper_cpp import (
    DEFAULT_WHISPER_CPP_URL,
    SpeechAudioLimitExceeded,
    SpeechRecognitionError,
    SpeechRecognitionProtocolError,
    SpeechRecognitionTimeout,
    SpeechRecognitionUnavailable,
    WhisperCppServerSTT,
    local_asset_status,
    normalize_whisper_cpp_url,
)

__all__ = [
    "DEFAULT_WHISPER_CPP_URL",
    "SpeechAudioLimitExceeded",
    "SpeechRecognitionError",
    "SpeechRecognitionProtocolError",
    "SpeechRecognitionTimeout",
    "SpeechRecognitionUnavailable",
    "WhisperCppServerSTT",
    "local_asset_status",
    "normalize_whisper_cpp_url",
]
