# Sam 0.2.3 release readiness and scope freeze

Status at `d8cff412` (2026-09-27): **implementation candidate, not RC1**. This is a
source and documentation audit, not integrated acceptance. The 0.2.3 changes are
unreleased; package and runtime version fields still consistently report 0.2.2.

## Frozen release scope

0.2.3 contains the frontend startup, Controls, renderer recovery and diagnostics
work; correlated provider discovery and connection state; turn-local inference
routing and typed local controls for exact provider/model switching and Stop
speaking; correlated text/voice turns; bounded audio ownership and distinct
capture, STT, synthesis and playback health; and the Living Surface circulation,
shared membrane, independent lighting/palette clocks, wider particle field and
bounded AmbientReactivity. These are implemented source paths with deterministic
coverage. Real provider, physical voice, native package and human visual behavior
have not been accepted for this release.

After this freeze, new features belong after 0.2.3 unless they fix a reproduced
release blocker, a regression, or a required validation failure. In particular,
natural-language control recognition, named server/API profiles, arbitrary
credential configuration, broader spoken settings and major new visual direction
are outside 0.2.3. The typed voice-control hook is not a phrase recognizer;
source-specific audio levels are not proof of useful physical voice reactivity.

## Open-work classification

| Class | Current disposition |
| --- | --- |
| Release blocker | No reproducible source defect is confirmed by this audit. Any crash, lost committed answer, silent inference fallback, obsolete-turn revival, or unusable claimed text/voice path found by the required smoke becomes a blocker and must be fixed before release. |
| Release validation required | Current-commit regression/static gates, Python/TypeScript protocol compatibility, real Windows provider discovery/selection/text generation and failure recovery, one physical capture→STT→answer→TTS→playback path with interruption, reconnect timing, combined native/visual acceptance, and guarded package/security gates. The unverified historical Rescan black screen warrants specific real-provider attention. |
| Post-0.2.3 | Named connection profiles and natural-language/spoken control, wider audio/device and model choices, stronger physical reactivity, surface/palette/membrane/lighting/particle art refinement, richer diagnostics, session-resume policy, and the dedicated Linux 0.3.0 review. Preserve these in [Backlog](BACKLOG.md). |
| Speculative / obsolete | A new 0.2.3 peel implementation and an entirely absent audio-reactivity foundation are superseded claims: the membrane patches and bounded envelope consumer exist. Physical quality remains unaccepted. The old assertion that 0.2.2 is still being prepared is stale. |

## Integrated validation sequence

| Path | Before RC1 source candidate | Between RC1 and final approval |
| --- | --- | --- |
| LM Studio/Ollama | Exercise one available real local provider for discovery, exact model selection, text generation, Rescan failure/recovery and provider switching if a second provider is available. If Ollama is unavailable, record its path as unvalidated rather than claiming it passed. | Complete any provider path advertised as validated; check service disappearance and model loss with real timing. |
| Voice/audio | One controlled real microphone/STT/TTS/playback turn, typed text after an audio failure, and a basic interruption smoke. | Broader device-loss/recovery, sustained/noisy speech, acoustic echo, language changes and timing acceptance. Fix release-blocking failures; keep deeper acoustic tuning out of scope. |
| Reconnect | One controlled core disconnect/reconnect during idle and one pending or active operation, observing stale-event rejection and UI recovery. | Longer-running and device/service-specific reconnect cases. |
| Native/visual | Verify a Windows native development shell opens and the integrated UI remains usable; review the current Orb/Controls on representative hardware. | Guarded native companion/installer packaging, artifact smoke, signing, AV/reputation and final human visual/voice/native acceptance before any public installer. |

Only a provider actually available for the candidate machine can be exercised at
RC1. Unsupported/unavailable provider paths must be described accurately in the
release notes. No test in this audit launched those systems.

## RC1 source-candidate gates

1. Freeze an identified clean `dev` commit; align Python, frontend, Tauri, Cargo and
   lockfile versions to 0.2.3 in one deliberate preparation change, then pass
   `scripts/check_release.py`. Do not infer 0.2.3 from changelog headings.
2. Run the release regression and static gates on that exact commit: Python and
   frontend tests, Ruff/format, Biome, TypeScript, Rust/Cargo checks and the
   relevant browser renderer/recovery regressions. Maintain protocol v1
   compatibility across frontend and core. Record any known Ubuntu exception
   under the existing Windows-first policy rather than hiding it.
3. Complete the bounded integrated RC1 smokes above. No known reproducible
   black screen/crash, lost committed text, silent fallback or stuck voice/control
   state may remain in a claimed path.
4. Reconcile the public scope, release notes, package contents and deferred
   validation with the candidate. RC1 is not publication approval: guarded
   artifacts, signing/security review and final acceptance remain separate gates
   in the [release checklist](RELEASE_CHECKLIST.md).

## Automated protection already present

- Provider/discovery, command correlation and reconnect: core control tests,
  frontend provider/reducer/transport tests and the isolated Rescan browser spec.
- Turn identity, interruption and audio failure: generation/voice pipeline and
  delivery integration tests, local-control tests, frontend lifecycle tests and
  fake PortAudio/STT/TTS tests. Real acoustic timing is not covered.
- Visual, fallback and interaction: visual-engine/material/quality/input tests
  plus browser slider, drag, Rescan and WebGL composition specs. They do not prove
  representative GPU cost or human visual acceptance.

The meaningful missing coverage is integrated reality at the listed boundaries,
not another broad synthetic test framework. Recent per-slice green results do
not replace a candidate-commit regression run.
