# Sam 0.2.2 static reliability audit

Date: 2026-09-17

Branch audited: `dev` after the published 0.2.1 checkpoint

Method: static source, configuration, test, and documentation inspection only

This document records the alpha findings that should guide the next small 0.2.x
releases. It does not claim that the observed missing Gemma response has been
reproduced, and it does not make any of the proposed behavior changes.

## 1. Executive findings

The strongest code-supported explanation for a request that logs
`model_request_start`, never logs `first_model_output`, and is followed by a new
turn is silent generation supersession. A new text turn immediately changes the
active generation before the old task handles cancellation. The old task then
suppresses its own `model.cancelled` event because it is no longer active. The
same generation gate suppresses late errors. This is a confirmed lifecycle
defect, but the available static evidence cannot prove that it caused the exact
0.2.1 Gemma incident.

A second confirmed defect is that a syntactically complete OpenAI-compatible
stream may contain no usable text. Role-only chunks, empty content, and a finish
reason are accepted as a successful empty response. The runtime records and
publishes completion with an empty string, while the React reducer deliberately
ignores blank transcript text. The result is another valid path to no visible
answer.

The provider has a 120 second HTTPX timeout, but no explicit first-token or
end-to-end generation deadline. SSE comments or other non-content traffic can
keep a read alive while Sam remains in THINKING. If a new turn supersedes that
wait, the first defect removes the visible cancellation boundary.

Conversation persistence and conversation presentation currently have different
truths. SQLite retains the durable session and committed messages for model
context, but `system.ready` sends only `recovered_message_count`; React receives
no recovered messages. A restarted UI can therefore show an empty transcript
while the model continues with old context.

Language selection is intentionally hysteretic but insufficiently explicit.
Whisper's detected language, the language used for the forced decode, the last
confident language, response-language inference, and TTS language are separate
concepts, yet the transcript/protocol carries none of their provenance.

The post-0.2 visual controls are mostly wired. Current alpha gaps are a mixture
of conservative defaults, low automatic budgets, limited current geometry and
feature inputs, and uncompleted human art-direction acceptance. The richer
audio-reactive design can be added through the existing input/evaluator/uniform
pipeline without replacing the renderer.

## 2. End-to-end architecture and ownership

### 2.1 Voice path

```text
physical input
  -> CaptureAdapter owns AudioFrame production and stream teardown
  -> VoiceInputPipeline owns pre-roll, VAD evidence, STT candidate lifetime,
     endpoint timing, and finalization
  -> WhisperCppServerSTT owns transcription requests, detected-language scores,
     low-confidence retry selection, and its in-memory last confident language
  -> TurnManager owns authoritative voice state and turn/cancellation correlation
  -> SamRuntime._start_voice_turn creates the generation and starts _run_turn
  -> SQLite commits the user message before model selection/request
  -> ProviderRouter owns privacy-policy candidate selection and health gating
  -> OpenAICompatibleProvider owns the LM Studio request and SSE interpretation
  -> SamRuntime owns tool rounds, generation validity, accumulated model text,
     delivery order, assistant persistence, and terminal protocol publication
  -> EventBus and WebSocket bridge own bounded event delivery to each client
  -> React reducer owns current client correlation and visible transcript state
  -> SpeechQueue/TTS adapter own synthesis/playback and spoken-text accounting
```

`TurnManager` is authoritative for voice states such as LISTENING, COMMITTING,
THINKING, SPEAKING, interruption candidates, and IDLE. `SamRuntime` is separately
authoritative for the active generation ID and cancellation token. The delivery
ledger owns generated-versus-spoken response accounting. These authorities are
related by IDs but are not one atomic lifecycle.

During a response, `_monitor_barge_in` opens a second capture/STT candidate. A
credible finalized candidate can commit a new voice turn. The voice loop waits
for the old response task to unwind, then calls `_start_voice_turn` with the new
turn identity and candidate token. Playback interruption has stronger transcript
confirmation than thinking-state interruption; this distinction must remain.

### 2.2 Text path

```text
React form
  -> control.user_message.submit
  -> ControlDispatcher validates ownership and deduplicates command IDs
  -> SamRuntime.submit_user_message cancels any active token
  -> new turn/generation/cancellation IDs become active immediately
  -> _run_turn commits user text, publishes user transcript + THINKING,
     selects model, builds context, and starts provider streaming
```

The text path has no `TurnManager` commit phase. `SamRuntime` is the turn and
generation owner from submission onward.

### 2.3 Model, persistence, protocol, UI, and TTS path

```text
_run_turn
  -> commit user text to SQLite
  -> select model and load at most 12 prior messages / 6000 characters
  -> log model_request_start
  -> ProviderRouter health-checks each candidate
  -> POST /chat/completions with stream=true
  -> SSE data chunks become TEXT_DELTA and TOOL_CALL events
  -> first TEXT_DELTA logs first_model_output and publishes model.delta
  -> tool calls execute in bounded rounds
  -> stream completion becomes model.completed
  -> _deliver_assistant performs TTS lifecycle and playback
  -> commit full assistant text to SQLite
  -> publish assistant transcript.final
```

Important ordering consequences:

- User text is durable before the model request, so cancellation or failure can
  leave an unmatched user message in future context.
- Model deltas are visible but provisional. `model.completed` does not itself
  commit visible transcript text.
- Full assistant text is persisted and finalized to the UI only after TTS
  delivery returns. A TTS failure or cancellation can therefore separate
  generated text, visible provisional text, spoken text, and durable text.
- Lossless protocol events apply backpressure at a per-subscriber queue of 64.
  Only `voice.level` and `tts.level` are lossy/coalesced.
- React rejects stale model, TTS, tool, and assistant-final events by generation.
  That protects the current turn, but it also means the runtime must publish an
  old generation's terminal status before changing client correlation.

## 3. Missing Gemma response: ranked static failure modes

The ranking below separates code evidence from incident attribution.

### 1. Silent supersession of a pending generation - high confidence defect

`submit_user_message` cancels the old token and then immediately assigns the new
active generation. When the old `_run_turn` catches cancellation, it publishes
`model.cancelled` only if it is still active. `_publish_generation` independently
drops every event for a non-active generation. A late provider error is dropped
for the same reason.

This exactly permits:

```text
old generation: model_request_start
new user/voice turn: replace active generation and cancel old token
old generation: cancellation handler sees itself as stale and emits nothing
UI: moves directly to the new turn with no terminal explanation for the old one
```

This is the best static match for the observed sequence, provided another turn
actually superseded the pending request. Runtime timing evidence is still needed
to establish that final condition.

### 2. Successful but empty provider stream - high confidence defect

The adapter ignores role-only chunks and empty content, and accepts either a
non-null `finish_reason` or `[DONE]` as completion. The runtime does not require
any text or tool call before accepting completion. It publishes an empty
completion, attempts empty delivery, and persists/publishes an empty assistant
message. The reducer rejects blank transcript text, yielding no visible answer.

An OpenAI-compatible extension that places useful output in an unsupported field
(for example a reasoning-specific field) would look empty to this adapter. There
is no evidence yet that LM Studio's Gemma stream did so.

### 3. Unbounded-to-the-user first-token wait - medium/high confidence risk

The router performs another `/models` health check before each request. Discovery
has a 10 second timeout and streaming uses an HTTPX 120 second timeout. That
timeout bounds individual HTTP operations/read inactivity, not an explicit total
generation or first-content interval. Comment/keepalive lines are ignored but can
keep the transport active. Sam emits no progress phase between
`model_request_start` and the first text/tool event.

This can explain a long THINKING state. Combined with cause 1, it can explain why
the wait ends without a visible cancellation or error.

### 4. Tool-only or malformed tool response - medium/low confidence

Tool events do not set `first_model_output`. A model can therefore enter tool
execution or approval without that timing marker. Tool activity should normally
be visible, bounded, and correlated, while malformed/excessive tool behavior
should become a current-generation component error. Always sending tool schemas
may expose model-specific compatibility differences, but a normal HTTP/API error
alone should have been visible unless superseded.

### 5. Provider/transport error after supersession - medium confidence

Current-generation status, timeout, transport, decode, and premature-end errors
flow to the runtime's exception handler and should produce `component.error`.
Errors arriving after a replacement generation are silently filtered by the
same active-generation gate as cancellation. This is a consequence of cause 1,
not a separate primary defect.

### 6. Event delivery backpressure - low confidence for this incident

A stalled WebSocket subscriber can block publication of lossless events. However,
`first_model_output` is logged before `model.delta` is published, so backpressure
cannot explain the absence of that log once a text delta has arrived. It remains
a lifecycle risk for completion and UI delivery after the first delta.

### 7. Context growth - low confidence for this incident

Context is bounded to 12 stored messages and 6000 characters, so unbounded session
growth is not present. Orphan user messages from cancelled generations do remain
eligible for later context and may degrade answer coherence, but do not directly
explain a missing first token.

## 4. Language authority audit

### 4.1 Current authorities

| Concept | Current owner | Lifetime / propagation |
| --- | --- | --- |
| Configured STT language | `RuntimeConfig.language` | Passed to each voice stream; commonly `auto`. |
| Detected language | Whisper server `language_probabilities` | Used inside one auto transcription; not retained in `Transcript`. |
| Selected decode language | `WhisperCppServerSTT.transcribe` | Detected language if confident; otherwise last confident language or highest preferred score, followed by a forced retry. |
| Previous confident language | STT adapter `_recent_language` | In-memory across turns for the adapter lifetime; forced retries do not update it. |
| Transcript confidence | `Transcript.confidence` | Decode confidence when supplied; otherwise callers often substitute 0.5. It is not language probability. |
| Assistant response language | `response_language` | Deterministic text inference for at least 20 letters and score at least 0.8. |
| TTS language | `_metered_tts_frames` | Response inference over fallback: last response language, then overridden by STT confirmed language when present. |
| Displayed language | none | UI displays text only; language evidence is absent from protocol and persistence. |

`STT language=en probability=0.49 selected=es` is an intentional possible result
of the low-confidence policy, not proof of a bug. With default preferred languages
`en` and `es`, a highest score of `en` would normally select `en` unless
`_recent_language` already held `es`. The log therefore means the current evidence
was weak and the prior confident language won. The policy is defensible
hysteresis, but its authority and duration are too implicit for diagnostics.

### 4.2 Drift paths

- `_recent_language` persists across unrelated turns until another confident auto
  detection replaces it or the adapter is recreated.
- A low-confidence turn is decoded in the old language but does not record why in
  the committed transcript or protocol.
- TTS gives STT's last confident language precedence over `_response_language` as
  the fallback, even when the current assistant response is short or ambiguous.
- `_response_language` updates only when the TTS synthesis path runs. Muted or
  unavailable TTS leaves it stale.
- Session storage preserves text but no turn-language evidence, so restart and
  in-process continuity have different language memory.

### 4.3 Proposed authority hierarchy

1. An explicit non-`auto` configured language is authoritative for STT decoding.
2. Auto STT produces immutable per-turn evidence: detected language and score,
   selected decode language, selection reason, and prior confirmed language.
3. The selected decode language labels the current user turn. Conversation-level
   language updates only through a documented confidence/hysteresis rule.
4. The assistant's full committed response determines assistant language when
   evidence is sufficient; short/ambiguous output uses current turn language,
   then confirmed conversation language, then configured default.
5. TTS uses assistant response language first and never mutates STT authority.
6. UI text is never silently translated. Optional diagnostics may expose the
   evidence and selection reason.
7. Transcript confidence and language probability remain separate typed fields.

## 5. Transcript, textbox, and session reliability

### Confirmed core/runtime issues

- User text is committed before model success. Failed/cancelled turns can become
  context without a paired assistant response or explicit durable terminal state.
- Assistant text is committed only after TTS delivery. Text generation and audio
  delivery are therefore coupled more tightly than transcript reliability needs.
- Old-generation cancellation and errors can be suppressed during supersession.
- The durable session ID is reused indefinitely. There is no explicit user-facing
  distinction between resume, reconnect, UI reload, and a new conversation.
- `system.ready` sends a recovery count but not recovered transcript entries.

### Confirmed UI/reducer issues

- A page reload starts with an empty transcript even though SQLite and model
  context resume. This explains transcript disappearance without data loss.
- `model.cancelled` has no reducer branch. Provisional assistant text is not
  explicitly finalized, marked interrupted, or cleared by model cancellation.
- `tts.cancelled` mutates only the last committed assistant entry. It does not
  reconcile a provisional assistant response.
- `model.completed` does not finalize visible assistant text; only
  `transcript.final` does, and that arrives after TTS.
- A new `system.ready` session reset clears correlation and provisional text but
  does not explicitly clear the committed transcript array. This can retain old
  visible entries if the client receives a different session without a full page
  state reset.
- Transcript auto-follow is implemented and stops following when the user scrolls
  away from the bottom. The basic scrolling algorithm is not the disappearance
  cause.
- UI history is capped at 100 entries, storage at its configured bound, and model
  context at 12 messages/6000 characters. These differing windows are currently
  not explained to the user.

### Textbox path assessment

Text submission is owner-controlled, bounded to 4000 characters, and command IDs
are deduplicated. The major reliability problem begins after accepted submission:
the input is cleared by the UI command path while the response lifecycle can end
silently. The textbox itself is not the primary source of the missing answer.

## 6. Post-0.2 visual and UI gap classification

| Alpha finding | Classification | Static assessment |
| --- | --- | --- |
| Peels thin, unnatural, not icon-like | 1 + 2 + 5 | Width/lift are wired and materially above the earlier baseline, but fragments remain simple narrow seeded strips with one carrier treatment. Further tuning may help; a stronger silhouette and layered hierarchy need bounded renderer/art-direction work. |
| Too few or poorly perceived layers | 1 + 5 | Budgets are 6/11/16 peels. Auto starts at low except explicit desktop/high-end profiles, so six peels are common. Opacity, occlusion, and similarity reduce perceived layering. |
| Particles effectively invisible | 1 + 2 + 5 | Density reaches the shader; 12/24/40 seeded points are genuinely gold and orbit at radius 1.1-1.4. Small point size, front/occlusion fading, low default density, and sparse low quality can make them imperceptible. Point sprites also limit richness. |
| Audio reactivity barely perceptible | 1 + 3 | RMS/peak/activity and TTS envelope are wired, but deformation/lift/ripple ranges are deliberately subtle. Band, shape, and richer transient fields exist in visual types but are not populated by the current UI/runtime path. |
| Sphere too simple | 2 + 5 | The shader uses a small fixed analytic deformation/lighting vocabulary. This is a capability/art-direction gap, not failed settings wiring. |
| Controls too tall/narrow | 4 | A 390 px panel stacks every group, and most visual settings span both columns. The complaint follows directly from layout and information architecture. |
| Scrollbar inconsistent | 4 + 5 | Transcript has only generic `scrollbar-color`; Controls has no matching scrollbar treatment. Platform rendering will differ. |
| Popup off-center | 4 | The quit/restart dialog explicitly uses a large top margin instead of viewport centering. Static CSS supports the report. |
| Settings need tabs/groups | 4 | Semantic groups exist, but all are rendered in one long scrolling panel with no navigation or disclosure hierarchy. |

The audio-reactive roadmap can remain incremental:

1. Add a bounded extractor and typed feature snapshot at the existing PCM boundary.
2. Transport newest-value-only compact features; never raw PCM or an accumulating queue.
3. Populate `VisualInput` fields and retain current expiry/interpolation semantics.
4. Add one mapping family at a time through `MotionEvaluator` and existing uniforms.
5. Extend analytic shader modes only where a mapping cannot use current uniforms.
6. Preserve four draws, fixed quality budgets, reduced-motion/static/Canvas paths,
   bounded DPR/FPS, deterministic seeds, and no per-frame React state/allocation.

## 7. Proposed patch release sequence

### 0.2.2 - model response lifecycle and visible terminality

**Scope:** Make every accepted turn reach exactly one user-observable terminal
outcome: completed response, explicit cancellation/supersession, or actionable
error. Reject successful empty model responses. Add explicit first-content and
overall lifecycle bounds without weakening cancellation.

**Likely code:** `runtime.py`, OpenAI-compatible provider/HTTP timeout policy,
protocol event payloads if a terminal reason is needed, React reducer/status, and
focused runtime/provider/reducer tests.

**Preserve:** stale-generation rejection; one active generation; interruption
confirmation; local-first routing; bounded tool rounds; cancellation identity;
text-mode availability; no fabricated model text.

**Deterministic tests:** pending stream superseded by text turn; pending stream
superseded by confirmed voice turn; cancellation terminal published before owner
replacement; late stale chunks rejected; role-only/empty completed stream fails;
first-content timeout; total timeout despite keepalives; current-generation error
visible; exactly one terminal event per accepted turn.

**Minimal human acceptance:** one normal Gemma response, one deliberately slow or
cancelled response, and one immediate follow-up turn. Verify visible status and no
cross-turn text. No broad acoustic acceptance.

**Do not bundle:** language policy, transcript history UI, visual work, dependency
upgrades, model prompt tuning, or STT threshold changes.

**Implementation model / cost:** Sol High; high relative quota because lifecycle
ordering and cancellation correctness deserve careful concurrency review.

### 0.2.3 - transcript commitment, interruption, and session resume semantics

**Scope:** Decouple text commitment from TTS success, define durable terminal turn
records, hydrate bounded visible history, and make reload/reconnect/new-session
behavior explicit. Reconcile provisional text on completion/cancellation.

**Likely code:** runtime delivery ordering, SQLite schema/accessors and migration,
ready/history protocol, WebSocket snapshot, React reducer/transcript component,
storage/runtime/UI tests.

**Preserve:** generated-versus-spoken distinction; stale-event filtering; bounded
storage and payloads; privacy boundaries; interrupted spoken-text accounting.

**Deterministic tests:** generated text survives TTS failure; interrupted response
stores the intended durable form; reconnect hydrates bounded ordered history;
new conversation clears both core and UI by explicit action; reload resumes the
same session consistently; orphan user turn has a visible terminal record.

**Minimal human acceptance:** reload during idle, reconnect after one completed
turn, and interrupt one spoken response. Confirm the same history is visible and
the model context matches it.

**Do not bundle:** language authority, settings redesign, visual tuning, or model
provider changes beyond interfaces required by 0.2.2.

**Implementation model / cost:** Sol High; medium/high relative quota due schema,
protocol, and reducer compatibility.

### 0.2.4 - explicit multilingual authority

**Scope:** Introduce typed per-turn language evidence and the hierarchy in section
4.3. Keep diagnostics observable without turning visual or voice heuristics into
semantic authority.

**Likely code:** Whisper adapter, voice transcript models, runtime TTS selection,
protocol payload/schema, optional diagnostic UI, configuration docs, and language
tests.

**Preserve:** deterministic detection; low-confidence protection; short utterance
support; no extra STT endpoint tuning; text mode; local audio/privacy boundaries.

**Deterministic tests:** confident switch; low-confidence hold with reason;
configured-language override; forced retry does not become evidence; short
assistant response inherits current turn; muted TTS does not create stale
authority; restart policy is explicit.

**Minimal human acceptance:** a small English/Spanish matrix including a language
switch, ambiguous short phrase, and muted TTS. Inspect diagnostic selections and
voice choice, not transcription quality broadly.

**Do not bundle:** noise hallucination filtering, transcript redesign, model
response lifecycle, or audio-reactive visuals.

**Implementation model / cost:** Sol High; medium relative quota.

### 0.2.5 - controls and window layout cleanup

**Scope:** Replace the single tall stack with accessible tabs or compact grouped
navigation, center modal surfaces, and give transcript/controls scrollbars one
coherent treatment.

**Likely code:** `App.tsx`, `QuitDialog.tsx`, `styles.css`, local preferences only
if panel state should persist, tooltip/layout tests, and responsive UI tests.

**Preserve:** keyboard escape hierarchy; focus return/trap behavior; tooltip
containment; all existing controls; mobile sizing; visual-engine free rectangle.

**Deterministic tests:** tab/group keyboard navigation; focus ownership; modal
centering constraints; narrow/short viewport containment; no control loss; panel
does not overlap required status/transcript bounds.

**Minimal human acceptance:** desktop plus one narrow and one short window, using
keyboard and mouse. No model/audio session is required.

**Do not bundle:** new settings, visual parameters, voice behavior, or renderer
changes.

**Implementation model / cost:** Sol Medium; low/medium relative quota.

### 0.2.6 - current-renderer visual legibility pass

**Scope:** Improve peel silhouette/layer readability, particle perception, and
sphere material depth using the existing input contract, geometry budgets, and
draw calls. Revisit Auto/profile defaults only with deterministic budget evidence.

**Likely code:** visual geometry, motion defaults, WebGL shaders/uniforms, quality
resolution, visual settings defaults, and deterministic renderer tests.

**Preserve:** all Visual Engine bounds; `mobile_2020`; at most four draws; fixed
particle/peel budgets; reduced motion; Canvas/static fallbacks; anti-strobe limits.

**Deterministic tests:** maximum extents; deterministic seeds; quality counts;
particle visibility at representative densities; profile caps; shader uniform
bounds; lifecycle/resource disposal.

**Minimal human acceptance:** static and moving fixtures at low/medium/high on one
desktop and representative mobile-sized viewport. Audio is not required.

**Do not bundle:** new audio feature extraction, controls IA, voice reliability,
post-processing, dynamic meshes, or new renderer dependencies.

**Implementation model / cost:** Sol High; medium relative quota, with human visual
acceptance as the limiting gate.

### 0.2.7 - compact audio feature contract and diagnostics fixtures

**Scope:** Implement only the bounded extractor/transport contract from the future
design: independent input/output envelopes, small bands, transient/flux candidate,
flatness candidate if justified, and compact shape coefficients. Establish
fixtures before visible mapping expansion.

**Likely code:** existing PCM boundary, typed protocol/snapshot models, newest-value
transport, visual input adapter, deterministic synthetic fixtures, documentation.

**Preserve:** no second microphone; no raw PCM persistence or React transport; no
unbounded queue; 20-40 Hz feature cadence; stale packet rejection; text mode;
mobile CPU and allocation bounds.

**Deterministic tests:** silence, tones, speech-like bands, impulse, flat noise,
keyboard-like noise, duplex, stale output after cancellation, and frozen nonzero
features. Prove queue-size-one and decay-to-baseline behavior.

**Minimal human acceptance:** none until deterministic integration is stable; a
later diagnostic fixture review is sufficient.

**Do not bundle:** broad shader redesign, emotion inference, MFCC/pitch pipelines,
settings UI, or multiple mapping families.

**Implementation model / cost:** Sol High for implementation with a prior Astra
high-reasoning design review if available; high relative quota.

### 0.2.8 and later - one audio-reactive mapping family per patch

Start with coordinated mid/envelope peel behavior, then surface modes, then
particle/lighting diagnostics, and finally user-facing coarse controls. Each patch
must preserve phase continuity, silence decay, input/output observability, shader
cost, and fallback behavior. Do not land a grab-bag mapping release.

**Implementation model / cost:** Sol High for shader/motion work; medium per slice.

## 8. Highest-risk unknowns requiring runtime evidence

1. The exact LM Studio SSE payload sequence for `google/gemma-4-e2b`, including
   role-only, reasoning-specific, empty, keepalive, finish, and usage chunks.
2. Whether the observed second turn actually cancelled the pending generation,
   and whether it came from intentional input, noise-held voice capture, or UI
   submission. Correlated timestamps and generation IDs are required.
3. Whether the server produced no bytes, keepalives only, malformed data, a tool
   call, or content that Sam ignored. Current logs do not distinguish these phases.
4. Whether the transcript disappearance involved a page reload, WebSocket
   reconnect, core restart, explicit new session, or interruption. These have
   different current behaviors but insufficient user-visible diagnostics.
5. Real visual salience across actual DPR, display, WebGL driver, and window size.
   Static inspection can classify the path but cannot settle art-direction quality.
6. Real multilingual acoustic behavior and TTS voice quality. The proposed
   authority can be deterministic, but threshold acceptance needs controlled audio.

Any later evidence capture should be narrow: correlated lifecycle logs and a
sanitized mockable stream fixture first, then the minimum live LM Studio check.
Do not begin with broad model, acoustic, or visual sessions.

## 9. Recommended first implementation task

Implement 0.2.2 as one focused lifecycle patch. Begin with deterministic tests
that freeze a provider stream before its first text event, submit a replacement
turn, and assert that the old generation publishes exactly one terminal
supersession before the new generation becomes authoritative. Add an empty
completed-stream fixture and a keepalive-only first-content timeout fixture in the
same test layer. Only then change runtime/provider behavior.

The design decision to settle first is the terminal-event handoff: either publish
the old terminal event before replacing `_active_generation_id`, or introduce a
small generation registry that permits terminal events for the immediately
superseded owner while still rejecting all stale content/tool/TTS events. The
second option is more explicit but should remain narrowly bounded. In either
case, a successful provider round must produce text or a valid tool call, and
every accepted turn must end in completed, cancelled/superseded, or error.

## 10. Static evidence index

- Generation replacement and lifecycle: `src/sam_ambient/runtime.py:720-992`,
  `src/sam_ambient/runtime.py:1261-1601`
- Provider/router/transport: `src/sam_ambient/core/providers/router.py:99-146`,
  `src/sam_ambient/adapters/openai_compatible/provider.py:83-154`,
  `src/sam_ambient/adapters/http.py:60-175`
- Event backpressure: `src/sam_ambient/core/protocol/bus.py:16-127`
- Persistence/session recovery: `src/sam_ambient/core/storage/sqlite.py:194-257`,
  `src/sam_ambient/runtime.py:994-1009`, `src/sam_ambient/runtime.py:1680-1719`
- Language selection: `src/sam_ambient/adapters/stt/whisper_cpp.py:251-307`,
  `src/sam_ambient/core/voice/language.py:17-34`,
  `src/sam_ambient/runtime.py:1110-1153`
- React correlation/transcript: `ui/src/state/reducer.ts:27-36`,
  `ui/src/state/reducer.ts:257-389`, `ui/src/state/reducer.ts:490-554`,
  `ui/src/App.tsx:51-88`
- Visual implementation: `ui/src/visual-engine/input.ts:90-199`,
  `ui/src/visual-engine/motion.ts:330-465`,
  `ui/src/visual-engine/geometry.ts:27-142`,
  `ui/src/visual-engine/quality.ts:20-100`,
  `ui/src/visual-engine/webgl.ts:84-184`, `ui/src/visual-engine/webgl.ts:526-602`
- Window layout: `ui/src/styles.css:14-24`, `ui/src/styles.css:386-655`,
  `ui/src/styles.css:767-835`
