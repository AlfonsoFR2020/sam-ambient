# Post-0.2 engineering backlog

**Current policy: Basics Before Expansion (2026-10-01).** See the authoritative
[core acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md) and [Roadmap](ROADMAP.md).
v0.2.5 is published as a source/Python experimental pre-release. Public native
signing/clean-host acceptance remains separate despite a passing hosted build. Unreproduced intermittent false speech
turns and long stalls remain disclosed, not declared fixed by the beta repairs.

Diagnostic launch/conversation observability was implemented October 13 and shipped in v0.2.5:
shared launch, session retention, bounded operational logging and timing/owner
summaries. See [diagnostic evidence](DIAGNOSTIC_LAUNCH.md). Use that evidence to
reproduce reliability failures; do not open another speculative audio rewrite.
No personal recording or new beta was needed for that increment. October 14's
[composable launcher](DIAGNOSTIC_LAUNCH.md) is complete: independent console,
verbosity/log-path flags, diagnostic preset and session retention. 152 focused
checks preserve redaction, quoting, settings and ownership; this adds no capability.
Hard STT language, installed multilingual persona selection, effective speech
status, confirmed provider cleanup and explicit runtime/supervisor SQLite closure
are implemented. Consolidation I's supervised Gemma lifecycle passed; II exposed
transient cold inventory/readiness with clean degraded startup/Quit. Actual base-model
en/es generated recognition, paced recovery, persona switching and meters→WebGL now
have evidence. [Cold recovery](COLD_PROVIDER_RECOVERY.md) now has bounded classified
retry and a real automatic Gemma/text/Rescan/owned-unload pass; wider compatibility
remains unverified. AEC research is parked pending timing/physical-reference evidence; physical voice
and human visual/persona acceptance remain open. Workspace mutation,
richer browser automation, arbitrary shell, memory sophistication, profiles and
multi-person implementation are parked. Retain their direction without treating
existing infrastructure as permission to make them the next frontier.

The published 0.2.3 human beta is preserved in
[Post-0.2.3 beta diagnosis](POST_0.2.3_BETA_PLAN.md). Conversation candidate
promotion, generation retirement, typed recovery and history integrity now have
post-release repairs. Acoustic source discrimination and prompt barge-in remain
open. The dependency-aware priority order is in [Roadmap](ROADMAP.md); older
items below are directions, not evidence that the physical beta passed them.

[October 9 complete finding inventory](BETA_TRIAGE_2026-10-09.md) preserves later
major STT/visual work, persona identity, load ETA, startup alignment/motion pauses,
Console/Memory presentation, shader ranges/tooltips/wireframe requests and reload
history observation. No feature or art expansion is authorized by those findings.
LM Studio desktop persistence is distinct from serving cleanup; CLI inventory's
implicit wake/initial status ordering needs bounded ownership evidence.

Memory Foundation I is implemented: app-data SQLite, owner CRUD, review-first
proposals, scoped lexical recall/context, deletion/correction and restart/adversarial
evidence. Do not reopen those as unimplemented storage tasks. Semantic/paraphrase
retrieval, cloud export, multi-user consent and human memory usefulness/privacy
acceptance remain future work; see [memory evidence](MEMORY_FOUNDATION_I.md).
The bounded existing LM Studio/Gemma structured workspace read passed; external
public-site/TLS and native packaging compatibility remain unverified.

This is the detailed backlog beyond the frozen 0.2.3 scope. It records
observed limitations and planned directions without implying acceptance, priority,
or a commitment to a specific implementation. Milestone-level sequencing remains
in [Roadmap](ROADMAP.md). The published 0.2.3 candidate gates are a historical
record in [0.2.3 release readiness](RELEASE_READINESS_0.2.3.md); the items below
are not automatically blockers for a future release.

## Release-known issues

- Recommend text interaction for the most reliable current alpha experience; voice
  input remains experimental.
- Complete the dedicated Linux compatibility review around 0.3.0. Hosted Ubuntu CI
  source/package gates passed for v0.2.4, while Linux desktop sandbox, voice and
  hardware acceptance remain deferred; do not confuse package tests with that acceptance.
- Stabilize language detection where drift can select the wrong TTS language.
- Continue physical voice/noise/language reliability work without treating acoustic
  tuning as generation-lifecycle repair.
- Replace or supplement robotic Windows System.Speech while retaining a safe fallback.
- Ship no public Windows installer until native packaging, signing, AV/reputation,
  artifact smoke, and acceptance gates pass.

## UI and Visual Engine

- **HQ4 first assignment (owner priority, 2026-10-15):** reference-led connected
  peeling film, resolving the current band impression before another optical/gain
  sweep. [Continuity, ranked dependencies and bounded assignment](HANDOFF_CODEX_VISUAL_CORE.md#first-visual-core-assignment)
  preserve current implementation/evidence and missing concept-board status.
  No theme engine or implementation is authorized by this planning entry.
- **Living Orb direction:** retain the shared, seam-safe body/peel field and the
  `mobile_2020` and bounded nine/ten-draw budgets. Six attached moving curled sheets now
  replace WebGL domes; compare their continuity and depth against the
  older loxodromic fallback on representative hardware. Broad palette,
  translucency and depth still need human visual acceptance; see
  [Visual direction](VISUAL_DIRECTION.md).
- **Human acceptance of circulation and drag ownership:** the first human beta
  perceived the older nearly rigid field as static. Asymmetric shear and the
  post-release bounded medium-pigment fold change coarse color relationships in
  fixed-orientation WebGL; pointer ownership eases field flow down and back without
  a phase jump. Verify that the full composition now
  reads as coherent circulation and that drag feels like grasping one object. A
  separate persisted Surface Flow control is completed in [Core Experience V](CORE_EXPERIENCE_V.md),
  with independent field clocks, legacy migration and renderer/persistence checks.
  Default-rate human acceptance remains open. Do not claim Auto without a real signal.
- **Palette and relief:** [composed local banks](LIVING_PALETTE_AND_READINESS.md)
  now evolve broader blue/violet/green/red/gold families over existing clocks;
  0–300 s palette-only/transport-only comparisons preserve large regions, quiet film
  and short-frame continuity. Appeal remains unaccepted; do not equate numeric
  color change with attractiveness or add rainbow noise. Keep
  the current bounded ovoid/mountain character pending art direction: it comes from
  Y scaling 1.06, field/breath displacement and older audio response terms clamped
  to ±0.04. Tune prominence later rather than flattening it by assumption.
- **Visual Identity I:** [form/material comparisons](VISUAL_IDENTITY_I.md) now cover
  smooth lower-lift domes, irregular-boundary/body-consistent normals, broader pigment
  and rose/violet allocation. Technical fixes are implemented; October 9 artistic
  rejection is not overwritten. Layer coherence/translucency, palette appeal and
  natural speech embodiment still need the actual reference and later human judgment.
- **Visual Identity II / outer membrane:** six broad attached sheets, actual curl
  flex, receptive/working/speech response and High opaque-core depth are implemented;
  [Identity III comparisons/cost](VISUAL_IDENTITY_III.md) add calmer raised pigment,
  front/underside optics, High local contact and shared spatial light/near-particle
  response. Colored folds are clearer; connected skin/thickness/translucency still
  need reference-led judgment. Soft intersections remain approximate. The one real
  startup passed, but live inference/High/fullscreen sampling was not obtained.
  Do not repeat dome tuning or infer human acceptance from numeric pixel changes.
- **Lighting:** the primary light now crosses the limb and additional tier lights
  are weak fill. Fixed-body WebGL pixels show spatial variation with light phase,
  but human visibility, ambient depth and restrained glints remain unverified.
  Measure each tier on representative hardware before further art-direction tuning.
- **Particles:** WebGL now has a seeded, biased 1.2–2.45 radius field with varied
  paths, size, opacity and shared regional palette tint; rear particles outside the silhouette
  survive depth testing. Counts are now 12/24/64 and the density slider reveals
  a share of that cap. Check whether the sparse tail actually gives useful
  atmosphere on desktop and mobile; viewport clipping still limits the farthest
  paths. Explore roughly 5–10× the high-end population only after point-fill,
  overdraw and model-coexistence measurements preserve lightweight tiers.
  Later actual waveform/semantic evidence may add modest XYZ perturbations.
- **Further audio-reactive embodiment:** measured `tts.level` now gives a fast,
  bounded speech expansion/light pulse and `voice.level` a quieter receptive
  response through the existing Audio reactivity control. An audio feature
  extractor, prosodic mapping beyond the existing envelope, physical timing and
  human perceptual acceptance remain. Preserve v1 geometry, draw, cadence,
  privacy and fallback constraints; do not call synthetic modulation live acceptance.
- Compare a workload-aware quality governor, high-end/demo richness and Orb Lab
  contact sheets using deterministic state/audio fixtures. Protect first-token,
  inference, audio and UI latency; do not treat visual FPS alone as acceptance.
- Complete human visual acceptance of the revised speech response, membrane/form
  and Living Surface across WebGL2, Canvas, reduced motion, supported window sizes
  and `mobile_2020`. The beta found particles broadly acceptable, but the Orb as a
  whole was below its intended visual character. Isolated WebGL checks and the
  desktop cost sample are not that acceptance.
- Controls inventory, particle-amount labeling and tab wiring have been audited.
  Remaining layout work concerns mobile access, the ambient rectangle and
  transcript/Controls coexistence; avoid a keyboard-only route or giant scroll panel.
- Grow the existing diagnostics monitor into a fuller Sam status/console surface
  when core telemetry is available through a bounded protocol. Wide layout now
  separates it from conversation, and current health leads collapsible detail.
  It shows the
  reported model/provider/STT/TTS/connection/microphone state and existing audio
  envelopes, but has no measured server health, loaded-model memory/latency,
  frequency features or physical audio-device diagnostics. Do not fabricate values,
  create a second telemetry pipeline or turn this into a terminal emulator.
- Revisit remaining soft-edge alpha-order artifacts in overlapping sheets if
  representative views reveal them. Six reused ranges now use bounded CPU center
  ordering; exact per-triangle transparency is still absent, with High opaque-core
  depth priming only for sufficiently opaque interiors.
- Consider bounded centre XYZ wandering and later waveform-driven peel/particle
  perturbations only after the relevant input evidence is available. The current
  centre remains fixed and diagnostics label it as such.
- Long-history buffering/performance remains unmeasured; independent scrolling
  and near-bottom auto-follow are implemented.
- Clarify microphone mute/toggle semantics, which appeared confusing or reversed.
- Physically validate the full voice/audio path and useful live voice reactivity
  after material surface, membrane and interaction improvements. Do not consume
  another human beta session for a narrow frontend patch alone.
- Validate the correlated conversation lifecycle with real capture/STT, provider
  streams and TTS playback, including mute during transcription, speech overlap,
  disconnect while output is active, and provider disappearance mid-response.
  Synthetic state tests do not establish acoustic ownership or actual timing.
- Full audio pass: extend the established frame-ownership, queue-bound and
  backpressure guarantees to device loss/recovery, shutdown/reconnect, real
  STT/TTS timing and audio-derived visual activity using controlled physical
  integration later.
  Source inspection and fake slow-consumer tests established the current bounded
  pull path, but real PortAudio overflow/underflow frequency, System TTS whole-WAV
  memory cost, and whether metered output tracks emitted sound need measurement.

## Behavior and settings

- Add an owner setting for new-session versus resume-previous-conversation behavior.
- **Provider/model presentation implemented:** core-confirmed preparation status,
  scoped observed waiting, separate loading/unloading/ready visual cues and stale
  reconnect protection have [focused/headless evidence](LIVING_PALETTE_AND_READINESS.md).
  This is presentation, not new routing/polling or a claim of broader provider
  compatibility. Real provider/performance behavior remains independently validated.
- Validate provider/model Rescan, service disappearance, and model loading against
  real LM Studio/Ollama and reconnect timing after the deterministic state and
  isolated-browser recovery checks. The historical black-screen report was not
  reproduced by the controlled transport scenarios.
- Add an owner setting for transcript retention during interruption.
- Physically accept LM Studio automatic model load and ownership-aware eject behavior.
- Define model/context/VRAM policy.
- Add named, trusted connection profiles to extend the existing atomic inference
  target switch from provider/model to profile/provider/model. Keep credentials outside
  route identity and diagnostics. Add natural-language classification and spoken
  acknowledgement at the existing typed final-STT control seam; extend it to
  active-response barge-in only after defining interruption policy. Validate
  real provider switch and reconnect timing. Current ordinary switches block
  while a response is active and have no deferred-switch queue.
- Later expose supported per-model system prompt, temperature, context, and generation
  settings through typed provider capabilities rather than universal assumptions.

## Product directions

- Add richer local TTS options.
- Add a health, latency, and model-status panel.
- Add a structured observability/debug overlay.
- Add a managed terminal/console surface.
- Add a file and multimedia workspace.
- Add a structured persistent context and knowledge database.
- Add trusted natural-language settings control.
- Add installer-assisted provider and model setup using the existing readiness layer.
- Publish a detailed manual/wiki after workflows stabilize.
- Continue approval-gated MCP and deskwright integration, generative UI, PAIR-compatible
  local routing, and trusted self-update work within the existing policy boundaries.
