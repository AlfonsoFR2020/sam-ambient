# Durable personal memory foundation

## Local store and identity

Standard-library SQLite, schema version 1 (`PRAGMA user_version`), stores selected
claims independently of session transcripts. Windows default is
`%LOCALAPPDATA%/Sam/memory.sqlite3`; other platforms use
`$XDG_DATA_HOME/Sam/memory.sqlite3` (default `~/.local/share`). Test/runtime fixtures
must explicitly supply isolated paths. No new dependency or database service.

One random durable principal in database metadata survives session/credential
rotation. It is a record scope, **not an authentication secret** or recognition
of a person from an OS username/voice. Every operation still needs current owner
authority at the capability boundary; the storage API is trusted internal code.

Kinds: fact, preference, project. Records carry ID, owner, scope, content (1,200
characters maximum), source kind/reference, review state/reviewer, creation/update
timestamps, revision and last update action reference. Original provenance remains
when the owner reviews/corrects a proposal. Session-only work stays in the existing
conversation context, not this store. No automatic transcript/page import.

Owner-origin creation is reviewed; model/conversation/tool/web-origin creation is
proposed. Approval is explicit. Correction replaces content at the same stable ID,
increments revision and requires the expected revision; stale edits/deletes fail
instead of overwriting newer owner work. Conflicting distinct claims need owner
review/correction; no automated truth maintenance. Duplicate same-origin proposals
return the existing record.

Parameterized transactions, separate short-lived connections, 250 ms lock wait,
bounded list pages/query and Unicode-normalized lexical fields keep work finite.
Obvious password/API-key/token assignments, bearer tokens, private-key blocks and
credential-bearing URLs are rejected without quoting the secret in errors. This
is deliberately not a general DLP detector. Local account/file access remains an
OS boundary; the database is plaintext, not a credential vault.

## Correction, deletion and retention

Deletion removes the record and lexical data. Correction replaces old plaintext;
there is no old-content revision/audit table. `secure_delete=ON` clears freed SQLite
cells; default rollback journaling avoids a retained WAL content history. No
background cache or embedding index exists. This does **not** guarantee forensic
erasure on SSDs, filesystem backups or copies already sent to a provider/UI.
Owner-managed records persist until deletion; no invented automatic expiry.

Unknown future schemas, malformed files and lock/write failures fail with sanitized
errors. Future schema migrations must be explicit transactions; never erase a
database to recover. Runtime degradation must preserve text conversation.

## Implementation evidence

Checkpoint 2: isolated CRUD, restart identity, proposed/reviewed provenance,
optimistic correction, content-removing delete, secret/size rejection, owner scope,
inert SQL/HTML strings, concurrent transactions, future schema, corruption and lock
tests. Runtime/UI, retrieval/context and model proposal admission are later
checkpoints in this action set, not implied by storage tests.

Synthetic correctness is separate from owner acceptance of recall/privacy.

## Owner management boundary (checkpoint 3)

Normal core startup opens the default app-data store; `sam runtime --memory-db`
selects an explicit test/development store and `--no-memory` disables it for that
core session. In-process runtime tests default to no memory unless they provide
a path; real-core fixtures override the default into a temporary directory.

`memory.list/get/create/correct/approve/delete` use existing owner-authenticated
capability admission, schema, lease, cancellation and bounded executor. CRUD tools
are owner-only and excluded from model schemas; guessed model calls are denied
before policy approval. The storage principal is pinned by the runtime, not supplied
by a client/model argument. Workspace scope is derived from the canonical root.

An exact direct owner mutation request is its approval; the new narrow
OWNER_DATA_MUTATION policy does not authorize shell/file destructive actions.
Deletion has a separate confirmation in the owner UI and an expected revision.
Memory tools additionally require the live server-owned action/token object before
database work and before transaction commit. Cancellation rolls back uncommitted
work; a transaction already committed cannot be undone by a late cancellation or
lost acknowledgement—refresh reflects the authoritative store.

The **Memory** surface is separate from chat and Console: searchable/filterable,
eight-record pages, bounded previews, full inspect/correct, provenance/review,
explicit creation, proposal approval and permanent deletion. React text rendering
keeps stored markup inert. Both panel and entries scroll. Disconnect clears the
view/editor; capability results are bounded transient owner-client state, not a
second durable store. Routine diagnostics do not log contents.

Checkpoint 3 evidence: authenticated real-WebSocket CRUD plus hidden model-tool
denial; store/executor/action regressions; frontend projection/client tests;
isolated Chrome memory create/correct/delete/inert text/scroll test; TypeScript,
Ruff/Biome and packaged frontend asset build. No provider/audio run for this phase.

## Write policy (checkpoint 4)

Owner create/correct is deliberately reviewed. Other sources can only enter a
**proposed** inbox: never auto-promoted, never silently overwrite an existing
owner claim. Exact owner approval of a model tool call permits holding a candidate;
it does **not** approve its truth for retrieval. The Memory panel's Approve claim
or correction is the separate review step. There is no automatic learning from
ordinary model prose, transcripts or pages. Model proposals remain optional and
bounded; pending inbox limit is 100 with duplicate same-origin/content/scope reuse.

Provenance is supplied by trusted mediation, not model arguments. Proposal policy
rejects owner impersonation. No raw transcript/page is saved as provenance.
Registered memory handlers reject secret-like content before an approval request,
not just before SQLite insertion. Correction is the explicit resolution for a
contradiction; distinct conflicting claims remain visible for owner review.
No automatic semantic conflict detection is claimed.

## Retrieval (checkpoint 5)

SQLite ranks **reviewed-by-this-owner** claims in Personal/current workspace only.
Unicode casefolded whole-word overlap supplies an explainable score; recency and
stable ID break ties. Stop words avoid retrieving personal facts for generic
request scaffolding. SQL ranks before returning at most 32 candidates; caller
selects at most six complete entries within a 4,800-character context envelope.
Individual content remains bounded at 1,200 characters. No partial claims or
database dump, no model/embedding dependency, no external search/index service.

Recall preserves source/revision/review and matched terms internally. Corrections
replace lexical content; deletion leaves no cached/indexed result. Unreviewed
claims and other workspaces are excluded. This lexical foundation cannot guarantee
paraphrase/concept matching; no semantic retrieval claim. `MemoryRetriever` is the
future semantic seam, whose implementations must preserve these filters/budgets.
Runtime prompt context is a separate following checkpoint.

## Conversation context (checkpoint 6)

A relevant turn on a **local** route may receive a separately named USER data
message (`sam_memory`, JSON type `sam.memory.context`) between history and the
current question. It preserves claim provenance/revision without pretending to
be a system instruction, a synthetic tool result or an ordinary committed chat
message. A system reminder explains data/authority separation and revision priority.
No memory changes the existing message path when recall is empty/disabled.

Memory is private in this first version: explicit cloud permission for a current
question is not memory-export permission. Cloud routes receive no memory context;
existing history/tool privacy guards remain unchanged. Retired generation/token,
revoked capability authority or recall failure prevent injection. Optional store
failure still allows a normal text answer.

The 4,800-character limit includes the serialized context envelope. It is a
character limit, not an asserted precise tokenizer budget. No recalled entry is
persisted as another chat message. Earlier committed answers/current conversation
may already contain information repeated from memory; deleting a memory does not
silently erase conversation history or recall prior provider requests.

## Structured model proposals (checkpoint 7)

Only `memory.propose` is advertised to models; ordinary prose cannot call it.
Arguments are concise content, kind, Personal/workspace scope, a bounded rationale
and optional completed source action ID. No owner/trust/review/source-kind override.
Ordinary exact tool approval permits the write of an **unreviewed** candidate;
the owner then inspects/corrects/approves it in Memory before recall can use it.
This intentionally conservative first UX uses two separate decisions, not silent
automatic learning. No user utterance or assistant text is automatically imported.

Source references are pinned to the active generation/turn. Tool-derived provenance
must identify an actual completed action in that same generation; browser sources
become web provenance, other actions tool provenance. References to old/unknown or
memory actions are rejected. Omitted evidence remains explicitly model-origin,
not an assertion that the owner actually said it. Rationale is approval context,
not a retained raw transcript.

Maximum two proposals per turn, the existing repeat/round/fragment limits and the
100-candidate inbox prevent compulsive/recursive collection. The tool guidance
asks for sparse lasting context, excluding transient tasks/speculation/page trivia.
Results return candidate ID/review requirement, not another instruction envelope.
Malformed/secret/provenance failures are bounded tool failures; the model can still
finish its text answer. Synthetic seven-mode tests include inert prose, schema
spoofing, source spoofing, excessive proposals and real workspace-read provenance.
