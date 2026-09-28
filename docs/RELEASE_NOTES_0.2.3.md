# Sam 0.2.3 alpha release notes

Sam 0.2.3 is a Windows-first alpha release candidate. These notes describe the
implemented release scope. The candidate does not claim new physical voice or
real-provider acceptance.

## Reliability and recovery

- Startup presents one plain-language status, and frontend or renderer failures
  retain a visible recovery path instead of a black window.
- Provider/model discovery, Rescan, command acknowledgements and reconnect use
  correlated state. Empty, failed and stale inventories are explicit, and older
  responses cannot overwrite a newer scan or connection.
- Diagnostics include bounded lifecycle and renderer events, provider/model,
  connection and separately reported audio health, with an accessible UI route.

## Conversation, voice and routing foundations

- Text and provisional voice input converge on correlated turns. Cancellation,
  interruption and late STT/model/TTS events cannot revive retired work; a
  completed text answer survives speech delivery failure.
- Committed turns pin their provider/model route. Typed local controls perform
  exact provider/model switches or Stop speaking, with explicit blocked and
  unavailable outcomes and no silent model fallback. A trusted typed hook can
  consume final STT as a local control before model commitment; natural-language
  recognition and spoken acknowledgements are not implemented.
- Capture, STT, synthesis and playback report separate operational health.
  Pull-based audio paths, bounded buffers and retired activity signals have
  deterministic fake-device/service coverage. Physical audio recovery remains
  unverified.

## Living Surface

- The WebGL Orb gains coherent material circulation, slow relational warm
  palette evolution, a lifted shared-field membrane, moving illumination and a
  wider seeded particle field. Autonomous motion remains independent of external
  audio, while bounded AmbientReactivity consumes separate input/output levels.
- Controls, drag and fallback behavior have focused browser and deterministic
  regressions. Human visual acceptance and representative GPU cost remain open.

## Release boundary

Broader real-provider switching, device and speech-service recovery, acoustic
interruption, representative GPU behavior and reconnect timing remain unvalidated
in this candidate. Named server/API profiles, natural-language spoken controls,
full audio embodiment and major additional visual art direction are outside this
release. A public Windows installer requires the repository's signing and
security review before publication.
