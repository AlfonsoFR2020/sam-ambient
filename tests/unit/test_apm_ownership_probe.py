"""Test the offline readiness contract and preserve its discovered counterexample."""

import os
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")

from scripts.apm_ownership_probe import (  # noqa: E402
    ReadinessProbe,
    diverse_source,
    ownership_cases,
)
from scripts.full_apm_prototype import FullApm  # noqa: E402


def evidence(sequence, **overrides):
    return {
        "sequence": sequence,
        "delay_ms": 80,
        "erle_db": 25,
        "estimated_delay_ms": 80,
        "available": True,
        "reference_valid": True,
        "reference_active": True,
        **overrides,
    }


def ready_probe():
    probe = ReadinessProbe()
    for sequence in range(20):
        probe.update(**evidence(sequence))
    assert probe.state == "ready"
    return probe


@pytest.mark.parametrize("erle", [None, float("nan"), float("inf"), 19.99])
def test_elapsed_frames_never_override_missing_or_inadequate_erle(erle):
    probe = ReadinessProbe()
    for sequence in range(800):
        assert probe.update(**evidence(sequence, erle_db=erle)) != "ready"


@pytest.mark.parametrize(
    "overrides",
    [
        {"reference_valid": False},
        {"reference_active": False},
        {"estimated_delay_ms": None},
        {"estimated_delay_ms": 100},
    ],
)
def test_reference_and_alignment_are_required(overrides):
    probe = ReadinessProbe()
    for sequence in range(800):
        assert probe.update(**evidence(sequence, **overrides)) != "ready"


def test_known_discontinuity_or_failure_retires_readiness_immediately():
    probe = ready_probe()
    assert probe.update(**evidence(20, delay_ms=100, estimated_delay_ms=100)) == "reconverging"
    assert probe.update(**evidence(22, delay_ms=100, estimated_delay_ms=100)) == "reconverging"
    assert probe.update(**evidence(23, available=False)) == "unavailable"
    assert probe.stable == 0
    probe.reset()
    probe.reset()
    assert probe.previous_delay is None and probe.previous_sequence is None


def test_erle_drop_disarms_instead_of_latching_authority():
    probe = ready_probe()
    assert probe.update(**evidence(20, erle_db=10)) == "reconverging"


@pytest.mark.parametrize("kind", ["low", "high", "fricative", "alternating"])
def test_diversity_sources_are_deterministic_small_bounded_and_distinct(kind):
    a, b = diverse_source(kind, 13), diverse_source(kind, 41)
    np.testing.assert_array_equal(a, diverse_source(kind, 13))
    assert len(a) == 8 * 16000
    assert np.isfinite(a).all() and np.max(np.abs(a)) <= 0.150001
    assert not np.array_equal(a, b)


@pytest.mark.skipif(
    os.name != "nt"
    or not os.environ.get("SAM_FULL_APM_DLL")
    or not os.environ.get("SAM_FULL_APM_PACKAGE"),
    reason="opt-in pinned full APM native package",
)
def test_actual_apm_erle_and_linear_vad_do_not_prove_ownership():
    def factory():
        return FullApm(
            Path(os.environ["SAM_FULL_APM_DLL"]), Path(os.environ["SAM_FULL_APM_PACKAGE"]), 7
        )

    report = ownership_cases(factory)
    assert not report["pass"]
    assert report["cases"]["echo_only"]["pass"]
    assert report["cases"]["noise_burst"]["pass"]
    assert report["cases"]["human"]["pass"]
    assert report["cases"]["known_delay_change"]["pass"]
    hidden = report["cases"]["hidden_delay_change"]
    assert not hidden["pass"] and hidden["proposal_times_ms"]
    # Engine failure remains evidence, never a production permission:
    # equivalent statistics can admit both real near-end and delayed self-output.
    assert report["cases"]["after_convergence"]["latency_ms"] is None
