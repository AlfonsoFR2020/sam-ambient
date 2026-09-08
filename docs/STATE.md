# Sam implementation state

Updated: 2026-09-08

## MVP status

- Unreleased TTS hardening: response-language evidence now reaches synthesis;
  Windows enumerates installed voices and selects locale/language before fallback.
  Existing cancellable PCM contract retained, optional discovery metadata added;
  cloud speech remains disabled. Silent live Windows WAV
  synthesis passed for installed es-ES Helena and en-US David voices. No microphone
  or speaker playback used; physical recognition/barge-in remain unvalidated.
- Hardening gate: 306 Python tests pass, two existing skips; Ruff/format pass.
  No frontend changes. Composed multi-turn acceptance covers language/voice switch,
  PCM subprocess synthesis, underrun recovery, stale/duplicate cancellation and
  shutdown. Output waits for PCM; underruns no longer abort speech; last-frame
  cancellation cannot claim completion. TTS stdin is now timeout-bound.
- Read-only audit: system-default audio devices and Whisper assets available;
  Whisper/LM Studio stopped, Ollama absent. Bootstrap/preferences/filtering/owned
  cleanup pass controlled tests; no service manipulation or new live model claim.

- Sam 0.1.2 alpha completes first-run stabilization; Phases 0–9 remain complete.
- 0.1.2 release gate: 288 Python tests pass with two justified skips (optional live
  Ollama and unavailable unprivileged Windows symlink creation). Frontend:
  45 tests, Biome lint/version-file format, TypeScript typecheck, and Vite
  production build pass.
- `sam-ambient` is the end-user command. The trusted `sam-supervisor` starts
  `sam-core` plus optional `sam-ui`; `Ctrl+C` or confirmed Quit Sam stops both.
- The release build produces `dist/sam_ambient-0.1.2-py3-none-any.whl` and
  `dist/sam_ambient-0.1.2.tar.gz`. The wheel contains the production UI, launchers,
  configuration example, license, and third-party notices.
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
  responses only; stale preferences fall back. Embeddings are excluded. Owned
  Ollama children stop on exit; shared LM daemon/server and existing services remain.
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

- React 19 + TypeScript + CSS renders the ambient state, normalized voice/TTS
  metrics, concise transcript, interruption, tool approval, update, offline,
  reconnect, reduced-motion, and intensity state.
- `sam-ui` is a small loopback-only static HTTP component on port 8766. It
  serves compiled assets with traversal rejection and a restrictive CSP; the
  UI uses protocol-v1 WebSocket transport to core port 8765 by default.
- Native Tauri remains behind the existing injected transport boundary and is
  not required for the browser-packaged MVP.

## Tools and security

- Immutable registry descriptors and trusted policy expose bounded
  `files.list/read/search/write`, `system.info`, clipboard read/write,
  constrained `app.open`, and structured `process.run` with `shell=False`.
- Canonical read/write roots reject absolute, drive/UNC/device, `..`, ADS,
  reserved-name, symlink, and junction/reparse escapes. Writes are bounded and
  atomic. Process output, time, cwd, argv, and environment are bounded.
- Approval is invocation-specific and separate from capability authority.
  Epoch-based global revoke invalidates leases/pending approvals, blocks new
  work, and cancels compatible active work; the model cannot restore authority.

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
  after stability, and automatically rolls back or enters safe mode on double
  failure.
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
- 0.1.1 live checks: UI HTTP ready, browser close/reopen, inline Cancel/Confirm,
  stopped page, graceful core/UI exit, zero crashes/restarts, INFO/DEBUG and doctor.
  Doctor found 27 audio devices and Windows TTS synthesis ready. Ollama absent;
  `lms` installed, daemon/server stopped, model inventory unknown (not awakened).
- Windows `dev` live text acceptance now passes two UI turns using the owner's
  installed `google/gemma-4-e2b` Q4_K_M through LM Studio at
  `http://127.0.0.1:1234/v1` (4096-token context; no cloud fallback).
  Fixed missing model conversation history using bounded committed SQLite
  messages (12 records / 6000 characters), excluding other sessions/current turn.
  Follow-up correctly recalled the user's fact; complete text-response intervals
  were 2.72 s and 0.51 s, not first-token measurements. Four focused tests pass.
  Physical voice acceptance is not yet passed: owner reports unreliable Spanish
  recognition, premature TTS cutoff, and unclear processing-state indication.
- Voice reliability continuation: whisper.cpp b4938 CPU server and multilingual
  `ggml-base.bin` installed in ignored `.sam/runtime` / `.sam/models`; LM Studio
  uses its installed Vulkan runtime. No additional model was downloaded this run.
  Default system input/output are used without hardcoded hardware selection.
- Final STT now explicitly requests auto language plus verbose detection metadata.
  Adapter-configurable preferences default to en/es; uncertain detection prefers
  recent confirmed language, with one bounded retry when needed. Only detection
  at the configured confidence threshold (default 0.8) updates that preference;
  uncertain en/es switches and forced fallbacks do not overwrite it. Confident other
  languages remain accepted; older servers without metadata retain auto behavior.
  High no-speech results/known sound markers are discarded; 10-frame pre-roll
  retains speech onset. INFO logs language probability/duration, not transcript.
- Fixed two deterministic voice races: wait for model-start/ledger readiness after
  SQLite commit before monitoring; allow TTS startup during a tentative candidate
  and recover into SPEAKING. UI projects actual voice state on reconnect and shows
  Transcribing during final STT, plus Listening/Thinking/Speaking/Microphone muted.
- Prior physical diagnostics: 5–29 s segments, low-confidence language guesses,
  background transcripts and VAD-only cancellation before TTS. Owner halted voice
  acceptance; recognition, segmentation, echo/barge-in and latency remain unverified.
- `72d083f` retains uncertain language; active turn/generation/token validation
  precedes cancellation callbacks so stale STT cleanup cannot cancel new speech.
  Controlled tests do not establish every physical cutoff cause.

## Known limitations / post-MVP priorities

- Prior startup/UI gate: 75 Python / 45 frontend tests, lint/typecheck/build and
  automated Quit/stopped-screen browser checks passed. Real stopped-provider loading
  and physical conversation remain separate validation; no seamless installer.
- STT readiness fix: assets were present, but localhost:8080 had no server;
  CLI previously created only an HTTP client. Windows now probes `/health`, starts
  existing `.sam/runtime/whisper-b4938/Release/whisper-server.exe` with
  `.sam/models/ggml-base.bin` under the workspace root, and waits up to 8 s.
  External/custom servers remain externally owned; missing/invalid assets name
  expected paths and retain text mode. Owned service stops on normal closure.
  25 focused tests and Ruff pass; real model-load/health/cleanup passed without
  audio capture. Recognition quality and physical barge-in remain unvalidated.

- First: validate Linux hardware end to end, tune physical barge-in latency and
  echo handling, and evaluate platform AEC plus streaming/partial STT.
- Next: improve permissively distributable Linux voice quality and consume the
  documented TOML settings schema (0.1.1 uses explicit CLI options).
- Then: implement native Tauri packaging (Rust/Cargo; Windows additionally
  needs MSVC), a trusted supervisor self-update bootstrap, and Windows Job
  Object descendant cleanup.
- Later: owner-approved AT-SPI/native semantic desktop capabilities and external
  worker/MCP adapters. No desktop automation, autonomous coding, or agent-worker
  orchestration is in the MVP.

## Commands

- Bootstrap/test: `scripts/{bootstrap,test}.{ps1,sh}`.
- End-user MVP: `uv run sam-ambient`.
- Diagnostics: `uv run sam doctor --root .`.
- Release build: `scripts/package.ps1` or `scripts/package.sh`.
- Development UI/runtime: `scripts/ui-dev.*` and `scripts/sam-dev.*`.
