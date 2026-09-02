import asyncio
from collections.abc import AsyncIterator

import pytest

from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    SentenceChunker,
    TextToSpeech,
)


class DeterministicTts:
    """Test double for the provider-neutral streaming TTS contract."""

    def __init__(self, *, block_after_first_frame: bool = False) -> None:
        self.audio_format = AudioFormat(sample_rate_hz=1_000)
        self.block_after_first_frame = block_after_first_frame
        self.requests: list[tuple[str, str, str]] = []
        self.waiting = asyncio.Event()
        self.closed_stream = asyncio.Event()

    async def synthesize(
        self,
        text: str,
        *,
        voice: str,
        language: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[AudioFrame]:
        cancellation.raise_if_cancelled()
        self.requests.append((text, voice, language))
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("TTS synthesis requires an asyncio task")
        loop = asyncio.get_running_loop()

        def cancel_task(_reason: str) -> None:
            loop.call_soon_threadsafe(task.cancel)

        remove_callback = cancellation.add_callback(cancel_task)
        try:
            yield AudioFrame(
                self.audio_format,
                b"\0\0" * len(text),
                monotonic_ms=0,
                sequence=0,
            )
            if self.block_after_first_frame:
                self.waiting.set()
                await asyncio.Event().wait()
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        finally:
            remove_callback()
            self.closed_stream.set()

    async def aclose(self) -> None:
        return None


def test_chunked_text_drives_provider_neutral_tts_frames() -> None:
    async def scenario() -> None:
        tts = DeterministicTts()
        assert isinstance(tts, TextToSpeech)
        chunker = SentenceChunker(min_chars=8, max_chars=80)
        chunks = chunker.push("First complete sentence. Second") + chunker.flush()
        token = CancellationToken("tts-chunks")
        frames: list[AudioFrame] = []

        for chunk in chunks:
            async for frame in tts.synthesize(
                chunk,
                voice="test",
                language="en",
                cancellation=token,
            ):
                frames.append(frame)

        assert chunks == ("First complete sentence.", "Second")
        assert tts.requests == [
            ("First complete sentence.", "test", "en"),
            ("Second", "test", "en"),
        ]
        assert len(frames) == 2
        assert all(frame.format == tts.audio_format for frame in frames)

    asyncio.run(scenario())


def test_tts_cancellation_closes_stream_and_preserves_identity() -> None:
    async def scenario() -> None:
        tts = DeterministicTts(block_after_first_frame=True)
        token = CancellationToken("tts-cancel")

        async def consume() -> None:
            async for _frame in tts.synthesize(
                "hello",
                voice="test",
                language="en",
                cancellation=token,
            ):
                pass

        consumer = asyncio.create_task(consume())
        await tts.waiting.wait()
        assert token.cancel("barge-in") is True
        with pytest.raises(OperationCancelled) as caught:
            await consumer
        assert caught.value.cancellation_id == "tts-cancel"
        assert caught.value.reason == "barge-in"
        assert tts.closed_stream.is_set()

    asyncio.run(scenario())
