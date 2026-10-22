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

## Core integration checkpoint

The same campaign has reproduced stalled explicit cancellation, late canceled
inventory/health returns and noncooperative discovery joins. Runtime repairs and
the Python fault/HTTP matrices are being integrated in the next recovery boundary.
Final verification, exact source changes, backlog classification and generated
asset identity will be recorded here before V-A closes.
