# Consolidation II: Windows AEC filter probe

**Separation gate failed; no production integration or early barge-in.**
The [rejected extraction](AEC_PROTOTYPE_2026-09-30.md) remains valid negative
evidence. Neither experiment proves that full upstream WebRTC APM fails.

## Upstream build boundary and fallback

Full upstream WebRTC requires GN/Ninja, depot-tools and a substantial dependency
checkout; APM depends on other audio/common/system/third-party targets. Sam has
no pinned full APM artifact, source or GN/depot-tools build. This is a separate
native-build deliverable, not a small binding edit. No large checkout/tool install
or unreviewed wheel was substituted. Its BSD license is compatible in principle;
an actual build requires dependency/notices verification. Upstream DSP was not run.

References: [WebRTC development](https://webrtc.github.io/webrtc-org/native-code/development/),
[revision-specific build guidance](https://webrtc.googlesource.com/src/+/977fa8c2e033d6652d5b19e37f0633a9e25c3f55/docs/native-code/development/index.md),
[APM target](https://webrtc.googlesource.com/src/+/0b52bb5022e8060f59e39b0c358a964150eaa4d0/modules/audio_processing/BUILD.gn).
These establish build scope, not measured upstream cost/failure.

The documented Windows fallback is tested through a small **Sam-authored** C++
shim to Voice Capture DSP filter mode. Application PCM goes to both streams;
source-mode capture/device APO replacement is not used. No device/network is
opened. No DSP implementation source is copied or bundled.

## Provenance / exact boundary

- Installed MSVC 14.51.36231 / Build Tools 18.10 and SDK 10.0.26100.0 compile
  `/W4 /WX /O2 /LD /MD`. No package versions change; prerequisites are optional.
- OS `mfwmaaec.dll`: 10.0.26100.9549, 274,432 bytes, SHA-256
  `cd324e2d7b8de91a4648f83aac70a4edc18088dec9bc29d3997e0ff3436701fc`.
  Windows licensing governs this OS component; it is not redistributed by Sam.
  Authored shim: 18,432 bytes, not a release artifact.
- `CLSID_CWMAudioAEC` / `IMediaObject` / `IPropertyStore`; filter mode,
  single-channel AEC, **16 kHz mono PCM16, 160 samples / 10 ms**. AGC, noise
  suppression, center clipping and noise fill disabled; residual echo suppression
  tested at documented 0 and 2 only. No hyperparameter search or relaxed gate.
- Capture stream 0, current render stream 1 with common sample-index timestamps
  in 100 ns units. DMO estimates its echo path; no WebRTC-style delay hint or
  claimed hardware alignment. Mixtures contain delayed echo, reference is current.
- One serialized COM thread. Output and pending queue each bounded at 16 frames
  (5,120 bytes); initial underflow returns silence for offline latency measurement.
  Overflow/incomplete output fails. Reset recreates COM/queues; close is idempotent.
  Cross-thread use rejects. None of this is approved production fallback behavior.

Microsoft sources: [DSP filter/source semantics](https://learn.microsoft.com/en-us/windows/win32/medfound/voicecapturedmo),
[frame size](https://learn.microsoft.com/en-us/windows/win32/medfound/mfpkey-wmaaecma-featr-frame-sizeproperty),
[residual suppression](https://learn.microsoft.com/en-us/windows/win32/medfound/mfpkey-wmaaecma-featr-aesproperty).

## Unchanged eight-second fixture gates

Factory injection reuses the original seeded mixtures/metrics/thresholds, not the
extracted processor. Its binding is now lazily imported only when selected;
Windows uses the existing optional NumPy fixture environment.

| Case | AES 0 | AES 2 | AES 2 gate |
| --- | --- | --- | --- |
| Echo 0 ms | 9.52 dB | 18.16 dB | >=20 dB: failed |
| Echo 40 ms | 10.29 dB | 19.74 dB | Failed |
| Echo 80 ms | 10.09 dB | 19.30 dB | Failed |
| Echo 160 ms | 7.64 dB | 14.99 dB | Failed |
| Echo + noise | 9.86 dB | 19.00 dB | >=10 dB: passed |
| First-second double-talk | Gain 0.920 / SDR 11.93 dB | Gain 0.826 / SDR 12.89 dB | Gain 0.7–1.3 / SDR >=6: passed |
| Near speech at playback end | Gain 0.905 / SDR 17.72 dB | Gain 0.888 / SDR 18.33 dB | Passed |
| Delay shift, after 2 s | 6.74 dB | 15.46 dB | >=20 dB: failed |

Measured fixed signal latency **20 ms**, distinct from echo-path delay. AES 2
process-call median **0.0329 ms**, p95 **0.0370 ms**, max **0.3383 ms** versus
10 ms frame duration. Some late seconds cross 20 dB; the declared gate after
two-second warm-up still fails. Native internal memory/thread costs not profiled.
Near-end survival is encouraging but insufficient when self-output rejection fails.
No physical acoustic success is inferred.

## Reproduction / validation

With existing C++ Build Tools/SDK and the optional NumPy fixture environment:

```powershell
cmd /d /c scripts\native\build_windows_aec_probe.cmd
.venv/Scripts/python.exe -m scripts.windows_aec_prototype --dll .sam/windows-aec/sam_windows_aec.dll --aes 2
$env:SAM_WINDOWS_AEC_DLL = (Resolve-Path .sam/windows-aec/sam_windows_aec.dll).Path
.venv/Scripts/python.exe -m pytest tests/unit/test_windows_aec_prototype.py -q
```

Measurement exits **1** honestly. Binaries/metrics remain ignored under `.sam`;
no PCM retained. Two native tests pass: exact frames, invalid delay, repeated
reset/fresh equivalence, render-history removal and idempotent close. Combined
native/old probe/barge-in/stream-lifecycle gate: **54 tests passed**. Native compile
errors were limited to corrected shim headers/macros/interface linkage. Machine
shell initialization reports a broken Clink hook but the build succeeds; global
shell/authentication settings were not changed.

## Stop decision

Checkpoint 6 is skipped: no processor passed all gates. Production keeps pinned
candidate/transcript screening, without raw-RMS permission or a new VAD timer.
Next acoustic task: **pinned full upstream APM build, then the same offline probe**,
with independent build/measurement checkpoints. If that native build is too costly,
explicitly revisit Windows configuration/fixture limits; do not universally reject
Windows AEC or lower thresholds to declare success.
