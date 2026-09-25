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

- **Living Orb direction:** design a seam-safe, low-cost shared surface/colour
  field, related outer-membrane openings and material response before changing the
  v1 renderer. Compare analytic flow/noise approaches, several cheap shell-mask
  boundaries and the existing loxodromic fallback under the `mobile_2020` and
  four-draw budgets in [Visual direction](VISUAL_DIRECTION.md). Keep broad palette,
  translucency and richer depth experimental until measured and visually accepted.
- **Visible circulation and drag ownership:** the present field phases change, but
  the first human beta still reads the broad colours as a texture rotating with the
  Orb. Make persistent large structures visibly migrate on a human timescale without
  procedural boiling. The shader samples unrotated object directions before the
  orientation transform, so the apparent texture sliding during drag is consistent
  with advection continuing while the pointer owns the Orb; verify perceptually and
  consider a strong rate reduction/hold during drag with a smooth post-release ramp,
  never a phase jump. A separate Surface Flow/Circulation Speed control needs a clean
  settings/protocol path and bounds around a useful default. Do not claim Auto until
  a real signal and algorithm exist.
- **Palette and relief:** retain warm dominance and multicolour regions, but evolve
  colour relationships, saturation and tonal balance slowly beyond the repetitive
  red/cyan/yellow/orange combination. Avoid discontinuities and rainbow noise. Keep
  the current bounded ovoid/mountain character pending art direction: it comes from
  Y scaling 1.06, field/breath displacement and older audio response terms clamped
  to ±0.04. Tune prominence later rather than flattening it by assumption.
- **Outer membrane/peels:** replace the current intersecting ribbons with a measured
  irregular outer membrane. Preserve shared-field tint, make fragments more legible
  and farther from the body, give individual fragments subtly different radial lift,
  and allow later activity/audio to extend them. Resolve the current transparency,
  blur/opacity and crossing/intersection lines in that architecture; add convincing
  specular response only where the hardware budget permits. Do not heavily polish
  ribbons that are planned for replacement.
- **Lighting:** the shader has world-space orbiting light calculations and constant
  ambient fill, with 1/2/3 key lights by quality. Human use could perceive neither
  the moving key nor convincing fill/day-night/glints. Measure light direction,
  normal/material response and contrast on real hardware, then tune a clearly
  perceptible but bounded orbiting key and ambient depth at each tier.
- **Particles:** current low/medium/high budgets are 12/24/40 points, and the
  density slider only reveals a share of that cap. Explore roughly 5–10× the high
  count when measured hardware headroom permits while keeping lightweight tiers.
  Diversify size, shape/appearance and colour, retain slow inclined orbits, and
  extend their atmosphere beyond the current 1.1–1.4 Orb-radius shell. Their short
  reach is a geometry/lifetime assumption, not viewport clipping; the shader also
  fades particles behind the Orb. Later use actual waveform/activity features for
  modest XYZ perturbations instead of arbitrary randomness. Profile point fill and
  overdraw before raising caps.
- **Moderately high priority - audio-reactive embodiment and diagnostics:** complete
  the strong-model checkpoints in [Visual Engine v1](VISUAL_ENGINE_V1.md#14-future-direction-audio-reactive-embodiment-and-diagnostics)
  before implementation. Evaluate a bounded feature extractor, independent
  input/output observability, coherent procedural mappings, diagnostic fixtures and
  an owner-facing high-level settings concept without weakening v1 geometry, draw,
  cadence, privacy or fallback constraints.
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
- Revisit intrinsic alpha-order/intersection lines in the current batched ribbons
  during the planned outer-membrane stage; no CPU per-frame sorting was added.
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
- Recover safely when provider/model Rescan leaves the UI black or unusable.
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
