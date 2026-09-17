# Changelog

## 0.2.1 (alpha) - Release candidate

### Highlights

- Refine Visual Engine v1 without increasing its fixed draw, geometry, DPR, cadence,
  reduced-motion, or `mobile_2020` budgets: restrain the halo; widen and lift peels;
  restore direct drag/flick and rotation-speed behavior; make particles, density and
  quality/profile changes visible; contain Controls help; and close renderer,
  fallback, adaptation and lifecycle contract gaps found by audit.
- Fix the response voice monitor teardown race that could observe authoritative
  `IDLE` after playback completion, while retaining interruption confirmation,
  cancellation identity and stale-event rejection.
- Bound every initial STT candidate to one finalization at 24 seconds so dense
  VAD-positive noise cannot hold a 30-32 second candidate open; retain the earlier
  sparse-noise guard and normal speech endpointing.
- Keep Sam importable and text-capable without PortAudio, degrade unavailable audio
  at adapter composition, and make shared test helpers portable on hosted Windows.
- Document the complete LM Studio first-run and recovery path for downloading or
  selecting a model, loading it, starting the localhost server and verifying both.
- Record the future audio-reactive embodiment/diagnostics direction and its required
  staged design checkpoints without claiming an implementation.

**Alpha limitations:** Windows is the validated 0.2.1 alpha path. Human visual,
native and physical acoustic acceptance remain deferred, as do language drift/noise
hallucination risk, mute semantics, transcript/history behavior and session-resume
policy. Hosted Ubuntu still has an unresolved Python-test failure after collection;
full Linux compatibility is explicitly deferred to the dedicated 0.3.0 Linux review.
Text interaction remains the recommended path. No signed Windows installer is
published by this preparation commit.

## 0.2.0 (alpha) — Published

### Highlights

- Integrate the thin Tauri native application/window boundary while retaining the
  browser development shell, React UI, localhost WebSocket, and Python companion.
- Introduce Visual Engine v1: the reactive WebGL2 ambient field, direct interaction,
  responsive fallbacks, reduced motion, quality profiles, and bounded adaptation.
- Harden microphone endpointing, transcript correlation, interruption/barge-in,
  cancellation, speech-language voice selection, and playback recovery. Physical
  echo cancellation and final hardware acceptance remain incomplete.
- Discover installed versus loaded local models correctly; support deterministic
  explicit, last-good, and sole-model selection, bounded LM Studio loading, startup
  choice, and Rescan without downloading models.
- Add persistent Sam input/output gains, visual controls, and ownership-aware Quit
  preferences that default to retaining local providers and models.
- Clarify startup, reconnect, degradation, transcript, Controls, UI reload, managed
  Restart, native close, and confirmed Quit behavior across normal and compact views.
- Add validated layered configuration, structured readiness/doctor output, Windows
  and Linux CI, release metadata checks, and guarded native companion/installer seams.
- Harden trusted capability policy, immutable schemas/arguments, update rollback
  verification, and approval-gated local MCP stdio integration.

**Alpha limitations:** text interaction is the recommended, most reliable 0.2.0
experience. Voice input remains experimental: language/TTS drift, physical barge-in,
and robotic Windows System.Speech remain known limitations. The source/native
architecture is alpha quality, and no signed Windows installer is distributed. Native installer
signing/AV review, final artifact smoke, combined native/visual acceptance, and
Linux hardware tuning remain outstanding. No cloud speech, bundled model, remote
MCP transport, AEC, or automatic model download is included. See the detailed
[post-0.2 backlog](docs/BACKLOG.md).

### Detailed development changes

- Integrate a thin Tauri 2 native shell with the current ambient React UI and
  Python runtime. Tauri owns the window, single-instance behavior, native identity,
  one trusted supervisor child, and close coordination only; runtime and policy
  responsibilities remain in the existing Python companion.
- Preserve browser/app-window development fallback and route native window close
  through Sam's existing confirmation, capability revocation, and graceful shutdown.
- Add a fixed packaged-companion resource layout, sibling executable contract,
  native icons, source-level Rust/Windows CI checks, and guarded NSIS packaging
  scripts. Native packaging and publication remain human-controlled release work.
- Accept the Tauri production origin at the loopback WebSocket boundary and add
  deterministic tests for native close coordination and frozen sibling commands.
- Track provider-service and model-load provenance independently for the current
  Sam runtime instance. Optional graceful-Quit policies can unload a verified
  Sam-loaded LM Studio model and stop a service Sam started; Restart, Emergency
  Stop, rescans, external resources, unsupported adapters, and future launches
  gain no cleanup authority. Cleanup is structured, bounded, and best effort.
- Add persisted `0-200%` Sam application input/output gains. Input gain is applied
  before VAD/STT/barge-in; output gain is applied before emitted-level metering and
  physical playback. These controls do not change operating-system mixer levels.
- Require sustained VAD evidence to reopen an endpoint candidate, reject long open
  STT candidates when both recent and overall speech density remain low, and finalize
  every initial candidate once at a 24-second lifecycle boundary. Discard empty noise
  results while committing meaningful sustained speech. Keep 200 ms pre-roll, normal
  silence thresholds, barge-in ownership, and language authority unchanged.
- Dispose finalized/rejected speech candidates before accepting more audio, apply
  confirmed interruption cancellation through the controller, and preserve an
  in-flight response's TTS eligibility during input failure. Discard short rejected
  noise buffers; classify capture, service, and protocol faults separately.
- Consolidate acceptance-pending and longer-term work in a maintained roadmap and
  add a human-controlled alpha release checklist.
- Add a provider-neutral MCP stdio seam for trusted configured local capability
  servers. Discovered tools remain exact-approval external side effects under
  Sam's lease, revocation, cancellation, result-bound, and audit rules; malformed
  or changing catalogs and protocol failures fail closed.
- Add a validated schema-versioned TOML configuration layer with defaults, user
  and workspace files, environment overrides, and CLI precedence. Keep secrets
  and learned runtime state separate.
- Categorize `sam doctor` readiness, including platform/tooling, provider and
  conversational-model state, Whisper assets/service, system voices, audio,
  UI, workspace, and supervisor state without changing the machine.
- Add deterministic Windows/Linux GitHub CI for Python/frontend quality plus
  source/wheel build, version consistency, and installed-CLI smoke validation.
- Deep-freeze registered tool schemas and invocation arguments so nested mutable
  model metadata cannot alter trusted validation or capability identity.
- Re-hash candidates after health observation and verify the persisted rollback
  hash; mutation rolls back or fails closed rather than becoming known-good.
- Prefer an isolated Edge/Chrome/Chromium application window after UI readiness;
  retain `--ui-mode browser` and automatic normal-browser fallback. Prevent
  duplicate supervisors per Sam root and request graceful shutdown when the owned
  app window closes, without terminating unrelated browser processes.
- Show truthful core startup/reconnect, provider, model, speech, privacy and
  degradation status in quiet controls. Clarify control effects and improve
  bounded transcript role styling and scrolling. Group owner controls, add
  focus-accessible concise help, keep startup/controls usable in narrow windows,
  and distinguish UI reload from managed restart and application quit.
- Add the acceptance-pending Visual Engine v1 foundation: typed provider-neutral
  envelope inputs; continuous state/audio choreography; a custom WebGL2 amber
  spheroid with drifting fragmented peels, analytic lights and sparse particles;
  explicit mobile budgets; and Canvas/CSS fallbacks. Refine desktop tessellation,
  peel proportions/orientations, warm lighting, breathing and restrained particles
  after initial review. Human acceptance remains pending.
- Add direct mouse/touch orb rotation with damped inertia, persisted visual quality
  and device-profile controls, deterministic mobile-budget emulation, bounded
  measured Auto-quality adaptation, and clearer silent state choreography.
- Harden human-acceptance startup and voice reliability: load only an explicit,
  remembered, or sole installed chat model; keep LM Studio's installed and loaded
  inventories distinct; and expose cancellable long-load, Rescan, model choice,
  Restart, stable reconnect, correlated transcript, and actionable startup state.
  Also debounce VAD, suppress playback self-echo, recover capture failures, and
  retain safe hotkeys and stage timing. Physical acceptance remains pending.

- Infer speech language from assistant responses, retaining context for ambiguous
  short replies. Select installed Windows voices by locale/language with explicit
  fallback diagnostics; pass requested languages to external eSpeak.
- Preserve the cancellable PCM adapter boundary and expose optional voice and
  synthesis-capability metadata. No cloud speech service is integrated.
- Wait for synthesized PCM before starting playback; recover from output underruns
  instead of truncating speech. Preserve cancellation during final audio draining
  and enforce synthesis timeouts while sending text to the backend.

## 0.1.2 (alpha) — 2026-09-08

- Bootstrap installed local model services with bounded readiness/model loading;
  remember successful local provider/model choices, reject embedding models, and
  reuse running services without restart. No model downloads or cloud fallback.
- Show actionable provider and voice readiness; add keyboard-focused Quit
  confirmation in both header/controls and an unmistakable stopped page.
- Add getting-started and everyday user guides.
- Check Whisper HTTP readiness before microphone startup; on Windows, start the
  existing local development installation when needed and stop only Sam-owned
  STT processes. Missing assets report expected paths while text remains usable.
- Preserve bounded committed conversation context across requests and runtime
  recovery; keep reused local context behind the cloud-privacy gate.
- Improve final-STT language fallback and silence handling, retain bounded audio
  pre-roll, and show transcription/muted status. Fix voice-start and tentative
  interruption/TTS state races; physical speaker-mode acceptance remains pending.
- Keep recent confirmed STT language during low-confidence switches, including
  between preferred languages; forced fallbacks do not count as confirmation.
- Reject mismatched turn/generation cancellation before stopping playback, and
  prevent stale STT cleanup from cancelling a promoted assistant response.

- Note: physical microphone, speaker-echo, and natural barge-in acceptance remain
  pending; these voice changes have deterministic coverage, not full hardware validation.

## 0.1.1 — 2026-09-06

- Open the browser once per supervisor launch, after core and HTTP readiness;
  browser failure leaves the application and manual URL available.
- Add confirmed Quit Sam / Ctrl+Q through direct UI control, with graceful
  managed shutdown and an explicit stopped view.
- Preserve Windows core process ownership through the version-aware launcher,
  avoiding a detached descendant that could hang shutdown.
- Discover existing Ollama, LM Studio/llmster, and configured local compatible
  servers; select deterministically and explain missing-model conditions.
- Add INFO lifecycle logging, safe DEBUG diagnostics, and a richer doctor report.
- Prepare concise public architecture, contribution, security, and first-run
  documentation. Preserve the existing ambient visual design.
- License original Sam material under Apache-2.0, with owner attribution in NOTICE
  and unchanged third-party licensing obligations.

## 0.1.0 — 2026-09-04

- Integrated the ambient browser UI, local protocol bridge, provider-neutral
  runtime, microphone/VAD/STT contracts, real system TTS, and barge-in logic.
- Added bounded filesystem/process capabilities, owner approvals, and global
  capability revocation outside model authority.
- Added trusted process supervision, durable committed state, safe mode, and
  staged updates with health-validated activation and automatic rollback.
- Packaged the Python runtime and compiled frontend in a single wheel.
