# Conversation sessions — UX-08

Unreleased V-E development, 2026-10-23. v0.2.5 has committed-history persistence
but does not expose these controls or send the new rehydration snapshot.
See [implementation/audit evidence](SESSION_CONTINUITY_VE.md).

## Owner experience

Controls → Conversation contains **New conversation**, a retained-conversation
selector, **Resume selected conversation**, and **On a new Sam launch**.
The active conversation has a stable opaque ID; labels use an ID excerpt and saved
message count, not automatically generated titles or private text snippets.

- **Resume previous conversation** is the default and preserves existing behavior.
  A normal restart restores the selected retained session. A UI reload or transient
  reconnect reattaches to the live session and its bounded saved history/live draft.
- **New conversation** creates a fresh core context. It does not merely clear React,
  change the provider/model, delete previous text or alter reviewed Personal Memory.
- **Resume selected conversation** restores that session's saved context. New turns
  still use the current deliberate model selection; no historical model is silently
  selected or substituted and no interrupted request is automatically reissued.
- **Begin a new conversation on launch** applies once per supervisor application
  launch identity. Component restart/recovery and UI reconnect reuse that identity,
  so they do not repeatedly run the launch policy. A new supervisor invocation is
  the fresh-launch boundary. Standalone core invocations without that identity
  conservatively resume rather than guessing whether they represent a fresh launch.

Finish/stop the current response, mute ordinary microphone input and wait for
recognition/capture cleanup and tools before switching. Armed PTT can remain enabled;
held or finalizing PTT blocks switching. A rejected operation leaves context intact
and reports a reason. Typing remains available when voice has failed, except during
the short serialized durable session transition itself.

Saved text is labelled as saved; speech is not replayed. A saved user request without
a completed saved answer is described as incomplete, not a successful answer.
Partially generated text can survive an ordinary UI reconnect as an in-memory draft,
but is not silently saved as a completed answer or restarted after a core failure.
Committed answer text survives stopped/failed speech; audio delivery is a separate
lifetime. Transcript visibility/Markdown/scroll preferences remain independent.

## Authority, persistence and limits

The runtime owns session changes. Additive protocol-v1 commands require an active
authenticated owner connection, current `session_id` and `expected_revision`.
The existing dispatcher deduplicates command identity; a persisted revision rejects
reordered work even after returning to an earlier session. ACK reports handling,
not selection, model readiness or inference completion.

SQLite compare-and-select updates session and revision in one short transaction.
The runtime retains transition ownership through requester cancellation until the
transaction outcome is known, then synchronizes live state. New input cannot race
that boundary. Busy inference/delivery, voice cleanup or tools block the operation.
Late stored callbacks cannot populate another current session; model/TTS events
cannot acquire generation ownership from a terminal or an old resumed session.

An additive `conversation_sessions` registry backfills legacy committed rows and
keeps empty selected sessions recoverable. Existing message tables and text are
not rewritten; schema version 1 and revision are validated. Corrupt/incompatible
state is reported rather than replaced with empty state. Failed/locked transactions
do not change the live session; after a recoverable store failure, typing can retry.
An unusable database at process startup retains the existing explicit startup-error
behavior; this work does not invent an unsafe silent ephemeral fallback.

The existing global retention remains **500 committed messages**, each bounded to
16,384 Unicode characters. New/Resume do not delete committed messages. Ordinary
retention can eventually remove old rows as before. Empty inactive registry rows
are trimmed against the latest 64 descriptors; selected sessions and descriptors
with retained messages are protected. Snapshot and inference queries filter session
before limiting rows. Live history/catalog refresh follows actual retained rows.

The UI lists up to **32 recent sessions including the active session**, with up to
**50 recent messages** and **48,000 Unicode characters** per history snapshot.
An optional current draft adds at most 16,384 characters. The parser counts Unicode
code points consistently with Python, including non-BMP text. Excerpts/limited
history are not proof that older stored text was deleted. Browsing/searching every
older session beyond this window, titles, export and retention settings are deferred.
Inference retains the existing 12-message/6,000-character context budget and cloud
privacy gate; UI history size does not increase the model context budget.

The operational database path is the namespace. Separate stores do not share history;
deliberately sharing one store shares its conversations, as before. This is not a
multi-user/workspace tenancy migration. File/tool workspace policy and reviewed
Personal Memory keep their existing independent ownership and review boundaries.

## Wire/recovery contract

`system.ready` includes a private `conversation` snapshot with session/runtime IDs,
persisted revision, launch policy, persistence availability, bounded history/catalog,
incomplete turn IDs and an optional live draft. It is sent only after owner proof.
No transcript, proof, audio, URL or new history payload is added to routine diagnostics.

After a durable change, `conversation.changed` carries the same snapshot plus the
previous session and originating command ID. Other authenticated peers can reattach
without treating ACK as authority. Socket epoch, runtime ID, session, revision,
snapshot timestamp, turn and generation remain distinct. Queued pre-snapshot deltas,
old ACKs/terminals and malformed snapshots cannot replace a newer context or clear
its pending request. A same-session core restart can reset clocks safely because it
has a new runtime ID. Existing v1 peers may ignore additive fields; a fresh new UI
can still connect to a legacy core with these controls unavailable.

## Verification boundary

Tests use temporary SQLite stores, in-memory transports, virtual scheduling and fake
provider/capture/TTS/output ports. They exercise context separation, restart policy,
rehydration, admission, stale/reordered events, partial generations, stopped speech,
cleanup, storage faults and retention bounds. React server markup checks labels and
disabled controls; they do not establish real focus/layout acceptance.

The missing history-snapshot contract was reproduced and repaired. The owner's older
reload observation remains unattributed as a particular incident. Physical voice,
natural bilingual accuracy, real provider latency, graphics and owner acceptance
remain open. No session work accepts the connected skin or changes CONV-07/08.
