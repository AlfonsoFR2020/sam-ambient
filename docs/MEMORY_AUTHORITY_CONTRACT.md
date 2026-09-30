# Future memory authority and provenance contract

Architecture seam only, 2026-09-30. No memory capability, embeddings, vector store,
retrieval loop or persistence schema is implemented here. Existing SQLite session
history/context is not durable semantic memory. The master spec keeps long-term
memory outside the initial MVP until measured need exists.

## Identity, scope and provenance

- A durable owner principal is distinct from the ephemeral supervisor session and
  connection authorizing an operation. Restart must not invent another person.
  Start later with one explicitly configured owner; OS username or STT speaker
  labels do not establish biometric/multi-user identity.
- Session context is temporary working data. Durable memory requires a deliberate
  write through the shared typed capability/policy boundary.
- A future record needs stable record/revision IDs, owner principal, workspace or
  conversation scope, creation/update timestamps, retention/expiry, source reference,
  source kind/trust class, sensitivity and permitted export routes. Source kinds
  include owner statement, model inference, webpage, file and tool result. A claim's
  provenance is not proof that it is true.
- Reference existing turn/generation/action IDs. Do not retain credentials, raw
  audio or entire returned pages merely to preserve provenance.

## Write, retrieval and deletion authority

Model prose, transcripts, pages and tool results can propose content; they cannot
grant write permission or silently become trusted owner facts. Initially require
exact owner-reviewed write/update including scope, source and sensitivity. Any
later auto-save policy must be explicit and bounded; read policy grants no writes.

Retrieval is a scoped capability. Filter owner/scope, trust, sensitivity, retention
and route permission before bounded context assembly. Retrieved claims remain
source-labelled data, not instructions or capability grants. Cloud-disabled routes
must not export private memory through fallback. Local retrieval permission alone
does not grant cloud export. Conflicts need review, not silent overwrite.

Updates are revisioned and reference the authorized action. Deletion/expiry removes
records from future retrieval/context and withdraws derived indexes/caches. Audit
keeps minimal operation metadata, not deleted content. Provider requests cannot be
recalled retroactively; backup and physical-erasure guarantees require a storage/
retention decision before implementation.

## Agency and future multi-person interaction

Action audit may reference records; capability output does not automatically become
memory. Memory cannot authorize a browser, process, file or owner-control action.
Authentication, schema/policy, approval, cancellation and output bounds remain shared.

Future diarization (including retained Nemotron research) is attribution evidence,
not owner authentication. Uncertain speakers cannot inherit owner write/read power.
Multi-person memory depends on principal/consent policy and reliable turn attribution.

## Small future implementation gate

Define the minimal single-owner schema, retention and approval UX first. Then test
untrusted-source proposals, reviewed writes, scope/export filtering, contradictions,
deletion/cache withdrawal, cancellation and restart identity. Do not begin general
RAG or a vector database to prove this seam. Privacy/recall acceptance belongs to a
later integrated checkpoint; no human beta is requested now.
