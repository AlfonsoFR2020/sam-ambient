# Memory authority, provenance and future multi-person contract

Updated 2026-10-01. The original Agency Foundation seam is implemented for one
owner in [Memory Foundation I](MEMORY_FOUNDATION_I.md): SQLite records, owner CRUD,
review-first model proposals, bounded lexical retrieval and local context assembly.
Session history remains separate. Embeddings/vector retrieval, automatic learning,
cloud memory export and multi-person memory are not implemented. HQ explicitly
authorized this post-MVP memory slice; it changes neither the published v0.2.3 nor
the original frozen MVP.

## Identity, scope and provenance

- A durable owner principal is distinct from the ephemeral supervisor session and
  connection authorizing an operation. Restart must not invent another person.
  The current store has one durable principal; OS username or STT speaker
  labels do not establish biometric/multi-user identity.
- Session context is temporary working data. Durable memory requires a deliberate
  write through the shared typed capability/policy boundary.
- The implemented record has stable record/revision IDs, owner principal, workspace or
  Personal scope, creation/update timestamps, source reference and source/review
  class. Retention is until owner deletion and all memory is local/private in this
  foundation; future expiry/sensitivity/export fields require explicit policy. Sources
  include owner statement, model inference, webpage, file and tool result. A claim's
  provenance is not proof that it is true.
- Reference existing turn/generation/action IDs. Do not retain credentials, raw
  audio or entire returned pages merely to preserve provenance.

## Write, retrieval and deletion authority

Model prose, transcripts, pages and tool results can propose content; they cannot
grant write permission or silently become trusted owner facts. Initially require
exact owner approval to hold a proposed claim, then separate review/correction
before recall. Direct owner creation/correction is reviewed. Any
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

## Future person attribution and consent (checkpoint 11)

Separate future `person_id`/subject and speaker-attribution evidence from the current
database's owner scope and ephemeral authenticated operation identity. A diarizer's
speaker label is not a real-world identity, permission or consent. Speaker confidence,
source turn/time and later owner correction must remain provenance rather than
automatically assigning a name or trusted fact. Unknown/uncertain speakers stay
unattributed and cannot inherit owner memory read/write authority.

Household/group scopes require explicit participants, access policy, consent,
retention and per-person correction/deletion boundaries before storing other
people's personal facts. The current single-owner runtime is not biometric
authentication: an ambient utterance cannot establish which person spoke it.
Owner review is required for proposals; retrieval in the configured local
conversation assumes the operator intends that single-owner session. Shared-room
private recall needs a future disclosure/identity policy before multi-person use.

NVIDIA Nemotron 3 Diarization remains only the researched future direction (roughly
100M parameters, 16 kHz mono, up to eight speakers, streaming/offline with speaker
cache/FIFO identity across chunks). It may support attributed transcripts/context,
meeting mode and memory provenance after reliable turn ownership and consent exist.
It is not AEC, owner authentication or a current integration. GPU/runtime,
dependencies and license suitability require evaluation before adoption.

Single-owner schema/restart/review/deletion/filter/budget tests are implemented;
the integrated simulator exercises real storage and authority. Semantic indexes
must implement the retrieval seam while preserving owner/review/route/budget
filters. Privacy, usefulness and perceptual acceptance remain a later integrated
human checkpoint; no human session is requested now.
