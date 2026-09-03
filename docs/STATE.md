# Sam implementation state

Updated: 2026-09-03

## Current milestone

- Phases 0–7 are complete as green vertical slices.
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
- The browser demo uses production protocol envelopes and deterministically
  exercises a normal turn, true interruption, false interruption/recovery,
  disconnect/reconnect, provisional/final transcripts, and burst voice levels.
- CSS variables driven by normalized RMS, peak, speech probability, playback
  envelope, and conversational state render the ambient field. Reduced-motion,
  visual intensity, interrupted transcript, and connection/offline presentation
  are included without Three.js or a frontend state-management dependency.
- Phase 5B complete: a BSD-3-Clause `websockets` bridge binds to loopback only,
  applies origin/message/queue bounds, forwards the real EventBus protocol to
  the UI, and routes versioned commands back through an authoritative Python
  `ControlDispatcher`. Commands are deduplicated and acknowledged/rejected as
  protocol events; no conversation state is duplicated in the bridge.
- Core controls cover microphone, TTS output, stop-speaking, and emergency stop
  (model generation + queued TTS + playback). Transcript visibility, reduced
  motion, brightness, and fullscreen stay local. Interrupted TTS events expose
  chunk-level spoken/unspoken text so the transcript shows only delivered text.
- The ambient presentation has one restrained visual language, CSS-smoothed
  audio/playback response, a concealed control panel, keyboard mute/emergency/
  escape actions, streaming/provisional transcript treatment, and preserved
  offline history. Demo/browser/WebSocket/Tauri seams use the same reducer.
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
- Phase 6A quality gate: Ruff format/lint, 167 Python tests pass with the optional
  live Ollama and host-privileged symlink probes skipped; Biome format/lint,
  TypeScript typecheck, 34 Vitest tests, and Vite production build pass.
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
- Phase 6B quality gate: Ruff format/lint, 184 Python tests pass with the same two
  justified skips; Biome format/lint, TypeScript typecheck, 35 Vitest tests, and
  Vite production build pass.
- Phase 7 complete: the dedicated `sam-supervisor` entry point launches only
  trusted `shell=False` argv, monitors `sam-core`, and is independent of the
  LLM, providers, UI, and cloud. Browser UI remains independently restartable
  and reconstructs current core state through the existing reconnect protocol.
- Health is explicit (`STARTING`, `HEALTHY`, `DEGRADED`, `UNHEALTHY`, `STOPPED`,
  `CRASH_LOOP`, `SAFE_MODE`). A bounded stdout `SAM_READY` record distinguishes
  initialization from liveness; provider unavailability reports `DEGRADED`
  without causing a core restart.
- Restart defaults are configurable: 15-second startup deadline, 0.5-to-8-second
  exponential delay, and three failures in a rolling 60-second window. The
  threshold stops the loop and persists safe mode; normal shutdown is bounded
  and idempotent.
- Every critical failure persists a new capability epoch and revoked state
  before restart. Fresh core instances start with that epoch and no authority,
  so old leases/approvals cannot revive. Safe mode stays revoked until an
  explicit trusted local-console restore; the model and UI have no such command.
- SQLite retains stable session identity, bounded committed text, current
  component status, security state, and the latest 200 bounded crash records.
  Raw microphone audio is absent by design; corrupt security/state data fails
  closed. Quality gate: Ruff plus 204 Python tests pass and two justified tests
  skip; frontend remains at 35 passing tests with its prior green build.

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
- Exact next step: Phase 8 staged update/rollback. No update activation or
  self-modification was implemented in Phase 7.

## Commands

- Bootstrap/test/dev: `scripts/{bootstrap,test,dev}.ps1` or matching `.sh`.
- Browser + real composed Python runtime: `scripts/ui-dev.ps1` or
  `scripts/ui-dev.sh`.
- Supervised core + browser UI: `scripts/sam-dev.ps1` or `scripts/sam-dev.sh`.
