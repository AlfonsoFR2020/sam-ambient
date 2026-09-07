# Changelog

## Unreleased

- Preserve bounded committed conversation context across requests and runtime
  recovery; keep reused local context behind the cloud-privacy gate.
- Improve final-STT language fallback and silence handling, retain bounded audio
  pre-roll, and show transcription/muted status. Fix voice-start and tentative
  interruption/TTS state races; physical speaker-mode acceptance remains pending.
- Keep recent confirmed STT language during low-confidence switches, including
  between preferred languages; forced fallbacks do not count as confirmation.

## 0.1.1 — 2026-09-06

- Open the browser once per supervisor launch, after core and HTTP readiness;
  browser failure leaves the application and manual URL available.
- Add confirmed Quit Sam / Ctrl+Q through direct UI control, with graceful
  managed shutdown and an explicit stopped view.
- Preserve Windows core process ownership through the version-aware launcher,
  avoiding a detached descendant that could hang shutdown.
- Discover existing Ollama, LM Studio/llmster, and configured local compatible
  servers; select deterministically and explain missing-model conditions.
- Add INFO lifecycle logging, safe DEBUG diagnostics, and a richer doctor report.
- Prepare concise public architecture, contribution, security, and first-run
  documentation. Preserve the existing ambient visual design.
- License original Sam material under Apache-2.0, with owner attribution in NOTICE
  and unchanged third-party licensing obligations.

## 0.1.0 — 2026-09-04

- Integrated the ambient browser UI, local protocol bridge, provider-neutral
  runtime, microphone/VAD/STT contracts, real system TTS, and barge-in logic.
- Added bounded filesystem/process capabilities, owner approvals, and global
  capability revocation outside model authority.
- Added trusted process supervision, durable committed state, safe mode, and
  staged updates with health-validated activation and automatic rollback.
- Packaged the Python runtime and compiled frontend in a single wheel.
