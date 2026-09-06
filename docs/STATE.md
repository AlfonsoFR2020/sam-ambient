# Sam implementation state

Updated: 2026-09-06

## MVP status

- Sam 0.1.1 completes first-run and repository preparation; Phases 0–9 remain complete.
- Quality gate: 246 Python tests pass with two justified skips (optional live
  Ollama and unavailable unprivileged Windows symlink creation). Frontend:
  38 tests, Biome, TypeScript typecheck, and Vite production build pass.
- `sam-ambient` is the end-user command. The trusted `sam-supervisor` starts
  `sam-core` plus optional `sam-ui`; `Ctrl+C` or confirmed Quit Sam stops both.
- The release build produces `dist/sam_ambient-0.1.1-py3-none-any.whl` and the
  matching source archive. The wheel contains the production UI, launchers,
  configuration example, license, and third-party notices.
- Original Sam material is Apache-2.0; NOTICE attributes Copyright 2026
  Alfonso Ernesto de la Fuente Ruiz, PhD. Bundled React/MIT notices are retained.

## 0.1.1 first-run behavior

- Browser handoff occurs once per supervisor lifetime after core and UI HTTP
  readiness. Browser errors print a manual URL; browser lifetime is independent.
- Quit Sam / Ctrl+Q uses inline Quit now / Cancel, then an instance-bound trusted
  shutdown channel. Acknowledged shutdown stops frontend reconnects. No LLM tool
  can quit Sam. Windows runs resolved version entry points in the monitored
  child rather than CRT exec-spawning an untracked descendant.
- INFO reports lifecycle, discovery, selection, voice configuration, degradation,
  revocation and shutdown. `--verbose` adds safe DEBUG diagnostics; doctor shows
  providers, audio/TTS/STT, UI readiness, active version and persisted health.
- Read-only discovery checks known loopback Ollama/LM Studio endpoints, bounded
  `lms` daemon/server status, and configured compatible APIs. Explicit provider,
  endpoint/model choices win; otherwise Ollama → LM Studio → configured compatible,
  with sorted model IDs. No download, service start, scan or automatic cloud use.
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
- Subsequent bounded LM Studio acceptance check on `dev`: existing daemon running,
  HTTP server stopped. Full inventory contains only Nomic Embed Text v1.5 Q4_K_M
  (embedding model); `lms ls --llm --json` and `lms ps --json` are empty. No chat
  provider, model or serving endpoint was selected; UI → model → UI acceptance remains
  blocked, not passed. No downloads, server start, Sam launch or code fix attempted.

- Windows `dev` live text acceptance now passes two UI turns using the owner's
  installed `google/gemma-4-e2b` Q4_K_M through LM Studio at
  `http://127.0.0.1:1234/v1` (4096-token context; no cloud fallback).
  Fixed missing model conversation history using bounded committed SQLite
  messages (12 records / 6000 characters), excluding other sessions/current turn.
  Follow-up correctly recalled the user's fact; complete text-response intervals
  were 2.72 s and 0.51 s, not first-token measurements. Four focused tests pass.
  Physical voice acceptance is not yet passed: owner reports unreliable Spanish
  recognition, premature TTS cutoff, and unclear processing-state indication.
- Conversation-context fix committed separately on `dev`: `4d754a0`.
- Voice reliability continuation: whisper.cpp b4938 CPU server and multilingual
  `ggml-base.bin` installed in ignored `.sam/runtime` / `.sam/models`; LM Studio
  uses its installed Vulkan runtime. No additional model was downloaded this run.
  Default system input/output are used without hardcoded hardware selection.
- Final STT now explicitly requests auto language plus verbose detection metadata.
  Adapter-configurable preferences default to en/es; uncertain detection prefers
  recent confirmed language, with one bounded retry when needed. Confident other
  languages remain accepted; older servers without metadata retain auto behavior.
  High no-speech results/known sound markers are discarded; 10-frame pre-roll
  retains speech onset. INFO logs language probability/duration, not transcript.
- Fixed two deterministic voice races: wait for model-start/ledger readiness after
  SQLite commit before monitoring; allow TTS startup during a tentative candidate
  and recover into SPEAKING. UI projects actual voice state on reconnect and shows
  Transcribing during final STT, plus Listening/Thinking/Speaking/Microphone muted.
- Focused gate: 41 Python tests and 25 frontend tests pass; Ruff/format, targeted
  Biome, TypeScript and static Vite build pass. No full-suite rerun in this slice.
- Live diagnostics showed 5–29 s captured segments, low-confidence language guesses
  (e.g. Korean 0.12), music/background transcripts, and VAD-only cancellation about
  188 ms after candidate onset, even BEFORE TTS. This does not prove speaker echo
  is the sole cause. Physical three-turn/intentional-barge-in acceptance was halted
  at owner request; no successful voice/latency claim. Sam capture/test STT stopped.
  Remaining: quiet controlled input/segmentation validation and distinguishing
  real interruption from background/playback speech. No AEC or broad policy rewrite.

## Known limitations / post-MVP priorities

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
