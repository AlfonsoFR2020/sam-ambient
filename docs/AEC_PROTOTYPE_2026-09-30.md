# AEC3 processor falsification — 2026-09-30

**Outcome: integration gate failed.** An offline Windows processor runs and
reduces echo, but this selected binding/fixture combination does not meet the
declared separation thresholds. No production audio, candidate policy, turn
ownership or early barge-in behavior changed. This is not evidence that upstream
WebRTC AEC3 as a whole fails, nor a physical-room result.

## Selected mechanism and provenance

- Experimental dependency group `aec-prototype`: **pywebrtc-audio 0.2.0** and
  its required **NumPy 2.5.3**. No existing locked dependency version changed;
  normal Sam runtime dependencies remain unchanged.
- [Publisher repository](https://github.com/strands-labs/pywebrtc-audio) under
  Strands Labs: created April 2026, four visible commits, latest push September
  3, 2026, not archived at inspection. It is a young beta binding with current
  Windows packaging, not a long-established maintenance guarantee. Source
  inspected at `1bc860a2051c2b9b3c10b8c778770794b9321d84`.
- [Published 0.2.0 wheel](https://pypi.org/project/pywebrtc-audio/0.2.0/) for
  CPython 3.12 Windows x86-64: **513,391 bytes**, SHA-256
  `0dabbdadd5d7fd7dcb88323266e5e14d46aaa136c58fa0573c4b0323b683c80b`.
  It imports in Sam's existing Python 3.12.11 environment. Publisher CI uses
  cibuildwheel on Windows; source build uses CMake/MSVC and pybind11.
- `EchoCanceller` directly wraps `EchoCanceller3Factory`, `AnalyzeRender`,
  `AnalyzeCapture` and `ProcessCapture`. This is a **vendored extraction**,
  sourced through ewan-xu/AEC3 with documented changes; it is not the complete
  current upstream Audio Processing Module. An exact original WebRTC revision
  is not established by its modification record. The Python interface pairs
  render/capture arrays and exposes a delay hint, not separate asynchronous
  reverse/capture APIs or a trusted human-origin verdict.
- Wheel `LICENSE`/`NOTICE` contain Apache-2.0 wrapper, WebRTC BSD-style,
  permissive Ooura FFT, Abseil Apache-2.0, JsonCpp MIT, rnnoise BSD and PFFFT
  permissive notices. NumPy is BSD-3-Clause with its bundled notices. No source
  was copied into Sam. Preserve these complete notices if a future approved
  bundle includes the binaries; this prototype does not change release contents.
- Reviewed binding/build paths are local numerical processing; no telemetry or
  network client was found there. `WEBRTC_APM_DEBUG_DUMP=0` is a build definition.
  Sam's probe never opens devices, emits waveform dumps or transmits PCM.

## Narrow boundary and measurement contract

`scripts/aec_prototype.py` contains a replaceable processor protocol with paired
capture/render and reset. Its adapter accepts exactly **160 samples / 320 bytes,
16 kHz mono PCM16, 10 ms**, validates a supplied integer delay in **0–250 ms**,
returns independent immutable bytes and retains no application reference queue.
The pair represents current simulated render-write/capture time; **the render
reference is not pre-delayed**. AEC3 receives the delay hint and retains its own
native filter history. Reset recreates the native object and audio buffers rather
than relying on the binding's partial reset. Repeated reset matches a new object.
Instances require one serialized owner; no live generation owner exists yet.

Compact eight-second fixtures generate harmonic/fricative speech-like signals
from fixed seeds, not recordings. Echo has attenuation and three delayed FIR
taps. Capture adds independent near-end excitation or seeded noise. The delay
shift is 40 → 100 ms at four seconds with a two-second recovery window. Human
onset near playback end is 200 ms before render stops.

Thresholds were declared before the first processor run and were not relaxed:

- Known echo: **20 dB** power reduction after a two-second warm-up (99% removed).
- Echo plus noise: **10 dB** mixture power reduction (90% removed).
- First second of independent near-end speech: projection gain **0.7–1.3** and
  signal-to-residual ratio **at least 6 dB** (desired power at least four times
  residual error). These are screening thresholds, not intelligibility scores.

Near-only broadband calibration measures **128 samples / 8 ms** of fixed output
latency. Near-end metrics compensate for this delay; echo delay and signal
latency are different quantities. The initial unaligned projection incorrectly
suggested near-end loss and was corrected before drawing conclusions. This
correlation is offline metric alignment, never a proposed ownership classifier.
Near-only speech gain passes the preservation floor after alignment.

## Observed separation and cost

| Fixture | Measurement | Gate |
| --- | --- | --- |
| Echo, 0 ms delay | 17.90 dB reduction | Failed |
| Echo, 40 ms | 17.88 dB | Failed |
| Echo, 80 ms | 17.88 dB | Failed |
| Echo, 160 ms | 17.88 dB | Failed |
| Echo + noise, 80 ms | 16.57 dB mixture reduction | Passed |
| Double-talk onset | Near gain 0.723; 4.18 dB first-second SDR | Failed |
| Near-end begins near playback end | Near gain 0.907; 8.08 dB SDR | Passed |
| Delay shift, measured after 2 s | 15.78 dB reduction | Failed |

The probe also reports per-second echo reduction; later seconds do not establish
convergence above the gate. Near-end is partly preserved, rather than completely
gated, but its first-second residual/distortion remains too large for this gate.
Fixture limitations, extraction/version and binding configuration remain possible
causes. This task did not isolate one of them as the root cause or tune a new DSP.

One representative Windows run: process-call median **0.068 ms**, p95 **0.083 ms**,
maximum **2.45 ms**, compared with a 10 ms frame budget. Includes adapter/native
allocation and byte-return cost; excludes fixture generation/PCM encoding and
device timing. These are observations, not machine-specific CI thresholds.
Installed `.pyd`: **660,480 bytes**; binding distribution about **1.28 MB**;
NumPy installed files about **41.91 MB**. Native working-memory and thread costs
were not profiled. Application calls are exact fixed frames; fixtures are fixed
eight-second arrays, not streaming unbounded queues. No production reference
buffer, clock alignment or resampler was introduced.

## Reproduction, test meaning and stopping decision

```powershell
uv sync --locked --group aec-prototype
uv run --locked --group aec-prototype python scripts/aec_prototype.py
uv run --locked --group aec-prototype pytest tests/unit/test_aec_prototype.py -q
```

The **probe exits 1** because the declared integration gate fails. The **11 unit
tests pass** for exact framing, delay rejection, immutable ownership, repeated
reset/fresh-operation equivalence, latency measurement and honest gate reporting.
Green measurement tests do not mean processor acceptance. Without the optional
group, these prototype tests skip; ordinary voice/lifecycle tests remain active.

Final focused validation: **60 tests** across the prototype, barge-in controller,
voice stream lifecycle, voice recovery and turn manager, plus **16 generation
terminality tests**. Changed-file Ruff lint/format, Python compilation, local
documentation-link checks and `git diff --check` pass. No browser, provider,
audio hardware, real speech service or Sam runtime was started. The repository
interpreter and TLS failed inside the sandbox but worked in the normal host
context; no interpreter repair, dependency upgrade or TLS bypass was needed.

Checkpoint 1 stops here. Checkpoints 2–6 were not begun. No echo-only false-trigger
rate, sustained human-origin decision, approximately-one-second interruption,
capture pre-roll integration or physical acoustic acceptance has been proven.
22.05 kHz output normalization is also deferred: a failed separation gate gives
no reason to wire a resampler or processor into Sam.

**Smallest next experiment:** establish a provenance-pinned, unmodified upstream
WebRTC APM/AEC3 adapter/build feasibility and replay these same declared fixtures,
with the measured latency correction. First determine whether a small Windows
adapter is actually maintainable; stop if it requires a large native subsystem.
Do not lower the thresholds or replace them with a raw-VAD timer. This result
does not by itself make Windows DMO the preferred processor. If upstream-native
cost is disproportionate, the contract's Windows Voice Capture DMO filter-mode
fallback is the next feasibility investigation, not an automatic runtime change.

The existing conservative transcript-gated playback candidate path remains the
production fallback, preserving complete assistant text and typed-turn recovery.
Physical speaker/microphone validation remains mandatory before a later claim
that barge-in is solved; no human test is requested now.
