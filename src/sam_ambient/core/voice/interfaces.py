"""Async interfaces for replaceable voice pipeline components."""

from __future__ import annotations

from collections.abc import AsyncIterable, AsyncIterator
from typing import Protocol, runtime_checkable

from sam_ambient.core.turns import CancellationToken
from sam_ambient.core.voice.models import (
    AudioFrame,
    Transcript,
    VadResult,
    VoiceStreamContext,
)


@runtime_checkable
class AudioInput(Protocol):
    def frames(self, cancellation: CancellationToken) -> AsyncIterator[AudioFrame]: ...


@runtime_checkable
class AudioOutput(Protocol):
    async def play(
        self,
        frames: AsyncIterable[AudioFrame],
        cancellation: CancellationToken,
    ) -> None: ...


@runtime_checkable
class VoiceActivityDetector(Protocol):
    def analyze(self, frame: AudioFrame) -> VadResult: ...


@runtime_checkable
class SpeechToTextStream(Protocol):
    @property
    def context(self) -> VoiceStreamContext: ...

    async def push_audio(
        self,
        frame: AudioFrame,
        cancellation: CancellationToken,
    ) -> None: ...

    async def partial_transcript(self) -> Transcript | None: ...

    async def finalize(self, cancellation: CancellationToken) -> Transcript: ...

    async def cancel(self, cancellation_id: str, reason: str = "cancelled") -> bool: ...


@runtime_checkable
class SpeechToText(Protocol):
    async def start_stream(
        self,
        context: VoiceStreamContext,
        cancellation: CancellationToken,
    ) -> SpeechToTextStream: ...

    async def aclose(self) -> None: ...


@runtime_checkable
class TextToSpeech(Protocol):
    def synthesize(
        self,
        text: str,
        *,
        voice: str,
        language: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[AudioFrame]: ...

    async def aclose(self) -> None: ...
