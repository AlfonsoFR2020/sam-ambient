# Sam implementation state

Updated: 2026-09-01

## Current milestone

- Phase 0 bootstrap complete; its lint/format/test gate is green.
- Repository initialized on `main`; reproducible Python package skeleton and
  one-command bootstrap/test/dev scripts are present.
- Phase 1 complete: protocol v1 models, bounded event bus, idempotent
  cancellation registry, and deterministic multi-signal turn state machine.
- Quality gate: Ruff lint/format plus 30 tests green on Python 3.12.11.
- Voice simulations cover normal endpointing, mid-sentence pauses, sustained
  interruption, credible-content interruption, cough/backchannel/echo recovery,
  false endpoint resume, STT revision, minimum speech, and audio loss.
- Phase 2 Ollama/provider-neutral conversational text loop is next.

## Environment

- Host: Windows development machine; primary product target remains Linux.
- Git: 2.55.0.windows.5.
- Python: 3.12.11 and 3.14.2 available; project targets Python >=3.12.
- uv: 0.9.26.
- Node/Rust/Tauri toolchains are not installed and are not needed before UI
  Phase 5.

## Architecture/invariants

- Python package: `src/zev_ambient` with core, adapters, and supervisor seams.
- Supervisor/update authority stays separate from conversational runtime.
- Protocol envelopes reject unsupported versions and carry relevant correlation
  and cancellation IDs.
- Durable events backpressure; stale audio-level visualization events may drop.
- Cancellation is idempotent and interruption cancellation keeps the prior
  generation identity separate from the provisional next user turn.
- Cloud fallback defaults off and will be enforced outside the model.
- No third-party source has been copied or vendored.

## Known decisions/open items

- See `docs/DECISIONS.md`.
- Owner's MIT-vs-Apache-2.0 project license selection remains pending; this is
  not blocking internal implementation.
- Tauri/Node/Rust installation is deferred until the UI phase to avoid unused
  toolchain cost.

## Commands

- Bootstrap: `scripts/bootstrap.ps1` or `scripts/bootstrap.sh`.
- Quality gate: `scripts/test.ps1` or `scripts/test.sh`.
- Development harness: `scripts/dev.ps1` or `scripts/dev.sh`.
