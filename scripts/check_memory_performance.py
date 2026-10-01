"""Synthetic temporary-store evidence, not a machine-speed CI assertion."""

import json
import statistics
import tempfile
import time
from pathlib import Path

from sam_ambient.core.memory import MemoryStore
from sam_ambient.core.memory.retrieval import MAX_CONTEXT_CHARS, LexicalMemoryRetriever


def measured(operation, count=15):
    values = []
    for _ in range(count):
        start = time.perf_counter()
        operation()
        values.append((time.perf_counter() - start) * 1000)
    return round(statistics.median(values), 3)


def main():
    output = []
    with tempfile.TemporaryDirectory(prefix="sam-memory-performance-") as temporary:
        for size in (30, 300, 3000):
            path = Path(temporary) / f"memory-{size}.db"
            start = time.perf_counter()
            store = MemoryStore(path)
            open_ms = (time.perf_counter() - start) * 1000
            start = time.perf_counter()
            for index in range(size):
                store.create(
                    store.owner_id,
                    kind="project",
                    scope="personal",
                    content=f"Project landmark{index} uses Python and SQLite",
                    source_kind="owner",
                    source_ref="synthetic",
                )
            write_ms = (time.perf_counter() - start) * 1000 / size
            recall = LexicalMemoryRetriever(store)
            query = f"landmark{size - 1}"
            entries = recall.retrieve(query, scopes=("personal",))
            assert len(entries) == 1
            assert len(json.dumps([entry.to_context() for entry in entries])) < MAX_CONTEXT_CHARS
            item = entries[0].record
            start = time.perf_counter()
            store.correct(
                store.owner_id,
                item.id,
                expected_revision=1,
                content=f"Project landmark{size - 1} corrected",
                action_ref="synthetic-correction",
            )
            correct_ms = (time.perf_counter() - start) * 1000
            start = time.perf_counter()
            store.delete(store.owner_id, item.id, expected_revision=2)
            delete_ms = (time.perf_counter() - start) * 1000
            output.append(
                {
                    "records": size,
                    "first_open_ms": round(open_ms, 3),
                    "reopen_median_ms": measured(lambda path=path: MemoryStore(path)),
                    "write_mean_ms": round(write_ms, 3),
                    "correct_ms": round(correct_ms, 3),
                    "delete_ms": round(delete_ms, 3),
                    "scoped_search_median_ms": measured(
                        lambda store=store: store.list(store.owner_id, query="Python")
                    ),
                    "recall_context_median_ms": measured(
                        lambda recall=recall: [
                            e.to_context() for e in recall.retrieve("Python", scopes=("personal",))
                        ]
                    ),
                    "database_bytes": path.stat().st_size,
                }
            )
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
