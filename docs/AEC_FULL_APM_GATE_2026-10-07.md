# Full upstream WebRTC APM: production engine gate

Recorded 2026-10-07 on Windows x64, development baseline `c6d34eae`.
**Decision: not selected for production.** Full APM can be built behind a small
Sam ABI using existing tools and markedly improves fixed-delay echo rejection.
None of the three tested output configurations passes every unchanged acoustic
gate. Runtime audio, TurnManager and conservative interruption are untouched.
Physical room acceptance remains unavailable, not inferred from these fixtures.

This is historical IV-A evidence. [IV-B diagnosis](AEC_APM_DIAGNOSIS_2026-10-07.md)
subsequently repairs known-delay linear alignment, but rejects production
selection after ownership and spectral-diversity counterexamples. Its next-task
recommendation supersedes the historical diagnosis recommendation below.

## Artifact, provenance and build

The experiment uses the complete standalone APM package from
[Sqhh99/webrtc-audio-processing](https://github.com/Sqhh99/webrtc-audio-processing/tree/65f1b3b959d3aaff17bd6611418980f49a5af3b8),
[release m153.8010.0.2](https://github.com/Sqhh99/webrtc-audio-processing/releases/tag/m153.8010.0.2),
published 2026-09-26. This is an independent repackaging, not a Google binary,
Python wheel or another AEC3 extraction. It includes `audio_processing_impl`,
the builtin APM builder and the full processing pipeline.

- Package source commit: `65f1b3b959d3aaff17bd6611418980f49a5af3b8`.
- Recorded upstream WebRTC M153 revision:
  `9ea5afcad008b940468c2a15aec339592cf5a935` (Chromium 153.0.8010.55).
- Package API: `webrtc-audio-processing-3`, version 3.0; Abseil 20250814.1.
- Windows x64 archive SHA-256:
  `76085b8fc409cfadec17c0c58e3eea829370668f33e91fc93327f891e93692b1`.
- APM DLL SHA-256:
  `15061610ffc7283a4f588899dcedb968cce575829194761d6b5c77ea114e4ba7`.
- Normalized source comparisons against the pinned official revision matched
  `builtin_audio_processing_builder.cc`, `audio_processing_impl.cc`,
  `aec3/echo_remover.cc` and `aec3/block_processor.cc`. These are spot checks,
  not a full source audit or reproducible attestation of the released binary.
- Reviewed packaging patches concern portability/build/tests, including MSVC
  SIMD access. Sam modifies no upstream DSP source. No vendor tree is committed.

The publisher's build is Meson >=0.63, Ninja, C++20 and pinned Abseil; its CI
defines Windows MSVC builds and upstream tests. This run did not independently
rebuild the upstream library or verify a particular publisher CI test result.
Meson is absent locally; installed VS Ninja/CMake alone do not replace it. A
separately verified source-build route would need that bounded prerequisite.
No tools or dependencies were installed to conduct this probe.

Sam's narrow C ABI shim compiled with installed VS Build Tools 18.10,
MSVC 14.51.36231 and Windows SDK 10.0.26100.0, C++20 `/O2 /MD /W4 /WX`.
These are tested versions, not a proved minimum SDK/compiler requirement.
The small personal publisher is recently active but has limited maintenance
history. Hash pinning prevents accidental version drift; it does not establish
publisher trust. Production adoption would require an owned, reproducible pinned
build/release policy and notice review, not automatic download on Sam startup.

Licenses reviewed before use: WebRTC BSD-3-Clause plus PATENTS; Abseil Apache-2.0;
PFFFT's permissive FFTPACK notice; rnnoise BSD-3-Clause. All five package notice
files must accompany any later redistribution. No GPL/AGPL code is copied.
`THIRD_PARTY.md` records experimental use only. No release contents change.

## Boundary and configurations

`scripts/native/full_apm_probe.cpp` is a Sam-authored C ABI with create,
render, capture, statistics and close. `scripts/full_apm_prototype.py` supplies
the resettable serialized adapter; vendor C++ types remain behind the ABI.
No device, dump writer, resampler, render queue, network client or runtime import
is added. No telemetry was found in the inspected processing path; this is not
an exhaustive binary security audit.

All runs use 16 kHz mono signed little-endian PCM16, exactly 160 samples / 320
bytes / 10 ms. The upstream int16 API requires matching native capture/render
rates (8/16/32/48 kHz); the float API permits other rates/layouts. This prototype
accepts only 16 kHz mono. `ProcessReverseStream` receives the current undelayed
render frame before `ProcessStream` receives the simulated capture mixture.
The known fixture delay is supplied through `set_stream_delay_ms`; the adapter
accepts 0..250 ms, with measured cases 0/40/80/160 and a 40→100 ms change.
This is not a solution for independent PortAudio clocks or unknown device delay.
Reset destroys/recreates the entire APM, retiring native reference history.

Configurations are deliberately small, not a suppressor parameter search:

- **0:** AEC enabled with upstream-enforced high-pass filtering; NS and AGCs off.
- **1:** same AEC, forced high-pass disabled to separate filter phase effects
  from near-end loss. No compensating gain or relaxed gate.
- **2:** disabled-AEC bypass control, bit-exact after correcting the shim to
  use in-place int16 processing. The upstream disabled pipeline may leave a
  distinct destination untouched; zero-initialized output was an invalid control.
- **3:** no high-pass; supported `GetLinearAecOutput`, without residual suppression.
  Both APM export and builder AEC3 filter-export flags are required. Enabling
  only the former caused a null-access failure in the isolated diagnostic;
  the corrected adapter and reset tests cover the supported paired configuration.

`GetStatistics` exposes optional ERLE, residual-echo likelihood and delay; none
is a human-origin verdict. Residual likelihood was absent in these runs; the
reported delay (64 ms) must not be confused with supplied or fixed signal delay.

## Comparable quantitative evidence

Fixtures and `Acceptance` in `scripts/aec_prototype.py` are unchanged: fixed-seed
eight-second harmonic/fricative signals, delayed/attenuated three-tap echo,
deterministic noise, independent speech at 3 s, speech at 5.8 s before render
ends at 6 s, and a 40→100 ms delay change at 4 s. Echo measures exclude the first
2 s; double-talk measures its first second with separately calibrated latency.
Gates remain >=20 dB echo reduction, >=10 dB noisy mixture reduction, gain
0.7..1.3 and >=6 dB near-end SDR. They are screening requirements, not universal
room-acoustic guarantees. Full exact reports: [machine-readable evidence](evidence/AEC_FULL_APM_2026-10-07.json).

| Measurement | Default APM | No high-pass | Linear AEC output |
| --- | ---: | ---: | ---: |
| Echo 0 / 40 / 80 / 160 ms, dB | 42.24 / 40.07 / 39.70 / 38.87 | 42.42 / 39.59 / 39.62 / 39.62 | 32.76 / 29.96 / 30.15 / 30.50 |
| Echo + noise mixture reduction, dB | 23.40 | 22.80 | 19.46 |
| First-second double-talk gain | 0.293 | 0.611 | 0.999 |
| First-second double-talk SDR, dB | -6.11 | 3.38 | 20.03 |
| Near playback end gain / SDR, dB | 0.523 / -2.88 | 0.870 / 9.36 | 1.000 / 30.34 |
| Changed-delay reduction after 2 s, dB | 41.82 | 42.25 | **19.53** |
| Calibrated fixed signal delay | 8 ms | 8 ms | 4 ms |
| Overall unchanged separation gate | **fail** | **fail** | **fail** |

Prior rejected extraction: approximately 17.9 dB echo, gain 0.723 / SDR 4.18 dB.
Prior Windows filter: 18.16/19.74/19.30/14.99 dB echo, gain 0.826 / SDR 12.89 dB,
changed-delay 15.46 dB. Those results remain preserved in their specialist docs.

Near-only controls without high-pass have gain approximately 1.000 and SDR
66.95 dB at the calibrated delay. Thus format conversion/global attenuation is
not the remaining double-talk problem. The linear output preserves the first
200 ms of overlap: gain 0.994 / SDR 17.95 dB, versus processed no-high-pass
output gain 0.464 / SDR 0.87 dB. Near playback end its first 200 ms gain is 1.006 /
SDR 18.37 dB, versus 0.145 / -5.88 dB. This localizes substantial onset loss to
the residual-suppression path in this fixture/configuration; it does not prove
upstream AEC3 is universally unsuitable or real speech sounds as these metrics imply.

Linear delay recovery remains insufficient: per-second reductions after the
change are 0.86, 2.82, 16.80 and 26.22 dB. The gate aggregates the last two
seconds at 19.53 dB. The later recovery is informative, not permission to extend
warm-up or lower 20 dB to obtain a pass. Readiness/change handling remains open.

## Product-oriented VAD check

The existing WebRTC VAD consumes paired 10 ms outputs as normal 20 ms frames,
using its existing activation/release behavior. After 2 s warm-up, echo-only
speech-frame fraction is 0%; the first second of overlap is 84% for processed
output and 96% for linear output. A declared additional screening proxy (echo
<=10%, overlap >=60%) passes; it does **not** override the separation gate.
Cold first-two-second echo activity is 5% for processed output and 25% for linear
output. Early decisions cannot safely assume immediate convergence. There is
no measured interruption latency because playback cancellation is not integrated.
Processed evidence may eventually stop delivery, **never directly commit text**;
existing candidate/STT/TurnManager commitment remains authoritative.

## Cost, bounds and validation

Final measurements include reverse + capture, ctypes and output allocation:
see exact median/p95/max in the JSON. Typical median ~0.04 ms and p95 below
0.10 ms per 10 ms frame, with observed maxima below 4 ms. Machine timings are
not portable CI limits or exact isolated DSP CPU profiling. Fixed signal delay
is distinct from that CPU cost and from echo-path/device delay.

APM DLL is 747,520 bytes; shim 15,872 bytes; downloaded ZIP 917,090 bytes. The
library imports Windows/VC runtime DLLs, not an external Abseil DLL. Existing
MSVC redistributable requirements still apply; installer work is not done.
Shim buffers are frame-sized; no unbounded reference queue or added worker is
implemented. Process observations remained at 27 OS threads (including NumPy)
before/after creation, replay, ten reset/replays and close. Working set rose
about 220 KiB overall; private-byte changes reflect allocator noise and do not
constitute a precise native heap bound. Internal APM memory was not heap-profiled.

Validation: native compile with warnings treated as errors; **99 focused tests**
across the optional full-APM ABI/framing/reset/failure/hash/thread controls, both
older probes, existing VAD, conservative interruption, voice lifecycle/recovery
and turn simulation. Reset matches a fresh processor for configurations 0/1/3.
All three acoustic CLI runs correctly return **1** for failed production gates;
passing adapter tests must not be confused with a passing acoustic engine.
Ruff/format/static and diff checks are recorded with the commit. No frontend,
full Sam, provider, physical microphone/speaker or human run was performed.

## Reproduction and next bounded task

1. Obtain the exact release asset `webrtc-audio-processing.windows_x86_64.zip`
   from the linked release. Verify the archive SHA-256 above **before extraction**
   to ignored `.sam/full-apm/package`. Retain its notices. The scripts do not
   download/install it. Inspect source/provenance before executing native code.
2. Run `scripts/native/build_full_apm_probe.cmd` from a prepared checkout with
   existing MSVC/SDK. It locates installed tools and compiles only Sam's shim.
3. With the already-installed optional prototype environment, run
   `.venv/Scripts/python.exe -m scripts.full_apm_prototype --mode 0` and modes
   `1` / `3`, supplying distinct `--report` paths. Reproduce the negative exit.
4. Opt in to native tests with `SAM_FULL_APM_DLL` / `SAM_FULL_APM_PACKAGE` set
   to absolute artifact paths, then run `tests/unit/test_full_apm_prototype.py`.
   Default runs skip native tests when the optional artifacts are absent.

**Next BASIC task:** bounded full-APM onset/delay-recovery diagnosis using this
pinned working build and unchanged fixtures, including cold/change VAD risk.
The linear output is a promising diagnostic, not a selected production engine.
Stop if a solution requires invasive upstream DSP changes; do not hide failure
by combining unvalidated output paths or waiting arbitrarily longer. A passing
configuration and maintainable owned build are prerequisites for the existing
[production integration contract](AEC_DOUBLE_TALK_CONTRACT.md).

No additional Windows fallback was investigated: full APM was buildable and
provides useful evidence, rather than being clearly impractical. The failed DMO
filter is not repeated. Resampling, render timeline, delay/drift estimation,
runtime lifetime/fallback and barge-in remain unimplemented. Physical echo,
onset intelligibility and human acceptance remain future gates.
