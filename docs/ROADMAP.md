# Roadmap

Implemented capabilities belong in [State](STATE.md); this file contains only
planned or acceptance-pending work. Priorities may change after real use.

## Before the next major alpha

- Human-accept `feature/ambient-shell` and fix only observed shell/visual defects.
- Accept and merge `feature/native-shell`, then reconcile it cleanly with the
  accepted ambient shell without importing the rejected `feature/ambient-ui`.
- Complete physical two-turn voice, multilingual, playback, and barge-in acceptance.
- Run the full regression, package, documentation, and release-candidate gate.

## Productization

- Add consent-driven prerequisite and model acquisition using existing doctor data.
- Establish Windows Authenticode signing plus antivirus/reputation validation.
- Assemble the final installer and validate Linux packages on Linux hardware.

## Computer agency

- The generic approval-gated local MCP stdio seam exists on `dev`.
- Later, validate deskwright on Linux GNOME/Wayland beneath Sam policy.
- Add MCP Streamable HTTP only if a concrete trusted deployment requires it.

## Voice and realtime

- Add optional richer local/cloud TTS adapters without making them core dependencies.
- Evaluate physical AEC and partial/streaming STT.
- Split realtime interaction from asynchronous cognition only if usage warrants it.

## Longer term

- Generative UI and AI-native OS interaction.
- A trusted supervisor self-update bootstrap.
- PAIR-compatible multi-machine local inference routing.
- Deeper Linux hardware acceptance and delegated specialist agents.
