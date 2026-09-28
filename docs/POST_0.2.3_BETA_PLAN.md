# Post-v0.2.3 human beta: diagnosis and repair order

This plan records a roughly five-minute physical Windows session of the published
0.2.3 build. It is product evidence, not acceptance inferred from synthetic tests.
Sam started through the supervisor with the existing LM Studio
`google/gemma-4-e2b`, whisper.cpp `ggml-base.bin`, microphone/STT, and Windows
System Speech. Several voice → model → spoken-answer turns succeeded. Vertical
Orb dragging worked, and Controls tabs, diagnostics, and particles were useful.
No post-release repair has yet been verified against the physical session.

## 1. P0 — restore conversation ownership before tuning speech quality

The first dependency is a trustworthy distinction between microphone speech
from the human and Sam's own playback. During playback, VAD opens an
`INTERRUPTION_CANDIDATE`, but `TurnManager` deliberately cannot confirm a
SPEAKING-origin candidate by duration. It waits for STT text because microphone
energy alone can be speaker bleed. This explains why several seconds of real
human speech may fail to stop playback promptly. The current
`_screen_playback_transcript` compares recognized words with generated answer
text; it is a limited text guard, not acoustic echo cancellation. The session's
YOU entry repeating Sam's miles answer, including spoken markup wording, is
strong evidence of self-output contamination, but the available excerpt cannot
prove which individual audio frames came from speakers versus the human.

One source defect is deterministic: `on_tts_completed` promotes an open,
unverified interruption candidate to `USER_SPEAKING`. The response then clears
`_active_generation_id`; `_monitor_barge_in` uses that mutable ID to find the
answer for playback-transcript screening. A later candidate final can therefore
skip screening and emit `turn.committed` as human content. A source-level
reproduction found that 1,200 ms of VAD speech during playback produced no
`tts.cancelled`; TTS completion promoted the candidate; a later final emitted
`turn.committed`. Existing fake tests end or reject candidates while playback
is still active, so they miss this handoff.

Repair in this order:

1. Give each playback/listening overlap a stable generation and playback
   reference through candidate finalization, including playback completion and
   cancellation. Keep candidates provisional until source ownership is resolved;
   never promote them solely because TTS ended. Preserve the already committed
   assistant answer when only speech delivery is interrupted.
2. Establish an input/output discrimination signal suitable for a roughly
   one-second sustained-human-speech decision **before** STT finalization.
   Validate speaker-only, human-only, and simultaneous speaker-plus-human
   synthetic signals. Do not substitute a VAD timer or transcript similarity
   threshold for source discrimination. Keep a conservative behavior if
   acoustic ownership is uncertain.
3. Correlate the physical run's turn/generation/cancellation IDs and provider
   stream terminals, especially `59f… → a81…`, `aeeb… → f7b…`, and
   `c5c… → 273f…`. Absence of `model_complete` alone is not failure: cancelled
   and superseded work is valid. Verify that every predecessor sets its
   `response_done` and releases any stream or pending command, so a later typed
   request proceeds when the provider is usable. Add consecutive-supersession
   and typed-recovery regressions for any defect actually found.
4. Keep provisional STT out of committed YOU history. Keep message role,
   interruption status, and delivery status as metadata; preserve full generated
   assistant text when playback stops. Render assistant formatting as prose,
   rather than displaying literal Markdown markers or appending status to text.

The P0 implementation is not complete. The source-discrimination and possible
provider/generation interaction need a focused high-reasoning continuation
before changing live barge-in semantics. A single bounded physical follow-up
should come only after deterministic overlap and terminality regressions pass.

## 2. Voice and embodiment after conversation integrity

- Reassess actual STT accuracy and unstable Spanish/Portuguese/Greek detection
  after self-output and candidate ownership are fixed. The beta alone cannot
  assign all transcript errors to Whisper.
- Keep Sam's voice persona coherent across languages. The session selected
  Microsoft David Desktop for English and Helena Desktop for Spanish.
- Drive distinct listening and speaking embodiments from the existing input
  and output activity measurements. Sam's speech should create fast, bounded
  emphasis-sensitive Orb expansion and illumination pulses with rapid return;
  listening should respond differently. Preserve autonomous motion underneath.
  The beta showed nonzero input and playback metrics but essentially no useful
  visible reaction.

## 3. Visual, UI, and product work after the P0 repair

- Revisit the Living Surface as a composition: pigment still seemed
  predetermined, large regions did not transform organically, high quality
  appeared faceted, and lifted membrane read as faint hard-edged polygons.
  Numerical fixed-pixel change did **not** establish perceptual acceptance.
  Particles were broadly acceptable; find or restore the particle-count
  control after auditing the settings registry and prior UI.
- Give conversation history its own obvious scrollbar. Place diagnostics so it
  does not obscure conversation even in fullscreen, then group immediate
  health/state, conversation/provider/audio, renderer/performance, and bounded
  event history by operational value.
- Reconcile model-eject/server-close settings with ownership of a provider
  already running before Sam. The session visibly shut down Sam core/STT but
  did not show LM Studio unloading or closing despite selected options.
  Labels and actual policy must agree.
- Make startup obvious without a repository command. Retain the longer-term
  Sam console, browser capability, Options, named profiles, natural-language
  controls, persistent memory, installer signing, and theme directions as
  post-P0 work, not reasons to delay conversation repair.

## Validation lesson

Deterministic lifecycle tests did not sufficiently cover simultaneous real
playback and listening, particularly a candidate that outlives TTS. Keep
synthetic state checks, but exercise operation handoff and source ownership.
Likewise, numerical renderer change is not the same as human visual acceptance.
