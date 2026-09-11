# Sam implementation state

Updated: 2026-09-11

## MVP status

- Native-shell checkpoint: a thin Tauri 2 crate now owns one desktop window and
  one structured `sam-supervisor --no-ui` child while React continues over the
  existing loopback WebSocket. The desktop single-instance plugin focuses the
  existing main window before setup, preventing a competing runtime. Native
  close requests the existing in-app Quit confirmation; only acknowledged
  trusted shutdown permits the window to close. Tauri exposes no filesystem,
  shell, model, voice, tool, supervisor, or policy command.
- Native validation on this Windows host: MSVC 19.51, linker 14.51, Windows SDK
  10.0.26100, Rust 1.98.1 MSVC target, and WebView2 are present. Cargo check and
  a Tauri debug build pass with output isolated outside Documents. Automated
  smoke proved one native window, an established Tauri-to-core WebSocket,
  duplicate-launch focus, intercepted window close, trusted Quit/revocation,
  degraded-core operation, and clean restart. Frontend 46 tests/Biome/TypeScript/
  Vite and three focused bridge tests pass.
- Native package checkpoint: a reproducible cx_Freeze 8.6.4 directory build
  produces `sam-supervisor.exe`, `sam-core.exe`, and `sam-ui.exe` with CPython,
  runtime dependencies, static resources, VC runtime files, and license notices.
  Its no-audio/no-provider lifecycle smoke reaches the real WebSocket, performs
  trusted Quit, and exits cleanly without a checkout, uv, or user Python. Inactive
  ASIO wheel variants are excluded. Tauri resolves only the fixed companion from
  packaged resources. A 15.3 MB per-user NSIS installer builds reproducibly;
  isolated install, native protocol/Quit, and uninstall passed before Norton
  flagged a subsequent unsigned `sam-supervisor.exe` as `IDP.Generic`. The exact
  owned process was stopped and no exclusion/bypass used. Native distribution is
  blocked on antivirus review and trusted signing; browser mode remains supported.
  Flagged SHA-256: `2DF74F29E7EBA9A4E8EC855149BF3FDC196727BFE378FC839438893FE00B6C6D`;
  Norton removed the supervisor/core launchers after the owned process stopped.
- Productization backbone: schema-v1 TOML now configures actual supervisor/runtime
  behavior with defaults -> user -> workspace -> environment -> explicit CLI
  precedence. Unsupported keys/types fail early. Secrets and SQLite last-good
  state stay separate. The standard-library implementation adds no dependency.
- Doctor now categorizes runtime, uv, browser, writable root, local providers and
  chat models, Whisper assets/service, system TTS voices, audio directions, UI,
  and supervisor/security state. It is read-only and supplies shared structured
  readiness data for a future installer. Current host: LM Studio installed/stopped;
  Whisper assets available; Windows TTS, audio, UI, Python and root ready.
- Cross-platform GitHub CI repeats Python/Ruff and frontend/Biome/type/build gates
  on Windows/Linux, then builds wheel/sdist and smoke-installs the wheel. Version
  consistency is checked locally; publishing remains explicitly manual. Final
  local gate: 331 Python passed / 2 skipped and 45 frontend passed; Ruff, Biome,
  typecheck, Vite build, distributions, metadata and installed CLI smoke pass.
- Unreleased TTS hardening: response-language evidence now reaches synthesis;
  Windows enumerates installed voices and selects locale/language before fallback.
  Existing cancellable PCM contract retained; cloud speech remains disabled.
  Silent live Windows WAV
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
- The Tauri 2 shell reuses this same UI/protocol. Hosted Windows CI builds and
  executes the controlled companion smoke, then assembles an unsigned development
  NSIS package. Local frozen-executable smoke is paused on the Norton-protected
  host. Linux native compilation and
  companion/package validation remain unverified.

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
- Python 3.12+, uv 0.9.26, bundled Node 24.19.0, pnpm 11.19.0, user-local
  Rust 1.98.1, and the owner-installed Microsoft C++ Build Tools/SDK are available.
  The compiler toolchain is development-only and is not a Sam runtime requirement.
- Live checks passed for audio discovery, Windows System.Speech playback,
  supervised core/UI, static HTTP, and protocol readiness. Doctor safely reports
  unavailable Ollama/Whisper alongside usable UI/audio/TTS/root state.
- Windows live text acceptance passed two UI turns with the owner's installed
  `google/gemma-4-e2b` via LM Studio at `http://127.0.0.1:1234/v1`, including
  bounded committed context and no cloud fallback. Complete response intervals
  were 2.72 s and 0.51 s (not first-token measurements).
- Local whisper.cpp b4938 and multilingual `ggml-base.bin` are ignored external
  assets. System-default input/output remain selected. Uncertain STT detection
  prefers recent confirmed language with a bounded retry; confident other
  languages remain accepted. Sound markers/high no-speech results are discarded.
- Turn/generation/token validation prevents stale STT cancellation; deterministic
  voice races around model readiness and tentative barge-in recovery are fixed.
  UI reports Listening/Transcribing/Thinking/Speaking from actual state.
- Physical recognition, segmentation, echo/barge-in, and latency acceptance remain
  unverified; controlled tests do not establish every physical cutoff cause.

## Known limitations / post-MVP priorities

- First: validate Linux hardware end to end, tune physical barge-in latency and
  echo handling, and evaluate platform AEC plus streaming/partial STT.
- Next: resolve native antivirus compatibility through sample review and trusted
  Authenticode signing (or evaluate official embedded Python if still needed),
  then add consent-driven prerequisite/model acquisition by reusing the
  configuration/readiness source of truth; no installer-specific probe logic.
- Then: validate Linux native/companion packages, improve Linux voice quality,
  add a trusted supervisor self-update bootstrap, and Windows Job Object
  descendant cleanup.
- Later: owner-approved semantic desktop capabilities and external worker/MCP
  adapters; none are implemented in the MVP.
