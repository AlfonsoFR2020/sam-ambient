# Decision log

Only implementation choices or justified deviations not already fixed by the
master specification are recorded here.

## D-001 — Python package layout

- **Status:** accepted, 2026-09-01
- **Decision:** Put the Python modular monolith under `src/zev_ambient` rather
  than creating importable top-level packages named `core` and `supervisor`.
- **Reason:** Namespaced packages avoid collisions and make one distributable
  core while preserving explicit core, adapter, and supervisor boundaries.
- **Consequence:** Files differ slightly from the approximate Section 14 tree;
  process authority boundaries remain unchanged.

## D-002 — Project license remains reserved during bootstrap

- **Status:** temporary, 2026-09-01
- **Decision:** Use a temporary all-rights-reserved notice until the owner makes
  the specification's MIT-vs-Apache-2.0 choice.
- **Reason:** The master specification expressly reserves the final project
  license to the owner, and implementation does not require that choice yet.
- **Consequence:** Do not distribute original project source until replaced by
  the selected license. Permissive third-party tools can still be used.

## D-003 — No historical Zev source reuse

- **Status:** accepted, 2026-09-01
- **Decision:** Independently implement the provider boundary instead of
  copying the historical Zev fork.
- **Reason:** The inspected MIT code is a small OpenAI-client wrapper tied to
  legacy configuration; reuse would add dependencies without useful plumbing.
- **Consequence:** Preserve behavior such as local detection and configurable
  Ollama URLs, but not historical internals.

