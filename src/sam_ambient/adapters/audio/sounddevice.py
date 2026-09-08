"""Bounded blocking-stream audio I/O through python-sounddevice/PortAudio."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterable, AsyncIterator, Callable
from typing import Any, Protocol

import sounddevice

from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import AudioFormat, AudioFrame, SampleFormat

log = logging.getLogger(__name__)


class AudioDeviceError(RuntimeError):
    pass


class AudioInputOverflow(AudioDeviceError):
    pass


class AudioOutputUnderflow(AudioDeviceError):
    pass


class _InputStream(Protocol):
    def start(self) -> Any: ...

    def read(self, frames: int) -> tuple[Any, bool]: ...

    def abort(self) -> Any: ...

    def close(self) -> Any: ...


class _OutputStream(Protocol):
    def start(self) -> Any: ...

    def write(self, data: bytes) -> bool: ...

    def stop(self) -> Any: ...

    def abort(self) -> Any: ...

    def close(self) -> Any: ...


class SoundDeviceCapture:
    """Read fixed PCM frames without an application-level polling loop."""

    def __init__(
        self,
        *,
        audio_format: AudioFormat | None = None,
        frame_duration_ms: int = 20,
        device: int | str | None = None,
        latency: str | float = "low",
        stream_factory: Callable[..., _InputStream] | None = None,
        clock_ms: Callable[[], int] | None = None,
    ) -> None:
        self.audio_format = audio_format or AudioFormat()
        self.frame_duration_ms = frame_duration_ms
        self.samples_per_frame = self.audio_format.samples_for_ms(frame_duration_ms)
        self._device = device
        self._latency = latency
        self._stream_factory = stream_factory or sounddevice.RawInputStream
        self._clock_ms = clock_ms or (lambda: int(time.monotonic() * 1000))

    async def frames(self, cancellation: CancellationToken) -> AsyncIterator[AudioFrame]:
        cancellation.raise_if_cancelled()
        try:
            stream = await asyncio.to_thread(
                self._stream_factory,
                samplerate=self.audio_format.sample_rate_hz,
                blocksize=self.samples_per_frame,
                device=self._device,
                channels=self.audio_format.channels,
                dtype=_sounddevice_dtype(self.audio_format.sample_format),
                latency=self._latency,
            )
        except Exception as error:
            raise AudioDeviceError(f"failed to open audio input: {error}") from error

        remove_callback = self._bind_abort(cancellation, stream)
        sequence = 0
        try:
            await asyncio.to_thread(stream.start)
            while True:
                cancellation.raise_if_cancelled()
                data, overflowed = await asyncio.to_thread(stream.read, self.samples_per_frame)
                cancellation.raise_if_cancelled()
                if overflowed:
                    raise AudioInputOverflow(
                        "PortAudio input overflowed; audio continuity was lost"
                    )
                yield AudioFrame(
                    format=self.audio_format,
                    data=bytes(data),
                    monotonic_ms=self._clock_ms(),
                    sequence=sequence,
                )
                sequence += 1
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        except OperationCancelled:
            raise
        except AudioDeviceError:
            raise
        except Exception as error:
            raise AudioDeviceError(f"audio input failed: {error}") from error
        finally:
            remove_callback()
            await asyncio.shield(asyncio.to_thread(self._close_safely, stream))

    @staticmethod
    def _bind_abort(
        cancellation: CancellationToken,
        stream: _InputStream,
    ) -> Callable[[], None]:
        task = asyncio.current_task()
        loop = asyncio.get_running_loop()
        if task is None:
            raise RuntimeError("audio capture requires an asyncio task")

        def abort(_reason: str) -> None:
            try:
                stream.abort()
            except Exception:
                pass
            finally:
                loop.call_soon_threadsafe(task.cancel)

        return cancellation.add_callback(abort)

    @staticmethod
    def _close_safely(stream: _InputStream) -> None:
        try:
            stream.abort()
        except Exception:
            pass
        stream.close()

    @staticmethod
    def _close_only(stream: _InputStream) -> None:
        stream.close()


class SoundDeviceOutput:
    """Play PCM frames sequentially and abort promptly on token cancellation."""

    def __init__(
        self,
        audio_format: AudioFormat,
        *,
        device: int | str | None = None,
        latency: str | float = "low",
        stream_factory: Callable[..., _OutputStream] | None = None,
    ) -> None:
        self.audio_format = audio_format
        self._device = device
        self._latency = latency
        self._stream_factory = stream_factory or sounddevice.RawOutputStream

    async def play(
        self,
        frames: AsyncIterable[AudioFrame],
        cancellation: CancellationToken,
    ) -> None:
        cancellation.raise_if_cancelled()
        try:
            stream = await asyncio.to_thread(
                self._stream_factory,
                samplerate=self.audio_format.sample_rate_hz,
                blocksize=0,
                device=self._device,
                channels=self.audio_format.channels,
                dtype=_sounddevice_dtype(self.audio_format.sample_format),
                latency=self._latency,
            )
        except Exception as error:
            raise AudioDeviceError(f"failed to open audio output: {error}") from error

        remove_callback = SoundDeviceCapture._bind_abort(cancellation, stream)
        completed = False
        started = False
        underruns = 0
        try:
            async for frame in frames:
                cancellation.raise_if_cancelled()
                if frame.format != self.audio_format:
                    raise AudioDeviceError("audio output frame format changed during playback")
                if not started:
                    await asyncio.to_thread(stream.start)
                    started = True
                underflowed = await asyncio.to_thread(stream.write, frame.data)
                if underflowed:
                    # PortAudio already inserted a gap, not an unrecoverable device
                    # failure. Aborting here discards the rest of a valid utterance.
                    underruns += 1
            cancellation.raise_if_cancelled()
            if started:
                await asyncio.to_thread(stream.stop)
            cancellation.raise_if_cancelled()
            completed = True
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        except OperationCancelled:
            raise
        except AudioDeviceError:
            raise
        except Exception as error:
            raise AudioDeviceError(f"audio output failed: {error}") from error
        finally:
            if underruns:
                log.warning("Audio output recovered from %d underrun(s)", underruns)
            remove_callback()
            close = (
                SoundDeviceCapture._close_only if completed else SoundDeviceCapture._close_safely
            )
            await asyncio.shield(asyncio.to_thread(close, stream))


def _sounddevice_dtype(sample_format: SampleFormat) -> str:
    return "int16" if sample_format is SampleFormat.PCM_S16LE else "float32"
