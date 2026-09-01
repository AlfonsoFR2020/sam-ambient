# AGENTS.md — Sam

## Mission

Build Sam according to `SAM_AMBIENT_CODEX_SPEC.md`.

## Operating style

* Act autonomously on routine engineering work.
* Keep the repository buildable and tests green.
* Prefer small vertical slices and targeted edits.
* Reuse permissively licensed libraries/implementations instead of recreating solved plumbing.
* Verify licenses before copying source; update `THIRD\_PARTY.md`.
* Never copy AGPL/GPL code into the project unless explicitly approved by the owner.
* Do not silently change architecture or product semantics; log justified deviations in `docs/DECISIONS.md`.

## Context/token economy

* At session start, read this file and `docs/STATE.md`.
* Read the full master spec only when the current task requires it.
* Do not repeatedly summarize the master spec.
* Use targeted file search and targeted tests.
* Keep `docs/STATE.md` concise (target <= 200 lines).
* Do not paste huge logs into durable docs.

## Safety/resilience invariants

* Supervisor/update authority remains separated from conversational runtime.
* No in-place self-overwrite when versioned staging + atomic activation is possible.
* Every activated candidate must have a rollback path.
* Cancellation IDs propagate through STT -> turn -> LLM -> TTS/tool calls.
* Cloud fallback must never silently export local context when disabled.
* Tool policy is enforced in code outside the LLM.

## Owner interaction

The owner is an executive customer. Do routine setup, Git, build, lint, tests and repository maintenance yourself. Ask only for irreversible/security/business/license/spend decisions or genuine blockers.

## Quality gate

Before marking a milestone complete:

1. format/lint,
2. targeted tests,
3. relevant integration/simulation tests,
4. update `docs/STATE.md`,
5. update `THIRD\_PARTY.md` if dependencies changed,
6. commit a coherent green slice.
