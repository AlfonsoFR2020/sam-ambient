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

Final adjacent regression counts, historical benchmark re-scoring and remaining
acceptance gates will be added at closure. No real recognizer, audio hardware,
inference, browser, graphical session or model download has run.
