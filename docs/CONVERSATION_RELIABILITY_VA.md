# Conversation responsiveness and deterministic reliability — V-A

Date: 2026-10-22. Local occupied-PC engineering; no new release or human acceptance.
Starting `dev`: `bfdd7175e238c4a9e5904c1222ef8d18318de5d6`, clean,
12 commits ahead of cached `origin/dev`; no fetch. Published v0.2.5 remains
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.

## Scope and evidence boundary

HQ4 authorizes sequential, low-priority CPU-only fake-service tests, focused
static checks, local implementation/commits and one necessary frontend build.
No Sam, provider/model, browser, GPU, microphone, speaker, real TTS, external network or
packaging is run. IV-B/IV-C remain graphically unverified. October 21's owner
judgment concerns released v0.2.5 assets, not the current compiled parent skin.

The October 9/21 apparent deafness and long typed-response waits remain
unattributed real-session symptoms. The reproducible failures below demonstrate
specific defects, not their occurrence or relative cost in that owner session.

## Critical path and existing protections

| Boundary | Actual authority / observable evidence | Interpretation |
| --- | --- | --- |
| Typed submission | `ProtocolClient.sendControl`, socket epoch, local pending command | Sending is local pending commitment, not an accepted model request |
| Authenticated admission | Owner connection and `ControlDispatcher` deduplication/lock | ACK admits the command; it does not prove commitment, model readiness or completion |
| Turn ownership | `SamRuntime.submit_user_message`, generation/cancellation IDs and frozen `CommittedInferenceTarget` | Snapshot the exact provider/router/model for that turn; no implicit substitution |
| User commitment | Core `turn.committed` or typed `transcript.final` with command correlation | Only committed user text enters history; voice candidates remain separate |
| Preparation and dispatch | Captured route eligibility, optional inventory, history/context, router health preflight | Desired/loading is not Active; command, commitment and inference waits remain distinct |
| Provider transport | Request, headers, first nonempty line, useful token, stream close | SSE metadata is not a useful first token; server/transport wait is not internal queue time |
| Committed answer | Once-only generation terminal and assistant transcript | Partial output followed by failure is not a completed answer |
| Optional speech | Separate delivery ledger, synthesis, accepted writes, drain/retirement | Voice failure preserves completed text; accepted PCM writes are not acoustic timestamps |
| Cancellation/recovery | Runtime owner identity, token/task cancellation, `response_done`, late-event guards | Logical retirement can precede physical adapter cleanup; stale cleanup cannot own a newer turn |

Existing tests already protect cold inventory outcome classification and bounded
retries, installed versus callable identities, exact route switching, cloud/privacy
boundaries, useful-content deadlines, empty streams, successive supersession,
voice-delivery failures with committed text, playback identity and shutdown grace.
These are implemented protections, not newly discovered defects or acceptance of
real startup/device behavior.

## Reproduced frontend defects and correction

The initial eight in-memory fault cases all failed against the starting source.
They establish:

- A precommit failure/cancellation for a newer typed command could be rejected as
  stale relative to the displayed old generation, leaving `pendingUserMessageId`
  alive after its command/ACK timer had retired.
- A foreign-session ACK could cancel a current command's timeout before the
  reducer rejected that session.
- Reordered same-session ACKs could remove timers while leaving obsolete pending
  command IDs. Correlated commitment also needs to retire ACK waiting.
- Previous speech/error presentation took priority over a fresh typed submission.

The client now validates session identity before side effects, retires correlated
command bookkeeping independently of stale conversation projection, and clears
only the matching typed wait on commitment, rejection or terminal failure. ACK
alone still means admission. A discarded precommit terminal exposes a bounded
retry/cancellation message without replacing the old committed conversation.
The existing IV-C presence projection shows the new Sending state before old
speech/error; connection and shutdown facts retain precedence.

`ui/tests/fixtures/conversation-faults.ts` provides a bounded virtual scheduler and
in-memory protocol transport. Ten cases cover both ACK orders, known failure,
commit-before-ACK, reordered ACKs, old/new request ownership and socket replacement.
The focused client/reducer/presence/fault batch passes **67 tests**, with TypeScript
project checking and focused Biome checking successful. No UI render is inferred.

## Reproduced core defects and correction

Five original Python cases fail before correction: explicit Stop at inventory,
health and streaming gates retains the active owner; canceled late inventory can
install a model; canceled late health can dispatch inference. Explicit Stop now
cancels the captured owner token/running task, retires its once-only terminal and
speech queue, sets `response_done` and releases only that generation. A matching
TurnManager inference returns to IDLE and disposes its candidate. Post-await token
checks prevent model installation/dispatch. Stop speaking remains delivery-only.

A further fake-capture regression proves that the typed monitor's final task join
retained microphone monitoring after logical Stop. It now follows `response_done`,
including terminal capture-error cleanup. This tests ownership handoff without
opening a microphone; physical capture/driver behavior remains unverified.

Final review reproduces four additional failures when Stop arrives after completed
text but before TTS preparation. Stop speaking could miss this pending delivery;
Emergency Stop could leave a voice-managed response in THINKING. Include pending
delivery in the existing stop path, retire the completed response's delivery owner
and emit one `tts.cancelled` without replacing `model.completed` or the answer.
TurnManager settles pending delivery to IDLE. A token check before TTS prevents
late post-model unwind from resurrecting speech or reporting a false synthesis
failure. Stop speaking still cannot cancel live inference. Fake voice on/off and
both Stop controls preserve the completed answer with zero output frames.

An unbounded discovery join reproduced a real dispatcher/owner-cleanup block.
The first reproduction reached its 10-second outer watchdog and was stopped;
the fixture now uses an independently bounded task snapshot so its own timeout
cannot join the adapter being tested. Rescan/disconnect give cancellation 250 ms
grace. If still retiring, publish a correlated failure, retain selected identity,
fence unconfirmed readiness and reject another model operation. The old task stays
tracked; no overlapping external loads or implicit route changes. Once it unwinds,
only its distinct late provider is closed; fresh Rescan confirms recovery.
Epoch checks also reject late discovery exceptions. Retirement callbacks are
registered once per model operation and cannot clear a newer operation's flag.

The reusable `tests/fixtures/conversation_faults.py` gates first inventory/health/
stream work while later requests remain independent. Nineteen integrated cases
cover the three Stop stages with/without fake voice, Stop before commitment,
delivery-only Stop speaking, partial network failure and typed recovery, late
inventory/health, and noncooperative Rescan/disconnect with late results or errors.
Four cases specifically cover completed-text-to-delivery cancellation.
Existing adjacent matrices
cover exact routing, failed/empty/timed-out cold discovery, desired versus callable,
delayed useful output, supersession, stale terminals and failed delivery with text.

## Diagnostic addition and limits

The source path performs JSON health/inventory before streaming, but only streaming
had request/header/close records. Three `provider.json_*` records now separate
preflight headers and body/decode from streaming admission. Existing context and a
hashed operation identity correlate them; no prompt, transcript, JSON, credentials,
URL or model identity enters these records. Virtual-time success/rejection/bad-JSON
tests prove the gap and privacy. JSON and streaming cancellation close their fake
HTTP streams. Existing bounded trace summaries and log rotation are reused.

This does not measure internal provider queueing, physical sound, UI paint or real
startup cost. No speculative timeouts, provider restarts, model changes or automatic
cloud fallback are added. Real-session latency attribution still needs separately
authorized representative evidence.

## Backlog classification at closure

| Issue / observation | Classification | Closure or next evidence |
| --- | --- | --- |
| Typed Sending survives a correlated precommit failure; stale ACK/timer bookkeeping; older presence hides new submission | Fixed in source and deterministically verified in V-A | Ten virtual-clock protocol cases plus adjacent client/reducer/presence checks |
| Explicit Stop retains a stalled generation and typed-monitor ownership | Fixed in source and deterministically verified in V-A | Inventory/health/stream gates, fake voice on/off, queued precommit Stop and delivery-only Stop speaking |
| Stop misses pending delivery or leaves THINKING after model completion | Fixed in source and deterministically verified in V-A | Both Stop controls with fake voice on/off; completed answer/terminal retained, one delivery cancellation and no late speech |
| Canceled late inventory/health still mutates/dispatches | Fixed in source and deterministically verified in V-A | Post-await token gates; exact model retained and no stale request dispatched |
| Rescan/disconnect join noncooperative discovery indefinitely; late exception changes route | Fixed in source and deterministically verified in V-A | Bounded grace, no overlapping external operations, fenced readiness, stale result/error retirement and fresh confirmation |
| Cold inventory classification, retries, desired/Active distinction, immutable route, empty/slow streams, supersession, voice failure preserving text | Already implemented and regression-protected; rechecked here | Keep existing contracts; no resurrected historical repair programme |
| October 9/21 long apparent stalls, startup speech unresponsiveness and slow typed replies | Credible owner symptoms; instrumented but not causally diagnosed | Representative correlated cold/typed session under separate authorization |
| Playback-boundary visual response and physical lead/drain; device/capture recovery | Implemented seams and synthetic protection; real environment acceptance open | Accepted-write timestamps do not establish acoustic delivery or room behavior |
| Connected skin/lifecycle/startup/Console/Memory/translation presentation | Implemented, compiled, deterministic contracts pass; graphical/owner acceptance open | No browser/GPU/visual judgment in V-A; October 21 saw released assets |
| New terminal/shell, richer telemetry, profiles, Agency/Memory expansion, STT/AEC/native distribution | Future capability or separately deferred programme | Functional bounded read-only Console and existing diagnostics are not missing features |

No observed owner symptom is closed merely because these offline gates pass.
Historical beta records, IV-B/IV-C source-only boundaries, IV-D evidence and
negative acoustic research are retained. BACKLOG now distinguishes the released
six swept sheets from current Candidate B and Canvas/static recovery, and no
longer calls IV-D's CPU/compiled work unimplemented.

## Executed verification and failures

All checks use existing local tools, sequentially, at BelowNormal priority with
short outer termination bounds. Vitest uses one worker and disables parallel
files; Ruff/Biome use one Rayon worker. Pytest writes only workspace-scoped `.sam`
scratch. In-process fake runtime/HTTP/WebSocket tests do not launch the application,
real providers, graphical windows or audio hardware.

| Final check | Actual result | Counting / scope |
| --- | --- | --- |
| Final adjacent Python batch, 22 files | **246 passed in 14.25 s** | Cancellation, context/history, exact routes, bootstrap/cold recovery, lifecycle, HTTP, diagnostics, authenticated admission, delivery, voice simulation and six file-only asset regressions |
| Final fault matrix, including late errors and pending delivery | 19 passed per run, three runs (0.40–0.41 s each) | 57 executions of 19 distinct cases already included in the 246-test batch; never added as extra tests |
| Frontend Node suite, 40 files | **300 passed**, 26.58 s wall / 5.27 s test bodies | Includes ten new fault cases; no browser/WebGL execution |
| Focused TypeScript project check | Passed | Existing 5.9.2 compiler, no emit campaign or new toolchain |
| Focused Biome and Ruff lint/format | Passed | Four frontend files; eight changed Python source/test files |
| Canonical production build | Passed once, 4.65 s wrapper / 852 ms Vite | Existing `ui` build script; TypeScript then Vite 7.3.6; no warnings |
| Source/artifact verifier and final Git/whitespace review | Passed | All 65 source inputs, HTML marker, Vite entry paths and integrated feature markers; no graphical inference |

Failure evidence is retained honestly: eight initial frontend reproductions, five
initial cancellation/preflight cases, three missing-JSON-timing cases, one
typed-monitor retirement case and four pending-delivery Stop cases failed before
their fixes. The discovery reproduction
was stopped by its 10 s watchdog, not reported as a completed test result. During
integration, three fake-voice cases exposed the missing THINKING → IDLE transition
for explicit cancellation; it was corrected in TurnManager. One assertion initially
counted only the replacement stream instead of the already-dispatched old stream;
that fixture expectation was corrected. Final executed gates have no failures.

The final two late-error variants protect a source-reviewed epoch guard. The earlier
234-test batch was rerun and expanded after the concrete pending-delivery repair
changed core behavior; the final 246 supersedes that count. Focused/repeated runs
are never added to it. The frontend suite/build did not need repeating because
the late repair changes Python alone.

## Source modules and generated assets

- Frontend production: `ui/src/state/client.ts`, `ui/src/presence.ts`.
- Core production: `src/sam_ambient/runtime.py`,
  `src/sam_ambient/core/providers/router.py`,
  `src/sam_ambient/core/turns/state_machine.py` and `src/sam_ambient/adapters/http.py`.
- New test foundations: `ui/tests/fixtures/conversation-faults.ts`,
  `ui/tests/conversation-faults.test.ts`, `tests/fixtures/conversation_faults.py`,
  `tests/integration/test_conversation_faults.py`.
- Extended regressions: `tests/unit/test_http_transport.py`,
  `tests/voice_sim/test_barge_in.py`.
- Current contracts/evidence: STATE, ROADMAP, BACKLOG, ARCHITECTURE, DECISIONS,
  CORE_EXPERIENCE_ACCEPTANCE, DIAGNOSTIC_LAUNCH, COLD_PROVIDER_RECOVERY,
  October 9/21 triage, this report and the new asset evidence below.

`Start Sam.cmd` still calls the existing editable `.venv` entry point, whose `.pth`
resolves this checkout's `src`. The private OwnerWindow resolves its sibling
`static` directory. Neither launcher nor private asset/authentication serving was
changed or launched. Generated files come only from the canonical build.

[File-only asset proof](evidence/conversation-reliability-va/frontend-assets.json)
records compiled source commit `4e1de183b39375050e8a5845113a1c85abbdfb90`,
`sourceDirtyAtBuild=false`, and 65-input normalized source SHA-256
`cb2e5b17395a571d4214fa3ec8326acf638afafa3c29154aa7266157c17d4542`.
The entry is `src/sam_ambient/static/assets/index-C5AyMQkc.js`, with unchanged
`index-BQcg81vV.css`; HTML, Vite manifest and `sam-build.json` agree. Raw artifact
hashes are in the proof. Existing Node 24.19.0 and bundled pnpm 11.25.0 ran the
declared script (package declares pnpm 11.19.0); automatic dependency verification/
installation and network were disabled. No dependency or lockfile changed.
The later Python delivery hardening changes no frontend input; the compiled
frontend identity remains the recorded `4e1de18`, with current inputs verified.

Git comparison to V-A's starting HEAD confirms no changes under `ui/src/visual-engine`,
`ui/src/ambient`, `ui/src/controls`, App, dependencies or lockfile. Geometry, shaders,
material/palette, particles, clocks, fallback and quality budgets remain unchanged.
No GPU/CPU-submission, inference-coexistence, thermal or hardware cost is measured.

## Recovery commits and remaining gates

- `2f19eab` — frontend correlated typed waits, virtual protocol faults and diagnosis.
- `4e1de18` — generation/discovery retirement, cancellation boundaries, JSON timing,
  fake-provider campaign and current architecture/diagnostic contracts.
- `e9b5dba` — completed-text/pending-delivery Stop hardening, late-error variants
  and matching fault regressions/contracts.
- Closing commit — canonical generated assets, immutable file proof, verified
  results and reconciled current records. Final full
  HEAD/clean-tree/ahead facts are reported after this commit; no remote was queried.

The compiled source identity intentionally precedes the closing artifact/documentation
commit. The repository remains on `dev`; there is no version bump, remote operation,
merge, tag, release, installer or next programme.

Next highest-value independent occupied-PC proposal: bounded diagnostic-trace
reconstruction fixtures for controlled cold/preflight/first-useful-token/delivery
delays and owner-session rotation, reusing the existing reports. Prove whether an
important interval is still ambiguous before adding telemetry or another report.
Do not begin it without HQ direction or invent further defects.

Later authorized integrated verification should first collect representative
cold-start and two typed turns using current artifact identity and existing
content-free timing/correlation, then cancellation/failure recovery. Separately
run shader/CPU-GPU proof and matched full-colour/pose/UI evidence, followed by bounded
matching performance if allowed. Physical capture/STT/TTS/playback and owner judgment
remain separate; no human beta is requested now. Noncooperative adapters can retain
physical work until unwind/shutdown; logical retirement does not kill external
resources or prove device recovery. Existing two-second shutdown task grace remains.

V-A is a deterministic reliability/source-integration checkpoint toward v0.2.6,
not evidence that real latency, graphical quality or release readiness is accepted.
Relevant package/native/clean-host/signing gates also remain separate. Stop here.
