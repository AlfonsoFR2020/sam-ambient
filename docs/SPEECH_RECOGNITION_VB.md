# Recognition integrity — Assignment V-B

2026-10-22. Unreleased development on `dev`, starting clean at
`fc149333131ff64993739b99ddf30aee1b95d2d4` (16 ahead of cached `origin/dev`).
Published v0.2.5 remains `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
This is an occupied-PC source/fake-service increment, not real recognition acceptance.

## Existing path and established limits

| Boundary | Current authority and behavior |
| --- | --- |
| Capture | SoundDeviceCapture pulls 20 ms mono PCM16 at 16 kHz by default; immutable frames, Sam-only gain, bounded blocking reads, overflow aborts the utterance |
| Onset/framing | WebRTC VAD opens an utterance; pre-roll precedes its onset. SpeechEvidence gates resumption/noise density and caps ordinary candidates at 24 seconds |
| Recognition admission | One stream with session/turn/cancellation context; push awaits the consumer. No unbounded Python PCM queue |
| Installed recognizer | Local whisper.cpp b4938 final-only multipart WAV API; 120-second PCM and request limits, 4 MiB response cap; no downloads or engine replacement |
| Language | Owner's explicit selection forces decoding. Auto uses detection probabilities and existing uncertain-language fallback; forced fallback is not new detection evidence |
| Results/commit | Recognition is provisional user evidence. TurnManager alone commits meaningful final text; empty/noise finals do not become user turns |
| Recovery | Input failure leaves typed interaction usable. Candidates, inference and optional delivery have distinct owners; VAD is not proof of human-origin speech |

Physical PortAudio buffering can overflow during a slow consumer/finalizer. This
increment does not create background capture or claim lower device/recognizer latency.
Speaker leakage, accent/model capacity, quiet-room accuracy and source separation
remain unassigned causes of the owner's poor English/Spanish experience.

## Reproduced defects and implemented correction

Nine initial adapter cases fail against the starting source: concurrent finalizers
launch two requests; failure retains PCM and permits reissue; cached results bypass
cancellation; late en/es/auto responses return despite retirement; reordered auto
results overwrite newer confirmed language; HTTP/JSON error bodies expose content.
Two further tests demonstrate reflected transport detail escaping through chained
exception tracebacks even after sanitizing the outer exception.

- Seal a stream before its first finalization await. Reject concurrent finalization
  and subsequent writes; successful repeated reads remain idempotent only for its
  active original token. Failed/canceled streams require a new utterance.
- Encode WAV directly from the PCM buffer, then clear PCM before HTTP wait and on
  every failure/cancellation path. This removes the extra `bytes(PCM)` conversion
  and duplicate retained PCM; it is not a measured speed or peak-RSS claim.
- Check cancellation after recognition returns, including early forced/legacy
  metadata paths and before caching. Require an actual final result.
- Snapshot supporting language context at request admission and use a monotonically
  increasing epoch for confirmed-language updates. Older results cannot replace
  evidence from a newer request; forced language still never becomes auto evidence.
- Surface bounded error class/status without returned bodies or reflected transport
  details, including traceback chaining. No ordinary transcript/PCM logging is added.
- Source hardening reproduced four more failures in a five-case metadata group:
  arbitrary language labels entered logs/confirmed-language state; boolean, infinite
  and out-of-range no-speech probabilities erased ordinary text. Only normalized
  language selectors and finite 0–1 probabilities now count as evidence. The
  already-correct negative-probability case remains protected.
  A final extreme-integer case also reproduced a conversion overflow in the new
  finite check; range rejection now precedes float conversion. This is malformed
  metadata hardening, not evidence of the owner's recognition failure.
  Strengthening the untrusted-metadata fixture also reproduced the same overflow
  in server duration; nonnumeric/boolean/nonfinite/out-of-audio-bound duration
  metadata now falls back to the existing unknown/zero log value. Local elapsed
  recognition timing is unchanged and does not trust this server field.

Six initial pipeline cases fail: 10/30 ms frames violate the claimed pre-roll window;
late canceled partial/final callbacks publish evidence; a foreign-context stream
receives PCM; provisional finalize output is accepted. The 20 ms framing case and
an initial early-final polling case already passed. The latter fixture was strengthened
to actually emit its early final after pre-roll; do not count its earlier pass as proof.

- Keep up to 200 ms of pre-roll by sample duration and timestamp, capped at 64
  frames. Retain the current block; normal 10/20/30 ms blocks stay within the window.
  The native 20 ms path and VAD/endpoint thresholds are unchanged.
- Validate the returned stream's context and recheck cancellation after start,
  pushes, polling and finalization. An adapter that ignores cancellation cannot
  publish or commit its retired utterance.
- Polling remains provisional even if an adapter marks an early result final.
  Explicit finalize must return final evidence before commitment. All existing
  TurnManager authority, empty-final rejection and local-control semantics remain.

## English, Spanish and locale semantics

`voice.stt_language`, `SAM_STT_LANGUAGE`, CLI and stream contexts accept primary
codes or common locales: `en-GB` → `en`, `es-ES` / `es_ES` → `es`. The same pure
normalizer handles preferred languages. Auto is allowed only as the recognition
mode, not a fallback preference. Invalid selectors fail before request dispatch.

The saved Automatic / English / Spanish owner control remains unchanged; it takes
precedence over launch defaults and changes only at an idle boundary. Locale
normalization does not promise Castilian accent specialization, mixed-language
decoding, translation or automatic override of an explicit selection. No setting
key, schema version, dependency or model changes. No automatic retry policy changes.

## Initial deterministic checkpoint

85 focused tests pass across adapter integrity, whisper.cpp contracts, configuration,
utterance integrity, existing input-pipeline behavior and recognition controls.
One existing invalid-configuration case is intentionally changed: `en-US` is now
supported; malformed `en-US-extra` remains rejected. Two composed stream fixtures
now expose their already-required `context` property rather than bypassing the
production identity check. These are fixture/contract updates, not hardware repairs.

## Final regression and static evidence

**256 distinct Python tests pass**, in completed, nonoverlapping file/test batches:

| Batch | Tests | Test elapsed time |
| --- | --- | --- |
| Adapter/configuration/recovery, audio fakes, language, scoring and public-doc checks (15 unit files) | 167 | 7.17 s |
| Recognition/framing and barge-in controller (3 integration files) | 26 | 0.41 s |
| Voice stream lifecycle | 24 | 1.30 s |
| Generation terminality, V-A faults and diagnostic conversation (3 files) | 36 | 11.16 s |
| Paced bilingual sequence, STT failure → typed recovery → voice re-entry | 1 | 9.69 s |
| Composed core experience / shutdown | 1 | 15.07 s |
| Same-store English → Spanish restart and fresh ownership | 1 | 30.04 s |

The 15-file unit batch includes the 15 documentation/vector and 6 offline-scoring
checks; earlier focused passes are subsets, not additional distinct tests.
Two final limit/recovery cases confirm exact PCM capacity, rejection without buffer
growth, failed-response buffer retirement and a fresh utterance surviving an old
cancellation. These protect existing bounds; they are not newly discovered defects.
**71 frontend protocol/client/reducer/presence/status tests pass** in one worker,
without a browser (1.51 s). No production frontend source changed, so no rebuild
is needed. File-only asset provenance is checked separately at final closure.

The first composed batch hit its 30-second process bound after eight failures in
old stream fixtures lacking the required `context`. Smaller reproduction exposed
that mismatch; `StrictStream` now carries the actual admitted context. One old
assertion also treated a polling result as authoritative final evidence. It now
checks that polling cannot shorten the endpoint, explicit finalization occurs
once, and no later frame enters its terminal stream. A repaired aggregate still
exceeded its 20-second bound, and a framing/core grouping exceeded 15 seconds.
Neither incomplete run is a pass. Subsequent isolated batches above all complete;
the core scenario's paced capture takes ~15 seconds per language, so its two-language
case uses a 40-second outer process bound. No runtime/provider timeout was raised.

All checks are sequential, low-priority, CPU-only, with bounded temporary output.
Audio adapters use in-memory streams, transport uses mocks or isolated loopback
fake-core connections, and synthesis subprocess fixtures generate synthetic bytes
only. No full Sam/supervisor, real recognizer, model/provider, device, real TTS,
browser, graphical session or download has run. Ruff and the final focused matrix
repetition are recorded with closure below; this is not a full-suite result.

## Historical reference re-score — not a new recognition run

[`rescore_speech_baseline.py`](../scripts/rescore_speech_baseline.py) reads the
existing approved, generated-corpus reports and exports only aggregate counts and
input SHA256s. [Committed audit](evidence/speech-vb/offline-baseline-rescore.json)
recomputes 36 historical decoder conditions and four paced sequence reference/text
pairs with NFC/casefold word edit distance, accents retained, and CER including
normalized spaces. Cached metric mismatches: **zero**.

| Historical mode | Word edits / reference words | WER | Character edits / reference characters | CER |
| --- | --- | --- | --- | --- |
| English forced and auto, separately (9 cases each) | 7 / 88 | 7.9545% | 30 / 449 | 6.6815% |
| Spanish forced and auto, separately (9 cases each) | 7 / 80 | 8.7500% | 23 / 434 | 5.2995% |
| Paced Spanish sequence (2 pairs) | 0 / 17 | 0% | 0 / 90 | 0% |
| Paced English sequence (2 pairs) | 0 / 22 | 0% | 0 / 112 | 0% |

Reproduce using `python -m scripts.rescore_speech_baseline --output PATH` with the
two retained ignored `.sam` reports. Their transcripts are generated/non-personal;
they and raw PCM are not added to the public evidence. Original PCM was not retained,
so there is no new decoding, V-B accuracy comparison or latency measurement.
Pipeline-only historical rows lack references and are not independently rescored.

## Classification and remaining gates

| Item | Disposition |
| --- | --- |
| Stream sealing, PCM retirement, stale/cancelled/foreign results, provisional polls | Fixed in source and deterministically verified |
| Locale normalization / explicit en/es and legitimate auto fallback | Implemented and verified at configuration, context and multipart boundaries; no dialect claim |
| Historical generated-corpus scores | Re-audited, unchanged; original recognizer evidence remains historical |
| Owner's poor natural bilingual recognition / mixed-language utterances | Credible unresolved symptom; cause not attributed or closed |
| Slow recognizer + physical capture overflow, real latency and natural endpoint behavior | Requires separately authorized runtime/device or retained-audio evidence |
| Echo / human-origin discrimination / prompt interruption | Existing unmet acoustic requirement; no AEC integration or engine replacement |
| Connected skin / public SVG appearance | No renderer changes; graphical/owner acceptance remains open |

Existing content-free `stt.final`, candidate and ownership diagnostics already
distinguish finalization wait from capture and delivery; no duplicate telemetry
subsystem is added. No cloud/audio export boundary, TurnManager authority, model
routing, provider/resource ownership, dependency or release-version change.

## Source-level closure and recovery commits

- Ruff format/check pass for all 15 changed/new Python files. Source review covers
  selector imports/normalization, immutable context, CPU-only duration accounting,
  token checks after awaits, stream seal/cache/error paths and callback/resource
  cleanup. No extra task, lock, unbounded queue or new recognizer engine is introduced.
- The final 36-case adapter/utterance matrix passes three consecutive runs
  (0.54 / 0.69 / 0.64 seconds). These are repeated subsets of the 256-test union.
- SVG `--check` and local link/vector checks pass. Static asset verification matches
  all 65 frontend source inputs and the existing manifest/JS/CSS; no build or shader
  execution. [Public documentation evidence](PUBLIC_DOCUMENTATION_VB.md) records
  exact provenance and the future docs-only publication plan.
- `2ddab329ef3491dd31c2e9d56bdec6c9f8ba4966`: recognition foundation, initial faults
  and configuration/context contracts.
- `2c44bc7c3c1f359e3086c69c77a46ae1b9c67394`: public guides, original editable SVGs,
  file-only checks and aggregate historical transcript audit.
- The following source-hardening/closure commit records safe metadata, composed
  fixture corrections, final tests and reconciled current records. No release,
  version, dependency, remote state or visual-engine source change.

Next independently useful occupied-PC scope is bounded recognition/transport
deadline and trace-replay fixtures using the existing content-free events. It is
a recommendation, not another task started here. Future v0.2.6 gates still include
authorized real-recognizer/representative speech evidence, actual provider/cold-start
correlation, physical delivery/interruption timing, graphical/shader/cost checks,
owner acceptance and any separately governed package/release requirements.
