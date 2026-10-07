"""Optional full-APM ABI checks. Passing tests do not imply processor acceptance."""

import ctypes
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")

from scripts.aec_prototype import FRAME_BYTES, echo_path, pcm, run_frames, speech_like  # noqa: E402
from scripts.full_apm_prototype import FullApm, discrimination  # noqa: E402

DLL = os.environ.get("SAM_FULL_APM_DLL")
PACKAGE = os.environ.get("SAM_FULL_APM_PACKAGE")
pytestmark = pytest.mark.skipif(
    os.name != "nt" or not DLL or not PACKAGE, reason="opt-in verified full APM package"
)


def factory(mode=1):
    return FullApm(Path(DLL), Path(PACKAGE), mode)


@pytest.mark.parametrize("size", [0, FRAME_BYTES - 2, FRAME_BYTES + 2, FRAME_BYTES * 2])
def test_partial_or_multiple_frames_rejected_without_state_change(size):
    processor = factory()
    try:
        with pytest.raises(ValueError, match="exact"):
            processor.process(bytes(size), bytes(FRAME_BYTES), delay_ms=0)
        silence = bytes(FRAME_BYTES)
        assert processor.process(silence, silence, delay_ms=0) == silence
    finally:
        processor.close()


@pytest.mark.parametrize("delay", [True, -1, 251, 0.5])
def test_invalid_delay_does_not_modify_reference(delay):
    processor = factory()
    try:
        with pytest.raises(ValueError, match="delay"):
            processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=delay)
    finally:
        processor.close()


def test_bypass_control_is_bit_exact_and_native_frame_validation_rejects():
    processor = factory(2)
    try:
        signal = pcm(speech_like(41, 1)[:160])
        assert processor.process(signal, bytes(FRAME_BYTES), delay_ms=0) == signal
        assert processor.library.sam_apm_render(processor.handle, signal, 159) == -900
        output = ctypes.create_string_buffer(FRAME_BYTES)
        assert processor.library.sam_apm_capture(processor.handle, signal, output, 160, 251) == -900
        assert signal == pcm(speech_like(41, 1)[:160])
    finally:
        processor.close()


@pytest.mark.parametrize("mode", [0, 1, 3])
def test_reset_discards_render_history_and_matches_fresh_operation(mode):
    used, fresh = factory(mode), factory(mode)
    try:
        render = speech_like(13, 1)
        echo = echo_path(render, 80)
        delays = np.full(100, 80)
        run_frames(used, echo, render, delays)
        used.reset()
        used.reset()
        actual, _ = run_frames(used, echo, render, delays)
        expected, _ = run_frames(fresh, echo, render, delays)
        np.testing.assert_array_equal(actual, expected)
        used.close()
        used.close()
        with pytest.raises(RuntimeError, match="closed"):
            used.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=0)
    finally:
        used.close()
        fresh.close()


def test_wrong_thread_and_processor_failure_are_explicit():
    processor = factory()
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            result = pool.submit(processor.render, bytes(FRAME_BYTES))
            with pytest.raises(RuntimeError, match="serialized"):
                result.result()
        with pytest.raises(RuntimeError, match="retired"):
            processor.check(-1)
        assert not processor.handle.value
        processor.reset()
        assert processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=0) == bytes(
            FRAME_BYTES
        )
        assert set(processor.statistics()) == {"erle_db", "residual_echo_likelihood", "delay_ms"}
    finally:
        processor.close()


def test_existing_vad_discrimination_is_reported_separately_from_separation():
    report = discrimination(factory)
    assert report["echo_only"]["speech_fraction_first_second"] <= 0.1
    assert report["double_talk"]["speech_fraction_first_second"] >= 0.6
    assert report["pass"]


def test_unverified_binary_and_unknown_mode_rejected(tmp_path):
    binary = tmp_path / "bin" / "webrtc-audio-processing-3-0.dll"
    binary.parent.mkdir()
    binary.write_bytes(b"not the pinned binary")
    with pytest.raises(ValueError, match="unverified"):
        FullApm(Path(DLL), tmp_path)
    with pytest.raises(ValueError, match="mode"):
        FullApm(Path(DLL), Path(PACKAGE), True)
    with pytest.raises(ValueError, match="mode"):
        FullApm(Path(DLL), Path(PACKAGE), 4)
    with pytest.raises(ValueError, match="mode"):
        FullApm(Path(DLL), Path(PACKAGE), 1.0)
