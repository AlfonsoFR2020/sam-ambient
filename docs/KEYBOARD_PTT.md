# Keyboard push-to-talk — UX-11

V-D, 2026-10-22. Unreleased development; v0.2.5 does not include this input mode.
The core and frontend hold/release/cancel path and fake-service/keyboard checks
are implemented. Canonical assets and final V-D evidence are recorded at closure;
physical/UI and owner acceptance remain open.

## Deliberate input contract

Controls selects **Ordinary microphone** or **Keyboard push-to-talk**. The core
persists that preference separately from microphone enablement. Muting always
wins; choosing PTT does not enable a muted or unavailable microphone. Restoring
PTT at startup leaves capture unopened until a new authenticated gesture.

The chosen local shortcut is **hold F8, release F8 to finish**, after deliberate
PTT selection. It avoids ordinary typing, Space activation, existing Sam shortcuts
and modifier-release ambiguity. It is not an OS-wide shortcut. Editable/interactive
fields, composition/IME, an unfocused/hidden window and modal operations prevent
new capture. A focusable PTT area supports deliberate keyboard/accessibility use.
Actual key mapping and assistive-technology behavior need later UI acceptance.

Input states are `disabled`, `ordinary`, `armed`, `starting`, `capturing`,
`finalizing`, `submitted`, `cancelled`, `failed` or `unavailable`. `starting` is an
admitted request, not a recording claim. `capturing` requires actual PCM accepted
by the correlated STT stream. Release before that confirmation discards the input.
Finalizing means capture has been asked to close and final STT is pending, not
that a user message has been committed.

## Ownership and retirement

- Additive protocol-v1 commands: `control.voice_input_mode.set` with exact `mode`,
  and `control.push_to_talk` with exact `action` (`start`/`finish`/`cancel`) and
  canonical UUID `gesture_id`. Both require a current authenticated owner context;
  runtime also validates the current session. Ordinary controls retain their APIs.
- The gesture binds owner connection, session, cancellation token and generation
  epoch. Command deduplication and 32 retired gesture identities are bounded.
  Foreign/late cleanup cannot touch a newer gesture. Reconnect never resumes a hold.
- `voice.input_state` is a content-free authoritative projection with an increasing
  runtime-local `sequence`; the ready snapshot contains the same object. ACK only
  acknowledges command handling. Old ACKs never create capture/readiness in the UI.
- PTT uses the existing capture/STT adapters exclusively after ordinary capture
  has unwound. The held task retains the single capture lease until all adapter
  cleanup finishes. A noncooperative adapter blocks further capture, not typing.
- Capture closes before final recognition. There are no VAD-derived endpoints or
  partial commits in held mode. Only a final nonempty transcript can reach the
  existing TurnManager commitment and runtime generation path. A completed stream
  is not cancelled in cleanup, which would wrongly cancel its subsequent answer.
- Commitment transfers ownership before event-publisher backpressure. The exact
  inference target is frozen then; an expected generation epoch prevents delayed
  PTT handoff from superseding newer typed work. Later focus loss cannot undo an
  already committed answer; regular Stop/Emergency Stop owns that lifetime.
- Blur, hidden/page loss, focus/control changes, Escape, unmount, mute, mode/language
  change, owner disconnect, Emergency Stop, shutdown and newer typing discard an
  unfinished gesture. They do not finalize provisional recognition.
- Release retains local gesture ownership until an authoritative terminal state.
  Blur can therefore revoke a queued finish, or cancel unfinished recognition after
  finish transport acceptance. Rejected/timed-out start admission retires only its
  exact command; key repeat cannot start another gesture. A rapid mute/unmute still
  reports unavailable while cancelled capture cleanup retains its lease.
- Missing key release is bounded by a **30-second held-input lease**. Finalization
  has a separate 30-second logical deadline. Expiry revokes ownership and requests
  adapter cancellation; it is not an inference timeout increase or retry loop.
- No PTT input starts during generation, playback or prior capture retirement.
  Held-mode answers use existing delivery without an ordinary barge-in microphone
  monitor. Typed requests remain available throughout, including after STT failure.

Cancellation requests and accepted PCM observations do not establish hardware
microphone-stop or acoustic output timestamps. PTT is deliberate input, **not AEC**,
not proof of human-origin speech, and not a promise of natural full-duplex barge-in.
No acoustic thresholds, recognizer engine, model routing or interruption sensitivity
policy changes are part of this work. CONV-08 remains separate future owner control.

## Evidence and later gates

### Related CONV-08 preference boundary — design only

Interruption mode remains `TurnConfig.interruption_mode` with aggressive/balanced/
conservative semantics. A separately scoped owner preference could reuse the
authenticated dispatcher, private metadata and authoritative projection pattern,
apply only between input/response owners, and freeze the selected TurnConfig per
turn. It must stay independent of microphone enablement, PTT and amplitude gain.
No such selector/policy activation is implemented here; threshold multipliers and
acoustic-origin protections are unchanged. Hardware acceptance cannot be inferred
from an enum or fake VAD. This does not complete CONV-08.

The focused core tests use queued PCM, fake recognition and controlled completion
gates, with bounded asynchronous settlement and a temporary preference store.
They cover en/es forwarding, no device acquisition while armed, fast release,
duplicate finish, mute, mode return, owner loss, timeout, Emergency Stop, shutdown,
typed supersession/recovery, invalid/empty/provisional/foreign recognition, delayed
noncooperative finals, postcommit focus cancellation and immutable route handoff.
They measure control/ownership behavior, not recognition accuracy or physical latency.

See [requirements UX-11](OWNER_REQUIREMENTS.md#ux-11),
[architecture](ARCHITECTURE.md) and [user guide](USER_GUIDE.md).
Graphical/focus, natural bilingual speech, actual devices and owner acceptance remain
separate gates. No application/audio/browser session is authorized by this document.
