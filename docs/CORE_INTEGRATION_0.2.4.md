# Core integration / release evidence — 2026-10-08

This records current-dev observations, not release approval or human acceptance.
Baseline `bd63e5ba52e84bdb293298e7f182a24b68db70fc` was clean, with the expected
nine Core Experience V commits. The authorized `origin/dev` preservation push
succeeded. Subsequent work stays local; v0.2.3 metadata/artifacts are unchanged.

## Stage 1 — one bounded real owner-window attempt

The normal supervisor and private authenticated OwnerWindow used temporary
configuration/state/app-data and existing LM Studio / `google/gemma-4-e2b`.
Hardware capture/TTS were disabled. Only operational observations were retained;
no credentials or personal PCM. The probe reloaded its page to install a recorder.

Observed local times (Europe/Madrid):

- Preflight: daemon not running, server false, loaded models absent; CLI installed
  inventory timed out. This was unavailable inventory, not a definitive empty result.
- 12:14:56: normal supervisor started; 12:15:01: endpoint/inventory available.
- 12:15:04: installed Gemma loading began; 12:16:24: core confirmed exact active route.
  Model load took approximately 80 seconds. Serving was already running when core
  discovery observed it and was classified reused, regardless of cold preflight.
- The probe's owner-window route-summary locator never became visible and timed
  out after 180 seconds. No explicit unload/reload, text-generation or Rescan
  assertion was reached. Core activation is not evidence that UI reflected it.
  No second full-Sam launch was made to conceal this failed gate.
- 12:18:00: authenticated UI Quit; 12:18:05: core stopped;
  12:18:06: Sam-loaded Gemma unload independently confirmed absent. Serving cleanup
  was skipped because the core had classified it reused; supervisor stopped.

**Result: partial, not a lifecycle pass.** The failure could be probe/reconnect
observation or UI state; logs do not identify its root cause. Do not weaken the
next check to acknowledgement/button visibility. It must retain actual request IDs,
core terminal events and independently verified inventory. Attach a passive socket
observer before navigation without reloading during bootstrap, retain content-free
UI/state snapshots on failure, and distinguish locator failure from protocol failure.

The temporary runtime log/probe live under ignored `.sam/`; they are not release
artifacts. Focused protection passed: 17 tests covering owner model lifecycle,
PortAudio fake cancellation/failure and the composed everyday runtime; two Chrome
cases covering correlated unload/reload UI and installed-speech rendering. This
does not replace the missing real explicit-operation sequence.

## Stage 2 — representative limits and safe device/scheduling observations

The real session ended at the Stage 1 observation failure before its planned
inference/cadence samples. **No current full-app inference contention or GPU timing
was collected.** Do not relabel the following frontend sample as full Sam.

The mounted React UI / production VisualEngine, current Surface Flow/membrane/
particle paths, and browser-event transport ran in isolated Chrome at 1280×800,
diagnostics closed, desktop profile, manual tiers, default Flow 0.6/amount 0.6.
`ui/tests/browser/everyday-timing.spec.ts` warms each mode, then records actual
WebGL draw-call times. It reports observations; it has no machine-speed FPS gate.
No model/native shell runs in this harness. Browser DPR was one; medium/high had
1280×800 backing pixels, low was pixel-budget-limited to 1265×791.

| Mode | Draw interval median / p95 ms | Scalar event → next draw median / p95 ms |
| --- | ---: | ---: |
| Low | 36.3 / 36.5 | — |
| Medium | 18.2 / 18.4 | — |
| High | 18.2 / 20.8 | — |
| English generated-speech scalar replay | 18.2 / 18.6 | 12.0 / 18.1 |
| Spanish generated-speech scalar replay | 18.2 / 18.6 | 12.0 / 17.9 |
| Audio Reactivity zero | 18.2 / 23.1 | 12.1 / 18.6 |
| Reduced Motion with level updates | 67.0 / 72.6 | 30.3 / 56.3 |

No sampled gap exceeded 100 ms. Draw-call CPU medians quantized to zero: this is
**not** total CPU submission cost, GPU time or proof of zero work. Event-to-next-draw
is frontend scheduling, not acoustic onset-to-display latency or human perception.
Separate fixed-camera installed-speech regression proves modulation magnitude,
zero-reactivity suppression and distinct input/output response; a next draw alone
does not prove visible response. Prior isolated GPU evidence remains separately
recorded in [visual performance](VISUAL_PERFORMANCE_0.2.3_DEV.md).

Actual installed System.Speech en→es→en→es again selected Hazel/Helena, produced
1,079 level events (peak 0.3354), correctly used the missing-voice fallback, and
retired synthesis/output tasks. Generated PCM was paced/discarded, not played.
The fresh backend gate and scalar renderer replay are separate checks, not one
simultaneous real inference/audio/render run.

Actual PortAudio default devices: input 1/output 4, 27 inventory entries. Input
16 kHz mono PCM16 format validation and stream creation/close succeeded **without
starting or reading microphone capture** (reported latency 26 ms). Output opened,
wrote only 100 ms of digital silence, then closed, without underflow (reported
latency 182 ms). These are backend/device-reported buffering values, not measured
physical latency. The first open-only probe used an unsupported `start=False`
constructor keyword; the corrected call constructed/closed the inactive stream.
No product defect or personal microphone recording was involved.

Additional existing regressions: 11 tests passed for bounded capture failure/re-entry,
STT failure→typed recovery and owner Stop speaking preserving complete assistant
text/future playback. Together with Stage 1's 17, **28 focused Python tests** passed.
Three targeted Chrome cases passed; TypeScript and changed-file Biome passed.
Source version-consistency check still reports 0.2.3. The new timing test initially
misread the scalar fixture shape; correcting `speech.output.en/es` required no
runtime changes. No art/gain/default/performance optimization was justified.

Physical device-loss/replug, owner-click-to-audible-silence timing, sustained thermal
load, low-power hardware, full-app inference competition and aesthetic acceptance
remain unmeasured. This is a usable partial assessment, not the intended full-app pass.
