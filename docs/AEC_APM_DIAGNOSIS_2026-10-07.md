# Full APM onset, delay and ownership diagnosis (IV-B)

Baseline: `236ff490`; [IV-A evidence](AEC_FULL_APM_GATE_2026-10-07.md) and both
previous rejected processors remain historical evidence. Same pinned upstream
M153 package, source hashes, licenses and fixture/threshold definitions apply.
Production runtime remains untouched. No physical/human acceptance is claimed.

## Checkpoint 1: hypothesis matrix, not production selection

The Sam-owned shim adds four explicitly named public-config hypotheses to the
existing controls. No upstream source is changed; NS/AGC/forced high-pass remain
disabled in the comparison. Mode 3 remains the old internal-estimator linear output.

| Mode | Hypothesis / exact deviation | First-second near gain / SDR | Shifted-delay rejection | Original separation gate |
| --- | --- | --- | --- | --- |
| 1 | Existing processed, no forced high-pass | 0.611 / 3.38 dB | 42.25 dB | fail |
| 4 | Dominant-nearend detector uses bounded instead of unbounded echo spectrum | 0.576 / 2.80 dB | 42.25 dB | fail |
| 5 | Trigger threshold 1 block; nearend smoothing 1 block | 0.576 / 2.94 dB | 42.25 dB | fail |
| 6 | Normal-mode masks use existing nearend-mode masking thresholds | 0.630 / 3.76 dB | 42.25 dB | fail |
| 3 | Existing linear output, internal delay estimator | 0.999 / 20.03 dB | 19.53 dB | fail |
| 7 | Linear output; `delay.use_external_delay_estimator=true` | 1.000 / 23.02 dB | 39.85 dB | pass |

Source trace localizes the difference to `echo_remover.cc`: exported linear
output precedes AEC state selection, residual-echo estimation and suppression.
Processed output uses the estimated linear result only when its internal filter
quality allows it; otherwise it may suppress raw capture according to estimated
echo. `suppression_gain.cc` applies echo-to-nearend masking, temporal gain limits
and dominant-nearend logic. The first 50 ms gain remains approximately 0.002
under all three processed changes. Detector trigger latency or its unbounded
spectrum alone does not explain or repair the destruction. No internal nearend
verdict is exported by this ABI, so that finer attribution remains unproven.

The linear control preserves onset. Mode 7 gains at 50/100/200/500/1000 ms are
1.030/1.007/0.999/1.000/1.000, SDR 15.87/18.04/22.03/22.15/23.02 dB. Fixed echo
0/40/80/160 ms is 32.76/34.17/35.65/34.43 dB; noisy mixture 19.71 dB. No original
threshold, fixture or warm-up window changes to obtain this result.

## Delay interpretation and limits

The public APM contract describes render/capture **buffering delay** at the API
boundaries, not a general-purpose room echo oracle. Our fixture synthesizes that
delay directly and supplies an exact hint. Current Sam PortAudio streams do not
provide an equivalently validated estimate.

`SetAudioBufferDelay` stores a hint; default AEC3 `block_processor.cc` still runs
its internal delay estimator and `AlignFromDelay`. Changing the hint does not
force immediate realignment under the default configuration. Mode 7 instead
uses the exposed external-estimator branch and `AlignFromExternalDelay` on each
block. It accounts for render/capture call-count skew and block quantization.
The initial evidence therefore was not a frame-order bug, but did not configure
the hint as authoritative external alignment. This explains a substantial part
of its observed delayed recovery, not all real echo-path behavior.

The changed-delay fixture alters an effective path delay while announcing the
new correct API delay. This is appropriate to test known buffer discontinuity,
not evidence that an unknown moving acoustic path can be supplied instantaneously.
No manual signal reset, longer measurement window or edited upstream DSP is used
to obtain mode 7's pass. Hidden/unreported delay changes still require testing.

## Evidence and reproduction

[Configuration measurements](evidence/AEC_APM_DIAGNOSIS_2026-10-07.json) include
50/100/200/500/1000 ms onset windows, original cases, VAD and processing cost.
Rebuild `scripts/native/build_full_apm_probe.cmd`, then use
`python -m scripts.full_apm_prototype --mode N --report PATH` for modes 1/3/4/5/6/7.
The nested C++ Tuning assignment operator is not exported by the package;
setting its public scalar fields avoids that ABI limitation without vendor patches.
Additional optional APM statistics are exposed as nullable facts, not ownership.

This checkpoint establishes a candidate for readiness/diversity evaluation.
The original gate passing in mode 7 does **not** select an acoustic engine,
authorize interruption or justify runtime integration.

## Checkpoints 2–6: readiness and ownership falsification

**Decision: FAIL; no production acoustic engine/output selected.** Mode 7 passes
the original separation fixture with exact external alignment, but neither its
ownership signal nor spectral diversity supports integration. No thresholds or
original fixture content were weakened. The probe never stops real playback,
commits text, or imports into production voice.

### Fresh statistics and delay recovery

The pinned `ApmStatsReporter` uses a bounded swap queue and drops updates while
unconsumed. Reading statistics only once after a fixture can return an old queued
snapshot. Historical IV-A `statistics_at_end` values are what the API returned,
**not guaranteed end-state measurements**; separation measurements are unaffected.
IV-B polls every 10 ms. Public ERLE is still smoothed/convergence-conditioned,
not a frame-local residual measurement or a private usable-filter verdict.
Unavailable optional statistics remain null, never a fabricated zero.

With the announced 40 → 100 ms change at 4 s, mode 3's reported delay stays near
36 ms until approximately 5.8 s, then reaches 96 ms. Mode 7 reports 100 ms on the
next frame. Its first four successive 100 ms recovery windows reject echo by
roughly 36/33/35/35 dB. No reset or longer scoring interval obtained this improvement.
This resolves the *known buffering-delay* fixture, not an unannounced acoustic
path change. The latter retains a wrong 40 ms hint and produces poor residual
rejection while public ERLE continues reporting approximately 26–27 dB.

### Readiness candidate and declared decision proxies

The offline candidate requires available processing, an active valid render
reference, continuous frame sequence, unchanged supplied delay, fresh finite
ERLE >=20 dB and reported delay within one upstream 4 ms block of the supplied
hint. Twenty consecutive qualifying 10 ms frames debounce evidence; elapsed
warm-up alone never arms. Failure/reference discontinuity retires readiness;
known delay changes reconverge. A public ERLE drop disarms it. Tests prove these
structural rules, **not their sufficiency as an acoustic safety boundary**.

Before selection, proxies require zero echo/noise/reset false proposals and a
decision within 1000 ms for clear speech after readiness. Existing WebRTC VAD
on linear output must sustain 400 ms of positive frames. An 80 ms noise burst
cannot satisfy this. The fixture's reference-valid flag represents synchronous
known input, not a validated physical Sam reference. No source-component oracle
enters the readiness or VAD decision.

| Case | Observed proposal / onset latency | Result |
| --- | --- | --- |
| Cold/converged echo only | None; readiness first at 3550 ms | pass proxy |
| Echo + short noise burst | None | pass proxy |
| Human onset at 4000 ms | 4440 ms / 440 ms; gain 1.001, SDR 28.07 dB | pass proxy |
| Human immediately after readiness, at 3560 ms | None; ERLE drops and readiness disarms; audio SDR 29.55 dB | fail responsiveness |
| Human near playback end | No cancellation needed before natural end; gain 0.996, SDR 24.46 dB | onset retained |
| Announced delay change | Reconverging at 4010 ms, ready at 4210 ms; no proposal | pass known-change proxy |
| Unannounced delay change, echo only | **False proposal at 4440 ms** | **unsafe** |
| Human during announced change | 4600 ms / 500 ms; gain 0.999, SDR 23.13 dB | pass supported case |
| Reset at 4000 ms | Warms again, ready at 7670 ms; no proposal | pass reset proxy |

The false echo proposal occurs at the same time as the genuine-human proposal.
ERLE/delay stability plus VAD cannot safely distinguish those cases. A longer
timer cannot supply missing alignment/ownership evidence. Conversely, real
near-end activity can reduce ERLE and disarm the candidate despite preserved
audio. These are two separate limitations of this readiness policy.

### Compact spectral diversity, unchanged separation gates

Four deterministic generators add lower/higher-pitch voiced, fricative-heavy
and alternating voiced/unvoiced sources. Independent seeds/spectra separate
render from near-end. No recordings, downloaded models or WAV assets are added.
These cases supplement the original fixtures, rather than replace them.

| Render → near source | Echo rejection at 0/40/80/160 ms, dB | Noise reduction, dB | Near gain / SDR, dB | Changed delay, dB | Separation |
| --- | --- | --- | --- | --- | --- |
| Low → high | 28.40 / 28.33 / 31.77 / 31.43 | 21.60 | 0.971 / 14.13 | 30.50 | pass |
| High → low | -0.01 / 4.37 / 2.30 / 2.33 | 2.66 | 1.003 / 6.69 | 4.64 | fail |
| Low → fricative | 28.40 / 28.33 / 31.77 / 31.43 | 21.60 | 0.999 / 22.78 | 30.50 | pass |
| Fricative → alternating | -0.02 / 3.00 / 4.87 / 4.88 | 3.69 | 1.006 / 8.88 | 2.99 | fail |

Near-end preservation passes the first-second gate in all four families; two
render families fail echo/noise/recovery badly. Their exact excitation/filter
cause remains unisolated. This does not prove all upstream APM configurations
fail, nor justify editing DSP internals. Readiness never arms for the diversity
double-talk cases, so a separation pass alone is not a useful ownership verdict.

### Resource evidence, reproduction and next boundary

The original linear path has 4 ms measured signal delay. The complete offline
mode-7 frame path (native processing, Python metrics/readiness and VAD) measures
approximately 0.045–0.049 ms median, 0.051–0.129 ms p95, and <=0.418 ms observed
maximum per 10 ms frame on this machine. This is host CPU cost, not device
latency or a hardware-independent deadline. The rebuilt shim is 16,384 bytes;
the unchanged upstream DLL is 747,520 bytes. Fixture arrays/history are finite;
there is no production queue, thread or dependency added.

Run `python -m scripts.apm_ownership_probe --mode 7 --report PATH` after the
same pinned native build. Exit 1 is the **expected rejected-engine outcome**.
[Ownership/diversity evidence](evidence/AEC_APM_OWNERSHIP_2026-10-07.json) records
decision proxies, onset and recovery windows, sampled public statistics and
timing. Fifteen readiness/diversity/counterexample tests preserve the negative
result alongside ABI/reset and conservative voice regressions.

Checkpoints 7–8 are skipped: an owned Meson build and production integration
contract are conditional on a passing acoustic route. No Meson environment was
installed, no binary provenance claim strengthened, and no runtime integration
was attempted. Existing source/license pins and young-publisher limitation remain.

**Next BASIC task:** characterize Windows render/capture timing and reference
validity in a bounded, separately authorized non-human device experiment before
further algorithm tuning. Start with deterministic timing/discontinuity tests;
later synthetic speaker/loopback measurement can establish latency, drift and
reference observability without asking the owner to speak. Do not retain raw
audio by default. Representative physical acoustic data is needed before stronger
algorithm claims; human room/persona acceptance remains a later separate gate.
Keep conservative interruption for this milestone. Do not repeat the rejected
extractor/DMO probes or select another engine merely because this effort failed.

## Final validation

118 focused tests passed across the full-APM adapter, readiness counterexample,
previous prototype adapters, VAD, conservative barge-in, voice stream/recovery
and TurnManager ownership. Ruff check and format passed for the four changed
Python files. Native shim compilation, Python compile checks, local documentation
links, evidence consistency and `git diff --check` passed. No frontend, browser,
full Sam, provider, physical microphone/speaker or human tests were run.
