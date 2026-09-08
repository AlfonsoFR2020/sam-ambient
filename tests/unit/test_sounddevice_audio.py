import asyncio
import threading
from collections.abc import AsyncIterator

import pytest

from sam_ambient.adapters.audio import (
    AudioDeviceError,
    AudioInputOverflow,
    SoundDeviceCapture,
    SoundDeviceOutput,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import AudioFormat, AudioFrame


class FakeInputStream:
    def __init__(self, reads: list[tuple[bytes, bool]]) -> None:
        self.reads = reads
        self.started = False
        self.aborted = False
        self.closed = False

    def start(self) -> None:
        self.started = True

    def read(self, _frames: int) -> tuple[bytes, bool]:
        return self.reads.pop(0)

    def abort(self) -> None:
        self.aborted = True

    def close(self) -> None:
        self.closed = True


class BlockingInputStream(FakeInputStream):
    def __init__(self) -> None:
        super().__init__([])
        self.reading = threading.Event()
        self._released = threading.Event()

    def read(self, _frames: int) -> tuple[bytes, bool]:
        self.reading.set()
        self._released.wait(timeout=2)
        return b"\0" * 640, False

    def abort(self) -> None:
        super().abort()
        self._released.set()


class FakeOutputStream:
    def __init__(self, *, underflow: bool = False) -> None:
        self.underflow = underflow
        self.started = False
        self.stopped = False
        self.aborted = False
        self.closed = False
        self.writes: list[bytes] = []

    def start(self) -> None:
        self.started = True

    def write(self, data: bytes) -> bool:
        self.writes.append(data)
        return self.underflow

    def stop(self) -> None:
        self.stopped = True

    def abort(self) -> None:
        self.aborted = True

    def close(self) -> None:
        self.closed = True


class BlockingOutputStream(FakeOutputStream):
    def __init__(self) -> None:
        super().__init__()
        self.writing = threading.Event()
        self._released = threading.Event()

    def write(self, data: bytes) -> bool:
        self.writing.set()
        self._released.wait(timeout=2)
        return super().write(data)

    def abort(self) -> None:
        super().abort()
        self._released.set()


def test_capture_reads_fixed_frames_and_surfaces_overflow() -> None:
    async def scenario() -> None:
        stream = FakeInputStream([(b"\0" * 640, False), (b"\0" * 640, True)])
        capture = SoundDeviceCapture(
            stream_factory=lambda **_options: stream,
            clock_ms=iter((10, 30)).__next__,
        )
        frames = capture.frames(CancellationToken("capture"))

        first = await anext(frames)
        assert first.sequence == 0
        assert first.monotonic_ms == 10
        with pytest.raises(AudioInputOverflow):
            await anext(frames)
        assert stream.started and stream.aborted and stream.closed

    asyncio.run(scenario())


def test_capture_cancellation_aborts_and_closes_blocking_stream() -> None:
    async def scenario() -> None:
        stream = BlockingInputStream()
        capture = SoundDeviceCapture(stream_factory=lambda **_options: stream)
        token = CancellationToken("capture-cancel")

        async def consume() -> None:
            async for _frame in capture.frames(token):
                pass

        consumer = asyncio.create_task(consume())
        await asyncio.to_thread(stream.reading.wait, 1)
        token.cancel("barge-in")
        with pytest.raises(OperationCancelled):
            await consumer
        assert stream.aborted and stream.closed

    asyncio.run(scenario())


def test_output_plays_in_order_and_recovers_underflow() -> None:
    async def source(audio_format: AudioFormat) -> AsyncIterator[AudioFrame]:
        yield AudioFrame(audio_format, b"\0\0", monotonic_ms=0, sequence=0)
        yield AudioFrame(audio_format, b"\1\0", monotonic_ms=1, sequence=1)

    async def scenario() -> None:
        audio_format = AudioFormat(sample_rate_hz=1_000)
        normal = FakeOutputStream()
        output = SoundDeviceOutput(
            audio_format,
            stream_factory=lambda **_options: normal,
        )
        await output.play(source(audio_format), CancellationToken("play"))
        assert normal.writes == [b"\0\0", b"\1\0"]
        assert normal.stopped and normal.closed and not normal.aborted

        broken = FakeOutputStream(underflow=True)
        output = SoundDeviceOutput(
            audio_format,
            stream_factory=lambda **_options: broken,
        )
        await output.play(source(audio_format), CancellationToken("underflow"))
        assert broken.writes == normal.writes
        assert broken.stopped and broken.closed and not broken.aborted

    asyncio.run(scenario())


def test_output_waits_for_synthesis_before_starting_and_uses_default_device():
    async def scenario():
        stream = FakeOutputStream()
        options = {}

        def factory(**kwargs):
            options.update(kwargs)
            return stream

        audio_format = AudioFormat()

        async def source():
            assert not stream.started
            await asyncio.sleep(0)
            assert not stream.started
            yield AudioFrame(audio_format, b"\0\0", 0, 0)

        await SoundDeviceOutput(audio_format, stream_factory=factory).play(
            source(), CancellationToken("delayed-synthesis")
        )
        assert options["device"] is None
        assert stream.started and stream.stopped and not stream.aborted

    asyncio.run(scenario())


def test_cancellation_while_draining_last_frame_is_not_reported_as_completed():
    async def scenario():
        token = CancellationToken("last-frame")

        class Stream(FakeOutputStream):
            def stop(self):
                super().stop()
                token.cancel("interruption during drain")

        audio_format = AudioFormat()
        stream = Stream()

        async def source():
            yield AudioFrame(audio_format, b"\0\0", 0, 0)

        with pytest.raises(OperationCancelled):
            await SoundDeviceOutput(audio_format, stream_factory=lambda **_: stream).play(
                source(), token
            )
        assert stream.closed and stream.aborted

    asyncio.run(scenario())


def test_output_cancellation_aborts_and_closes_blocking_stream() -> None:
    async def source(audio_format: AudioFormat) -> AsyncIterator[AudioFrame]:
        yield AudioFrame(audio_format, b"\0\0", monotonic_ms=0, sequence=0)

    async def scenario() -> None:
        audio_format = AudioFormat(sample_rate_hz=1_000)
        stream = BlockingOutputStream()
        output = SoundDeviceOutput(
            audio_format,
            stream_factory=lambda **_options: stream,
        )
        token = CancellationToken("play-cancel")

        playback = asyncio.create_task(output.play(source(audio_format), token))
        await asyncio.to_thread(stream.writing.wait, 1)
        assert token.cancel("barge-in") is True
        assert token.cancel("again") is False
        with pytest.raises(OperationCancelled) as caught:
            await playback
        assert caught.value.cancellation_id == "play-cancel"
        assert stream.aborted and stream.closed and not stream.stopped

    asyncio.run(scenario())


def test_output_rejects_format_changes_and_wraps_open_failures() -> None:
    async def source(audio_format: AudioFormat) -> AsyncIterator[AudioFrame]:
        yield AudioFrame(audio_format, b"\0\0", monotonic_ms=0, sequence=0)

    async def scenario() -> None:
        expected = AudioFormat(sample_rate_hz=1_000)
        stream = FakeOutputStream()
        output = SoundDeviceOutput(expected, stream_factory=lambda **_options: stream)
        with pytest.raises(AudioDeviceError, match="format changed"):
            await output.play(
                source(AudioFormat(sample_rate_hz=2_000)),
                CancellationToken("format"),
            )
        assert stream.aborted and stream.closed

        def fail_open(**_options):
            raise OSError("device unavailable")

        broken = SoundDeviceOutput(expected, stream_factory=fail_open)
        with pytest.raises(AudioDeviceError, match="failed to open audio output"):
            await broken.play(source(expected), CancellationToken("open"))

    asyncio.run(scenario())
