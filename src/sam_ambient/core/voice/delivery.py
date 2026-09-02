"""Generation-scoped speech delivery and interruption side effects."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import StrEnum

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.turns import (
    CancellationRegistry,
    CancellationToken,
    OperationCancelled,
)


class SpeechChunkState(StrEnum):
    QUEUED = "queued"
    PLAYING = "playing"
    SPOKEN = "spoken"
    CANCELLED = "cancelled"


class DeliveryLimitExceeded(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class SpeechChunk:
    chunk_id: str
    turn_id: str
    generation_id: str
    cancellation_id: str
    text: str


@dataclass(frozen=True, slots=True)
class DeliveredChunk:
    chunk_id: str
    text: str
    state: SpeechChunkState
    queued_at_ms: int
    started_at_ms: int | None
    completed_at_ms: int | None


@dataclass(frozen=True, slots=True)
class DeliverySnapshot:
    turn_id: str
    generation_id: str
    cancellation_id: str
    generated_text: str
    chunks: tuple[DeliveredChunk, ...]
    interrupted_at_ms: int | None
    completed: bool

    @property
    def queued_text(self) -> str:
        return "".join(chunk.text for chunk in self.chunks)

    @property
    def spoken_text(self) -> str:
        return "".join(
            chunk.text for chunk in self.chunks if chunk.state is SpeechChunkState.SPOKEN
        )

    @property
    def unspoken_text(self) -> str:
        if self.generated_text.startswith(self.spoken_text):
            return self.generated_text[len(self.spoken_text) :]
        return "".join(
            chunk.text for chunk in self.chunks if chunk.state is not SpeechChunkState.SPOKEN
        )


@dataclass(slots=True)
class _ChunkRecord:
    chunk: SpeechChunk
    state: SpeechChunkState
    queued_at_ms: int
    started_at_ms: int | None = None
    completed_at_ms: int | None = None


@dataclass(slots=True)
class _GenerationRecord:
    turn_id: str
    generation_id: str
    cancellation_id: str
    generated_parts: list[str] = field(default_factory=list)
    generated_chars: int = 0
    chunks: list[_ChunkRecord] = field(default_factory=list)
    interrupted_at_ms: int | None = None
    completed: bool = False


class AssistantDeliveryLedger:
    """Chunk-level truth about generated, queued, and actually spoken text."""

    def __init__(
        self,
        *,
        max_generations: int = 64,
        max_chunks_per_generation: int = 512,
        max_generated_chars: int = 1_000_000,
    ) -> None:
        if min(max_generations, max_chunks_per_generation, max_generated_chars) < 1:
            raise ValueError("delivery limits must be positive")
        self._max_generations = max_generations
        self._max_chunks_per_generation = max_chunks_per_generation
        self._max_generated_chars = max_generated_chars
        self._records: dict[str, _GenerationRecord] = {}
        self._active_generation_id: str | None = None

    @property
    def active_generation_id(self) -> str | None:
        return self._active_generation_id

    def start_generation(
        self,
        *,
        turn_id: str,
        generation_id: str,
        cancellation_id: str,
    ) -> None:
        for name, value in (
            ("turn_id", turn_id),
            ("generation_id", generation_id),
            ("cancellation_id", cancellation_id),
        ):
            if not value.strip():
                raise ValueError(f"{name} must be non-blank")
        if generation_id in self._records:
            raise ValueError(f"generation already exists: {generation_id}")
        if self._active_generation_id is not None:
            raise RuntimeError("active generation must finish or cancel before starting another")
        if len(self._records) >= self._max_generations:
            oldest_generation_id = next(iter(self._records))
            del self._records[oldest_generation_id]
        self._records[generation_id] = _GenerationRecord(
            turn_id=turn_id,
            generation_id=generation_id,
            cancellation_id=cancellation_id,
        )
        self._active_generation_id = generation_id

    def record_generated(self, generation_id: str, text_delta: str) -> bool:
        record = self._active_record(generation_id)
        if record is None:
            return False
        if not isinstance(text_delta, str):
            raise TypeError("text_delta must be a string")
        if text_delta:
            if record.generated_chars + len(text_delta) > self._max_generated_chars:
                raise DeliveryLimitExceeded("generated assistant text exceeded its limit")
            record.generated_parts.append(text_delta)
            record.generated_chars += len(text_delta)
        return True

    def queue_chunk(self, generation_id: str, text: str, at_ms: int) -> SpeechChunk | None:
        record = self._active_record(generation_id)
        if record is None:
            return None
        self._check_timestamp(at_ms)
        if not isinstance(text, str) or not text.strip():
            raise ValueError("speech chunk text must be non-blank")
        if len(record.chunks) >= self._max_chunks_per_generation:
            raise DeliveryLimitExceeded("speech chunks exceeded the per-generation limit")
        chunk = SpeechChunk(
            chunk_id=f"{generation_id}:{len(record.chunks)}",
            turn_id=record.turn_id,
            generation_id=generation_id,
            cancellation_id=record.cancellation_id,
            text=text,
        )
        record.chunks.append(
            _ChunkRecord(
                chunk=chunk,
                state=SpeechChunkState.QUEUED,
                queued_at_ms=at_ms,
            )
        )
        return chunk

    def mark_playing(self, chunk: SpeechChunk, at_ms: int) -> bool:
        self._check_timestamp(at_ms)
        record = self._active_record(chunk.generation_id)
        item = self._find_chunk(record, chunk.chunk_id)
        if item is None or item.state is not SpeechChunkState.QUEUED:
            return False
        item.state = SpeechChunkState.PLAYING
        item.started_at_ms = at_ms
        return True

    def mark_spoken(self, chunk: SpeechChunk, at_ms: int) -> bool:
        self._check_timestamp(at_ms)
        record = self._active_record(chunk.generation_id)
        item = self._find_chunk(record, chunk.chunk_id)
        if item is None or item.state is not SpeechChunkState.PLAYING:
            return False
        item.state = SpeechChunkState.SPOKEN
        item.completed_at_ms = at_ms
        return True

    def cancel_unspoken(self, generation_id: str, at_ms: int) -> DeliverySnapshot | None:
        self._check_timestamp(at_ms)
        record = self._records.get(generation_id)
        if record is None:
            return None
        if record.completed:
            return self.snapshot(generation_id)
        if record.interrupted_at_ms is None:
            record.interrupted_at_ms = at_ms
            for item in record.chunks:
                if item.state is not SpeechChunkState.SPOKEN:
                    item.state = SpeechChunkState.CANCELLED
                    item.completed_at_ms = at_ms
        if self._active_generation_id == generation_id:
            self._active_generation_id = None
        return self.snapshot(generation_id)

    def finish_generation(self, generation_id: str) -> bool:
        if generation_id != self._active_generation_id:
            return False
        record = self._records[generation_id]
        if any(item.state is not SpeechChunkState.SPOKEN for item in record.chunks):
            return False
        record.completed = True
        self._active_generation_id = None
        return True

    def snapshot(self, generation_id: str) -> DeliverySnapshot | None:
        record = self._records.get(generation_id)
        if record is None:
            return None
        return DeliverySnapshot(
            turn_id=record.turn_id,
            generation_id=record.generation_id,
            cancellation_id=record.cancellation_id,
            generated_text="".join(record.generated_parts),
            chunks=tuple(
                DeliveredChunk(
                    chunk_id=item.chunk.chunk_id,
                    text=item.chunk.text,
                    state=item.state,
                    queued_at_ms=item.queued_at_ms,
                    started_at_ms=item.started_at_ms,
                    completed_at_ms=item.completed_at_ms,
                )
                for item in record.chunks
            ),
            interrupted_at_ms=record.interrupted_at_ms,
            completed=record.completed,
        )

    def chunk_state(self, chunk: SpeechChunk) -> SpeechChunkState | None:
        record = self._records.get(chunk.generation_id)
        item = self._find_chunk(record, chunk.chunk_id)
        return None if item is None else item.state

    def cancellation_id_for(self, generation_id: str) -> str | None:
        record = self._records.get(generation_id)
        return None if record is None else record.cancellation_id

    def _active_record(self, generation_id: str) -> _GenerationRecord | None:
        if generation_id != self._active_generation_id:
            return None
        return self._records.get(generation_id)

    @staticmethod
    def _find_chunk(
        record: _GenerationRecord | None,
        chunk_id: str,
    ) -> _ChunkRecord | None:
        if record is None:
            return None
        return next((item for item in record.chunks if item.chunk.chunk_id == chunk_id), None)

    @staticmethod
    def _check_timestamp(at_ms: int) -> None:
        if not isinstance(at_ms, int) or isinstance(at_ms, bool) or at_ms < 0:
            raise ValueError("timestamp must be a non-negative integer")


class BoundedSpeechQueue:
    """Durable bounded TTS queue; enqueue applies producer backpressure."""

    def __init__(self, ledger: AssistantDeliveryLedger, *, max_chunks: int = 8) -> None:
        if max_chunks < 1:
            raise ValueError("max_chunks must be positive")
        self.ledger = ledger
        self._queue: asyncio.Queue[SpeechChunk] = asyncio.Queue(maxsize=max_chunks)
        self._in_flight: dict[str, SpeechChunk] = {}

    @property
    def pending(self) -> int:
        return self._queue.qsize()

    async def enqueue(
        self,
        generation_id: str,
        text: str,
        *,
        at_ms: int,
        cancellation: CancellationToken,
    ) -> SpeechChunk:
        cancellation.raise_if_cancelled()
        expected_cancellation_id = self.ledger.cancellation_id_for(generation_id)
        if expected_cancellation_id is None:
            raise ValueError("cannot queue speech for a stale generation")
        if cancellation.cancellation_id != expected_cancellation_id:
            raise ValueError("speech token does not match the generation cancellation identity")
        chunk = self.ledger.queue_chunk(generation_id, text, at_ms)
        if chunk is None:
            raise ValueError("cannot queue speech for a stale generation")
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("speech enqueue requires an asyncio task")
        loop = asyncio.get_running_loop()
        remove_callback = cancellation.add_callback(
            lambda _reason: loop.call_soon_threadsafe(task.cancel)
        )
        try:
            await self._queue.put(chunk)
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                self.ledger.cancel_unspoken(generation_id, at_ms)
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        finally:
            remove_callback()
        return chunk

    async def next_chunk(self, cancellation: CancellationToken) -> SpeechChunk:
        cancellation.raise_if_cancelled()
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("speech dequeue requires an asyncio task")
        loop = asyncio.get_running_loop()
        remove_callback = cancellation.add_callback(
            lambda _reason: loop.call_soon_threadsafe(task.cancel)
        )
        try:
            while True:
                chunk = await self._queue.get()
                if self.ledger.chunk_state(chunk) is SpeechChunkState.QUEUED:
                    self._in_flight[chunk.chunk_id] = chunk
                    return chunk
                self._queue.task_done()
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        finally:
            remove_callback()

    def mark_playing(self, chunk: SpeechChunk, at_ms: int) -> bool:
        return self.ledger.mark_playing(chunk, at_ms)

    def mark_spoken(self, chunk: SpeechChunk, at_ms: int) -> bool:
        changed = self.ledger.mark_spoken(chunk, at_ms)
        if self._in_flight.pop(chunk.chunk_id, None) is not None:
            self._queue.task_done()
        return changed

    def cancel_generation(self, generation_id: str, at_ms: int) -> DeliverySnapshot | None:
        snapshot = self.ledger.cancel_unspoken(generation_id, at_ms)
        for chunk_id, chunk in tuple(self._in_flight.items()):
            if chunk.generation_id == generation_id:
                del self._in_flight[chunk_id]
                self._queue.task_done()
        retained: list[SpeechChunk] = []
        while True:
            try:
                chunk = self._queue.get_nowait()
            except asyncio.QueueEmpty:
                break
            self._queue.task_done()
            if chunk.generation_id != generation_id:
                retained.append(chunk)
        for chunk in retained:
            self._queue.put_nowait(chunk)
        return snapshot


@dataclass(frozen=True, slots=True)
class InterruptionEffects:
    cancellation_applied: bool
    response_cancellation_applied: bool
    candidate_cancellation_applied: bool
    logical_stop_latency_ms: int | None
    delivery: DeliverySnapshot | None


class InterruptionCoordinator:
    """Apply state-machine cancellation events exactly once to active work."""

    _CANCELLATION_EVENTS = frozenset(
        {
            EventType.MODEL_CANCELLED,
            EventType.STT_CANCELLED,
            EventType.TTS_CANCELLED,
            EventType.COMPONENT_ERROR,
        }
    )
    _STOP_EVENTS = frozenset(
        {EventType.MODEL_CANCELLED, EventType.TTS_CANCELLED, EventType.COMPONENT_ERROR}
    )

    def __init__(
        self,
        cancellations: CancellationRegistry,
        speech_queue: BoundedSpeechQueue,
    ) -> None:
        self._cancellations = cancellations
        self._speech_queue = speech_queue

    def apply(self, events: tuple[ProtocolEvent, ...]) -> InterruptionEffects:
        cancellation_applied = False
        response_cancellation_applied = False
        candidate_cancellation_applied = False
        delivery: DeliverySnapshot | None = None
        confirmation_ms: int | None = None
        stop_event_seen = False
        handled_generations: set[str] = set()
        for event in events:
            if event.type not in self._CANCELLATION_EVENTS:
                continue
            stop_event_seen = stop_event_seen or event.type in self._STOP_EVENTS
            if event.cancellation_id:
                reason = str(event.payload.get("reason", "component_cancelled"))
                applied = self._cancellations.cancel_if_registered(
                    event.cancellation_id,
                    reason,
                )
                cancellation_applied = applied or cancellation_applied
                if event.type == EventType.STT_CANCELLED:
                    candidate_cancellation_applied = applied or candidate_cancellation_applied
                else:
                    response_cancellation_applied = applied or response_cancellation_applied
            generation_is_bound = (
                event.generation_id is not None
                and event.cancellation_id
                == self._speech_queue.ledger.cancellation_id_for(event.generation_id)
            )
            if generation_is_bound and event.generation_id not in handled_generations:
                handled_generations.add(event.generation_id)
                delivery = self._speech_queue.cancel_generation(
                    event.generation_id,
                    event.monotonic_ms,
                )
            confirmation_ms = (
                event.monotonic_ms
                if confirmation_ms is None
                else min(confirmation_ms, event.monotonic_ms)
            )
        return InterruptionEffects(
            cancellation_applied=cancellation_applied,
            response_cancellation_applied=response_cancellation_applied,
            candidate_cancellation_applied=candidate_cancellation_applied,
            logical_stop_latency_ms=0
            if response_cancellation_applied and confirmation_ms is not None and stop_event_seen
            else None,
            delivery=delivery,
        )
