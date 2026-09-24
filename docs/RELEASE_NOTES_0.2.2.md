# Sam 0.2.2 Alpha release notes

Sam 0.2.2 is a focused Windows-first reliability patch for generation completion,
interruption, speech delivery and current-session transcript integrity.

## What changed

- Every accepted generation now reaches one explicit completed, cancelled/superseded,
  timeout, empty-response or error outcome. Replacement turns cannot silently hide the
  predecessor, and stale content remains rejected.
- OpenAI-compatible streams have bounded total and first-useful-content lifecycles.
  Metadata-only, keepalive-only and otherwise empty successful streams fail with an
  actionable response instead of disappearing silently.
- Generation and delivery ownership now hand off in order. Typed and voice responses
  share the authoritative microphone/barge-in path, and a credible replacement turn
  terminalizes the prior playback before opening the successor response.
- Final local STT text is screened against Sam's known current output. Output-only
  matches are explicitly rejected as probable playback echo; clearly novel overlap can
  become one replacement turn. This is bounded text screening, not acoustic echo
  cancellation.
- Committed current-session user and assistant messages are append-only. Playback
  cancellation may mark an answer interrupted but cannot delete, relabel, truncate or
  replace it.
- **Stop Sam talking** stops only current queued/playing speech. **Mute voice** also
  stops current speech and suppresses future TTS while text answers remain available.

## Validation and release boundary

The reliability slice has focused deterministic provider, lifecycle, delivery, voice
and reducer coverage. The versioned preparation commit must still pass the hosted
Windows quality, package-smoke and Native Package workflows before publication.

Voice remains experimental. Physical speaker-to-microphone echo, overlapping speech,
language/noise behavior and device latency remain hardware acceptance risks; 0.2.2
does not add AEC or change voice-acoustic policy. The known hosted Ubuntu failure and
the broader Linux compatibility review remain deferred.

This release does not include provider-Rescan recovery, prior-session hydration/resume
policy, Controls redesign, visual/particle/peel work, audio-reactive visuals,
Dependabot work, console/file-manager features, model bundles, automatic downloads,
cloud speech, or a signed public Windows installer.
