# Post-0.2 engineering backlog

This is the detailed backlog for work after the Sam 0.2.0 alpha. It records
observed limitations and planned directions without implying acceptance, priority,
or a commitment to a specific implementation. Milestone-level sequencing remains
in [Roadmap](ROADMAP.md).

## Release-known issues

- Recommend text interaction for the most reliable 0.2.0 alpha experience; voice
  input remains experimental.
- Investigate `voice monitor entered unexpected state IDLE` during voice input.
- Bound very long STT segments caused by sustained environmental or keyboard noise.
- Stabilize language detection where drift can select the wrong TTS language.
- Replace or supplement robotic Windows System.Speech while retaining a safe fallback.
- Ship no public Windows installer until native packaging, signing, AV/reputation,
  artifact smoke, and acceptance gates pass.

## UI and Visual Engine

- Thin the atmospheric halo.
- Make peels thicker and place them farther from the orb.
- Verify and repair direct drag interaction; it appeared ineffective in human testing.
- Verify particle rendering and density controls; density changes produced no visible
  particles in human testing.
- Verify quality and motion settings whose effects were not consistently perceptible.
- Verify rotation-speed behavior.
- Keep tooltips within the Sam window.
- Normalize minor Controls typography inconsistencies.
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
