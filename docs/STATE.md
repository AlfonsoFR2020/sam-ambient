# Sam implementation state

Updated: 2026-09-02

## Current milestone

- Phases 0–5 and Phase 6A are complete as green vertical slices.
- Phase 0 established the reproducible Python package, scripts, protocol seam,
  supervisor/update separation, and rollback-oriented filesystem skeleton.
- Repository initialized on `main`; reproducible Python package skeleton and
  one-command bootstrap/test/dev scripts are present.
- Phase 1 complete: protocol v1 models, bounded event bus, idempotent
  cancellation registry, and deterministic multi-signal turn state machine.
- Voice simulations cover normal endpointing, mid-sentence pauses, sustained
  interruption, credible-content interruption, cough/backchannel/echo recovery,
  false endpoint resume, STT revision, minimum speech, and audio loss.
- Phase 2 complete: provider-neutral contracts/registry/router, native Ollama
  discovery and NDJSON chat streaming, generic OpenAI-compatible SSE streaming,
  privacy-gated fallback, and `sam chat/models/doctor` text harness.
- HTTP transport uses HTTPX `AsyncClient.stream()`; token cancellation is tested
  to close the active response stream before surfacing `OperationCancelled`.
- Phase 3 complete: validated bounded PCM frames; provider-neutral `AudioInput`,
  `AudioOutput`, VAD, streaming STT, and streaming TTS contracts; deterministic
  sentence chunking; cancellable audio/STT/TTS flows; and one-turn voice event
  orchestration ready for Phase 4.
- Concrete Phase 3 adapters are sounddevice/PortAudio fixed-frame I/O, WebRTC
  VAD, and a local-only-by-default whisper.cpp server adapter. Audio flows by
  direct async iteration (strict backpressure); native overflow and adapter
  failures are surfaced. Existing bounded event-bus queues preserve durable
  events and may drop only stale voice-level visualization events.
- Production TTS is intentionally deferred. The neutral contract and
  deterministic fake are green; the evaluated Kokoro Python route was rejected
  because its current phonemizer/eSpeak dependency chain introduces GPL terms.
- Quality gate: Ruff lint/format plus 71 tests collected (70 pass, optional live
  Ollama probe skipped unless explicitly enabled) on Python 3.12.11.
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
- Quality gate: Ruff lint/format plus 104 tests collected (103 pass, optional
  live Ollama probe skipped unless explicitly enabled) on Python 3.12.11.
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
- Phase 5A quality gate: Biome format/lint, TypeScript typecheck, 13 Vitest tests,
  and Vite production browser build pass. The existing Python deterministic
  suite remains the separate core gate.
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
- Phase 5B quality gate: Ruff format/lint; 108 Python tests pass and one optional
  live Ollama test skips. Biome format/lint, TypeScript typecheck, 21 Vitest
  tests, Vite production build, browser demo, and browser-to-Python WebSocket
  command/acknowledgement smoke test pass.
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

## Environment

- Host: Windows development machine; primary product target remains Linux.
- Git: 2.55.0.windows.5.
- Python: 3.12.11 and 3.14.2 available; project targets Python >=3.12.
- uv: 0.9.26.
- Bundled Node.js 24.19.0 and pnpm 11.19.0 drive the frontend. No privileged
  system toolchain installation was performed.
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
- The upstream sounddevice Windows wheel contains inactive ASIO-enabled DLLs;
  Sam does not load them, and a distributable bundle must exclude or separately
  approve them.
- Tauri 2 identity/build metadata and the injected `NativeEventSource` boundary
  are scaffolded, but no native build is claimed. Remaining native work is
  Rust/Cargo setup, host implementation, Python-core lifecycle integration, and
  platform packaging. Windows additionally needs MSVC C++ Build Tools; Linux or
  WSL is the preferred route to evaluate first because Linux is the primary
  deployment target.
- The development bridge intentionally has no remote binding/authentication.
  The real runtime supports text/provider/tool flow; physical voice capture/TTS
  is not started by this CLI. Capability revocation is process-local and has no
  OS-global shortcut or persistence yet; Phase 6B must preserve it when adding
  higher-risk grants.
- The replaceable live clipboard adapter relies on Tk and is not yet verified on
  headless target Linux; `app.open` remains policy-disabled in Phase 6A.
- Exact next step: Phase 6B dedicated privileged/destructive shell and desktop
  capability threat/policy review following the documented AT-SPI-first Linux
  direction. No such capability is currently implemented.

## Commands

- Bootstrap: `scripts/bootstrap.ps1` or `scripts/bootstrap.sh`.
- Quality gate: `scripts/test.ps1` or `scripts/test.sh`.
- Development harness: `scripts/dev.ps1` or `scripts/dev.sh`.
- Browser + real composed Python runtime: `scripts/ui-dev.ps1` or
  `scripts/ui-dev.sh`.
