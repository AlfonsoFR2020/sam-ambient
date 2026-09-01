# Sam implementation state

Updated: 2026-09-01

## Current milestone

- Phase 0 bootstrap complete; its lint/format/test gate is green.
- Repository initialized on `main`; reproducible Python package skeleton and
  one-command bootstrap/test/dev scripts are present.
- First green test: 2 deterministic smoke tests on Python 3.12.11.
- Phase 1 core protocol/state/cancellation/event work is next.

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
- Cancellation correlations propagate through protocol fields.
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
