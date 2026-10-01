"""Review-first memory proposals. Provenance never supplies write authority."""

from dataclasses import dataclass

from sam_ambient.core.memory.store import MemoryError, MemoryRecord, MemoryStore


@dataclass(frozen=True, slots=True)
class ProposalSource:
    """Constructed by trusted mediation, never deserialized from model/page text."""

    kind: str
    reference: str


class MemoryWritePolicy:
    """Calling this requires capability approval; it cannot create a trusted claim."""

    def propose(
        self,
        store: MemoryStore,
        *,
        kind: str,
        scope: str,
        content: str,
        source: ProposalSource,
    ) -> MemoryRecord:
        if source.kind not in {"model", "conversation", "tool", "web"}:
            raise MemoryError("A proposal cannot impersonate owner-authored memory")
        return store.create(
            store.owner_id,
            kind=kind,
            scope=scope,
            content=content,
            source_kind=source.kind,
            source_ref=source.reference,
        )
