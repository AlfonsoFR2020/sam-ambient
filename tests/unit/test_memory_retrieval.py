import json

from sam_ambient.core.memory import MemoryStore
from sam_ambient.core.memory.retrieval import MAX_CONTEXT_CHARS, LexicalMemoryRetriever


def create(store, text, *, scope="personal", source="owner"):
    return store.create(
        store.owner_id,
        kind="preference",
        scope=scope,
        content=text,
        source_kind=source,
        source_ref="source-1",
    )


def test_selective_rank_scope_review_and_provenance(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    best = create(store, "Preferred language Spanish; concise explanations")
    weaker = create(store, "Spanish recipes are interesting")
    create(
        store,
        "Preferred language Spanish; concise explanations for another workspace",
        scope="other",
    )
    create(store, "Preferred language Spanish; concise explanations unverified", source="web")
    create(store, "Favourite animal is a fox")
    recall = LexicalMemoryRetriever(store)
    entries = recall.retrieve(
        "What is my preferred language for concise explanations?",
        scopes=("personal", "workspace:current"),
    )
    assert [entry.record.id for entry in entries] == [best.id]
    assert "language" in entries[0].matched_terms and entries[0].score >= 3
    assert entries[0].to_context()["provenance"]["review"] == "owner_reviewed_claim"
    assert recall.retrieve("Spanish", scopes=("personal",))[0].record.id == weaker.id
    assert not recall.retrieve("What is 7 times 8?", scopes=("personal",))
    assert not recall.retrieve("Please tell me", scopes=("personal",))


def test_correction_deletion_review_and_whole_entry_budgets(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    pending = create(store, "Preferred language Spanish", source="model")
    recall = LexicalMemoryRetriever(store)
    assert not recall.retrieve("Preferred language", scopes=("personal",))
    updated = store.correct(
        store.owner_id,
        pending.id,
        content="Preferred language English",
        expected_revision=1,
        action_ref="correction",
    )
    assert not recall.retrieve("Spanish", scopes=("personal",))
    assert recall.retrieve("English", scopes=("personal",))[0].record.id == updated.id
    store.delete(store.owner_id, pending.id, expected_revision=2)
    assert not recall.retrieve("English", scopes=("personal",))
    for n in range(12):
        create(store, f"Context memory {n} " + "x" * 1100)
    entries = recall.retrieve("Context memory", scopes=("personal",))
    assert 0 < len(entries) <= 6
    assert (
        len(json.dumps([entry.to_context() for entry in entries], ensure_ascii=False))
        < MAX_CONTEXT_CHARS
    )
    assert all(len(entry.record.content) > 1100 for entry in entries)


def test_unicode_tokens_are_whole_words_and_case_insensitive(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    create(store, "Idioma preferido español y respuestas concisas")
    recall = LexicalMemoryRetriever(store)
    assert recall.retrieve("ESPAÑOL", scopes=("personal",))
    assert not recall.retrieve("spa", scopes=("personal",))
