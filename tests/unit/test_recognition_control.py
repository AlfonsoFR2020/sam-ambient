"""Recognition mode is an owner preference, not inferred from status text."""

import asyncio

from sam_ambient.core.protocol import ControlCommand, EventType
from sam_ambient.core.turns import VoiceState
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from tests.integration.test_core_experience import Capture, Stt, Vad
from tests.unit.test_local_controls import RecordingProvider


def test_recognition_mode_is_validated_applied_and_restored(tmp_path):
    async def scenario():
        config = RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        runtime = SamRuntime(RecordingProvider("fixture"), config)

        async def change(language, identity):
            return await runtime.controls.dispatch(
                ControlCommand(
                    type="control.recognition_language.set",
                    command_id=identity,
                    monotonic_ms=1,
                    payload={"language": language},
                )
            )

        try:
            result = await change("es", "spanish")
            assert result.type == EventType.CONTROL_ACKNOWLEDGED
            assert runtime.config.language == "es"
            assert runtime._ready_event().payload["recognition_language"] == "es"
            invalid = await change("../../en", "invalid")
            assert invalid.type == EventType.CONTROL_REJECTED
            runtime.voice_turns.state = VoiceState.USER_SPEAKING
            blocked = await change("en", "mid-utterance")
            assert blocked.type == EventType.CONTROL_REJECTED
            assert runtime.config.language == "es"
        finally:
            await runtime.close()
        reopened = SamRuntime(RecordingProvider("fixture"), config)
        try:
            assert reopened.config.language == "es"
        finally:
            await reopened.close()

    asyncio.run(scenario())


def test_idle_mode_change_restarts_capture_and_reaches_next_stt_stream(tmp_path):
    async def scenario():
        capture, stt = Capture(), Stt()
        runtime = SamRuntime(
            RecordingProvider("fixture"),
            RuntimeConfig(tmp_path, port=0, model="chat"),
            voice=RuntimeVoiceAdapters(capture, Vad(), stt),
        )

        async def wait_for(predicate):
            async with asyncio.timeout(5):
                while not predicate():  # noqa: ASYNC110 -- bounded independent voice loop
                    await asyncio.sleep(0.01)

        try:
            await runtime.start()
            for identity, language in enumerate(("es", "en")):
                await wait_for(
                    lambda: (
                        runtime._active_done.is_set()
                        and runtime.voice_turns.state is VoiceState.LISTENING
                    )
                )
                prior_token = runtime._voice_listen_token
                result = await runtime.controls.dispatch(
                    ControlCommand(
                        type="control.recognition_language.set",
                        command_id=str(identity),
                        monotonic_ms=1,
                        payload={"language": language},
                    )
                )
                assert result.type is EventType.CONTROL_ACKNOWLEDGED
                await wait_for(
                    lambda prior_token=prior_token: (
                        runtime._voice_listen_token is not prior_token
                        and runtime.voice_turns.state is VoiceState.LISTENING
                    )
                )
                capture.utterances.put_nowait(True)
                await wait_for(
                    lambda identity=identity: (
                        len(stt.contexts) > identity
                        and runtime._active_done.is_set()
                        and runtime.voice_turns.state is VoiceState.LISTENING
                    )
                )
                assert stt.contexts[identity].language == language
        finally:
            await runtime.close()

    asyncio.run(scenario())
