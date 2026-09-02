# Sam implementation state

Updated: 2026-09-02

## Current milestone

- Phases 0–4 are complete and committed as green vertical slices.
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

## Environment

- Host: Windows development machine; primary product target remains Linux.
- Git: 2.55.0.windows.5.
- Python: 3.12.11 and 3.14.2 available; project targets Python >=3.12.
- uv: 0.9.26.
- Node/Rust/Tauri toolchains are not installed and are not needed before UI
  Phase 5.

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
- Tauri/Node/Rust installation is deferred until the UI phase to avoid unused
  toolchain cost.
- Exact next step: Phase 5 ambient UI consuming authoritative protocol/state and
  real audio metrics. Do not begin it as part of the Phase 4 milestone.

## Commands

- Bootstrap: `scripts/bootstrap.ps1` or `scripts/bootstrap.sh`.
- Quality gate: `scripts/test.ps1` or `scripts/test.sh`.
- Development harness: `scripts/dev.ps1` or `scripts/dev.sh`.
