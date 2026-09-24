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
- Redesign the Controls layout and scrollbar and allocate a formally unobstructed
  ambient rectangle; the current full-window scene remains behind controls/transcript.
- Extend the developer-only Visual Diagnostics overlay into a richer status/debug
  surface if beta evidence warrants it. The first overlay now shows renderer,
  fallback reason, quality, phase, orientation and recent lifecycle events.
- Revisit intrinsic alpha-order/intersection lines in the current batched ribbons
  during the planned outer-membrane stage; no CPU per-frame sorting was added.
- Consider bounded centre XYZ wandering and later waveform-driven peel/particle
  perturbations only after the relevant input evidence is available. The current
  centre remains fixed and diagnostics label it as such.
- Tune transcript buffering and scrolling.
- Clarify microphone mute/toggle semantics, which appeared confusing or reversed.
- Complete the broader settings-control semantics audit after the 0.2.2 direct
  Stop Talking and speech-mute repair.

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
