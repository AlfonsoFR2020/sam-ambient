# Sam implementation state

Updated: 2026-09-04

## MVP status

- Sam 0.1.0 is an integrated, packaged MVP; Phases 0–9 are complete.
- Quality gate: 229 Python tests pass with two justified skips (optional live
  Ollama and unavailable unprivileged Windows symlink creation). Frontend:
  36 tests, Biome, TypeScript typecheck, and Vite production build pass.
- `sam-ambient` is the end-user command. The trusted `sam-supervisor` starts
  `sam-core` plus optional `sam-ui`; `Ctrl+C` performs bounded shutdown.
- The release build produces `dist/sam_ambient-0.1.0-py3-none-any.whl` and the
  matching source archive. The wheel contains the production UI, launchers,
  configuration example, license, and third-party notices.

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
  pointer uses the installed 0.1.0 package; an invalid pointer fails closed.

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

## Known limitations / post-MVP priorities

- First: validate Linux hardware end to end, tune physical barge-in latency and
  echo handling, and evaluate platform AEC plus streaming/partial STT.
- Next: improve permissively distributable Linux voice quality and consume the
  documented TOML settings schema (0.1.0 uses explicit CLI options).
- Then: implement native Tauri packaging (Rust/Cargo; Windows additionally
  needs MSVC), a trusted supervisor self-update bootstrap, and Windows Job
  Object descendant cleanup.
- Later: owner-approved AT-SPI/native semantic desktop capabilities and external
  worker/MCP adapters. No desktop automation, autonomous coding, or agent-worker
  orchestration is in the MVP.
- Owner selection of MIT versus Apache-2.0 for Sam's project license remains
  pending; third-party license obligations are inventoried in `THIRD_PARTY.md`.

## Commands

- Bootstrap/test: `scripts/{bootstrap,test}.{ps1,sh}`.
- End-user MVP: `uv run sam-ambient`.
- Diagnostics: `uv run sam doctor --root .`.
- Release build: `scripts/package.ps1` or `scripts/package.sh`.
- Development UI/runtime: `scripts/ui-dev.*` and `scripts/sam-dev.*`.
