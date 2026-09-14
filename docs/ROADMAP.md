# Roadmap

Implemented capabilities belong in [State](STATE.md); this file contains only
planned or acceptance-pending work. Priorities may change after real use.

## Before the next major alpha

- Human-accept the combined ambient/native source candidate and fix only observed
  shell, visual, or native-boundary defects. The rejected `feature/ambient-ui`
  remains excluded.
- Physically accept the new sparse-noise endpointing bounds, then investigate any
  remaining continuously VAD-positive environmental noise and complete multi-turn
  voice, multilingual playback, and barge-in acceptance.
- Use existing stage timings to reduce observed latency, then accept the final
  transcript, startup, and compact-window behavior.
- Run the full regression, package, documentation, and release-candidate gate.

## Visual Engine polish

- Refine silhouette antialiasing and efficient material/specular cues; widen/lift
  and vary peel carriers/fragments, state breathing, lights, and sparse particles.
- Human-accept the implemented damped pointer rotation, persisted profile controls,
  low-power emulation, adaptive quality, and strengthened state readability.
- Consider waveform/spectral and prosody/theme mappings only after the
  envelope-driven baseline is accepted.

## Productization

- Add consent-driven prerequisite and model acquisition using existing doctor data.
- Establish Windows Authenticode signing plus antivirus/reputation validation.
- Assemble the final installer and validate Linux packages on Linux hardware.
- Extend the current typed Settings surface only when real alternatives arrive,
  including visual themes and adapter-based STT/TTS choices. Keep Rescan, Reload,
  Restart, and Quit distinct owner controls.
- Validate the integrated native identity and taskbar icon, then recheck the
  version-sensitive architecture infographic. Native plus ambient acceptance is
  the likely `0.2.0` boundary.

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
