# Diagnostic launch and conversation evidence

Implementation checkpoint 1 — 2026-10-13. No version bump or release publication.

## Owner launch

`Start Sam.cmd` remains the ordinary one-action prepared-checkout launch. It uses
its existing environment, supervisor and sandboxed authenticated owner window;
no dependency installation, provider download or persisted default change.

Double-click `Diagnose Sam.cmd` for diagnostic mode. It delegates to the same
launcher, opens the normal Sam window and leaves the console available after exit
or failure. From a terminal: `Diagnose Sam.cmd --keep-model`, or
`uv run --no-sync sam-ambient --diagnostic --keep-provider`.

- `--diagnostic`: content-free operational console/log records and final summary.
- `--keep-model`: retain Sam-loaded models for this session; also retain their
  serving endpoint so stopping the service cannot defeat model retention.
- `--keep-provider`: retain Sam-started serving endpoints; model cleanup still
  follows ordinary preferences unless `--keep-model` is present.
- No flags: existing persisted cleanup preferences remain authoritative.

Flags never write configuration or lifecycle preferences. They apply at final
cleanup after live preference changes. Existing external services/models remain
externally owned. Retaining LM Studio serving is distinct from its desktop app;
Sam does not terminate a pre-existing desktop application.

## Log contract

The console prints the resolved `<checkout>/.sam/diagnostics/session.jsonl` path
at startup and completion. UTF-8 JSON Lines contain UTC wall time and monotonic
milliseconds, stage, bounded numeric metrics, controlled status/category fields
and hashed correlation identities. One supervisor writer rotates at 1 MiB with
three backups (about 4 MiB total); append across sessions. At most 100 records per
second per process; dropped records are counted. The session summary reports
exit code, elapsed time, failures/warnings and dropped records.

The core/UI use bounded diagnostic records on the existing supervised stdout
pipe. Readiness, owner bootstrap and shutdown protocols remain distinct; raw
stdout is never relayed to the log. There is no new network endpoint or authority.

Positive field selection excludes raw transcripts, model/token text, tool/memory
content, credentials, proofs, provider response bodies and PCM. Raw warning/error
messages become logger identity and severity rather than copied text. Diagnostic
mode deliberately does not provide unrestricted DEBUG exception dumps. This is
operational metadata, not anonymity: review times/paths before sharing logs.

Startup failure still prints a short error and session summary when the diagnostic
file was opened. If the root/environment/log directory is unavailable, the launcher
keeps the error console open; a log cannot be promised for an unwritable location.

## Evidence

41 focused launcher/rotation/redaction, supervisor, first-run and composed cleanup
checks pass using temporary data. Existing sandbox/authentication code is unchanged.
Conversation timing/ownership projection and its composed scenario follow in the
next checkpoint; this does not claim the beta's intermittent stall is solved.
