"""Offline AEC3 falsification; no devices, runtime integration or personal recordings.

Run with: uv run --group aec-prototype python scripts/aec_prototype.py
"""

from __future__ import annotations

import json
import math
import time
from dataclasses import dataclass
from typing import Protocol

import numpy as np

RATE = 16_000
SAMPLES = 160
FRAME_BYTES = SAMPLES * 2


class AcousticProcessor(Protocol):
    """Synchronized 10 ms mono PCM16 pair; timing alignment belongs to the caller."""

    def process(self, capture: bytes, render: bytes, *, delay_ms: int) -> bytes: ...

    def reset(self) -> None: ...


class PrototypeAec3:
    """One single-thread owner; exact frames prevent native padding and large allocations.

    Paired input contains render at the current simulated write time, NOT an
    externally delayed duplicate. AEC3 owns its internal delayed reference.
    No Sam turn identity or human-origin decision is implied by this adapter.
    """

    def __init__(self) -> None:
        from pywebrtc_audio import EchoCanceller

        self._constructor = EchoCanceller
        self._native = EchoCanceller(sample_rate=RATE, num_channels=1)

    def process(self, capture: bytes, render: bytes, *, delay_ms: int) -> bytes:
        if len(capture) != FRAME_BYTES or len(render) != FRAME_BYTES:
            raise ValueError("AEC requires exactly 160 samples of mono PCM16 per source")
        if isinstance(delay_ms, bool) or not isinstance(delay_ms, int) or not 0 <= delay_ms <= 250:
            raise ValueError("prototype delay must be an integer in the tested 0..250 ms range")
        self._native.stream_delay_ms = delay_ms
        result = self._native.process(
            np.frombuffer(capture, dtype="<i2"), np.frombuffer(render, dtype="<i2")
        )
        return result.astype("<i2", copy=False).tobytes()

    def reset(self) -> None:
        # Recreate buffers too: upstream reset retains AudioBuffers/resampler history.
        self._native = self._constructor(sample_rate=RATE, num_channels=1)


def speech_like(seed: int, seconds: int = 8) -> np.ndarray:
    """Synthetic harmonic + fricative excitation, never a personal recording."""
    rng = np.random.default_rng(seed)
    t = np.arange(RATE * seconds, dtype=np.float64) / RATE
    pitch = 120 + seed % 50 + 22 * np.sin(2 * np.pi * 0.7 * t)
    phase = 2 * np.pi * np.cumsum(pitch) / RATE
    voiced = sum(np.sin(harmonic * phase) / harmonic for harmonic in range(2, 15))
    noise = rng.normal(0, 1, len(t))
    noise = np.convolve(noise, [0.25, 0.5, 0.25], mode="same")
    envelope = 0.15 + 0.85 * np.maximum(0, np.sin(2 * np.pi * 3.1 * t + seed)) ** 2
    signal = envelope * (voiced + 0.35 * noise)
    return 0.15 * signal / np.max(np.abs(signal))


def echo_path(render: np.ndarray, delay_ms: int) -> np.ndarray:
    echo = np.zeros_like(render)
    for lag_ms, gain in [(delay_ms, 0.55), (delay_ms + 7, 0.16), (delay_ms + 19, -0.08)]:
        lag = RATE * lag_ms // 1000
        if lag:
            echo[lag:] += gain * render[:-lag]
        else:
            echo += gain * render
    return echo


def pcm(signal: np.ndarray) -> bytes:
    return np.rint(np.clip(signal, -1, 32767 / 32768) * 32768).astype("<i2").tobytes()


def run_frames(
    processor: AcousticProcessor, capture: np.ndarray, render: np.ndarray, delays: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    if (
        len(capture) != len(render)
        or len(capture) % SAMPLES
        or len(delays) != len(capture) // SAMPLES
    ):
        raise ValueError("fixture must contain matching complete frames and one delay per frame")
    output = np.empty(len(capture), dtype=np.float64)
    cost = np.empty(len(delays), dtype=np.float64)
    for index, delay in enumerate(delays):
        offset = index * SAMPLES
        near = pcm(capture[offset : offset + SAMPLES])
        far = pcm(render[offset : offset + SAMPLES])
        started = time.perf_counter()
        processed = processor.process(near, far, delay_ms=int(delay))
        cost[index] = (time.perf_counter() - started) * 1000
        output[offset : offset + SAMPLES] = np.frombuffer(processed, dtype="<i2") / 32768
    return output, cost


def reduction_db(before: np.ndarray, after: np.ndarray) -> float:
    return 10 * math.log10((float(before @ before) + 1e-12) / (float(after @ after) + 1e-12))


def measure_signal_latency(processor_factory=PrototypeAec3) -> int:
    """Measurement alignment only, never an acoustic ownership classifier.

    Broadband near-only calibration distinguishes fixed processor latency from
    signal loss. Limit the search to 30 ms; this is separate from echo-path delay.
    """
    near = np.random.default_rng(88).normal(0, 0.03, RATE * 3)
    output, _ = run_frames(processor_factory(), near, np.zeros_like(near), np.zeros(300))
    desired = near[RATE : 2 * RATE]
    return max(range(481), key=lambda lag: float(output[RATE + lag : 2 * RATE + lag] @ desired))


@dataclass(frozen=True)
class Acceptance:
    # Screening thresholds, not a claim of room acoustics or intelligibility.
    # 20 dB = 99% echo power removed; 10 dB in noise = 90% mixture reduction.
    echo_reduction_db: float = 20
    noisy_reduction_db: float = 10
    near_gain_min: float = 0.7
    near_gain_max: float = 1.3
    near_sdr_db: float = 6  # independent signal power >= 4x residual error


def evaluate(processor_factory=PrototypeAec3) -> dict[str, object]:
    gate = Acceptance()
    latency = measure_signal_latency(processor_factory)
    render = speech_like(13)
    near = speech_like(41)
    count = len(render) // SAMPLES
    reports: list[dict[str, object]] = []
    costs: list[np.ndarray] = []
    warm = slice(2 * RATE, None)
    for delay in [0, 40, 80, 160]:
        echo = echo_path(render, delay)
        output, cost = run_frames(processor_factory(), echo, render, np.full(count, delay))
        attenuation = reduction_db(echo[warm], output[warm])
        reports.append(
            {
                "case": f"echo_{delay}ms",
                "reduction_db": attenuation,
                "reduction_by_second_db": [
                    reduction_db(echo[i * RATE : (i + 1) * RATE], output[i * RATE : (i + 1) * RATE])
                    for i in range(8)
                ],
                "pass": attenuation >= gate.echo_reduction_db,
            }
        )
        costs.append(cost)
    noise = np.random.default_rng(55).normal(0, 0.001, len(render))
    echo = echo_path(render, 80)
    mixture = echo + noise
    output, cost = run_frames(processor_factory(), mixture, render, np.full(count, 80))
    attenuation = reduction_db(mixture[warm], output[warm])
    reports.append(
        {
            "case": "echo_noise",
            "mixture_reduction_db": attenuation,
            "pass": attenuation >= gate.noisy_reduction_db,
        }
    )
    costs.append(cost)
    for name, onset, stop in [("double_talk", 3, 8), ("playback_end", 5.8, 6)]:
        far = render.copy()
        far[stop * RATE :] = 0
        human = near.copy()
        start = round(onset * RATE)
        human[:start] = 0
        mixed = echo_path(far, 80) + human
        output, cost = run_frames(processor_factory(), mixed, far, np.full(count, 80))
        # First second tests prompt preservation, rather than cherry-picking late convergence.
        segment = slice(start, start + RATE)
        desired = human[segment]
        received = output[start + latency : start + RATE + latency]
        gain = float(received @ desired / (desired @ desired))
        sdr = reduction_db(desired * gain, received - desired * gain)
        reports.append(
            {
                "case": name,
                "first_second_near_gain": gain,
                "near_sdr_db": sdr,
                "pass": gate.near_gain_min <= gain <= gate.near_gain_max
                and sdr >= gate.near_sdr_db,
            }
        )
        costs.append(cost)
    changed = echo_path(render, 40)
    changed[4 * RATE :] = echo_path(render, 100)[4 * RATE :]
    delays = np.full(count, 40)
    delays[400:] = 100
    output, cost = run_frames(processor_factory(), changed, render, delays)
    attenuation = reduction_db(changed[6 * RATE :], output[6 * RATE :])
    reports.append(
        {
            "case": "delay_change",
            "reduction_after_2s_db": attenuation,
            "pass": attenuation >= gate.echo_reduction_db,
        }
    )
    costs.append(cost)
    timings = np.concatenate(costs)
    return {
        "sample_rate": RATE,
        "samples_per_frame": SAMPLES,
        "fixture_seconds": 8,
        "warmup_seconds": 2,
        "signal_latency_ms": latency / RATE * 1000,
        "thresholds": gate.__dict__,
        "cases": reports,
        "processing_ms": {
            "median": float(np.median(timings)),
            "p95": float(np.percentile(timings, 95)),
            "max": float(np.max(timings)),
        },
        "separation_pass": all(case["pass"] for case in reports),
    }


if __name__ == "__main__":
    report = evaluate()
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["separation_pass"] else 1)
