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
