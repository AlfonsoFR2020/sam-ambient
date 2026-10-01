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
