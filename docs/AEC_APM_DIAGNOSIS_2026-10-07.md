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
