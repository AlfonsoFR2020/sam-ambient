# Sam implementation state

Updated: 2026-09-16

## MVP status

- Visual polish pass 1 on `feature/visual-polish` substantially restrains the
  analytic halo and makes the existing deterministic peels wider and farther
  from the body without increasing geometry, draw calls, or mobile frame budgets.
- Visual polish pass 2 restores direct rotation across WebGL and Canvas, makes
  flick inertia frame-independent and motion-scaled, and aligns the pointer hit
  region with the bounded maximum orb extent while preserving mobile budgets.

- Release metadata and end-user documentation are prepared consistently for
  `0.2.0` under the existing alpha convention. The eventual GitHub release remains
  a prerelease. The deterministic source gate and Python wheel/sdist install smoke
  pass. Native companion/installer packaging and final artifact smoke were not run;
  Windows signing/AV review, final human voice/visual/native acceptance, merge, tag,
  publication, and release approval remain outstanding.
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
- Cross-platform GitHub CI repeats Python/Ruff and frontend/Biome/type/build gates
  on Windows/Linux, then builds wheel/sdist and smoke-installs the wheel. Version
  consistency is checked locally; publishing remains explicitly manual. Current
  local gate: 348 Python passed / 2 skipped and 45 frontend passed; Ruff, Biome,
  typecheck, Vite build, distributions, metadata and installed CLI smoke pass.
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
- Accepted 0.2.0 source on `dev` includes an isolated
  Chromium-family app window with browser fallback, per-root single-instance lock,
  graceful owned-window shutdown, truthful startup/status controls, and bounded
  transcript polish are implemented. [Visual Engine v1](VISUAL_ENGINE_V1.md) Stages
  A-D add typed inputs, bounded motion, a WebGL2 amber orb, drifting peels, analytic
  lights/particles and mobile fallbacks. Desktop geometry/material baselines were
  strengthened after initial review. Acceptance-pending direct mouse/touch rotation,
  damped inertia, persisted typed visual preferences, mobile-profile emulation and a
  bounded measured Auto-quality governor are implemented; final acceptance remains pending.
- Voice endpointing now layers sustained-resume hysteresis and bounded speech-density
  evidence over WebRTC VAD. Sparse clicks no longer repeatedly reset endpoint silence,
  and a low-density candidate is discarded after 12 seconds instead of accumulating
  pathological 30-60 second clips. The normal 0.65-1.1 second silence endpoint,
  200 ms pre-roll, long sustained speech, and playback-aware barge-in remain intact.
  Physical acoustic/AEC acceptance remains pending.
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
  includes the native application boundary. No further 0.2.0 feature work should
  land except fixes required by release validation or later acceptance.
  Combined human acceptance and native package/release gates remain outstanding;
  this is not a release-readiness claim.
- Sam 0.1.2 alpha completes first-run stabilization; Phases 0–9 remain complete.
- 0.1.2 release gate: 288 Python tests pass with two justified skips (optional live
  Ollama and unavailable unprivileged Windows symlink creation). Frontend:
  45 tests, Biome lint/version-file format, TypeScript typecheck, and Vite
  production build pass.
- `sam-ambient` is the end-user command. The trusted `sam-supervisor` starts
  `sam-core` plus optional `sam-ui`; `Ctrl+C` or confirmed Quit Sam stops both.
- The prepared 0.2.0 release build is expected to produce
  `dist/sam_ambient-0.2.0-py3-none-any.whl` and
  `dist/sam_ambient-0.2.0.tar.gz`. These artifacts have not been built in this
  preparation task. The wheel includes the production UI, launchers, configuration
  example, license, and third-party notices.
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
- Deskwright, remote MCP, self-update bootstrap, AEC, and delegated workers remain
  future work. Priorities and release boundaries are in [Roadmap](ROADMAP.md).

## Commands

- Bootstrap/test: `scripts/{bootstrap,test}.{ps1,sh}`.
- End-user MVP: `uv run sam-ambient`.
- Diagnostics: `uv run sam doctor --root .`.
- Release build: `scripts/package.ps1` or `scripts/package.sh`.
- Development UI/runtime: `scripts/ui-dev.*` and `scripts/sam-dev.*`.
