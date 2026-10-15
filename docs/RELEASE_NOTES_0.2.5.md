# Sam 0.2.5 — living embodiment and diagnostic launch

**Experimental source/Python alpha.** This incremental release builds on v0.2.4;
it is not stable-production certification, a one-click Windows application release
or human aesthetic acceptance. Python 3.12+ and documented local prerequisites apply.

## Improvements since v0.2.4

- **Organic visual foundations:** smoother body relief/normals and six attached,
  animated curling membrane sheets. Raised-film optics, contact depth, front/underside
  satin lighting and richer High fidelity preserve one artistic identity across tiers.
- **Coordinated embodiment:** distinct Idle, Listening, Processing and Speaking
  behavior; synthetic activity drives bounded body, film, lighting and nearby particle
  responses. Audio Reactivity zero and Reduced Motion remain respected.
- **Living color:** broader regional red/gold/green/blue/violet harmonies evolve on
  independent clocks, with large transported pigment territories and coordinated
  particle temperature. Lifted film remains quieter to preserve layer readability.
- **Visible readiness:** core-confirmed discovery, model loading/replacement,
  unloading, ready and recoverable-failure presentation. Elapsed waiting is observed,
  never a fabricated percentage. Reconnect preserves last-known facts until fresh state.
- **Shared Windows launcher:** Start Sam.cmd keeps ordinary one-action defaults;
  Diagnose Sam.cmd is a preset. Compose --verbose, --keep-console, --log-file PATH,
  --keep-model and --keep-provider. Overrides are session-only; model retention
  implies endpoint retention, while endpoint retention leaves model cleanup independent.
- **Conversation observability:** bounded rotating operational JSONL, correlated
  command/turn/STT/provider/delivery timing and terminal summaries. No routine transcript,
  owner proof, credential or raw audio logging. This improves diagnosis, not proof that
  all historical intermittent failures are fixed.
- **Security maintenance:** source-map-js 1.2.2, esbuild 0.28.2 via Vite 7.3.6,
  pytest 9.0.3 and setuptools 83.0.0 via cx_Freeze 8.7.0. No unrelated modernization.
- **Release-gate repair:** the UI HTTP server now retires idle/partial clients before
  waiting for listener shutdown. Python 3.12 cancellation previously waited on those
  clients before outer cleanup could run, sometimes requiring a forced UI-child stop.
  Four isolated server/parent-pipe cases protect orderly shutdown without a browser.

## Maturity and known limitations

Visual behavior has deterministic and headless evidence, but the owner has not
accepted the revised appearance, membrane character, palette or speech embodiment.
Isolated GPU results are not full-app frame-rate promises. The original visual
reference board remains unavailable; further art direction is a separate effort.

Voice remains experimental: false/noise/self-playback turns, poor multilingual
recognition and prolonged response latency were reported and are not generally
resolved. Typed recovery and explicit Stop speaking remain important. Acoustic
source separation is parked; no safe prompt full-duplex ownership/AEC is claimed.
Installed voice-persona pleasantness and real-room behavior require later acceptance.

Existing bounded Agency/Memory foundations are carried forward, not expanded:
model/web/stored content is data, never execution authority. Owner proof, typed
policy/approval and bounded execution remain required. Personal SQLite data is
local plaintext under OS privacy, not a credential vault.

## Artifact and security boundary

Publish only `sam_ambient-0.2.5-py3-none-any.whl`, `sam_ambient-0.2.5.tar.gz` and
`SHA256SUMS-0.2.5.txt`. The wheel contains current static UI, notices and required
resources. No models, private data, diagnostic logs, native companion ZIP or
unsigned executable/installer is uploaded. Assets must match the exact validated tag.

GLib 0.18.5's VariantStrIter advisory remains on the Linux/BSD GTK-native graph.
It is absent from Windows native and Python runtime dependencies; fixing it needs
compatible upstream GTK/Tauri work. This is not universal security certification.

**Native Windows installer remains unavailable and unvalidated.** Updated cx_Freeze
alone does not validate freezing, installation, upgrades or signing. Hosted native
job outcomes are reported separately from source/package quality; no unsigned native
artifact is public. Current source/Python quality must pass on Windows and Ubuntu,
plus hosted Package smoke, before tagging and publication.

[Readiness/evidence](RELEASE_READINESS_0.2.5.md) ·
[Launcher commands](DIAGNOSTIC_LAUNCH.md) ·
[Security triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md#focused-maintenance--2026-10-15).
