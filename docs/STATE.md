# Sam implementation state

Updated: 2026-09-18

## MVP status

- The focused 0.2.2 model-response lifecycle slice now gives accepted generations one
  correlated completed, cancelled/superseded, timeout, empty-response or error terminal
  outcome. Replacement turns wait for predecessor terminal publication; stale chunks
  remain rejected. The existing OpenAI-compatible stream timeout now bounds total
  wall-clock generation and first useful content unless the latter is explicitly
  narrowed; metadata/keepalive-only streams cannot report silent success. The reducer
  commits completed current-turn text and clears
  provisional text on cancellation/error. Transcript hydration and broader history work
  remain reserved for 0.2.3. Focused deterministic tests pass; broad and live-model
  validation have not been run.
- The 0.2.2 voice follow-up now serializes committed-turn handoff across runtime and
  delivery ownership. A replacement cancels the predecessor with its existing identity,
  publishes a delivery cancellation when model completion preceded active playback,
  waits for the predecessor response task to unwind, and only then opens the successor
  ledger. Focused deterministic coverage includes replacement during playback and while
  waiting for first model output; no acoustic policy was changed.
- Visual polish pass 1 on `feature/visual-polish` substantially restrains the
  analytic halo and makes the existing deterministic peels wider and farther
  from the body without increasing geometry, draw calls, or mobile frame budgets.
- Visual polish pass 2 restores direct rotation across WebGL and Canvas, makes
  flick inertia frame-independent and motion-scaled, and aligns the pointer hit
  region with the bounded maximum orb extent while preserving mobile budgets.
- Visual polish passes 3 and 4 land their scoped repairs: particles are visibly gold,
  slightly thick and orbiting Sam's atmospheric space; density and resolved
  quality/profile influence bounded renderer budgets; and tooltip/popover placement
  is contained within the Sam window alongside the Controls typography/layout cleanup.
- Visual polish pass 5 audits the implemented engine against the v1 contract. It
  restores the 50 ms integration cap, stationary availability states, 15 Hz and
  200 ms reduced-motion behavior, exact Canvas sampling/clipping/DPR/cadence,
  five-second Auto-quality semantics, bounded context-loss recovery, zero-size and
  disabled suspension, resize/resource cleanup, and allocation-free inertial matrix
  updates. Deterministic validation covers these paths; final human visual/native
  acceptance and a future unobstructed ambient-layout pass remain open.

- `0.2.0` is published under the existing alpha convention. The nine-commit
  stabilization slice is integrated into `dev` and versioned as the `0.2.1` release
  candidate. Hosted Windows Quality and Native Package are green for the integrated
  stabilization baseline (`c477800`); the exact versioned preparation commit awaits
  hosted validation after push. Hosted Ubuntu reaches Python tests but retains an
  unresolved Linux-only failure that is explicitly deferred to the dedicated 0.3.0
  Linux review under the Windows-first alpha policy. Human visual/native/acoustic
  acceptance and signed installer/AV acceptance remain intentionally deferred;
  preparation is not publication approval.
- Native integration checkpoint (`feature/ambient-shell`): the thin Tauri 2 shell
  is reconciled with the frozen ambient React source. It owns the native window,
  single-instance focus, identity/icons, one trusted supervisor child, fixed
  packaged-companion resource boundary, and close coordination only. React still
  connects over the localhost WebSocket; Python still owns supervisor/core,
  models, voice, policy, tools, persistence, and updates. Browser and Chromium
  app-window development fallbacks remain supported.
- Native source includes frozen sibling-component handling, Tauri-origin protocol
  coverage, lifecycle tests, icons, resource layout, Windows CI definitions, and
  guarded companion/NSIS scripts. Native development validation now passes from a
  cold Tauri build through clean managed shutdown: the current Visual Engine loads,
  Restart Sam reconnects to the restarted core without quitting the window, a
  second native launch focuses the sole existing instance, and the title-bar close
  request routes through Sam's Quit confirmation. Vite ignores Cargo target output
  so its watcher survives cold compilation, and the development supervisor uses the
  bootstrapped locked environment without dependency synchronization. Browser and
  Chromium app-window fallbacks remain intact. This validation performs no
  packaging, unsigned companion execution, signing, release, or full human voice or
  visual acceptance. Source gates pass: 105 frontend tests, changed-file Biome,
  TypeScript, Vite production build, Rust formatting and `cargo check --locked`.
- Native LM Studio inventory now preserves installed conversational models reported
  by the supported `lms` CLI when the server's serving inventories are empty because
  those models are unloaded. Installed and loaded inventories remain distinct, and
  existing explicit, last-good, and sole-model selection policy is unchanged. The
  live native development path resolved the existing CLI without a user-specific
  path and reported one installed model with zero loaded. Automated UI smoke covered
  status visibility, Controls, compact 390x700 layout, and distinct Restart/Quit
  confirmations without loading or downloading a model. Human visual/voice
  acceptance and all packaging/release gates remain outstanding.
- Productization backbone: schema-v1 TOML configures supervisor/runtime behavior
  with defaults -> user -> workspace -> environment -> explicit CLI precedence.
  Unsupported keys/types fail early; secrets and SQLite last-good state stay separate.
- Doctor now categorizes runtime, uv, browser, writable root, local providers and
  chat models, Whisper assets/service, system TTS voices, audio directions, UI,
  and supervisor/security state. It is read-only and supplies shared structured
  readiness data for a future installer. Current host: LM Studio installed/stopped;
  Whisper assets available; Windows TTS, audio, UI, Python and root ready.
- GitHub CI repeats Python/Ruff and frontend/Biome/type/build gates on Windows/Linux,
  then builds wheel/sdist and smoke-installs the wheel. Windows Quality and Native
  Package are green through the integrated stabilization baseline; the version-only
  preparation commit still requires hosted validation. Ubuntu fails during Python
  tests, so its dependent package smoke is skipped; this known Linux issue is deferred
  to 0.3.0 rather than hidden by weakened tests or broad runner packages. Publishing
  remains explicitly manual.
- Unreleased TTS hardening: response-language evidence now reaches synthesis;
  Windows enumerates installed voices and selects locale/language before fallback.
  Existing cancellable PCM contract retained; cloud speech remains disabled.
  Silent Windows WAV synthesis passed for installed es-ES Helena and en-US David;
  physical recognition, playback and barge-in remain unvalidated.
- Hardening gate: 306 Python tests pass, two existing skips; Ruff/format pass.
  No frontend changes. Composed multi-turn acceptance covers language/voice switch,
  PCM subprocess synthesis, underrun recovery, stale/duplicate cancellation and
  shutdown. Output waits for PCM; underruns no longer abort speech; last-frame
  cancellation cannot claim completion. TTS stdin is now timeout-bound.
- Read-only audit: system-default audio devices and Whisper assets available;
  Whisper/LM Studio stopped, Ollama absent. Bootstrap/preferences/filtering/owned
  cleanup pass controlled tests; no service manipulation or new live model claim.
- Accepted 0.2.x source on `dev` includes an isolated
  Chromium-family app window with browser fallback, per-root single-instance lock,
  graceful owned-window shutdown, truthful startup/status controls, and bounded
  transcript polish are implemented. [Visual Engine v1](VISUAL_ENGINE_V1.md) Stages
  A-D add typed inputs, bounded motion, a WebGL2 amber orb, drifting peels, analytic
  lights/particles and mobile fallbacks. Desktop geometry/material baselines were
  strengthened after initial review. Acceptance-pending direct mouse/touch rotation,
  damped inertia, persisted typed visual preferences, mobile-profile emulation and a
  bounded measured Auto-quality governor are implemented; final acceptance remains pending.
- Voice endpointing now layers sustained-resume hysteresis and bounded speech-density
  evidence over WebRTC VAD. Sparse candidates are discarded after 12 seconds; every
  initial STT candidate is finalized once at 24 seconds, so dense VAD-positive noise
  cannot accumulate a 30-second clip. Empty results are discarded while meaningful
  sustained speech is committed. Normal silence endpointing, 200 ms pre-roll, short
  utterances, and playback-aware barge-in remain intact. Physical acoustic/AEC
  acceptance remains pending.
- Schema-v1 and trusted owner controls now persist Sam application input and output
  gains from 0-200%. Captured PCM is saturated once before all voice consumers;
  synthesized PCM is saturated once before output metering/playback, so mute reports
  zero emitted energy. These are not operating-system device-volume controls.
- Local bootstrap records service-start and model-load provenance independently.
  Direct Ollama process handles stay in their creating core; verified LM Studio
  service/model provenance is keyed to a random supervisor lifetime so it survives
  managed core Restart but cannot authorize cleanup in a future Sam launch. Persisted graceful-Quit
  policies default to Keep; opt-in cleanup unloads only a Sam-loaded LM Studio model
  and stops only a service Sam started. Restart/failure/Emergency Stop never apply
  exit cleanup, unsupported providers fail closed, and timeouts cannot block shutdown.
- The accepted combined source on `dev` preserves the frozen ambient behavior and
  includes the native application boundary. The 0.2.1 scope is closed; no new feature
  work belongs in this release candidate. Combined human acceptance and final
  publication approval remain outstanding.
- Sam 0.1.2 alpha completes first-run stabilization; Phases 0–9 remain complete.
- 0.1.2 release gate: 288 Python tests pass with two justified skips (optional live
  Ollama and unavailable unprivileged Windows symlink creation). Frontend:
  45 tests, Biome lint/version-file format, TypeScript typecheck, and Vite
  production build pass.
- `sam-ambient` is the end-user command. The trusted `sam-supervisor` starts
  `sam-core` plus optional `sam-ui`; `Ctrl+C` or confirmed Quit Sam stops both.
- The 0.2.1 release build is expected to produce
  `dist/sam_ambient-0.2.1-py3-none-any.whl` and
  `dist/sam_ambient-0.2.1.tar.gz`. These artifacts were not built during the local
  lightweight preparation pass. The wheel must include the production UI, launchers,
  configuration example, license, and third-party notices; deterministic artifact
  validation and isolated-install smoke remain release-preparation gates.
- Original Sam material is Apache-2.0; NOTICE attributes Copyright 2026
  Alfonso Ernesto de la Fuente Ruiz, PhD. Bundled React/MIT notices are retained.

## 0.1.2 first-run behavior

- Browser handoff occurs once per supervisor lifetime after core and UI HTTP
  readiness. Browser errors print a manual URL; browser lifetime is independent.
- Quit Sam / Ctrl+Q uses a focused in-app Confirm quit / Cancel dialog, then a trusted
  shutdown channel. Acknowledged shutdown stops frontend reconnects. No LLM tool
  can quit Sam. Controls also exposes Quit; the stopped screen is unambiguous.
  Windows runs resolved version entry points in the monitored
  child rather than CRT exec-spawning an untracked descendant.
- INFO reports lifecycle, discovery, selection, voice configuration, degradation,
  revocation and shutdown. `--verbose` adds safe DEBUG diagnostics; doctor shows
  providers, audio/TTS/STT, UI readiness, active version and persisted health.
- Discovery checks known loopback endpoints and bounded `lms` status. Diagnostics
  stay passive; runtime startup may start installed Ollama/LM and load an existing
  LM chat model (20 s/backend, 4096 context, 600 s idle TTL). No eviction/download/cloud.
- Explicit choices win; otherwise last successful local provider/model → Ollama →
  LM → configured compatible. SQLite runtime metadata remembers successful local
  responses only; stale preferences fall back. Embeddings are excluded. External
  resources remain untouched. Sam-owned resources are retained by default and may
  receive bounded ownership-aware cleanup only on terminal Quit when opted in.
- Provider reason, started/reused status, STT readiness and TTS backend reach the
  UI; unavailable discovery cannot be bypassed by runtime model auto-selection.
  Core startup budget is 90 s for bounded provider/model + existing STT readiness.
- Protocol-compatible local routers (including future PAIR) fit the endpoint-based
  provider boundary. Discovery labels are not verified vendor identity; no PAIR
  integration is implemented. Restart Sam after changing provider availability.

## Runtime architecture

- `sam-core` composes the EventBus, cancellation registry, turn manager,
  provider router/Ollama, voice adapters, delivery ledger, tool policy,
  capability authority, persistence, and loopback WebSocket bridge.
- Continuous microphone acquisition uses sounddevice/PortAudio fixed 20 ms PCM,
  WebRTC VAD, and a local-only whisper.cpp final-STT adapter. STT starts on
  speech rather than accumulating indefinite leading silence.
- While the model or TTS is active, microphone frames feed the Phase 4
  interruption-candidate controller. Confirmed interruption cancels the shared
  generation token before event delivery; false candidates recover without
  replay. Generated, queued, and chunk-level spoken text remain distinct.
- Real TTS uses Windows System.Speech through fixed structured PowerShell argv,
  or a separately installed Linux `espeak-ng`/`espeak` executable. Synthesized
  PCM flows through the neutral TTS contract, bounded 32 MiB WAV capture,
  cancellation-aware sounddevice output, and normalized `tts.level` events.
- Missing microphone, STT, TTS, or provider degrades to the packaged text UI;
  none is required by deterministic CI. No raw microphone audio is persisted.

## UI and protocol

- React 19 + TypeScript + WebGL2/Canvas/CSS renders ambient state and voice/TTS
  metrics, concise transcript, interruption, tool approval, update, offline,
  reconnect, reduced-motion, and intensity state.
- `sam-ui` is a small loopback-only static HTTP component on port 8766. It
  serves compiled assets with traversal rejection and a restrictive CSP; the
  UI uses protocol-v1 WebSocket transport to core port 8765 by default.
- The integrated Tauri shell uses the same localhost protocol through the browser
  transport and adds only fixed close coordination. The older injected transport
  seam remains available; neither path is required for the browser-packaged MVP.

## Tools and security

- Immutable registry descriptors and trusted policy expose bounded
  `files.list/read/search/write`, `system.info`, clipboard read/write,
  constrained `app.open`, and structured `process.run` with `shell=False`.
- Canonical read/write roots reject absolute, drive/UNC/device, `..`, ADS,
  reserved-name, symlink, and junction/reparse escapes. Writes are bounded and
  atomic. Process output, time, cwd, argv, and environment are bounded.
- Approval is invocation-specific and separate from capability authority.
  Epoch-based global revoke invalidates leases/pending approvals, blocks new
  work, and cancels compatible active work; nested schemas/arguments are immutable
  after construction and the model cannot restore authority.
- External capability Stage 1 adds a standard-library MCP stdio client beneath
  the same executor. Trusted user/explicit config owns structured launch argv;
  workspace config and models cannot launch servers. Discovery creates immutable
  descriptors but no authority; all calls need exact approval and current epoch.
  Catalog drift, malformed/oversized data, timeout, cancellation, crash, and
  revocation fail closed. No server, remote transport, or automation is installed.

## Resilience and updates

- The LLM-independent supervisor uses structured trusted argv, readiness
  records, rolling bounded backoff, three-failures/60-second crash-loop
  detection, safe mode, capability revocation before critical restart, POSIX
  process groups, and Windows direct-child termination.
- SQLite persists committed text, component health, a bounded 200-record crash
  journal, security epoch, and explicit update transactions; raw audio and
  secrets are excluded. UI reconnect does not own authoritative state.
- Phase 8 stages contained local artifacts in version directories, verifies
  identity/provenance/SHA-256, runs bounded structured validation, atomically
  replaces `active.json`, observes Phase 7 health, commits last-known-good only
  after stability plus a second hash check, and automatically rolls back. A changed
  rollback artifact fails closed into safe mode rather than executing.
- The stable core launcher re-reads and re-hashes `active.json` on every restart
  and executes only a contained fixed `sam_core.py` entry point. An absent
  pointer uses the installed package; an invalid pointer fails closed.

## Environment and live validation

- Host: Windows development machine; primary deployment target remains Linux.
- Python 3.12+, uv 0.9.26, bundled Node 24.19.0, and pnpm 11.19.0 are available.
  No privileged/native toolchain installation was performed.
- Live checks passed for audio-device discovery (default input 1/output 4),
  Windows System.Speech synthesis and physical playback, supervised core/UI
  launch, static HTTP 200, and protocol `system.ready` over WebSocket.
- Ollama and whisper.cpp were not running on this host; `sam doctor` reported
  both unavailable while confirming UI, audio, TTS, roots, active version, and
  supervisor state without exposing secrets.
- Windows live text acceptance passes two contextual turns with the installed
  `google/gemma-4-e2b` via LM Studio (local-only). Bounded SQLite history fixes
  context; complete response intervals were 2.72 s and 0.51 s. Physical voice
  remains unaccepted after recognition, self-echo and status problems.
- Voice reliability continuation: whisper.cpp b4938 CPU server and multilingual
  `ggml-base.bin` installed in ignored `.sam/runtime` / `.sam/models`; LM Studio
  uses its installed Vulkan runtime. No additional model was downloaded this run.
  Default system input/output are used without hardcoded hardware selection.
- Final STT requests auto language/metadata. Uncertain detection prefers recent
  confirmed language or en/es with one retry; only confidence >=0.8 updates it.
  Confident other languages remain valid. Silence markers are discarded and
  10-frame pre-roll retains speech onset; INFO never logs transcript text.
- Voice monitoring waits for model-start/ledger readiness after SQLite commit;
  TTS can start during tentative candidates. UI projects actual turn state on reconnect.
- `72d083f` retains uncertain language; active turn/generation/token validation
  precedes cancellation callbacks so stale STT cleanup cannot cancel new speech.
  Controlled tests do not establish every physical cutoff cause.
- VAD hysteresis, bracket-caption filtering, playback echo rejection and reconciled clocks remain.
- Lifecycle correction detaches final STT streams before awaiting and disposes rejected/noise buffers.
  Controller confirmations cancel once; input health cannot force model/TTS OFFLINE.
  Device retries are bounded; protocol/service errors halt retry. Finals cannot reopen endpoints.
  Gate: 71 bounded Python tests + 10 focused tests after the confidence guard; Ruff/diff pass.
  Sustained-noise endpointing and physical voice remain unaccepted; no AEC or VAD tuning added.
- LM Studio now distinguishes installed/loaded models: explicit/last-good choices
  win, a sole chat model may load automatically, and multiple candidates require
  selection. Model load has a separate cancellable 180-second bound while ordinary
  provider readiness remains short. Trusted Rescan can adopt newly available local
  models; Restart affects managed Sam components only. The startup card has an
  explicit dismissible lifecycle and compact picker; reconnect errors clear on
  success and correlated roles/history remain stable. Physical voice and visual
  acceptance remain pending.

## Known limitations / post-MVP priorities

- Physical voice/Linux hardware acceptance and a seamless installer remain open.
- Native and ambient source are integrated on `dev`, but combined product/visual/native
  acceptance, native packaging verification, signing, and publication remain open.
  The rejected ambient experiment is not part of `dev`.
- Visual polish Pass 3 makes WebGL particles materially visible as bounded, seeded
  gold points and maps density to their deterministic visible share. Quality/profile
  changes rebuild the resolved 12/24/40-particle budget; `mobile_2020` remains capped
  at low. Canvas remains the intentionally particle-free fallback from the v1 spec.
- Visual polish Pass 4 replaces Controls' native and locally anchored help tooltips
  with measured, viewport-contained popovers and normalizes Controls form typography.
  Visual acceptance remains pending; no live GUI was launched for this pass.
- Visual polish Pass 5 closes renderer-contract and lifecycle defects found by a
  code/spec audit without adding effects or raising geometry, draw-call, pixel, or
  cadence budgets. No browser or native GUI was launched; final appearance remains
  a human acceptance gate.
- Voice reliability Pass 1 treats authoritative terminal turn states as the response
  monitor's teardown boundary even while its response task is still unwinding. This
  closes the playback-completion `IDLE` race without changing interruption confirmation,
  stale-event rejection, cancellation identity, endpointing, or text mode.
- Voice reliability Pass 2 bounds dense noise-held initial STT candidates: sparse
  candidates still discard at 12 seconds, while every initial candidate finalizes at
  24 seconds. Empty results discard; meaningful sustained speech commits. Physical
  acceptance remains needed for language drift, noise hallucination risk, mute
  semantics, transcript/history behavior, session-resume policy and broader voice
  reliability.
- Audio-reactive visual embodiment and diagnostics are documented future design work;
  no extractor, protocol, renderer, DSP, setting or diagnostic UI implementation is
  claimed by this checkpoint.
- Deskwright, remote MCP, self-update bootstrap, AEC, and delegated workers remain
  future work. Priorities and release boundaries are in [Roadmap](ROADMAP.md).

## Commands

- Bootstrap/test: `scripts/{bootstrap,test}.{ps1,sh}`.
- End-user MVP: `uv run sam-ambient`.
- Diagnostics: `uv run sam doctor --root .`.
- Release build: `scripts/package.ps1` or `scripts/package.sh`.
- Development UI/runtime: `scripts/ui-dev.*` and `scripts/sam-dev.*`.
