# Installed speech baseline — 2026-10-01

Consolidation II, checkpoint 2. Real installed whisper.cpp b4938 server and
`ggml-base.bin`; System.Speech Hazel/en-GB and Helena/es-ES generate a deliberately
small non-personal corpus. No microphone, speaker output, model/voice download or
human acceptance. The base model is not replaced or tuned.

## Reproduction and measurement boundary

Run `.venv/Scripts/python.exe scripts/speech_baseline.py --root .` from the checkout.
The opt-in script starts/reuses only the existing local recognizer and closes a
server it started. It generates twelve clips in memory, never retains WAV/PCM,
and writes generated reference/transcript/metrics to ignored `.sam/speech-baseline.json`.
Existing VAD and VoiceInputPipeline consume continuous paced 20 ms mono PCM16
at 16 kHz, including silence. No Sam supervisor/provider runs in this benchmark.

Six ordinary requests/questions/sentences per language include numbers, dates,
places and sentence pauses. Nine conditions per language/mode: all six clean;
one short request also at quarter amplitude, with seeded noise (20 dB clip RMS
ratio), and with 0.5 s leading / 1 s trailing silence. Forced and automatic
decoding use the actual adapter, including its current automatic fallback policy.
These condition variations cover one phrase, not a broad noisy-accent benchmark.

WER/CER are literal normalized edit distance: case/punctuation ignored, accents
retained. Digits versus spoken number words, spelling variants and missing accents
count as errors; this is not semantic comprehension accuracy. Endpoint wall time
is measured after the last nontrivial generated sample observed by paced capture;
corpus-relative timing uses sample indices. Neither is hardware endpoint latency.

## Actual recognition results

| Language/mode | Cases | Aggregate WER | CER | Median request latency |
| --- | --- | --- | --- | --- |
| English forced en | 9 | 7.95% | 6.68% | 1,190 ms |
| English automatic | 9 | 7.95% | 6.68% | 1,744 ms |
| Spanish forced es | 9 | 8.75% | 5.30% | 1,196 ms |
| Spanish automatic | 9 | 8.75% | 5.30% | 1,793 ms |

All 18 automatic requests selected the correct primary language; no fallback
request was necessary. English confidence 0.977–0.998, Spanish 0.903–0.998.
Portuguese/Greek appeared as low probability alternatives, never the selected
language. Forced requests used exactly en/es. Transcripts matched between modes.
The short clean/quiet/noisy requests had zero word errors; padded Spanish lost
the accent in “qué”. Dates/numbers introduced digit formatting; the Spanish time
phrase also produced “9.5 y media” and split “octubre”. This is a real base-model
recognition error, not endpoint truncation. No meaningful decoder parameter
experiment is justified by these results; automatic mode is kept available.

## Real VAD / endpoint observations

| Paced input | Word errors | First/last words retained | Finalize after last active PCM |
| --- | --- | --- | --- |
| English ordinary request | 0 | Yes | 1,219 ms |
| English two sentences, 250 ms pause | 0 | Yes | 1,328 ms |
| Spanish ordinary request | 0 | Yes | 1,407 ms |
| Spanish two sentences, 250 ms pause | 0 | Yes | 1,437 ms |

All four captured the complete input. Finalization then incurs actual transcription
latency, separately from the silence/endpoint wait. No first/last-word loss was
demonstrated under these generated conditions.

The initial two-sentence fixture joined complete separately synthesized clips
without removing their trailing/leading silence. Its nominal 250 ms pause was
actually 1,036 / 1,128 ms; the single-turn pipeline legitimately finalized the
first sentence before the next began. The corrected fixture trims synthesis
padding and inserts exactly 250 ms. This is a fixture correction, not a product
endpoint fix. Long pauses may create separate turns; sequential ownership/recovery
is a separate integration gate. Benchmark scoring/padding have three unit tests.

## Limitations

Synthetic Windows voices are easier and more consistent than the owner's actual
accent, pacing, background and speaker leakage. The beta's poor Spanish remains
unresolved as human evidence. This establishes real decoding/configuration and
endpoint basics, not robust physical recognition or prompt full-duplex interruption.
Forced language avoids extra language-detection cost, but did not improve this
corpus's accuracy. No broad model-capacity conclusion follows from twelve clips.

## Sequential runtime gate (checkpoint 3)

`python -m tests.integration.test_voice_sequence --real` uses actual generated
PCM, WebRTC VAD, whisper.cpp streams, SamRuntime, authenticated owner commands,
operational/durable-memory initialization and cancellation. Only inference,
response synthesis/output and the physical capture device are fixtures. Capture
produces paced silence indefinitely; no finite fake starvation.

Two Spanish turns complete, then the normal configured-session boundary switches
explicitly to English (recognition language is not a new live setting). Short and
long English turns complete; injected recognizer failure retires its stream;
authenticated typed input completes; re-enabling capture permits another voice
generation. Six generations complete, each STT stream has a unique cancellation
identity, and all four scored real transcripts retain first/last words with zero
normalized word errors. Both owner sessions revoke and tasks close. The same
composed path is protected by one deterministic integration regression.

An initial harness timeout came from leaving the owner socket unread. Continuous
real-paced events require a consuming client, as the actual UI provides. Draining
that test socket corrected the fixture; no product reset or timing change was
added. Slow durable-event subscribers are an existing backpressure design, not
evidence of a new voice/STT ownership defect. Physical PortAudio buffering,
overflow and device restart remain outside this generated-input gate.

## Installed persona/runtime gate (checkpoint 4)

`python -m scripts.speech_persona_gate` drives four complete fake-provider answers
through actual System.Speech, SamRuntime synthesis-health/meter publication and
the normal SoundDeviceOutput adapter with a paced **discarding device fixture**.
English → Spanish → English → Spanish selects Hazel/en-GB → Helena/es-ES →
Hazel → Helena, all reported female by Windows inventory. Each first-PCM health
event matches the selected adapter voice; the final ready snapshot agrees.
Four complete assistant answers remain committed. 1,079 output-level events,
maximum RMS 0.3354, demonstrate actual post-gain waveform activity. No PCM is
saved or played. Missing preferred voice still synthesizes with installed Helena;
both runtime and synthesis subprocess resources close. Existing 19 persona/TTS/
multilingual delivery tests pass, including late cancellation and configured
preference/fallback. Frontend stale selection rejection is retained separately.

The script records bounded non-personal events in ignored `.sam` for the next
fixed-camera signal-to-render gate. No voice preference schema or UI policy
changes were required. Same inventory gender does not prove matching timbre,
cadence or pleasantness; those remain human questions.

## Actual speech → visual gate (checkpoint 7)

`python -m scripts.export_speech_levels` freezes a small, scalar-only fixture from
the persona and paced-recognition reports: RMS/peak/VAD probability, relative
timestamps, no PCM/transcripts/owner credentials. First en/es delivery and capture
windows are downsampled every third measured frame; no synthetic level gain is
substituted. Reproduction requires running the two opt-in gates first.

One isolated Chrome/WebGL test replays it through the real protocol reducer,
VisualInputAdapter and MotionEvaluator at default Audio Reactivity, then freezes
orientation/material clocks to isolate body form/light differences:

| Generated source | Peak output pulse | Quarter-volume pulse | Input presence | Extra body pixels | Mean central light gain |
| --- | --- | --- | --- | --- | --- |
| English | 0.5295 | 0.2647 | 0.3033 | 5,035 | 7.99 / 255 |
| Spanish | 0.4110 | 0.2055 | 0.2672 | 3,905 | 6.18 / 255 |

Input response has zero output pulse; amount zero has zero output modulation;
expired output settles below 0.000001. Stronger actual envelopes produce larger
bounded response; WebGL error is zero. Existing input/amount-zero regressions
remain. No renderer/gain/art-direction change was needed. This joins actual local
synthesis and capture meters to rendering, but not physical sound/device timing
or human perceptual acceptance. The checked-in fixture contains measurements only.
