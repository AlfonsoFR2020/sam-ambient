"""Optional offline native contract checks, not a passing acoustic gate."""

import os
from pathlib import Path

import pytest

pytest.importorskip("numpy")
from scripts.windows_aec_prototype import FRAME_BYTES, WindowsAec

dll = os.environ.get("SAM_WINDOWS_AEC_DLL")
pytestmark = pytest.mark.skipif(
    os.name != "nt" or not dll, reason="opt-in installed Windows filter probe"
)


def test_exact_frames_close_and_repeated_reset():
    processor = WindowsAec(Path(dll), 2)
    try:
        with pytest.raises(ValueError, match="exact"):
            processor.process(b"", bytes(FRAME_BYTES), delay_ms=0)
        with pytest.raises(ValueError, match="delay"):
            processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=True)
        signal = b"\0\x10" * 160

        def collect():
            return [processor.process(signal, bytes(FRAME_BYTES), delay_ms=0) for _ in range(20)]

        initial = collect()
        assert all(len(frame) == FRAME_BYTES for frame in initial)
        assert any(frame != bytes(FRAME_BYTES) for frame in initial)
        processor.reset()
        assert collect() == initial
        processor.reset()
        assert collect() == initial
        assert len(processor.pending) <= FRAME_BYTES * 16
    finally:
        processor.close()
        processor.close()
    with pytest.raises(RuntimeError, match="closed"):
        processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=0)


def test_reset_clears_prior_render_history():
    processor = WindowsAec(Path(dll), 2)
    clean = WindowsAec(Path(dll), 2)
    try:
        for _ in range(50):
            processor.process(b"\0\x10" * 160, b"\0\x20" * 160, delay_ms=40)
        processor.reset()
        for _ in range(30):
            expected = clean.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=0)
            assert processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=0) == expected
    finally:
        clean.close()
        processor.close()
