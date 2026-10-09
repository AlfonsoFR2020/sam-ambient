# Post-0.2 engineering backlog

**Current policy: Basics Before Expansion (2026-10-01).** See the authoritative
[core acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md) and [Roadmap](ROADMAP.md).
The [October 9 release hold](RELEASE_READINESS_0.2.4.md) records repaired VAD-only
generation cancellation, empty final commitment, spoken Markdown and source launch/
Controls defects. Residual plausible spurious turns and long stalls are unresolved;
candidate preparation is held. October 8 closed real owner-window model operations
and bounded inference cadence. Native package validation/public signing stay separate.
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

- Recommend text interaction for the most reliable 0.2.3 alpha experience; voice
  input remains experimental.
- Complete the dedicated Linux compatibility review around 0.3.0. Hosted Ubuntu CI
  currently reaches Python tests but retains an unresolved Linux-only failure; it is
  explicit deferred work, not a silently weakened or artificially green 0.2.x gate.
- Stabilize language detection where drift can select the wrong TTS language.
- Continue physical voice/noise/language reliability work without treating acoustic
  tuning as generation-lifecycle repair.
- Replace or supplement robotic Windows System.Speech while retaining a safe fallback.
- Ship no public Windows installer until native packaging, signing, AV/reputation,
  artifact smoke, and acceptance gates pass.

## UI and Visual Engine

- **Living Orb direction:** retain the shared, seam-safe body/peel field and the
  `mobile_2020` and four-draw budgets. Irregular lifted membrane fragments now
  replace the WebGL ribbons; compare their continuity and depth against the
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
- **Palette and relief:** retain warm dominance and multicolour regions, but evolve
  colour relationships, saturation and tonal balance beyond the new slow local
  balance/contrast changes if human review still finds repetitive
  red/cyan/yellow/orange. Avoid discontinuities and rainbow noise. Keep
  the current bounded ovoid/mountain character pending art direction: it comes from
  Y scaling 1.06, field/breath displacement and older audio response terms clamped
  to ±0.04. Tune prominence later rather than flattening it by assumption.
- **Outer membrane/peels:** high-tier edge resolution, normals and lift have
  been repaired after the beta; evaluate whether the revised seeded patches read
  as one lifted membrane rather than separate plates. Check soft edge depth writes,
  overlapping fragments, opacity, silhouette and specular balance at low/mobile
  and high tiers; the isolated WebGL check establishes tint alignment, not human
  perception or worst-case alpha ordering. Later activity/audio may increase
  individual lift. Consider a connected shell mask only if the measured patches
  remain visually disconnected; avoid an expensive transparency system by default.
- **Lighting:** the primary light now crosses the limb and additional tier lights
  are weak fill. Fixed-body WebGL pixels show spatial variation with light phase,
  but human visibility, ambient depth and restrained glints remain unverified.
  Measure each tier on representative hardware before further art-direction tuning.
- **Particles:** WebGL now has a seeded, biased 1.2–2.45 radius field with varied
  paths, size, opacity and warm pigment; rear particles outside the silhouette
  survive depth testing. Counts remain 12/24/40 and the density slider reveals
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
- Revisit any remaining soft-edge alpha-order artifacts in overlapping membrane
  fragments if representative views reveal them; no CPU per-frame sorting was added.
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
