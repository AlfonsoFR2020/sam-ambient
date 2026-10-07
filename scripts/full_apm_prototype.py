"""Optional full upstream APM offline gate. Never opens devices or enters Sam runtime."""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import math
import os
import threading
from pathlib import Path

import numpy as np

from scripts.aec_prototype import (
    FRAME_BYTES,
    RATE,
    SAMPLES,
    echo_path,
    evaluate,
    pcm,
    run_frames,
    speech_like,
)

UPSTREAM_DLL_SHA256 = "15061610ffc7283a4f588899dcedb968cce575829194761d6b5c77ea114e4ba7"


class FullApm:
    """One serialized owner; render precedes capture; reset recreates complete APM."""

    def __init__(self, dll: Path, package: Path, mode: int = 0) -> None:
        if isinstance(mode, bool) or not isinstance(mode, int) or mode not in (0, 1, 2, 3):
            raise ValueError("unknown processing mode")
        self.mode = mode
        self.thread = threading.get_ident()
        upstream = package.resolve() / "bin" / "webrtc-audio-processing-3-0.dll"
        if hashlib.sha256(upstream.read_bytes()).hexdigest() != UPSTREAM_DLL_SHA256:
            raise ValueError("unverified full APM binary")
        self.directory = os.add_dll_directory(str(upstream.parent))
        self.library = ctypes.CDLL(str(dll.resolve()))
        self.library.sam_apm_create.argtypes = [ctypes.POINTER(ctypes.c_void_p), ctypes.c_int]
        self.library.sam_apm_create.restype = ctypes.c_int
        self.library.sam_apm_close.argtypes = [ctypes.c_void_p]
        self.library.sam_apm_close.restype = None
        self.library.sam_apm_render.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint32]
        self.library.sam_apm_render.restype = ctypes.c_int
        self.library.sam_apm_capture.argtypes = [
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_void_p,
            ctypes.c_uint32,
            ctypes.c_int,
        ]
        self.library.sam_apm_capture.restype = ctypes.c_int
        self.library.sam_apm_stats.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_double)]
        self.library.sam_apm_stats.restype = ctypes.c_int
        self.handle = ctypes.c_void_p()
        self.reset()

    def check_thread(self) -> None:
        if threading.get_ident() != self.thread:
            raise RuntimeError("full APM requires one serialized owner")

    def check(self, status: int) -> None:
        if status != 0:
            self.close()
            raise RuntimeError(f"full APM failed with status {status}; processor retired")

    def render(self, frame: bytes) -> None:
        self.check_thread()
        if len(frame) != FRAME_BYTES:
            raise ValueError("exact 10 ms mono PCM16 frame required")
        if not self.handle.value:
            raise RuntimeError("processor closed")
        self.check(self.library.sam_apm_render(self.handle, frame, SAMPLES))

    def process_capture(self, frame: bytes, *, delay_ms: int) -> bytes:
        self.check_thread()
        if len(frame) != FRAME_BYTES:
            raise ValueError("exact 10 ms mono PCM16 frame required")
        if isinstance(delay_ms, bool) or not isinstance(delay_ms, int) or not 0 <= delay_ms <= 250:
            raise ValueError("delay must be an integer in 0..250 ms")
        if not self.handle.value:
            raise RuntimeError("processor closed")
        output = ctypes.create_string_buffer(FRAME_BYTES)
        self.check(self.library.sam_apm_capture(self.handle, frame, output, SAMPLES, delay_ms))
        return output.raw

    def process(self, capture: bytes, render: bytes, *, delay_ms: int) -> bytes:
        # Validate both sources/timing before mutating native reference state.
        if len(capture) != FRAME_BYTES or len(render) != FRAME_BYTES:
            raise ValueError("exact 10 ms mono PCM16 frame required")
        if isinstance(delay_ms, bool) or not isinstance(delay_ms, int) or not 0 <= delay_ms <= 250:
            raise ValueError("delay must be an integer in 0..250 ms")
        self.render(render)
        return self.process_capture(capture, delay_ms=delay_ms)

    def statistics(self) -> dict[str, float | None]:
        self.check_thread()
        values = (ctypes.c_double * 3)()
        self.check(self.library.sam_apm_stats(self.handle, values))
        return {
            name: value if math.isfinite(value) else None
            for name, value in zip(
                ("erle_db", "residual_echo_likelihood", "delay_ms"), values, strict=True
            )
        }

    def reset(self) -> None:
        self.close()
        self.check(self.library.sam_apm_create(ctypes.byref(self.handle), self.mode))

    def close(self) -> None:
        self.check_thread()
        if self.handle.value:
            self.library.sam_apm_close(self.handle)
            self.handle = ctypes.c_void_p()

    def __del__(self) -> None:
        if getattr(self, "handle", None) and threading.get_ident() == self.thread:
            self.close()
        if getattr(self, "directory", None):
            self.directory.close()


def discrimination(factory) -> dict[str, object]:
    """Existing VAD on 20 ms processed frames; NOT permission to interrupt or commit."""
    from sam_ambient.adapters.vad import WebRtcVoiceActivityDetector
    from sam_ambient.core.voice import AudioFormat, AudioFrame

    render = speech_like(13)
    near = speech_like(41)
    near[: 3 * RATE] = 0
    results = {}
    for name, capture in (
        ("echo_only", echo_path(render, 80)),
        ("double_talk", echo_path(render, 80) + near),
    ):
        output, _ = run_frames(factory(), capture, render, np.full(800, 80))
        vad = WebRtcVoiceActivityDetector()
        decisions = []
        for offset in range(0, 4 * RATE, 320):
            frame = AudioFrame(
                AudioFormat(),
                pcm(output[offset : offset + 320]),
                monotonic_ms=offset * 1000 // RATE,
                sequence=offset // 320,
            )
            decisions.append(vad.analyze(frame).is_speech)
        results[name] = {
            "cold_first_two_seconds_speech_fraction": float(np.mean(decisions[:100])),
            "speech_fraction_before_onset": float(np.mean(decisions[100:150])),
            "speech_fraction_first_second": float(np.mean(decisions[150:])),
        }
    # An unchanged speech detector must not call most residual echo frames human.
    results["pass"] = (
        results["echo_only"]["speech_fraction_first_second"] <= 0.1
        and results["double_talk"]["speech_fraction_first_second"] >= 0.6
    )
    return results


def preservation_diagnostics(factory) -> dict[str, object]:
    """Control and onset measurements; never alter the existing acceptance gate."""
    render = speech_like(13)
    human = speech_like(41)
    from scripts.aec_prototype import measure_signal_latency, reduction_db

    latency = measure_signal_latency(factory)
    result = {}
    for name, onset, stop in (("near_only", 0, 0), ("double_talk", 3, 8), ("playback_end", 5.8, 6)):
        far, near = render.copy(), human.copy()
        far[round(stop * RATE) :] = 0
        near[: round(onset * RATE)] = 0
        processor = factory()
        output, _ = run_frames(processor, echo_path(far, 80) + near, far, np.full(800, 80))
        try:
            segments = {}
            start = round(max(onset, 2) * RATE)
            for milliseconds in (200, 1000):
                size = RATE * milliseconds // 1000
                desired = near[start : start + size]
                received = output[start + latency : start + size + latency]
                gain = float(received @ desired / (desired @ desired))
                segments[str(milliseconds)] = {
                    "gain": gain,
                    "sdr_db": reduction_db(desired * gain, received - desired * gain),
                }
            result[name] = {
                "onset_windows_ms": segments,
                "statistics_at_end": processor.statistics(),
            }
        finally:
            processor.close()
    changing = echo_path(render, 40)
    changing[4 * RATE :] = echo_path(render, 100)[4 * RATE :]
    delays = np.full(800, 40)
    delays[400:] = 100
    processor = factory()
    try:
        output, _ = run_frames(processor, changing, render, delays)
        result["delay_change_recovery"] = {
            "reduction_by_second_db": [
                reduction_db(
                    changing[i * RATE : (i + 1) * RATE],
                    output[i * RATE : (i + 1) * RATE],
                )
                for i in range(8)
            ],
        }
    finally:
        processor.close()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dll", type=Path, default=Path(".sam/full-apm/sam_full_apm.dll"))
    parser.add_argument("--package", type=Path, default=Path(".sam/full-apm/package"))
    parser.add_argument("--report", type=Path, default=Path(".sam/full-apm/result.json"))
    parser.add_argument("--mode", type=int, choices=(0, 1, 2, 3), default=0)
    args = parser.parse_args()
    factory = lambda: FullApm(args.dll, args.package, args.mode)  # noqa: E731
    report = evaluate(factory)
    report["discrimination"] = discrimination(factory)
    report["preservation_diagnostics"] = preservation_diagnostics(factory)
    report["processor"] = "Full APM M153 / m153.8010.0.2"
    report["mode"] = args.mode
    report["acoustic_gate_pass"] = report["separation_pass"] and report["discrimination"]["pass"]
    args.report.write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    print(json.dumps(report, indent=2, allow_nan=False))
    return 0 if report["acoustic_gate_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
