"""Voice pipeline domain interfaces."""

from sam_ambient.core.voice.chunker import SentenceChunker
from sam_ambient.core.voice.interfaces import (
    AudioInput,
    AudioOutput,
    SpeechToText,
    SpeechToTextStream,
    TextToSpeech,
    VoiceActivityDetector,
)
from sam_ambient.core.voice.models import (
    AudioFormat,
    AudioFrame,
    SampleFormat,
    Transcript,
    VadResult,
    VoiceStreamContext,
)
from sam_ambient.core.voice.pipeline import (
    VoiceInputPipeline,
    VoiceInputResult,
    VoicePipelineEnded,
    normalized_audio_level,
)

__all__ = [
    "AudioFormat",
    "AudioFrame",
    "AudioInput",
    "AudioOutput",
    "SampleFormat",
    "SentenceChunker",
    "SpeechToText",
    "SpeechToTextStream",
    "TextToSpeech",
    "Transcript",
    "VadResult",
    "VoiceActivityDetector",
    "VoiceInputPipeline",
    "VoiceInputResult",
    "VoicePipelineEnded",
    "VoiceStreamContext",
    "normalized_audio_level",
]
