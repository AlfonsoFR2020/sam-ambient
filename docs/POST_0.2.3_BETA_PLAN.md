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
3. Keep generation terminality and typed recovery protected. The source-backed
   stall path and repair are recorded below. Correlate the physical run's
   turn/generation/cancellation IDs and provider stream terminals, especially
   `59f… → a81…`, `aeeb… → f7b…`, and `c5c… → 273f…`, before attributing the
   whole physical no-response episode. Absence of `model_complete` alone is not
   failure: cancelled and superseded work is valid.
4. Keep provisional STT out of committed YOU history. Keep message role,
   interruption status, and delivery status as metadata; preserve full generated
   assistant text when playback stops. Render assistant formatting as prose,
   rather than displaying literal Markdown markers or appending status to text.
   The frontend history now shows only committed entries, keeps a stopped-speech
   indicator outside answer content, renders common assistant paragraphs,
   emphasis and lists as escaped React text, and provides an independent
   scrollbar that follows new entries only while the reader is near the bottom.
   Richer Markdown remains deferred.

### Acoustic-ownership feasibility checkpoint (2026-09-28)

Source inspection confirms that Sam can retain a reference to the **PCM it
sends** to playback. System Speech generates bounded 16 kHz mono PCM16 WAV;
`_metered_tts_frames` applies output gain and yields 20 ms PCM frames to
`SoundDeviceOutput`. `SoundDeviceCapture` independently reads 20 ms, 16 kHz
mono PCM16 frames and applies microphone gain before VAD/STT. The two PortAudio
streams have no shared sample clock, render/capture timestamp, loopback stream,
or acoustic echo canceller in the current stack. eSpeak output may be 22.05 kHz.
`webrtcvad-wheels` supplies VAD only. The output reference is therefore the
intended render data, not a measured signal from the actual speaker/microphone
path.

The physical mixture is microphone = unknown, delayed, filtered speaker echo
+ human speech + noise. Simple amplitude comparison, raw correlation, or
single-delay subtraction cannot distinguish that mixture robustly when device
latency, room response, speaker distortion, and microphone gain vary. In
particular, residual echo after imperfect subtraction can falsely satisfy a
one-second VAD rule. Transcript matching remains a useful secondary safeguard
but arrives too late to guarantee prompt barge-in. A deterministic repeat of
the state-machine reproduction still confirms the promotion defect above;
there is no evidence yet that a small pure-Python classifier would work on the
real Windows audio path.

The smallest viable options are:

1. **Recommended:** add a bounded, replaceable render-reference/near-end audio
   processing boundary and evaluate a mature native AEC/double-talk processor
   (for example [WebRTC Audio Processing](https://webrtc.googlesource.com/src/+/1fce3f8e55a5a416b0436adfff61b627f4033a98/modules/audio_processing/include/audio_processing.h)). Feed the actual post-gain playback
   PCM as the reverse stream and capture PCM as the near-end stream; align,
   resample, and reset by playback/candidate identity. This is the most portable
   path to early human-origin evidence, but adds native DSP/build/licensing
   work and requires physical-device validation.
2. Use supported [Windows capture-endpoint AEC](https://learn.microsoft.com/en-us/windows/win32/coreaudio/wasapi) where available. It may exploit
   platform render-reference integration, but requires a Windows-specific
   adapter, capability detection, and a fallback because endpoint support is
   not universal. The current `sounddevice` adapter exposes no such contract.
3. Keep the present text-confirmed policy as a conservative fallback. It can
   avoid VAD-only self-interruption but cannot meet the one-second barge-in
   target. The candidate-promotion/reference defects have been corrected on
   `dev`; text alone still cannot establish acoustic source ownership.

The bounded safety repair on `dev` now keeps a playback-time candidate
provisional when TTS completes and pins the monitor to that delivery's
generation for subsequent text-reference screening. Rejected candidates
return to IDLE after playback; a novel finalized candidate can still become a
normal user turn. The regression reproduces the old echo commitment by ending
playback before STT finalization and clearing the mutable active-generation
pointer; it now rejects the echo while accepting a distinct utterance. An
unresolved candidate also retires if its monitor stops, including when a newer
turn replaces that monitor's lifecycle owner. This is **not** acoustic source
separation, and text screening can still accept a
misrecognized echo that does not resemble the generated text. No claim of
prompt or physically reliable barge-in follows from these tests.

Before enabling early interruption, establish signal-level echo-only,
double-talk, and post-playback fixtures plus a bounded real-device check. A
candidate should carry its playback reference through cancellation and final
STT independently of the mutable active-generation pointer. Promotion must
require independent-speech evidence or another explicit validated path;
echo and expired candidates must retire. Preserve capture pre-roll and the
complete assistant answer when cancelling only playback.

### Conversation terminality checkpoint (2026-09-29)

A deterministic A → B → typed C sequence reproduced a no-response path: if
generation A's provider stream did not unwind on token cancellation, B and C
remained behind A's unbounded `response_done` wait. The runtime had already
made C its active generation and acknowledged its text command, yet C never
reached model execution. A matching voice-managed variant retained an old
`INTERRUPTION_CANDIDATE` and exhibited the same risk. The repair requests
task/token cancellation, publishes one terminal for the predecessor, retires
its speech queue and logical ownership, and lets C execute without waiting for
the old adapter. Late A output cannot commit an answer or replace C's state.
An additional voice-handoff race let a committed voice turn resume after its
retirement await and claim active generation ownership after a newer typed
request. A monotonic generation epoch now rejects that stale handoff; the
controlled overlap regression dispatches and completes typed input first.
The HTTP stream adapter already binds token cancellation to its task and closes
the stream on unwind; a non-cooperative adapter may still run in the background
until it returns, but it no longer holds the conversation gate.

A second concrete frontend gate was independent: a late old-turn terminal could
be discarded as stale by the conversation reducer before it released the
corresponding pending command. Moreover, any pending Control disabled the Send
button. Command retirement now follows correlation even when the event is stale
for display, and a pending Control no longer blocks a valid typed request.
The existing 30-second acknowledgement bound remains a diagnostics/failure
bound, not a condition for text recovery.

These synthetic regressions establish a viable typed recovery path after
successive supersessions; they do not identify which provider/voice/UI gate
caused the five-minute physical beta to stop responding. The captured excerpt
does not contain enough correlated terminal and command evidence to assign that
specific incident. Acoustic source separation and approximately-one-second
barge-in remain deferred and are unaffected by this checkpoint.

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
- Place diagnostics so it does not obscure the now independently scrolling
  conversation history even in fullscreen, then group immediate
  health/state, conversation/provider/audio, renderer/performance, and bounded
  event history by operational value.
- Reconcile model-eject/server-close settings with ownership of a provider
  already running before Sam. The session visibly shut down Sam core/STT but
  did not show LM Studio unloading or closing despite selected options.
  The service and model were pre-existing, so the established conditional
  policy correctly left them alone. Controls and Quit now state that outcome
  before exit, cleanup reports skips, and multiple discovery snapshots are
  cleaned once in unload-before-stop order. Physical LM Studio cleanup remains
  unverified; no permission to stop reused providers was added.
- Make startup obvious without a repository command. Retain the longer-term
  Sam console, browser capability, Options, named profiles, natural-language
  controls, persistent memory, installer signing, and theme directions as
  post-P0 work, not reasons to delay conversation repair.

### Future direction: speaker-attributed conversations

NVIDIA Nemotron 3 Diarization is an open-weight streaming/offline speaker
diarization model of approximately 100M parameters. It consumes 16 kHz mono
audio, supports up to eight speakers, and maintains speaker identities across
streaming chunks using a speaker-cache/FIFO architecture. It may be relevant
to future multi-person conversations, speaker-attributed transcripts, context
and memory, and meeting mode. It is **not** Sam's playback self-echo/AEC
solution, and no integration is proposed now. Runtime, GPU, dependency and
licensing suitability require evaluation before any future adoption.

## Validation lesson

Deterministic lifecycle tests did not sufficiently cover simultaneous real
playback and listening, particularly a candidate that outlives TTS. Keep
synthetic state checks, but exercise operation handoff and source ownership.
Likewise, numerical renderer change is not the same as human visual acceptance.
