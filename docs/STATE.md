# Sam implementation state

Updated: 2026-09-04

## Current milestone

- Phases 0–8 are complete as green vertical slices.
- Phases 0–3 established the reproducible Python package, protocol/event and
  cancellation seams, deterministic turn manager, provider-neutral Ollama and
  OpenAI-compatible streaming, privacy routing, and bounded voice contracts.
- Local voice adapters are sounddevice/PortAudio fixed-frame I/O, WebRTC VAD,
  and local-only whisper.cpp final STT. Audio uses direct async backpressure;
  overflow, cancellation, and adapter failure remain explicit.
- Production TTS is intentionally deferred. The neutral contract and
  deterministic fake are green; the evaluated Kokoro Python route was rejected
  because its current phonemizer/eSpeak dependency chain introduces GPL terms.
- Phase 4 complete: continuous VAD/optional transcript evidence enters a
  reversible `INTERRUPTION_CANDIDATE`; sustained or credible speech confirms,
  while coughs, backchannels, short noise, and false candidates recover without
  replaying or cancelling remaining response audio.
- Interruption policy modes share one implementation: aggressive/balanced/
  conservative use 108/180/288 ms sustained-speech thresholds. Credible-text
  confidence thresholds are 0.55/0.65/0.80 (conservative requires final STT);
  false candidates recover after 900 ms and known backchannels require 3x the
  duration threshold before duration-only confirmation.
- Confirmed interruption synchronously cancels the generation token before
  publishing events, propagating to model streaming, TTS production/queue, and
  playback. Callback failures are isolated, cancellation is idempotent, stale
  generation events are ignored, and provisional STT is cancelled only when a
  candidate is rejected or abandoned.
- A bounded speech queue and bounded delivery history record generated, queued,
  playing, spoken, and cancelled chunks. Interrupted history exposes heard and
  unheard text separately; false recovery leaves the next unplayed chunk intact.
- Phase 5A complete: React/TypeScript/Vite ambient frontend, protocol-v1 decoder,
  authoritative UI reducer, stale-event rejection, animation-frame coalescing
  for lossy metrics, reconnect-safe client, and replaceable transport boundary.
- Phase 5B complete: a BSD-3-Clause `websockets` bridge binds to loopback only,
  applies origin/message/queue bounds, forwards the real EventBus protocol to
  the UI, and routes versioned commands back through an authoritative Python
  `ControlDispatcher`. Commands are deduplicated and acknowledged/rejected as
  protocol events; no conversation state is duplicated in the bridge.
- Core controls cover microphone, TTS output, stop-speaking, and emergency stop
  (model generation + queued TTS + playback). Transcript visibility, reduced
  motion, brightness, and fullscreen stay local. Interrupted TTS events expose
  chunk-level spoken/unspoken text so the transcript shows only delivered text.
- Phase 6A complete: `sam runtime --root <workspace>` composes the EventBus,
  cancellation registry, voice turn state machine, provider router/Ollama,
  static tool registry, policy/executor, capability authority, controls, and
  loopback UI bridge. The deterministic bridge/demo remains available.
- Registered tools are bounded `files.list/read/search`, fixed-schema
  `system.info`, approval-gated `clipboard.read/write`, and adapter-validated
  `app.open`. Policy auto-allows registered reads in configured roots, requires
  approval for sensitive reads/reversible writes, and denies external,
  privileged, and destructive classes; `app.open` is not executable yet. No
  general shell or file-write/delete capability exists.
- Tool requests carry session/turn/generation/cancellation/tool-call IDs through
  authorization and one terminal result. Provider fragments are bounded and
  assembled before validation; results are bounded untrusted data, and local
  tool content cannot fall through to a cloud provider.
- Filesystem authority is root-ID based with separate read/write scope. Paths
  reject absolute/drive/UNC/device, parent traversal, NUL, Windows ADS and
  reserved names, then resolve canonically and must remain under the root.
  Listing/search do not recurse through links; all output and traversal are
  bounded, and blocking file work runs off the asyncio event loop.
- Approval is distinct from capability authority. An epoch lease binds the
  exact frozen invocation; global revoke invalidates leases and pending
  approvals, blocks new starts, and cancels cancellable tools. Protocol exposes
  a one-way trusted revoke command; only a non-tool runtime API can restore
  authority, and old epochs remain invalid.
- Windows containment includes an unprivileged junction/reparse escape test and
  UNC/device/ADS/reserved-name cases. Direct symlink creation is skipped on this
  host because it lacks symlink privilege; strict canonical containment uses
  the same rejection path. Portable check-then-open retains a small local
  TOCTOU window pending target-specific hardening.
- Phase 6B adds approval-only `process.run`: an explicit executable plus bounded
  argv, authorized cwd, `shell=False`, sanitized child environment, per-stream
  output caps, timeout, cancellation, and POSIX process-group/direct Windows
  child cleanup. Results remain bounded untrusted data.
- `files.write` is exposed only when the workspace root is explicitly writable.
  It creates without clobbering by default or atomically replaces when
  `overwrite=true`; UTF-8 input is capped at 64 KiB and every write needs exact
  owner approval. Runtime `app.open` is likewise approval-only.
- Global revoke invalidates Phase 6B leases/approvals, blocks new work, and
  cancels an active process. The UI shows risk plus expandable exact command or
  target details before approval.
- Phase 7 complete: the dedicated `sam-supervisor` entry point launches only
  trusted argv, monitors `sam-core`, and remains independent of model, provider,
  UI, and cloud availability. Explicit readiness, bounded rolling restarts, and
  crash-loop safe mode are persisted in SQLite with committed text, security
  epoch, component status, and a 200-record crash journal; raw audio is absent.
- Phase 8 complete: a component-neutral trusted updater persists explicit
  `CREATED` through `COMMITTED`/`ROLLED_BACK`/`FAILED` transactions and emits
  correlated `update.state_changed` protocol events for minimal UI visibility.
- Candidates must come from a configured local incoming root, carry exact
  component/version identity and provenance, and pass bounded SHA-256 traversal
  (2,000 files/128 MiB). They copy into versioned staging before validation;
  `active.json` is switched with same-filesystem `os.replace` on Windows/POSIX.
- Trusted validation uses structured `shell=False` argv, contained cwd, bounded
  output, cancellation, and timeout. Only a re-hashed `READY` artifact can
  activate; the supervisor then performs one planned affected-component restart
  and requires a stable Phase 7 readiness/health observation window.
- Activation and rollback each revoke capability authority and advance its
  persisted epoch. A candidate becomes last-known-good only after observation;
  start/readiness/crash-loop/health errors restore and verify the prior version.
  Rollback failure enters persistent safe mode without version bouncing.
- Restart recovery leaves `READY` inactive and conservatively rolls back any
  ambiguous activation/observation. Cleanup retains active/known-good versions
  and bounds failed artifacts. Supervisor self-update is explicitly deferred to
  a separate trusted bootstrap. Quality gate: 224 Python tests pass with two
  justified skips; 36 frontend tests, typecheck, lint, and Vite build pass.

## Environment

- Host: Windows development machine; primary product target remains Linux.
- Python 3.12.11/3.14.2, uv 0.9.26, bundled Node.js 24.19.0, and pnpm 11.19.0
  are available; the project targets Python >=3.12. No privileged install ran.
- Rust is still required for the native host. A Windows Tauri build additionally
  requires MSVC C++ Build Tools; both are intentionally deferred. Because Linux
  is the primary deployment target, a Linux/WSL native build route may be
  evaluated before changing this Windows host.

## Architecture/invariants

- Product/project/package naming is `Sam` / `sam-ambient` / `sam_ambient`.
- Future process names are `sam-core`, `sam-ui`, and `sam-supervisor`.
- Python package: `src/sam_ambient` with core, adapters, and supervisor seams.
- Supervisor/update authority stays separate from conversational runtime.
- Protocol envelopes reject unsupported versions and carry relevant correlation
  and cancellation IDs.
- Durable events backpressure; stale audio-level visualization events may drop.
- Cancellation is idempotent and interruption cancellation keeps the prior
  generation identity separate from the provisional next user turn.
- Cloud fallback defaults off and will be enforced outside the model.
- Only loopback Ollama endpoints are classified local; other hosts cross the
  cloud/privacy routing boundary unless explicitly overridden.
- No third-party source, model, voice, or downloaded binary is stored in the
  repository; dependency/native license details are recorded in
  `THIRD_PARTY.md`.

## Known decisions/open items

- See `docs/DECISIONS.md`.
- Owner's MIT-vs-Apache-2.0 project license selection remains pending; this is
  not blocking internal implementation.
- whisper.cpp STT currently emits final transcripts only; its live server/model
  and physical audio devices are not required by deterministic CI and remain
  unverified on target Linux hardware.
- No production TTS backend/voice is selected, so end-to-end spoken output is
  not enabled yet. Text-only `sam chat/models/doctor` remains available without
  opening audio hardware.
- Interruption stop is 0 ms in deterministic logical-time simulations because
  token cancellation precedes event publication. The <250 ms physical target,
  acoustic echo cancellation, microphone/speaker coupling, and false-trigger
  tuning still require target-hardware measurement; no custom AEC was added.
- Delivery accounting is sentence/chunk-level. A partially played chunk at
  cancellation is conservatively treated as unspoken; word-level alignment is
  intentionally deferred.
- Tauri 2 identity/build metadata and the injected `NativeEventSource` boundary
  are scaffolded, but no native build is claimed. Remaining native work is
  Rust/Cargo setup, host implementation, Python-core lifecycle integration, and
  platform packaging. Windows additionally needs MSVC C++ Build Tools; Linux or
  WSL is the preferred route to evaluate first because Linux is the primary
  deployment target.
- The development bridge intentionally has no remote binding/authentication;
  physical voice capture/TTS is not started by this CLI. Active cancellation is
  process-local, while the supervisor persists capability revocation/epoch;
  there is still no OS-global shortcut.
- The replaceable live clipboard adapter relies on Tk and is not yet verified on
  headless target Linux.
- `process.run` is not an OS filesystem sandbox: exact argv is owner-approved,
  but programs retain normal user authority. POSIX cancellation targets the
  process group; Windows stops the direct child but not independently detached
  descendants without a Job Object. No shell-string mode, stdin, environment
  override, elevation, destructive operation, or desktop automation exists.
- The portable supervisor uses POSIX process groups on Linux. Windows can
  guarantee direct-child termination only; detached descendant cleanup would
  need a future Job Object adapter. The browser dev UI is not a supervised
  process until the packaged native host exists.
- The stable packaged component launcher that resolves `active.json`, native UI
  packaging, and trusted supervisor self-update bootstrap remain Phase 9 work.
- Exact next step: Phase 9 final integration/package MVP.

## Commands

- Bootstrap/test/dev: `scripts/{bootstrap,test,dev}.ps1` or matching `.sh`.
- Browser + real composed Python runtime: `scripts/ui-dev.ps1` or
  `scripts/ui-dev.sh`.
- Supervised core + browser UI: `scripts/sam-dev.ps1` or `scripts/sam-dev.sh`.
