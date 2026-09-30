"""Optional offline prototype checks; install the aec-prototype dependency group."""

from __future__ import annotations

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("pywebrtc_audio")

from scripts.aec_prototype import (  # noqa: E402
    FRAME_BYTES,
    RATE,
    Acceptance,
    PrototypeAec3,
    echo_path,
    evaluate,
    measure_signal_latency,
    pcm,
    run_frames,
    speech_like,
)


@pytest.mark.parametrize("length", [0, FRAME_BYTES - 2, FRAME_BYTES + 2, FRAME_BYTES * 2])
def test_processor_rejects_partial_or_multi_frames(length: int) -> None:
    processor = PrototypeAec3()
    with pytest.raises(ValueError, match="exactly"):
        processor.process(bytes(length), bytes(FRAME_BYTES), delay_ms=0)


@pytest.mark.parametrize("delay", [-1, 251, 1.5, True])
def test_processor_rejects_unvalidated_delays(delay: int) -> None:
    processor = PrototypeAec3()
    with pytest.raises(ValueError, match="delay"):
        processor.process(bytes(FRAME_BYTES), bytes(FRAME_BYTES), delay_ms=delay)


def test_silence_and_repeated_reset_match_new_processor() -> None:
    processor = PrototypeAec3()
    render = speech_like(13, seconds=2)
    delays = np.full(200, 80)
    run_frames(processor, echo_path(render, 80), render, delays)
    processor.reset()
    processor.reset()
    fresh = PrototypeAec3()
    # Retirement discards native state and must not leak it into the next silence.
    for _ in range(20):
        capture = render_frame = bytes(FRAME_BYTES)
        assert (
            processor.process(capture, render_frame, delay_ms=0)
            == fresh.process(capture, render_frame, delay_ms=0)
            == capture
        )
    # Nor may it retain old filter coefficients during a subsequent operation.
    reused, _ = run_frames(processor, echo_path(render, 80), render, delays)
    new, _ = run_frames(fresh, echo_path(render, 80), render, delays)
    np.testing.assert_array_equal(reused, new)


def test_latency_alignment_preserves_near_end_with_no_render() -> None:
    latency = measure_signal_latency()
    assert 0 <= latency <= RATE // 100  # at most one 10 ms frame
    near = speech_like(41, seconds=3)
    source = pcm(near[:160])
    saved = bytes(source)
    processor = PrototypeAec3()
    assert len(processor.process(source, bytes(FRAME_BYTES), delay_ms=0)) == FRAME_BYTES
    assert source == saved  # immutable ownership; output is a new byte string
    output, _ = run_frames(PrototypeAec3(), near, np.zeros_like(near), np.zeros(300))
    desired = near[RATE : 2 * RATE]
    received = output[RATE + latency : 2 * RATE + latency]
    assert float(desired @ received / (desired @ desired)) >= Acceptance().near_gain_min


def test_report_enforces_declared_separation_gate() -> None:
    report = evaluate()
    cases = report["cases"]
    assert len(cases) == 8
    assert report["separation_pass"] == all(case["pass"] for case in cases)
    assert np.isfinite(report["signal_latency_ms"])
    for case in cases:
        for name, value in case.items():
            if name.endswith("_db") or name.endswith("_gain"):
                assert np.all(np.isfinite(value))
    # These tests validate measurement/ownership. The CLI, not pytest, decides
    # whether a processor is eligible for runtime integration.
