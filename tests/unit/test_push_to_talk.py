"""Held keyboard input through real core ownership and in-memory audio/STT only."""

import asyncio
from dataclasses import replace
from uuid import UUID, uuid4

import pytest

from sam_ambient.core.owner import OwnerConnection, OwnerSession
from sam_ambient.core.protocol import ControlCommand, EventType
from sam_ambient.core.voice import AudioFormat, AudioFrame, Transcript
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.integration.test_core_experience import Vad
from tests.unit.test_local_controls import RecordingProvider


async def until(predicate):
    async with asyncio.timeout(2):
        while not predicate():  # noqa: ASYNC110 -- bounded independent task/SQLite completion
            await asyncio.sleep(0.001)


class Capture:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.opened = self.active = self.maximum_active = 0

    async def frames(self, cancellation):
        self.opened += 1
        self.active += 1
        self.maximum_active = max(self.maximum_active, self.active)
        try:
            while True:
                cancellation.raise_if_cancelled()
                yield await self.queue.get()
        finally:
            self.active -= 1

    def pcm(self):
        self.queue.put_nowait(AudioFrame(AudioFormat(), b"\x10\x01" * 320, 1, 0))


class Stt:
    def __init__(self):
        self.contexts = []
        self.final_calls = self.cancel_calls = 0
        self.result = Transcript("Una prueba. An English test.", True, 0.95)
        self.fail = False
        self.foreign = False
        self.gate = None
        self.ignore_cancel = False

    async def start_stream(self, context, cancellation):
        self.contexts.append(context)
        provider = self

        class Stream:
            @property
            def context(self):
                if provider.foreign:
                    from dataclasses import replace

                    return replace(context, cancellation_id="foreign")
                return context

            async def push_audio(self, frame, token):
                token.raise_if_cancelled()

            async def finalize(self, token):
                provider.final_calls += 1
                if provider.gate is not None:
                    try:
                        await provider.gate.wait()
                    except asyncio.CancelledError:
                        if not provider.ignore_cancel:
                            raise
                        await provider.gate.wait()
                if provider.fail:
                    raise RuntimeError("synthetic failure")
                return provider.result

            async def cancel(self, cancellation_id, reason):
                provider.cancel_calls += 1
                return cancellation.cancel(reason)

        return Stream()

    async def aclose(self):
        pass


def fixture(root):
    capture, stt = Capture(), Stt()
    runtime = SamRuntime(
        RecordingProvider("fixture"),
        RuntimeConfig(root, state_db=root / "state.db", model="fixture"),
        voice=RuntimeVoiceAdapters(capture, Vad(), stt),
    )
    owner = OwnerConnection(OwnerSession(), runtime.session_id)
    observed = []
    original_publish = runtime.events.publish

    async def publish(event):
        observed.append(event)
        await original_publish(event)

    runtime.events.publish = publish
    return runtime, owner, capture, stt, observed


async def command(runtime, owner, kind, payload, *, session=None):
    return await runtime.controls.dispatch(
        ControlCommand(
            type=kind,
            command_id=str(uuid4()),
            monotonic_ms=1,
            session_id=session or runtime.session_id,
            payload=payload,
        ),
        owner_connection=owner,
    )


async def arm(runtime, owner):
    result = await command(runtime, owner, "control.voice_input_mode.set", {"mode": "push_to_talk"})
    assert result.type == EventType.CONTROL_ACKNOWLEDGED


async def gesture(runtime, owner, action="start", identity=None):
    identity = identity or str(uuid4())
    result = await command(
        runtime, owner, "control.push_to_talk", {"action": action, "gesture_id": identity}
    )
    return identity, result


@pytest.mark.parametrize("language", ["en", "es"])
def test_release_finalizes_once_commits_final_and_preserves_exact_route(tmp_path, language):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        runtime.config = replace(runtime.config, language=language)
        try:
            await arm(runtime, owner)
            assert capture.opened == 0  # Arming is not device acquisition.
            identity, ack = await gesture(runtime, owner)
            assert ack.type == EventType.CONTROL_ACKNOWLEDGED
            assert runtime._input_state == "starting"
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            assert not any(e.type == EventType.TURN_COMMITTED for e in events)
            await gesture(runtime, owner, "finish", identity)
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: runtime._ptt_task is None)
            committed = [e for e in events if e.type == EventType.TURN_COMMITTED]
            assert len(committed) == 1
            assert committed[0].payload["text"] == stt.result.text
            assert stt.contexts[0].language == language
            assert stt.final_calls == 1 and stt.cancel_calls == 0
            assert capture.active == 0 and capture.maximum_active == 1
            assert any(e.type == EventType.MODEL_COMPLETED for e in events)
            assert runtime._active_done.is_set()
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_fast_release_never_claims_capture_or_commits(tmp_path):
    async def scenario():
        runtime, owner, _capture, stt, events = fixture(tmp_path)
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: runtime._ptt_task is None)
            assert stt.final_calls == 0 and not stt.contexts
            assert not any(e.type == EventType.TURN_COMMITTED for e in events)
            assert runtime._input_state == "cancelled"
            assert runtime.cancellations._tokens == {}
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "terminal",
    ["cancel", "mute", "disconnect", "emergency", "shutdown", "mode", "timeout", "typed"],
)
def test_lost_input_ownership_discards_pcm_and_keeps_typing_usable(tmp_path, terminal):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            if terminal == "cancel":
                await gesture(runtime, owner, "cancel", identity)
            elif terminal == "mute":
                await runtime._set_microphone(False)
            elif terminal == "disconnect":
                owner.retire()
                await runtime._detach_owner(owner)
            elif terminal == "emergency":
                await command(runtime, owner, "control.emergency_stop", {})
            elif terminal == "shutdown":
                await command(runtime, owner, "control.application.quit", {})
            elif terminal == "mode":
                await command(runtime, owner, "control.voice_input_mode.set", {"mode": "ordinary"})
            elif terminal == "timeout":
                runtime._expire_ptt(runtime._ptt)
            else:
                runtime.submit_user_message("Typed recovery")
            await until(lambda: runtime._ptt_task is None)
            assert stt.final_calls == 0 and stt.cancel_calls == 1
            assert not any(
                e.type == EventType.TURN_COMMITTED and e.payload.get("text") == stt.result.text
                for e in events
            )
            if terminal not in ("shutdown", "mode", "typed"):
                runtime.submit_user_message("Typed recovery")
            await until(lambda: runtime._active_done.is_set())
            assert capture.maximum_active == 1
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("failure", ["empty", "provisional", "failure", "foreign"])
def test_recognition_failure_or_invalid_result_does_not_commit(tmp_path, failure):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        stt.result = (
            Transcript("", True)
            if failure == "empty"
            else Transcript("Uncommitted", failure != "provisional")
        )
        stt.fail, stt.foreign = failure == "failure", failure == "foreign"
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state in {"capturing", "failed"})
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: runtime._ptt_task is None)
            assert not any(e.type == EventType.TURN_COMMITTED for e in events)
            runtime.submit_user_message("Text still works")
            await until(lambda: runtime._active_done.is_set())
            assert capture.active == 0
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_delayed_noncooperative_final_is_quarantined_and_cannot_commit_after_cancel(tmp_path):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        stt.gate, stt.ignore_cancel = asyncio.Event(), True
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: stt.final_calls == 1)
            assert capture.active == 0
            await gesture(runtime, owner, "cancel", identity)
            _, busy = await gesture(runtime, owner)
            assert busy.type == EventType.CONTROL_REJECTED
            runtime.submit_user_message("New typed owner")
            stt.gate.set()
            await until(lambda: runtime._ptt_task is None and runtime._active_done.is_set())
            assert not any(
                e.type == EventType.TURN_COMMITTED and e.payload.get("text") == stt.result.text
                for e in events
            )
            second, ack = await gesture(runtime, owner)
            assert ack.type == EventType.CONTROL_ACKNOWLEDGED
            _, stale = await gesture(runtime, owner, "cancel", identity)
            assert (
                runtime._ptt.gesture_id == second and stale.type == EventType.CONTROL_ACKNOWLEDGED
            )
            await gesture(runtime, owner, "cancel", second)
        finally:
            stt.gate.set()
            await runtime.close()

    asyncio.run(scenario())


def test_preference_is_persisted_but_never_enables_muted_or_unavailable_capture(tmp_path):
    async def scenario():
        runtime, owner, capture, _stt, _ = fixture(tmp_path)
        try:
            _, rejected = await gesture(runtime, owner)
            assert rejected.type == EventType.CONTROL_REJECTED
            await arm(runtime, owner)
            await runtime._set_microphone(False)
            _, rejected = await gesture(runtime, owner)
            assert rejected.type == EventType.CONTROL_REJECTED and capture.opened == 0
        finally:
            await runtime.close()
        reopened = SamRuntime(
            RecordingProvider("fixture"), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        try:
            assert reopened._voice_input_mode == "push_to_talk"
            assert reopened._input_snapshot()["state"] == "unavailable"
        finally:
            await reopened.close()

    asyncio.run(scenario())


def test_authentication_current_session_and_gesture_validation_are_required(tmp_path):
    async def scenario():
        runtime, owner, _, _, _ = fixture(tmp_path)
        try:
            denied = await command(
                runtime, None, "control.voice_input_mode.set", {"mode": "push_to_talk"}
            )
            assert denied.type == EventType.CONTROL_REJECTED
            await arm(runtime, owner)
            denied = await command(
                runtime,
                owner,
                "control.voice_input_mode.set",
                {"mode": "ordinary"},
                session="retired",
            )
            assert denied.type == EventType.CONTROL_REJECTED
            for payload, session in (
                ({"action": "start", "gesture_id": "not-a-token"}, None),
                ({"action": "start", "gesture_id": str(UUID(int=1))}, "retired"),
                ({"action": "start", "gesture_id": str(UUID(int=2)), "enabled": True}, None),
            ):
                denied = await command(
                    runtime, owner, "control.push_to_talk", payload, session=session
                )
                assert denied.type == EventType.CONTROL_REJECTED
            owner.retire()
            _, denied = await gesture(runtime, owner)
            assert denied.type == EventType.CONTROL_REJECTED
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_ordinary_capture_is_retired_before_ptt_and_mode_return_never_overlaps(tmp_path):
    async def scenario():
        runtime, owner, capture, stt, _ = fixture(tmp_path)
        try:
            runtime._resume_ordinary_capture()
            await until(lambda: capture.active == 1)
            await arm(runtime, owner)
            assert capture.active == 0
            _identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            await command(runtime, owner, "control.voice_input_mode.set", {"mode": "ordinary"})
            await until(lambda: runtime._ptt_task is None and capture.active == 1)
            assert capture.maximum_active == 1
            assert stt.final_calls == 0
            await runtime._set_microphone(False)
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_two_released_utterances_have_distinct_ownership_and_pauses_never_auto_finalize(tmp_path):
    async def scenario():
        runtime, owner, capture, stt, events = fixture(tmp_path)
        try:
            await arm(runtime, owner)
            for _ in range(2):
                identity, ack = await gesture(runtime, owner)
                assert ack.type == EventType.CONTROL_ACKNOWLEDGED
                capture.pcm()
                await until(lambda: runtime._input_state == "capturing")
                for sequence in range(8):
                    capture.queue.put_nowait(
                        AudioFrame(AudioFormat(), b"\0" * 640, sequence + 2, sequence + 1)
                    )
                await until(lambda: capture.queue.empty())
                assert runtime._input_state == "capturing"  # Silence is not key release.
                await gesture(runtime, owner, "finish", identity)
                await until(lambda: runtime._ptt_task is None)
            assert stt.final_calls == 2
            assert len({context.turn_id for context in stt.contexts}) == 2
            assert len({context.cancellation_id for context in stt.contexts}) == 2
            assert sum(e.type == EventType.TURN_COMMITTED for e in events) == 2
            assert capture.maximum_active == 1
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_generation_and_playback_block_ptt_without_acquiring_capture(tmp_path):
    async def scenario():
        runtime, owner, capture, _, _ = fixture(tmp_path)
        try:
            await arm(runtime, owner)
            runtime._active_done.clear()
            _, rejected = await gesture(runtime, owner)
            assert rejected.type == EventType.CONTROL_REJECTED
            runtime._active_done.set()
            runtime._active_playback_generation_id = "draining"
            _, rejected = await gesture(runtime, owner)
            assert rejected.type == EventType.CONTROL_REJECTED
            assert capture.opened == 0
            runtime._active_playback_generation_id = None
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_frozen_route_and_postcommit_focus_cancel_do_not_retarget_the_answer(tmp_path):
    async def scenario():
        runtime, owner, capture, _stt, events = fixture(tmp_path)
        original_provider = runtime.provider
        alternate = RecordingProvider("later-route")
        original_publish = runtime.events.publish

        async def change_after_commit(event):
            await original_publish(event)
            if event.type == EventType.TURN_COMMITTED:
                runtime.provider = alternate
                runtime._model = "later-model"
                await gesture(runtime, owner, "cancel", identity)

        runtime.events.publish = change_after_commit
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: runtime._ptt_task is None)
            assert original_provider.models_used == ["fixture"]
            assert alternate.models_used == []
            assert sum(e.type == EventType.MODEL_COMPLETED for e in events) == 1
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_new_typing_during_commit_publication_cannot_be_superseded_by_old_ptt(tmp_path):
    async def scenario():
        runtime, owner, capture, _stt, events = fixture(tmp_path)
        original_publish = runtime.events.publish
        inserted = False

        async def type_after_commit(event):
            nonlocal inserted
            await original_publish(event)
            if event.type == EventType.TURN_COMMITTED and not inserted:
                inserted = True
                runtime.submit_user_message("Newer typing")

        runtime.events.publish = type_after_commit
        try:
            await arm(runtime, owner)
            identity, _ = await gesture(runtime, owner)
            capture.pcm()
            await until(lambda: runtime._input_state == "capturing")
            await gesture(runtime, owner, "finish", identity)
            await until(lambda: runtime._ptt_task is None and runtime._active_done.is_set())
            assert runtime.provider.models_used == ["fixture"]
            completed = [e for e in events if e.type == EventType.MODEL_COMPLETED]
            assert len(completed) == 1
            newer = next(
                e
                for e in events
                if e.type == EventType.TRANSCRIPT_FINAL and e.payload.get("text") == "Newer typing"
            )
            assert completed[0].turn_id == newer.turn_id
        finally:
            await runtime.close()

    asyncio.run(scenario())
