"""Selective explainable lexical retrieval with a future semantic-provider seam."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

from sam_ambient.core.memory.store import MemoryRecord, MemoryStore, terms

# Grammar/request scaffolding must not retrieve arbitrary personal facts.
_STOP = frozenset(
    """a an and are as at be by can could do does for from how i in is it
me my of on or please sam tell that the this to was what when where which who why will
with would you your un una el la los las de del y en que qué cómo como mi mis por para
es son me puedes favor responde respuesta answer reply remember memory""".split()
)
MAX_RECALL_ENTRIES = 6
MAX_CONTEXT_CHARS = 4800


@dataclass(frozen=True, slots=True)
class RecallEntry:
    record: MemoryRecord
    matched_terms: tuple[str, ...]
    score: int

    def to_context(self) -> dict:
        row = self.record
        return {
            "id": row.id,
            "kind": row.kind,
            "scope": row.scope,
            "content": row.content,
            "provenance": {
                "source": row.source_kind,
                "reference": row.source_ref,
                "review": "owner_reviewed_claim",
                "revision": row.revision,
            },
        }


class MemoryRetriever(Protocol):
    """Semantic indexes may implement this later; authority/filter/budgets must remain."""

    def retrieve(self, query: str, *, scopes: tuple[str, ...]) -> tuple[RecallEntry, ...]: ...


class LexicalMemoryRetriever:
    def __init__(self, store: MemoryStore) -> None:
        self.store = store

    def retrieve(self, query: str, *, scopes: tuple[str, ...]) -> tuple[RecallEntry, ...]:
        words = tuple(word for word in terms(query[:4000]) if len(word) >= 3 and word not in _STOP)[
            :12
        ]
        candidates = self.store.ranked_reviewed(self.store.owner_id, words, scopes)
        selected: list[RecallEntry] = []
        remaining = MAX_CONTEXT_CHARS - 256  # envelope and separators, never partial records
        for record, score in candidates:
            matched = tuple(word for word in words if word in terms(record.content))
            entry = RecallEntry(record, matched, score)
            cost = len(json.dumps(entry.to_context(), ensure_ascii=False)) + 2
            if cost > remaining:
                continue
            selected.append(entry)
            remaining -= cost
            if len(selected) >= MAX_RECALL_ENTRIES:
                break
        return tuple(selected)
