# Roadmap

Implemented capabilities belong in [State](STATE.md); this file contains only
planned or acceptance-pending milestones. Detailed post-0.2 findings and engineering
items live in [Backlog](BACKLOG.md). Priorities may change after real use.

## Post-0.2 patch-alpha progression

- `0.2.0` is published. Favor frequent coherent patch alphas over a large unrelated
  unreleased delta: a small green slice that materially improves the public alpha is
  sufficient, while a knowingly broken intermediate commit is not a release.
- The nine-commit stabilization slice is integrated into `dev` and prepared as the
  `0.2.1` release candidate. Deterministic Windows/package gates and release metadata
  may establish a shippable checkpoint, but publication remains human-controlled.
- Treat the remaining hosted Ubuntu Python-test failure as known deferred Linux work.
  Do not weaken CI to hide it; perform the dedicated compatibility review around 0.3.0.
- Let later voice-reliability slices become `0.2.2`, `0.2.3` and later patch alphas
  when individually coherent; do not batch unrelated completed work for appearance.
- Before substantial audio-reactive implementation, complete the bounded strong-model
  checkpoints in [Visual Engine v1](VISUAL_ENGINE_V1.md#14-future-direction-audio-reactive-embodiment-and-diagnostics).

## Before the next major alpha

- Human-accept the combined ambient/native source candidate and fix only observed
  shell, visual, or native-boundary defects. The rejected `feature/ambient-ui`
  remains excluded.
- Physically accept the bounded sparse/dense-noise endpointing lifecycle, then
  complete multi-turn voice, multilingual playback, and barge-in acceptance.
- Use existing stage timings to reduce observed latency, then accept the final
  transcript, startup, and compact-window behavior.
- Run the full regression, package, documentation, and release-candidate gate.

## Visual Engine polish

- Refine silhouette antialiasing and efficient material/specular cues; widen/lift
  and vary peel carriers/fragments, state breathing, lights, and sparse particles.
- Human-accept the implemented damped pointer rotation, persisted profile controls,
  low-power emulation, adaptive quality, and strengthened state readability.
- Treat audio-reactive embodiment/diagnostics as a moderately high-priority future
  design direction. Preserve the envelope-driven baseline; implement nothing until
  its strong-model signal, mapping, performance and fixture checkpoints are accepted.

## Productization

- Add consent-driven prerequisite and model acquisition using existing doctor data.
- Establish Windows Authenticode signing plus antivirus/reputation validation.
- Assemble the final installer and validate Linux packages on Linux hardware.
- Extend the current typed Settings surface only when real alternatives arrive,
  including visual themes and adapter-based STT/TTS choices. Keep Rescan, Reload,
  Restart, and Quit distinct owner controls.
- Validate the integrated native identity and taskbar icon, then recheck the
  version-sensitive architecture infographic. Native plus ambient acceptance remains
  a human-controlled alpha-release concern after published `0.2.0` and prepared
  `0.2.1`.

## Computer agency

- The generic approval-gated local MCP stdio seam exists on `dev`.
- Later, validate deskwright on Linux GNOME/Wayland beneath Sam policy.
- Add MCP Streamable HTTP only if a concrete trusted deployment requires it.

## Voice and realtime

- Add optional richer human-sounding TTS adapters without making them core
  dependencies; Windows System.Speech remains the baseline/fallback.
- Evaluate physical AEC and partial/streaming STT.
- Split realtime interaction from asynchronous cognition only if usage warrants it.

## Longer term

- Structured observability/debug overlay, typed natural-language Settings control
  plane, managed interactive terminal, and persistent structured context memory.
- Generative UI and AI-native OS interaction.
- A trusted supervisor self-update bootstrap.
- PAIR-compatible multi-machine local inference routing.
- Deeper Linux hardware acceptance and delegated specialist agents.
