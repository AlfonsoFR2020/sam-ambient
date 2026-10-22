# Conversation responsiveness and deterministic reliability — V-A

Date: 2026-10-22. Local occupied-PC engineering; no new release or human acceptance.
Starting `dev`: `bfdd7175e238c4a9e5904c1222ef8d18318de5d6`, clean,
12 commits ahead of cached `origin/dev`; no fetch. Published v0.2.5 remains
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.

## Scope and evidence boundary

HQ4 authorizes sequential, low-priority CPU-only fake-service tests, focused
static checks, local implementation/commits and one necessary frontend build.
No Sam, provider/model, browser, GPU, microphone, speaker, real TTS, network or
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
stream work while later requests remain independent. Thirteen integrated cases
cover the three Stop stages with/without fake voice, Stop before commitment,
delivery-only Stop speaking, partial network failure and typed recovery, late
inventory/health, and noncooperative Rescan/disconnect. Existing adjacent matrices
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

## Verification checkpoint

The integrated core checkpoint passes **43 tests** across the new fault matrix,
HTTP transport and deterministic turn/interruption simulation. Focused Ruff and
TypeScript/Biome checks pass. Broader adjacent regressions, bounded repetition,
final backlog reconciliation and the single frontend build follow before closure.
