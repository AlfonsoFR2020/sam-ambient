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
