import pytest

from sam_ambient.core.memory import MemoryError, MemoryStore
from sam_ambient.core.memory.policy import MemoryWritePolicy, ProposalSource
from sam_ambient.core.memory.store import MAX_PROPOSED


def test_proposals_are_unreviewed_deduplicated_and_never_overwrite_owner_claim(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    owner = store.create(
        store.owner_id,
        kind="fact",
        scope="personal",
        content="I live in Madrid",
        source_kind="owner",
        source_ref="owner-action",
    )
    policy = MemoryWritePolicy()
    for source in ("model", "conversation", "tool", "web"):
        proposal = policy.propose(
            store,
            kind="fact",
            scope="personal",
            content="I live in Berlin",
            source=ProposalSource(source, "turn-action-ref"),
        )
        assert proposal.review == "proposed" and proposal.reviewed_by is None
        assert store.get(store.owner_id, owner.id).content == "I live in Madrid"
    with pytest.raises(MemoryError, match="impersonate"):
        policy.propose(
            store,
            kind="fact",
            scope="personal",
            content="Invented fact",
            source=ProposalSource("owner", "fake-owner"),
        )
    assert len(store.list(store.owner_id)) == 5


def test_proposal_inbox_bound_does_not_block_owner_memory_and_duplicates(tmp_path):
    store = MemoryStore(tmp_path / "memory.db")
    policy = MemoryWritePolicy()
    for n in range(MAX_PROPOSED):
        policy.propose(
            store,
            kind="fact",
            scope="personal",
            content=f"Unreviewed claim {n}",
            source=ProposalSource("model", f"turn-{n}"),
        )
    duplicate = policy.propose(
        store,
        kind="fact",
        scope="personal",
        content="Unreviewed claim 0",
        source=ProposalSource("model", "another-turn"),
    )
    assert duplicate.review == "proposed"
    with pytest.raises(MemoryError, match="inbox full"):
        policy.propose(
            store,
            kind="fact",
            scope="personal",
            content="New claim",
            source=ProposalSource("model", "new-turn"),
        )
    explicit = store.create(
        store.owner_id,
        kind="preference",
        scope="personal",
        content="Prefer concise answers",
        source_kind="owner",
        source_ref="owner",
    )
    assert explicit.review == "reviewed"
