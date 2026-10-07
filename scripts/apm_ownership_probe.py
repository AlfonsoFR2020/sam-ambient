"""Offline readiness/ownership falsification. Never cancels playback or commits text."""

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from scripts.aec_prototype import (
    RATE,
    SAMPLES,
    Acceptance,
    echo_path,
    measure_signal_latency,
    pcm,
    reduction_db,
    speech_like,
)
from scripts.full_apm_prototype import FullApm


@dataclass
class ReadinessProbe:
    """Candidate based on fresh public metrics, NOT a production readiness policy.

    Stable ERLE >= original rejection gate, matching delay and a valid reference
    are necessary. Twenty evidence frames debounce metrics; elapsed warm-up
    alone can never arm. The ownership suite attempts to falsify sufficiency.
    """

    state: str = "unavailable"
    stable: int = 0
    previous_sequence: int | None = None
    previous_delay: int | None = None

    def reset(self) -> None:
        self.state = "unavailable"
        self.stable = 0
        self.previous_sequence = self.previous_delay = None

    def update(
        self,
        *,
        sequence: int,
        delay_ms: int,
        erle_db: float | None,
        estimated_delay_ms: float | None,
        available: bool,
        reference_valid: bool,
        reference_active: bool,
    ) -> str:
        discontinuity = self.previous_sequence is not None and (
            sequence != self.previous_sequence + 1 or delay_ms != self.previous_delay
        )
        self.previous_sequence, self.previous_delay = sequence, delay_ms
        if not available:
            self.state, self.stable = "unavailable", 0
            return self.state
        if self.state == "unavailable":
            self.state = "warming"
        if discontinuity or not reference_valid:
            self.state, self.stable = "reconverging", 0
            return self.state
        good = (
            reference_active
            and erle_db is not None
            and estimated_delay_ms is not None
            and math.isfinite(erle_db)
            and math.isfinite(estimated_delay_ms)
            and erle_db >= Acceptance().echo_reduction_db
            and abs(estimated_delay_ms - delay_ms) <= 4  # upstream 4 ms block quantization
        )
        if good:
            self.stable += 1
            if self.stable >= 20:
                self.state = "ready"
        else:
            self.stable = 0
            if self.state == "ready":
                self.state = "reconverging"
        return self.state


def diverse_source(kind: str, seed: int, seconds: int = 8) -> np.ndarray:
    """Compact synthetic spectral diversity; no recordings or speech model."""
    t = np.arange(seconds * RATE) / RATE
    pitch = (90 if kind == "low" else 240) + 12 * np.sin(2 * np.pi * 0.9 * t)
    phase = np.cumsum(pitch) * (2 * np.pi / RATE)
    voiced = sum(np.sin(h * phase) / h for h in range(1, 19))
    noise = np.random.default_rng(seed).normal(size=len(t))
    fricative = np.convolve(noise, [-0.5, 1, -0.5], mode="same")
    if kind == "fricative":
        value = 0.4 * voiced + fricative
    elif kind == "alternating":
        blend = (1 + np.sin(2 * np.pi * 2.5 * t)) / 2
        value = blend * voiced + (1 - blend) * fricative
    elif kind in ("low", "high"):
        value = voiced + 0.15 * fricative
    else:
        raise ValueError("unknown synthetic source")
    envelope = 0.15 + 0.85 * np.maximum(0, np.sin(2 * np.pi * 3.1 * t + seed)) ** 2
    value *= envelope
    return value * 0.15 / np.max(np.abs(value))


def trace(factory, capture, render, hints, *, reset_frame=None) -> tuple[np.ndarray, dict]:
    """One owner polls metrics every frame. No ground-truth source labels used online."""
    from sam_ambient.adapters.vad import WebRtcVoiceActivityDetector
    from sam_ambient.core.voice import AudioFormat, AudioFrame

    processor = factory()
    readiness = ReadinessProbe()
    vad = WebRtcVoiceActivityDetector()
    output = np.empty(len(capture))
    transitions, readings, proposals = [], [], []
    ready_frames, speech_frames = [], []
    speech_run = 0
    episode_proposed = False
    previous_state = "unavailable"
    timings = []
    try:
        for index, delay in enumerate(hints):
            if index == reset_frame:
                processor.reset()
                readiness.reset()
                vad = WebRtcVoiceActivityDetector()
                speech_run = 0
                episode_proposed = False
            offset = index * SAMPLES
            far, raw = render[offset : offset + SAMPLES], capture[offset : offset + SAMPLES]
            started = time.perf_counter()
            processed = processor.process(pcm(raw), pcm(far), delay_ms=int(delay))
            output[offset : offset + SAMPLES] = np.frombuffer(processed, dtype="<i2") / 32768
            stats = processor.statistics()
            stats.update(processor.diagnostics())
            state = readiness.update(
                sequence=index,
                delay_ms=int(delay),
                erle_db=stats["erle_db"],
                estimated_delay_ms=stats["delay_ms"],
                available=True,
                reference_valid=True,  # synchronous fixture; NOT inferred for real devices
                reference_active=float(far @ far) > 0,
            )
            ready_frames.append(state == "ready")
            if state != previous_state:
                transitions.append({"at_ms": (index + 1) * 10, "state": state})
                previous_state = state
            if index % 10 == 0:
                readings.append({"at_ms": (index + 1) * 10, **stats})
            if index % 2 == 1:
                frame = AudioFrame(
                    AudioFormat(),
                    pcm(output[offset - SAMPLES : offset + SAMPLES]),
                    monotonic_ms=(index + 1) * 10,
                    sequence=index // 2,
                )
                speech = vad.analyze(frame).is_speech
                speech_frames.append(
                    {"at_ms": (index + 1) * 10, "speech": speech, "ready": state == "ready"}
                )
                speech_run = speech_run + 1 if speech and state == "ready" else 0
                # 400 ms sustained VAD, not a one-second energy timer. Tests must
                # reject short noise plus VAD hangover, not just echo at convergence.
                if speech_run >= 20 and not episode_proposed:
                    proposals.append((index + 1) * 10)
                    episode_proposed = True
                if not speech:
                    episode_proposed = False
            timings.append((time.perf_counter() - started) * 1000)
        return output, {
            "transitions": transitions,
            "statistics_100ms": readings,
            "proposal_times_ms": proposals,
            "ready_fraction": float(np.mean(ready_frames)),
            "vad": speech_frames,
            "processing_ms": {
                "median": float(np.median(timings)),
                "p95": float(np.percentile(timings, 95)),
                "max": float(np.max(timings)),
            },
        }
    finally:
        processor.close()


def ownership_cases(factory) -> dict:
    """Declared proxy: zero echo/noise proposals, clear ready-onset speech <=1 s."""
    far, human = speech_like(13), speech_like(41)
    latency_samples = measure_signal_latency(factory)
    reports = {}
    for name in (
        "echo_only",
        "noise_burst",
        "human",
        "after_convergence",
        "playback_end",
        "known_delay_change",
        "hidden_delay_change",
        "human_during_change",
        "reset",
    ):
        render = far.copy()
        hints = np.full(800, 40)
        capture = echo_path(render, 40)
        onset = None
        if name in ("known_delay_change", "hidden_delay_change", "human_during_change"):
            capture[4 * RATE :] = echo_path(render, 100)[4 * RATE :]
            if name != "hidden_delay_change":
                hints[400:] = 100
        if name == "noise_burst":
            capture[4 * RATE : 4 * RATE + 1280] += np.random.default_rng(55).normal(0, 0.04, 1280)
        if name in ("human", "after_convergence", "playback_end", "human_during_change"):
            onset = {
                "human": 4,
                "after_convergence": next(
                    x["at_ms"] + 10
                    for x in reports["echo_only"]["transitions"]
                    if x["state"] == "ready"
                )
                / 1000,
                "playback_end": 5.8,
                "human_during_change": 4.1,
            }[name]
            near = human.copy()
            near[: round(onset * RATE)] = 0
            if name == "playback_end":
                render[6 * RATE :] = 0
                capture = echo_path(render, 40)
            capture += near
        output, details = trace(
            factory, capture, render, hints, reset_frame=400 if name == "reset" else None
        )
        proposals = details["proposal_times_ms"]
        if onset is None:
            passed = not proposals
            latency = None
        else:
            after = [x for x in proposals if x >= onset * 1000]
            latency = after[0] - onset * 1000 if after else None
            # During a known discontinuity, conservative abstention is acceptable;
            # onset PCM must nevertheless survive for eventual STT.
            passed = not any(x < onset * 1000 for x in proposals) and (
                name in ("human_during_change", "playback_end")
                or (latency is not None and latency <= 1000)
            )
        reports[name] = {**details, "latency_ms": latency, "pass": passed}
        if onset is not None:
            start = round(onset * RATE)
            desired = human[start : start + RATE]
            received = output[start + latency_samples : start + RATE + latency_samples]
            gain = float(received @ desired / (desired @ desired))
            sdr = reduction_db(desired * gain, received - desired * gain)
            reports[name]["onset_ms"] = onset * 1000
            reports[name]["first_second_gain"] = gain
            reports[name]["first_second_sdr_db"] = sdr
            reports[name]["pass"] &= 0.7 <= gain <= 1.3 and sdr >= 6
        if name in ("known_delay_change", "hidden_delay_change"):
            reports[name]["reduction_by_100ms_after_change_db"] = [
                reduction_db(capture[start : start + 1600], output[start : start + 1600])
                for start in range(4 * RATE, 8 * RATE, 1600)
            ]
    return {"cases": reports, "pass": all(r["pass"] for r in reports.values())}


def diversity(factory) -> dict:
    latency = measure_signal_latency(factory)
    reports = {}
    gate = Acceptance()
    for render_kind, near_kind in (
        ("low", "high"),
        ("high", "low"),
        ("low", "fricative"),
        ("fricative", "alternating"),
    ):
        render, near = diverse_source(render_kind, 13), diverse_source(near_kind, 41)
        cases = {}
        for delay in (0, 40, 80, 160):
            echo = echo_path(render, delay)
            output, _ = trace(factory, echo, render, np.full(800, delay))
            value = reduction_db(echo[2 * RATE :], output[2 * RATE :])
            cases[f"echo_{delay}ms"] = {
                "reduction_db": value,
                "pass": value >= gate.echo_reduction_db,
            }
        near[: 3 * RATE] = 0
        output, info = trace(factory, echo_path(render, 80) + near, render, np.full(800, 80))
        windows = {}
        for ms in (50, 100, 200, 500, 1000):
            size = RATE * ms // 1000
            desired = near[3 * RATE : 3 * RATE + size]
            received = output[3 * RATE + latency : 3 * RATE + size + latency]
            gain = float(received @ desired / (desired @ desired))
            windows[str(ms)] = {
                "gain": gain,
                "sdr_db": reduction_db(desired * gain, received - desired * gain),
            }
        value = windows["1000"]
        cases["double_talk"] = {
            "onset_windows_ms": windows,
            "pass": gate.near_gain_min <= value["gain"] <= gate.near_gain_max
            and value["sdr_db"] >= gate.near_sdr_db,
            "readiness_transitions": info["transitions"],
            "ownership_proposals_ms": info["proposal_times_ms"],
        }
        changed = echo_path(render, 40)
        changed[4 * RATE :] = echo_path(render, 100)[4 * RATE :]
        hints = np.full(800, 40)
        hints[400:] = 100
        output, _ = trace(factory, changed, render, hints)
        value = reduction_db(changed[6 * RATE :], output[6 * RATE :])
        cases["delay_change"] = {"reduction_db": value, "pass": value >= gate.echo_reduction_db}
        noisy = echo_path(render, 80) + np.random.default_rng(55).normal(0, 0.001, len(render))
        output, _ = trace(factory, noisy, render, np.full(800, 80))
        value = reduction_db(noisy[2 * RATE :], output[2 * RATE :])
        cases["echo_noise"] = {"reduction_db": value, "pass": value >= gate.noisy_reduction_db}
        reports[f"{render_kind}_render__{near_kind}_near"] = {
            "cases": cases,
            "pass": all(v["pass"] for v in cases.values()),
        }
    return {"families": reports, "pass": all(v["pass"] for v in reports.values())}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", type=int, choices=(3, 7), default=7)
    parser.add_argument("--report", type=Path, default=Path(".sam/full-apm/ownership.json"))
    args = parser.parse_args()

    def factory():
        return FullApm(
            Path(".sam/full-apm/sam_full_apm.dll"), Path(".sam/full-apm/package"), args.mode
        )

    report = {
        "mode": args.mode,
        "production_selected": False,
        "separation_requirements": vars(Acceptance()),
        "proxy_requirements": {
            "false_proposals": 0,
            "ready_speech_max_latency_ms": 1000,
            "vad_sustain_ms": 400,
        },
        "ownership": ownership_cases(factory),
        "diversity": diversity(factory),
    }
    report["pass"] = report["ownership"]["pass"] and report["diversity"]["pass"]
    args.report.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "pass": report["pass"],
                "ownership_pass": report["ownership"]["pass"],
                "diversity_pass": report["diversity"]["pass"],
            }
        )
    )
    return 0 if report["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
