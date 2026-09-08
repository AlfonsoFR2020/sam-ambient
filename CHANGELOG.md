# Changelog

## Unreleased

- Infer speech language from assistant responses, retaining context for ambiguous
  short replies. Select installed Windows voices by locale/language with explicit
  fallback diagnostics; pass requested languages to external eSpeak.
- Preserve the cancellable PCM adapter boundary and expose optional voice and
  synthesis-capability metadata. No cloud speech service is integrated.

## 0.1.2 (alpha) — 2026-09-08

- Bootstrap installed local model services with bounded readiness/model loading;
  remember successful local provider/model choices, reject embedding models, and
  reuse running services without restart. No model downloads or cloud fallback.
- Show actionable provider and voice readiness; add keyboard-focused Quit
  confirmation in both header/controls and an unmistakable stopped page.
- Add getting-started and everyday user guides.
- Check Whisper HTTP readiness before microphone startup; on Windows, start the
  existing local development installation when needed and stop only Sam-owned
  STT processes. Missing assets report expected paths while text remains usable.
- Preserve bounded committed conversation context across requests and runtime
  recovery; keep reused local context behind the cloud-privacy gate.
- Improve final-STT language fallback and silence handling, retain bounded audio
  pre-roll, and show transcription/muted status. Fix voice-start and tentative
  interruption/TTS state races; physical speaker-mode acceptance remains pending.
- Keep recent confirmed STT language during low-confidence switches, including
  between preferred languages; forced fallbacks do not count as confirmation.
- Reject mismatched turn/generation cancellation before stopping playback, and
  prevent stale STT cleanup from cancelling a promoted assistant response.

- Note: physical microphone, speaker-echo, and natural barge-in acceptance remain
  pending; these voice changes have deterministic coverage, not full hardware validation.

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
