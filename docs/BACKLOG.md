# Post-0.2 engineering backlog

This is the detailed backlog for work after the Sam 0.2.0 alpha. It records
observed limitations and planned directions without implying acceptance, priority,
or a commitment to a specific implementation. Milestone-level sequencing remains
in [Roadmap](ROADMAP.md).

## Release-known issues

- Recommend text interaction for the most reliable 0.2.0 alpha experience; voice
  input remains experimental.
- Stabilize language detection where drift can select the wrong TTS language.
- Replace or supplement robotic Windows System.Speech while retaining a safe fallback.
- Ship no public Windows installer until native packaging, signing, AV/reputation,
  artifact smoke, and acceptance gates pass.

## UI and Visual Engine

- **Moderately high priority - audio-reactive embodiment and diagnostics:** complete
  the strong-model checkpoints in [Visual Engine v1](VISUAL_ENGINE_V1.md#14-future-direction-audio-reactive-embodiment-and-diagnostics)
  before implementation. Evaluate a bounded feature extractor, independent
  input/output observability, coherent procedural mappings, diagnostic fixtures and
  an owner-facing high-level settings concept without weakening v1 geometry, draw,
  cadence, privacy or fallback constraints.
- Complete human visual acceptance of the Visual Engine polish passes across WebGL2,
  Canvas, reduced motion, supported window sizes, and the `mobile_2020` profile.
- Allocate a formally unobstructed ambient rectangle around Controls and transcript
  surfaces in a later layout pass; the current full-window scene remains behind them.
- Surface the ephemeral resolved renderer/automatic Canvas fallback in a future
  settings or diagnostics surface; it is currently observable only inside the engine.
- Preserve transcript history during interruption.
- Tune transcript buffering and scrolling.
- Clarify microphone mute/toggle semantics, which appeared confusing or reversed.

## Behavior and settings

- Add an owner setting for new-session versus resume-previous-conversation behavior.
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
