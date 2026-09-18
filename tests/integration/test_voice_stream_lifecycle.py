"""Real pipeline/runtime orchestration with strict terminal STT streams, no hardware."""

import asyncio

import pytest

from sam_ambient.adapters.stt.whisper_cpp import SpeechRecognitionProtocolError
from sam_ambient.core.protocol import ControlCommand, ControlCommandType, EventBus, EventType
from sam_ambient.core.providers import ModelEvent, ModelEventKind
from sam_ambient.core.turns import CancellationToken, TurnManager, VoiceState
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    Transcript,
    VadResult,
    VoiceInputPipeline,
)
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.unit.test_conversation_context import ConversationProvider
from tests.unit.test_phase9_packaging import _FakeOutput, _FakeTts


class StrictStream:
    def __init__(self, token, text, confidence):
        self.token = token
        self.text = text
        self.confidence = confidence
        self.finalizations = 0
        self.closed = False
        self.frames = 0

    async def push_audio(self, frame, cancellation):
        assert cancellation is self.token
        if self.closed:
            raise SpeechRecognitionProtocolError("cannot append audio after STT finalization")
        cancellation.raise_if_cancelled()
        self.frames += 1

    async def partial_transcript(self):
        return None

    async def finalize(self, cancellation):
        assert not self.closed
        cancellation.raise_if_cancelled()
        self.closed = True
        self.finalizations += 1
        return Transcript(self.text, True, self.confidence)

    async def cancel(self, cancellation_id, reason="cancelled"):
        assert cancellation_id == self.token.cancellation_id
        self.closed = True
        return self.token.cancel(reason)


class StrictStt:
    def __init__(self, candidate="uh", confidence=0.2):
        self.candidate = candidate
        self.confidence = confidence
        self.streams = []
        self.normal = True

    async def start_stream(self, context, cancellation):
        stream = StrictStream(
            cancellation,
            "Tell me something." if self.normal else self.candidate,
            0.9 if self.normal else self.confidence,
        )
        self.streams.append(stream)
        return stream

    async def aclose(self):
        pass


class SignalVad:
    def analyze(self, frame):
        return VadResult(bool(frame.data[0]), float(bool(frame.data[0])))


class GatedProvider(ConversationProvider):
    def __init__(self):
        super().__init__()
        self.release = asyncio.Event()

    async def stream_chat(self, messages, tools, *, model, cancellation):
        await self.release.wait()
        cancellation.raise_if_cancelled()
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "Your color is green.")
        yield ModelEvent(ModelEventKind.COMPLETED)


class HandoffProvider(ConversationProvider):
    def __init__(
        self,
        *,
        gate_first: bool = False,
        first_answer: str = "answer A",
        second_answer: str = "answer B",
    ):
        super().__init__()
        self.gate_first = gate_first
        self.first_answer = first_answer
        self.second_answer = second_answer
        self.first_started = asyncio.Event()
        self.second_started = asyncio.Event()
        self.release_first = asyncio.Event()
        self.requests = 0

    async def stream_chat(self, messages, tools, *, model, cancellation):
        del messages, tools, model
        self.requests += 1
        if self.requests == 1:
            self.first_started.set()
            while self.gate_first and not self.release_first.is_set():
                cancellation.raise_if_cancelled()
                await asyncio.sleep(0)
            cancellation.raise_if_cancelled()
            yield ModelEvent(ModelEventKind.TEXT_DELTA, self.first_answer)
        else:
            self.second_started.set()
            cancellation.raise_if_cancelled()
            yield ModelEvent(ModelEventKind.TEXT_DELTA, self.second_answer)
        yield ModelEvent(ModelEventKind.COMPLETED)


class TrackingTts(_FakeTts):
    def __init__(self):
        self.texts = []

    async def synthesize(self, text, *, voice, language, cancellation):
        self.texts.append(text)
        async for frame in super().synthesize(
            text,
            voice=voice,
            language=language,
            cancellation=cancellation,
        ):
            yield frame


class BlockingFirstOutput(_FakeOutput):
    def __init__(self):
        super().__init__()
        self.first_started = asyncio.Event()
        self.release_first = asyncio.Event()
        self.play_calls = 0
        self.frames_by_call = []

    async def play(self, frames, cancellation):
        self.token = cancellation
        self.play_calls += 1
        call_frames = 0
        async for _frame in frames:
            cancellation.raise_if_cancelled()
            call_frames += 1
            if self.play_calls == 1 and call_frames == 1:
                self.first_started.set()
                while not self.release_first.is_set():
                    cancellation.raise_if_cancelled()
                    await asyncio.sleep(0)
        self.frames += call_frames
        self.frames_by_call.append(call_frames)


class PlaybackCandidateCapture:
    def __init__(self, runtime, *, attempts=1):
        self.runtime = runtime
        self.attempts = attempts

    async def frames(self, cancellation):
        at_ms = self.runtime._last_event_ms
        for _ in range(self.attempts):
            for delta, speech in ((20, 1), (200, 1), (20, 0), (400, 0), (1_200, 0)):
                cancellation.raise_if_cancelled()
                at_ms += delta
                yield AudioFrame(
                    AudioFormat(sample_rate_hz=1_000),
                    bytes([speech, 0]) * 20,
                    at_ms,
                    at_ms // 20,
                )
                await asyncio.sleep(0)


class TextResponseBargeInCapture(PlaybackCandidateCapture):
    def __init__(self, runtime, *, playback_started=None):
        super().__init__(runtime)
        self.calls = 0
        self.initial_listening = asyncio.Event()
        self.playback_started = playback_started

    async def frames(self, cancellation):
        self.calls += 1
        if self.calls == 1:
            self.initial_listening.set()
            at_ms = self.runtime._last_event_ms
            while True:
                cancellation.raise_if_cancelled()
                at_ms += 20
                yield AudioFrame(
                    AudioFormat(sample_rate_hz=1_000),
                    b"\0\0" * 20,
                    at_ms,
                    at_ms // 20,
                )
                await asyncio.sleep(0)
        else:
            if self.playback_started is not None:
                await self.playback_started.wait()
            async for frame in super().frames(cancellation):
                yield frame


class SequencedStt(StrictStt):
    def __init__(self, candidates):
        super().__init__()
        self.candidates = iter(candidates)

    async def start_stream(self, context, cancellation):
        text, confidence = next(self.candidates)
        stream = StrictStream(cancellation, text, confidence)
        self.streams.append(stream)
        return stream


def committed_voice_turn(runtime, text):
    manager = TurnManager(runtime.session_id)
    manager.start_listening(0)
    manager.on_vad(10, 1.0)
    manager.on_vad(210, 1.0)
    manager.on_transcript(220, text, is_final=True, confidence=0.99)
    manager.on_vad(230, 0.0)
    manager.on_time(1_330)
    assert manager.state is VoiceState.COMMITTING
    runtime.voice_turns = manager
    assert manager.cancellation_id is not None
    return Transcript(text, True, 0.99), runtime.cancellations.create(manager.cancellation_id)


class ScriptCapture:
    def __init__(self, clock, provider):
        self.clock = clock
        self.provider = provider
        self.normal = True
        self.failure = None
        self.calls = 0

    async def frames(self, cancellation):
        self.calls += 1
        if self.failure is not None:
            error, self.failure = self.failure, None
            if isinstance(error, SpeechRecognitionProtocolError):
                self.provider.release.set()
            raise error
        script = (
            [(20, 0), (20, 1), (200, 1), (20, 0), (1200, 0)]
            if self.normal
            else [(20, 1), (80, 0), (400, 0), (20, 0), (20, 1), (80, 0), (400, 0)]
        )
        try:
            for delta, speech in script:
                cancellation.raise_if_cancelled()
                self.clock[0] += delta
                yield AudioFrame(
                    AudioFormat(sample_rate_hz=1000),
                    bytes([speech, 0]) * 20,
                    self.clock[0],
                    self.clock[0] // 20,
                )
                await asyncio.sleep(0)
        finally:
            if not self.normal:
                self.provider.release.set()


class CompletionRaceCapture:
    def __init__(self, generation_id):
        self.runtime = None
        self.generation_id = generation_id
        self.monitor_token = None
        self.closed = False

    async def frames(self, cancellation):
        self.monitor_token = cancellation
        try:
            assert self.runtime is not None
            events = self.runtime.voice_turns.on_tts_completed(
                1_490, generation_id=self.generation_id
            )
            for event in events:
                await self.runtime.events.publish(event)
            yield AudioFrame(AudioFormat(sample_rate_hz=1_000), b"\0\0" * 20, 1_500, 75)
        finally:
            self.closed = True


def test_monitor_tears_down_when_tts_completion_reaches_idle_before_response_task(tmp_path):
    async def scenario():
        generation_id = "generation-completion-race"
        capture = CompletionRaceCapture(generation_id)
        runtime = SamRuntime(
            ConversationProvider(),
            RuntimeConfig(tmp_path, port=0),
            voice=RuntimeVoiceAdapters(capture, SignalVad(), StrictStt()),
        )
        capture.runtime = runtime
        cancellation_id = "cancel-completion-race"
        turn_id = "turn-completion-race"
        manager = runtime.voice_turns
        manager.start_listening(0, turn_id=turn_id, cancellation_id=cancellation_id)
        manager.on_vad(10, 1.0)
        manager.on_vad(210, 1.0)
        manager.on_transcript(220, "Tell me something.", is_final=True, confidence=0.99)
        manager.on_vad(230, 0.0)
        manager.on_time(1_330)
        manager.on_model_started(
            1_340,
            generation_id=generation_id,
            cancellation_id=cancellation_id,
        )
        manager.on_tts_started(1_350, generation_id=generation_id)
        response_token = runtime.cancellations.create(cancellation_id)
        runtime.delivery.start_generation(
            turn_id=turn_id,
            generation_id=generation_id,
            cancellation_id=cancellation_id,
        )
        runtime._active_generation_id = generation_id
        runtime._active_token = response_token
        release_response = asyncio.Event()

        async def finish_response():
            await release_response.wait()

        response = asyncio.create_task(finish_response())
        try:
            assert await runtime._monitor_barge_in(response) is None
            assert manager.state is VoiceState.IDLE
            assert not response.done()
            assert not response_token.is_cancelled
            assert capture.closed
            assert capture.monitor_token is not None
            assert capture.monitor_token.is_cancelled
            assert capture.monitor_token.reason == "barge_in_monitor_stopped"
        finally:
            release_response.set()
            await response
            await runtime.close()

    asyncio.run(asyncio.wait_for(scenario(), 2))


@pytest.mark.parametrize("candidate", ["uh", "[BLANK_AUDIO]", "Your color is green."])
def test_three_turns_rejected_final_candidates_do_not_poison_tts(tmp_path, candidate):
    async def scenario():
        clock = [0]
        provider = GatedProvider()
        capture = ScriptCapture(clock, provider)
        stt = StrictStt(candidate)
        output = _FakeOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=512)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )

        def next_ms():
            clock[0] += 1
            runtime._last_event_ms = clock[0]
            return clock[0]

        runtime._next_event_ms = next_ms
        try:
            for _turn in range(3):
                provider.release.clear()
                capture.normal = stt.normal = True
                runtime.voice_turns = TurnManager(runtime.session_id)
                token = runtime.cancellations.create()
                result = await VoiceInputPipeline(
                    capture=capture,
                    vad=SignalVad(),
                    stt=stt,
                    turn_manager=runtime.voice_turns,
                    publish=events.publish,
                ).run(token)
                response = await runtime._start_voice_turn(result.transcript, token)
                capture.normal = stt.normal = False
                assert await runtime._monitor_response_capture(response) is None
                await response
                assert runtime.voice_turns.state is VoiceState.IDLE
                assert not token.is_cancelled
            assert output.frames == 3 * _FakeTts.frame_count
            assert len(stt.streams) == 9  # one user + two independent candidates per turn
            assert all(stream.finalizations == 1 for stream in stt.streams)
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            model_completions = [
                event for event in observed if event.type == EventType.MODEL_COMPLETED
            ]
            assert len(model_completions) == 3
            assert all(
                event.payload.get("text") == "Your color is green."
                and event.payload.get("outcome") == "completed"
                for event in model_completions
            )
            assert sum(event.type == EventType.TTS_COMPLETED for event in observed) == 3
            assert not any(event.type == EventType.COMPONENT_ERROR for event in observed)
            assert not any(event.payload.get("to") == "OFFLINE" for event in observed)
        finally:
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_rejected_short_noise_disposes_normal_stt_buffer():
    async def scenario():
        provider = GatedProvider()
        capture = ScriptCapture([0], provider)
        capture.normal = False  # 80 ms bursts separated by silence
        stt = StrictStt()
        token = CancellationToken("noise")

        async def publish(_event):
            pass

        result = await VoiceInputPipeline(
            capture=capture,
            vad=SignalVad(),
            stt=stt,
            turn_manager=TurnManager("noise"),
            publish=publish,
        ).run(token)
        assert result.transcript.text == ""
        assert len(stt.streams) == 1
        assert stt.streams[0].closed
        assert stt.streams[0].finalizations == 0
        assert token.is_cancelled

    asyncio.run(scenario())


def test_final_confidence_change_cannot_reopen_or_refinalize_normal_stream():
    async def scenario():
        class Capture:
            async def frames(self, cancellation):
                for at_ms, speech in [
                    (0, 0),
                    (20, 1),
                    (220, 1),
                    (240, 0),
                    (640, 0),
                    (660, 1),
                    (1440, 0),
                ]:
                    yield AudioFrame(
                        AudioFormat(sample_rate_hz=1000),
                        bytes([speech, 0]) * 20,
                        at_ms,
                        at_ms // 20,
                    )

        class Stt(StrictStt):
            async def start_stream(self, context, cancellation):
                stream = await super().start_stream(context, cancellation)
                stream.confidence = 0.1

                async def early_result():
                    return Transcript("A tentative sentence.", True, 0.9)

                stream.partial_transcript = early_result
                return stream

        async def publish(_event):
            pass

        stt = Stt()
        manager = TurnManager("confidence")
        result = await VoiceInputPipeline(
            capture=Capture(),
            vad=SignalVad(),
            stt=stt,
            turn_manager=manager,
            publish=publish,
        ).run(CancellationToken("confidence"))
        assert result.transcript.confidence == 0.1
        assert manager.state is VoiceState.COMMITTING
        assert stt.streams[0].finalizations == 1
        assert stt.streams[0].frames == 5

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "error,retries",
    [
        (OSError("device lost"), 1),
        (SpeechRecognitionProtocolError("invalid candidate lifecycle"), 0),
    ],
)
def test_capture_fault_keeps_inflight_response_eligible_for_tts(tmp_path, error, retries):
    async def scenario():
        clock = [0]
        provider = GatedProvider()
        capture = ScriptCapture(clock, provider)
        stt = StrictStt()
        output = _FakeOutput()
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )

        def next_ms():
            clock[0] += 1
            runtime._last_event_ms = clock[0]
            return clock[0]

        runtime._next_event_ms = next_ms
        try:
            token = runtime.cancellations.create()
            result = await VoiceInputPipeline(
                capture=capture,
                vad=SignalVad(),
                stt=stt,
                turn_manager=runtime.voice_turns,
                publish=runtime.events.publish,
            ).run(token)
            response = await runtime._start_voice_turn(result.transcript, token)
            capture.normal = stt.normal = False
            capture.failure = error
            assert await runtime._monitor_response_capture(response) is None
            await response
            assert capture.calls == 2 + retries
            assert runtime.voice_turns.state is VoiceState.IDLE
            assert output.frames == _FakeTts.frame_count
            assert not token.is_cancelled
        finally:
            await runtime.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_final_candidate_cancels_old_response_once_and_starts_fresh_turn(tmp_path):
    async def scenario():
        clock = [0]
        provider = GatedProvider()
        capture = ScriptCapture(clock, provider)
        stt = StrictStt("Please stop and listen.", 0.9)
        output = _FakeOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )

        def next_ms():
            clock[0] += 1
            runtime._last_event_ms = clock[0]
            return clock[0]

        runtime._next_event_ms = next_ms
        try:
            token = runtime.cancellations.create()
            result = await VoiceInputPipeline(
                capture=capture,
                vad=SignalVad(),
                stt=stt,
                turn_manager=runtime.voice_turns,
                publish=events.publish,
            ).run(token)
            response = await runtime._start_voice_turn(result.transcript, token)
            # The old generation may be both reasoning and playing queued speech.
            runtime.voice_turns.on_tts_started(
                next_ms(), generation_id=runtime._active_generation_id
            )
            capture.normal = stt.normal = False
            committed = await runtime._monitor_response_capture(response)
            assert committed is not None
            await response
            assert token.is_cancelled
            assert not committed[1].is_cancelled
            assert runtime.voice_turns.state is VoiceState.COMMITTING
            assert stt.streams[-1].finalizations == 1
            fresh = await runtime._start_voice_turn(*committed)
            await fresh
            assert runtime.voice_turns.state is VoiceState.IDLE
            assert output.frames == _FakeTts.frame_count
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert sum(event.type == EventType.MODEL_CANCELLED for event in observed) == 1
            assert sum(event.type == EventType.TTS_CANCELLED for event in observed) == 1
        finally:
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_committed_voice_turn_replaces_generation_during_active_playback(tmp_path):
    async def scenario():
        provider = HandoffProvider()
        tts = TrackingTts()
        output = BlockingFirstOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            tts=tts,
            audio_output=output,
        )
        try:
            first = await runtime._start_voice_turn(
                *committed_voice_turn(runtime, "first voice turn")
            )
            first_generation = runtime.active_generation_id
            assert first_generation is not None
            await output.first_started.wait()
            assert runtime.delivery.active_generation_id == first_generation

            second = await runtime._start_voice_turn(
                *committed_voice_turn(runtime, "replacement voice turn")
            )
            second_generation = runtime.active_generation_id
            assert second_generation not in {None, first_generation}
            await asyncio.gather(first, second)

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            first_delivery_terminals = [
                event
                for event in observed
                if event.generation_id == first_generation
                and event.type in {EventType.TTS_COMPLETED, EventType.TTS_CANCELLED}
            ]
            second_authority = next(
                index
                for index, event in enumerate(observed)
                if event.generation_id == second_generation
            )
            assert len(first_delivery_terminals) == 1
            assert first_delivery_terminals[0].type == EventType.TTS_CANCELLED
            assert observed.index(first_delivery_terminals[0]) < second_authority
            assert not any(
                event.type == EventType.COMPONENT_ERROR
                and "active generation must finish" in str(event.payload.get("error", ""))
                for event in observed
            )
            assert not any(
                index > second_authority
                and event.generation_id == first_generation
                and event.type
                in {EventType.MODEL_DELTA, EventType.TTS_LEVEL, EventType.TRANSCRIPT_FINAL}
                for index, event in enumerate(observed)
            )
            first_snapshot = runtime.delivery.snapshot(first_generation)
            second_snapshot = runtime.delivery.snapshot(second_generation)
            assert first_snapshot is not None and first_snapshot.interrupted_at_ms is not None
            assert second_snapshot is not None and second_snapshot.completed
            assert tts.texts == ["answer A", "answer B"]
            assert output.frames_by_call == [
                _FakeTts.frame_count,
            ]  # only B reaches completed playback
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_committed_voice_turn_replaces_generation_waiting_for_first_output(tmp_path):
    async def scenario():
        provider = HandoffProvider(gate_first=True)
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            tts=_FakeTts(),
            audio_output=_FakeOutput(),
        )
        try:
            first = await runtime._start_voice_turn(
                *committed_voice_turn(runtime, "first voice turn")
            )
            first_generation = runtime.active_generation_id
            assert first_generation is not None
            await provider.first_started.wait()

            second = await runtime._start_voice_turn(
                *committed_voice_turn(runtime, "replacement voice turn")
            )
            second_generation = runtime.active_generation_id
            assert second_generation not in {None, first_generation}
            provider.release_first.set()
            await asyncio.gather(first, second)

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            first_terminals = [
                event
                for event in observed
                if event.generation_id == first_generation
                and event.type
                in {EventType.MODEL_COMPLETED, EventType.MODEL_CANCELLED, EventType.COMPONENT_ERROR}
            ]
            second_authority = next(
                index
                for index, event in enumerate(observed)
                if event.generation_id == second_generation
            )
            assert len(first_terminals) == 1
            assert first_terminals[0].type == EventType.MODEL_CANCELLED
            assert first_terminals[0].payload["reason"] == "superseded_by_new_user_turn"
            assert observed.index(first_terminals[0]) < second_authority
            assert not any(
                event.type == EventType.MODEL_DELTA and event.generation_id == first_generation
                for event in observed
            )
            assert not any(
                event.type == EventType.COMPONENT_ERROR
                and "active generation must finish" in str(event.payload.get("error", ""))
                for event in observed
            )
        finally:
            provider.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_playback_echo_is_explicitly_rejected_without_false_user_turn(tmp_path):
    async def scenario():
        spoken = "The answer is forty two and here is why."
        provider = HandoffProvider(first_answer=spoken)
        output = BlockingFirstOutput()
        stt = SequencedStt([(spoken, None)])
        capture = PlaybackCandidateCapture(None)
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )
        capture.runtime = runtime
        first_transcript, first_token = committed_voice_turn(runtime, "first voice turn")
        try:
            response = await runtime._start_voice_turn(first_transcript, first_token)
            await output.first_started.wait()
            assert await runtime._monitor_response_capture(response) is None
            assert not first_token.is_cancelled
            assert runtime.delivery.active_generation_id == runtime.active_generation_id

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            rejections = [
                event
                for event in observed
                if event.type == EventType.STT_CANCELLED
                and event.payload.get("reason") == "playback_echo"
            ]
            assert len(rejections) == 1
            assert not any(event.type == EventType.TURN_COMMITTED for event in observed[1:])
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_typed_answer_routes_active_microphone_into_real_voice_interruption(tmp_path):
    """Reproduce the physical text -> TTS -> live microphone failure end to end."""

    async def scenario():
        provider = HandoffProvider(
            first_answer="The first typed answer is still playing.",
            second_answer="The replacement voice answer.",
        )
        output = BlockingFirstOutput()
        stt = SequencedStt([("Stop and answer my voice question.", None)])
        capture = TextResponseBargeInCapture(None, playback_started=output.first_started)
        events = EventBus()
        subscription = await events.subscribe(max_queue=256)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )
        capture.runtime = runtime
        runtime._voice_task = asyncio.create_task(runtime._voice_loop())
        try:
            await capture.initial_listening.wait()
            first_generation = runtime.submit_user_message("typed request")
            await output.first_started.wait()
            await asyncio.wait_for(provider.second_started.wait(), 0.5)
            await runtime._active_done.wait()

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert (
                sum(
                    event.type == EventType.TTS_CANCELLED
                    and event.generation_id == first_generation
                    for event in observed
                )
                == 1
            )
            assert (
                sum(
                    event.type == EventType.TURN_COMMITTED
                    and event.payload.get("text") == "Stop and answer my voice question."
                    for event in observed
                )
                == 1
            )
            assert provider.requests == 2
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


@pytest.mark.parametrize(
    "candidate,expected_user_text",
    [
        ("Please stop and tell me the weather.", "Please stop and tell me the weather."),
        ("The answer is forty two stop", "stop"),
    ],
)
def test_unscored_final_voice_during_playback_becomes_replacement_turn(
    tmp_path, candidate, expected_user_text
):
    async def scenario():
        spoken = "The answer is forty two and here is why."
        provider = HandoffProvider(
            first_answer=spoken,
            second_answer="The replacement answer.",
        )
        output = BlockingFirstOutput()
        stt = SequencedStt([(candidate, None)])
        capture = PlaybackCandidateCapture(None)
        events = EventBus()
        subscription = await events.subscribe(max_queue=256)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )
        capture.runtime = runtime
        first_transcript, first_token = committed_voice_turn(runtime, "first voice turn")
        try:
            first = await runtime._start_voice_turn(first_transcript, first_token)
            first_generation = runtime.active_generation_id
            await output.first_started.wait()
            committed = await runtime._monitor_response_capture(first)
            assert committed is not None
            assert committed[0].text == expected_user_text
            await first
            second = await runtime._start_voice_turn(*committed)
            second_generation = runtime.active_generation_id
            await second

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert (
                sum(
                    event.type == EventType.TTS_CANCELLED
                    and event.generation_id == first_generation
                    for event in observed
                )
                == 1
            )
            assert (
                sum(
                    event.type == EventType.TURN_COMMITTED
                    and event.payload.get("text") == expected_user_text
                    for event in observed
                )
                == 1
            )
            assert any(
                event.type == EventType.MODEL_COMPLETED and event.generation_id == second_generation
                for event in observed
            )
            assert provider.requests == 2
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_rejected_echo_then_real_interruption_commits_only_one_replacement(tmp_path):
    async def scenario():
        spoken = "The answer is forty two and here is why."
        provider = HandoffProvider(first_answer=spoken, second_answer="Replacement complete.")
        output = BlockingFirstOutput()
        stt = SequencedStt([(spoken, None), ("Stop and listen to me.", None)])
        capture = PlaybackCandidateCapture(None, attempts=2)
        events = EventBus()
        subscription = await events.subscribe(max_queue=256)
        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, port=0),
            events=events,
            voice=RuntimeVoiceAdapters(capture, SignalVad(), stt),
            tts=_FakeTts(),
            audio_output=output,
        )
        capture.runtime = runtime
        first_transcript, first_token = committed_voice_turn(runtime, "first voice turn")
        try:
            first = await runtime._start_voice_turn(first_transcript, first_token)
            await output.first_started.wait()
            committed = await runtime._monitor_response_capture(first)
            assert committed is not None and committed[0].text == "Stop and listen to me."
            await first
            replacement = await runtime._start_voice_turn(*committed)
            await replacement

            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert sum(event.type == EventType.TURN_COMMITTED for event in observed) == 1
            assert sum(event.type == EventType.TTS_CANCELLED for event in observed) == 1
            assert (
                sum(
                    event.type == EventType.STT_CANCELLED
                    and event.payload.get("reason") == "playback_echo"
                    for event in observed
                )
                == 1
            )
            assert provider.requests == 2
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_stop_speaking_preserves_answer_and_allows_future_playback(tmp_path):
    async def scenario():
        output = BlockingFirstOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            HandoffProvider(first_answer="First complete answer.", second_answer="Second answer."),
            RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db"),
            events=events,
            tts=_FakeTts(),
            audio_output=output,
        )
        try:
            first_generation = runtime.submit_user_message("first request")
            await output.first_started.wait()
            await runtime.controls.dispatch(
                ControlCommand(
                    type=ControlCommandType.STOP_SPEAKING,
                    command_id="stop",
                    monotonic_ms=runtime._next_event_ms(),
                    session_id=runtime.session_id,
                )
            )
            await runtime._active_done.wait()
            second_generation = runtime.submit_user_message("second request")
            await runtime._active_done.wait()

            assert runtime.state is not None
            messages = runtime.state.recent(limit=10)
            assert [(item.role, item.content) for item in messages] == [
                ("user", "first request"),
                ("assistant", "First complete answer."),
                ("user", "second request"),
                ("assistant", "Second answer."),
            ]
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert (
                sum(
                    event.type == EventType.TTS_CANCELLED
                    and event.generation_id == first_generation
                    for event in observed
                )
                == 1
            )
            assert any(
                event.type == EventType.MODEL_COMPLETED and event.generation_id == second_generation
                for event in observed
            )
            assert output.play_calls == 2
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))


def test_mute_stops_current_playback_and_keeps_future_text_answers(tmp_path):
    async def scenario():
        output = BlockingFirstOutput()
        events = EventBus()
        subscription = await events.subscribe(max_queue=128)
        runtime = SamRuntime(
            HandoffProvider(first_answer="First complete answer.", second_answer="Muted answer."),
            RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db"),
            events=events,
            tts=_FakeTts(),
            audio_output=output,
        )
        try:
            first_generation = runtime.submit_user_message("first request")
            await output.first_started.wait()
            acknowledgement = await runtime.controls.dispatch(
                ControlCommand(
                    type=ControlCommandType.TTS_OUTPUT_SET,
                    command_id="mute",
                    monotonic_ms=runtime._next_event_ms(),
                    session_id=runtime.session_id,
                    payload={"enabled": False},
                )
            )
            assert acknowledgement.payload["tts_output_enabled"] is False
            await runtime._active_done.wait()
            second_generation = runtime.submit_user_message("muted request")
            await runtime._active_done.wait()

            assert runtime.state is not None
            messages = runtime.state.recent(limit=10)
            assert [(item.role, item.content) for item in messages] == [
                ("user", "first request"),
                ("assistant", "First complete answer."),
                ("user", "muted request"),
                ("assistant", "Muted answer."),
            ]
            observed = []
            while subscription.pending:
                observed.append(await subscription.get())
            assert (
                sum(
                    event.type == EventType.TTS_CANCELLED
                    and event.generation_id == first_generation
                    for event in observed
                )
                == 1
            )
            assert any(
                event.type == EventType.MODEL_COMPLETED and event.generation_id == second_generation
                for event in observed
            )
            assert output.play_calls == 1
        finally:
            output.release_first.set()
            await runtime.close()
            await subscription.close()

    asyncio.run(asyncio.wait_for(scenario(), 3))
