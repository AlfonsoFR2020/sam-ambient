import asyncio
from types import SimpleNamespace

from sam_ambient import runtime as runtime_module
from sam_ambient.core.voice import AudioFormat, AudioFrame
from sam_ambient.runtime import (
    RuntimeConfig,
    RuntimeVoiceAdapters,
    SamRuntime,
    _frame_after_protocol_clock,
)
from tests.unit.test_conversation_context import ConversationProvider


class ClosableStt:
    async def aclose(self) -> None:
        return None


def test_audio_frame_clock_is_advanced_past_runtime_transition_clock():
    frame = AudioFrame(
        format=AudioFormat(),
        data=b"\0" * 640,
        monotonic_ms=100,
        sequence=1,
    )
    adjusted = _frame_after_protocol_clock(frame, 103)
    assert adjusted.monotonic_ms == 104
    assert adjusted.data is frame.data


def test_voice_loop_reopens_capture_after_recoverable_failure(tmp_path, monkeypatch):
    attempts = 0
    reopened = asyncio.Event()

    class RecoveringPipeline:
        def __init__(self, **_options) -> None:
            pass

        async def run(self, _token):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise ValueError("temporary device parameters changed")
            reopened.set()
            await asyncio.Event().wait()

    monkeypatch.setattr(runtime_module, "VoiceInputPipeline", RecoveringPipeline)

    async def scenario() -> None:
        voice = RuntimeVoiceAdapters(SimpleNamespace(), SimpleNamespace(), ClosableStt())
        runtime = SamRuntime(ConversationProvider(), RuntimeConfig(tmp_path), voice=voice)
        runtime._voice_task = asyncio.create_task(runtime._voice_loop())
        try:
            await asyncio.wait_for(reopened.wait(), 2)
            assert attempts == 2
            assert runtime._voice_task.done() is False
        finally:
            await runtime.close()

    asyncio.run(scenario())
