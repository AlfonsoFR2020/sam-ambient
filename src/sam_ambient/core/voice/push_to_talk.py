"""One deliberate held input, using the existing capture and recognizer ports.

Release closes capture before final recognition. Focus loss/cancellation discards
the input. No VAD endpoint, synthetic speech, playback interruption or extra stream.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import replace

from sam_ambient.core.turns import CancellationToken, TurnManager
from sam_ambient.core.voice.interfaces import AudioInput, SpeechToText, VoiceActivityDetector
from sam_ambient.core.voice.models import Transcript, VoiceStreamContext
from sam_ambient.core.voice.pipeline import VoiceInputPipeline, VoiceInputResult, VoicePipelineEnded


async def held_input(
    *,
    capture: AudioInput,
    stt: SpeechToText,
    vad: VoiceActivityDetector,
    turns: TurnManager,
    cancellation: CancellationToken,
    released: asyncio.Event,
    language: str,
    clock_ms: Callable[[], int],
    is_current: Callable[[], bool],
    publish: Callable[..., Awaitable[None]],
    on_ready: Callable[[], Awaitable[None]],
    on_final: Callable[[Transcript], Awaitable[bool]],
    on_commit: Callable[[], None],
) -> VoiceInputResult:
    """The caller retains the capture lease until this coroutine fully unwinds."""
    capture_token = CancellationToken(cancellation.cancellation_id)
    unbind = cancellation.add_callback(capture_token.cancel)
    stream = None
    frames = 0
    started = False
    finalized = False
    helper = VoiceInputPipeline(
        capture=capture, vad=vad, stt=stt, turn_manager=turns, publish=publish, language=language
    )

    def current():
        cancellation.raise_if_cancelled()
        if not is_current():
            cancellation.cancel("ptt_input_owner_retired")
            cancellation.raise_if_cancelled()

    async def collect():
        nonlocal stream, frames, started
        iterator = capture.frames(capture_token)
        try:
            async for frame in iterator:
                current()
                if released.is_set():
                    return
                if stream is None:
                    for event in turns.start_listening(
                        max(frame.monotonic_ms, clock_ms()),
                        cancellation_id=cancellation.cancellation_id,
                    ):
                        await publish(event)
                    current()
                    assert turns.turn_id is not None
                    context = VoiceStreamContext(
                        turns.session_id, turns.turn_id, cancellation.cancellation_id, language
                    )
                    stream = await stt.start_stream(context, cancellation)
                    current()
                    if stream.context != context:
                        raise VoicePipelineEnded("PTT recognizer context mismatch")
                await stream.push_audio(frame, cancellation)
                current()
                frames += 1
                # Readiness requires actual acquired PCM accepted by this STT stream.
                if not started:
                    started = True
                    await on_ready()
                level_frame = replace(frame, monotonic_ms=max(frame.monotonic_ms, clock_ms()))
                await publish(
                    helper._level_event(level_frame, vad.analyze(frame).speech_probability)
                )
        finally:
            await iterator.aclose()

    reader = asyncio.create_task(collect())
    release_wait = asyncio.create_task(released.wait())
    cancel_wait = asyncio.create_task(cancellation.wait())
    try:
        done, _ = await asyncio.wait(
            (reader, release_wait, cancel_wait), return_when=asyncio.FIRST_COMPLETED
        )
        current()
        if release_wait not in done:
            await reader  # Preserve a real capture/STT failure; EOF is not a key release.
            raise VoicePipelineEnded("PTT capture ended before release")
        if not started:
            cancellation.cancel("ptt_released_before_capture")
            cancellation.raise_if_cancelled()
        capture_token.cancel("ptt_released")
        reader.cancel()
        outcome = (await asyncio.gather(reader, return_exceptions=True))[0]
        if isinstance(outcome, Exception):
            raise outcome
        current()
        assert stream is not None
        result = await VoiceInputPipeline._finalize_stream(stream, cancellation)
        finalized = True
        current()
        if not result.text:
            return VoiceInputResult(result, frames)
        if await on_final(result):
            current()
            return VoiceInputResult(result, frames, True)
        current()
        for event in turns.on_transcript(
            clock_ms(), result.text, is_final=True, confidence=result.confidence
        ):
            await publish(event)
        current()
        # Only TurnManager can establish commitment, after final recognition and release.
        committed_events = turns.commit_push_to_talk(clock_ms())
        on_commit()  # Atomically transfer input ownership before publisher backpressure.
        for event in committed_events:
            await publish(event)
        return VoiceInputResult(result, frames)
    finally:
        capture_token.cancel("ptt_capture_retired")
        reader.cancel()
        release_wait.cancel()
        cancel_wait.cancel()
        # Keep the caller's single capture lease while a noncooperative adapter unwinds.
        await asyncio.gather(reader, release_wait, cancel_wait, return_exceptions=True)
        unbind()
        if stream is not None and not finalized:
            await stream.cancel(cancellation.cancellation_id, "ptt_stream_retired")
        if turns.state.value != "COMMITTING":
            for event in turns.cancel_input(clock_ms(), cancellation.reason or "ptt_input_retired"):
                await publish(event)
