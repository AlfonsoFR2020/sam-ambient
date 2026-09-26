# Post-0.2 engineering backlog

This is the detailed backlog for work after the Sam 0.2.x alpha. It records
observed limitations and planned directions without implying acceptance, priority,
or a commitment to a specific implementation. Milestone-level sequencing remains
in [Roadmap](ROADMAP.md).

## Release-known issues

- Recommend text interaction for the most reliable 0.2.2 alpha experience; voice
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
  perceived the older nearly rigid field as static. The new asymmetric shear makes
  fixed-orientation WebGL material change over seconds, and pointer ownership eases
  field flow down and back without a phase jump. Verify that the full composition now
  reads as coherent circulation and that drag feels like grasping one object. A
  separate Surface Flow control still needs a clean persisted settings/protocol path
  and bounds around an accepted default. Do not claim Auto without a real signal.
- **Palette and relief:** retain warm dominance and multicolour regions, but evolve
  colour relationships, saturation and tonal balance beyond the new slow local
  balance/contrast changes if human review still finds repetitive
  red/cyan/yellow/orange. Avoid discontinuities and rainbow noise. Keep
  the current bounded ovoid/mountain character pending art direction: it comes from
  Y scaling 1.06, field/breath displacement and older audio response terms clamped
  to ±0.04. Tune prominence later rather than flattening it by assumption.
- **Outer membrane/peels:** evaluate whether seeded curved patches read as one
  lifted membrane rather than separate plates. Check soft edge depth writes,
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
- **Moderately high priority - audio-reactive embodiment and diagnostics:** complete
  the strong-model checkpoints in [Visual Engine v1](VISUAL_ENGINE_V1.md#14-future-direction-audio-reactive-embodiment-and-diagnostics)
  before implementation. Evaluate a bounded feature extractor, independent
  input/output observability, coherent procedural mappings, diagnostic fixtures and
  an owner-facing high-level settings concept without weakening v1 geometry, draw,
  cadence, privacy or fallback constraints.
  The new visual-only sustained/onset layer is a bounded destination for existing
  envelopes, not a feature extractor or proof of useful live voice embodiment.
- Compare a workload-aware quality governor, high-end/demo richness and Orb Lab
  contact sheets using deterministic state/audio fixtures. Protect first-token,
  inference, audio and UI latency; do not treat visual FPS alone as acceptance.
- Complete human visual acceptance across WebGL2, Canvas, reduced motion, supported
  window sizes, and `mobile_2020`; particle visibility and the overall Visual Engine
  appearance remain materially below the alpha target.
- Continue Controls hierarchy/help review after the tab split. Conversation, visual,
  device, system and developer paths are distinct, but the ambient rectangle and
  transcript/Controls coexistence still need layout work. Ensure any mobile route is
  accessible without a physical keyboard; avoid one giant scrolling panel.
- Grow the existing diagnostics overlay into a fuller Sam status/console surface
  when core telemetry is available through a bounded protocol. It now shows the
  reported model/provider/STT/TTS/connection/microphone state and existing audio
  envelopes, but has no measured server health, loaded-model memory/latency,
  frequency features or physical audio-device diagnostics. Do not fabricate values,
  create a second telemetry pipeline or turn this into a terminal emulator.
- Revisit any remaining soft-edge alpha-order artifacts in overlapping membrane
  fragments if representative views reveal them; no CPU per-frame sorting was added.
- Consider bounded centre XYZ wandering and later waveform-driven peel/particle
  perturbations only after the relevant input evidence is available. The current
  centre remains fixed and diagnostics label it as such.
- Tune transcript buffering and scrolling.
- Clarify microphone mute/toggle semantics, which appeared confusing or reversed.
- Physically validate the full voice/audio path and useful live voice reactivity
  after material surface, membrane and interaction improvements. Do not consume
  another human beta session for a narrow frontend patch alone.

## Behavior and settings

- Add an owner setting for new-session versus resume-previous-conversation behavior.
- Validate provider/model Rescan, service disappearance, and model loading against
  real LM Studio/Ollama and reconnect timing after the deterministic state and
  isolated-browser recovery checks. The historical black-screen report was not
  reproduced by the controlled transport scenarios.
- Add an owner setting for transcript retention during interruption.
- Physically accept LM Studio automatic model load and ownership-aware eject behavior.
- Define model/context/VRAM policy.
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
