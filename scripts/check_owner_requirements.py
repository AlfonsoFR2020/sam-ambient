"""File-only owner-register integrity; does not infer implementation or acceptance."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

GATES = {"SCOPE", "RENDER", "AUDIO", "REAL", "OWNER", "DIST", "—"}
FAMILIES = {
    "VIS": 4,
    "SHELL": 2,
    "STYLE": 11,
    "EXP": 4,
    "QUAL": 4,
    "UX": 11,
    "CONV": 9,
    "AUTH": 5,
    "CAP": 8,
    "PLAT": 2,
    "GOV": 6,
}
BASE_IDS = {
    f"{family}-{number:02}" for family, count in FAMILIES.items() for number in range(1, count + 1)
}


def parse_register(text: str, *, required_ids=()) -> dict[str, dict]:
    sources = set(re.findall(r"^\| (S\d+) \|", text, re.MULTILINE))
    records = {}
    for line in text.splitlines():
        if not line.startswith('| <a id="'):
            continue
        fields = [value.strip() for value in line.split("|")[1:-1]]
        if len(fields) != 6 or not all(fields):
            raise ValueError("Each requirement needs six complete register fields")
        match = re.fullmatch(r'<a id="([a-z]+-\d+)"></a>([A-Z]+-\d+)', fields[0])
        if not match or match[1] != match[2].lower():
            raise ValueError("Requirement needs a matching stable ID and anchor")
        identity = match[2]
        if identity in records:
            raise ValueError(f"Duplicate requirement: {identity}")
        origins = set(re.findall(r"\bS\d+\b", fields[2]))
        if not origins or origins - sources:
            raise ValueError(f"Unknown or absent source: {identity}")
        if not re.search(r"\b(?:DO|D|A|I|U)\b", fields[2]):
            raise ValueError(f"Absent provenance classification: {identity}")
        parts = [value.strip() for value in fields[5].split("·")]
        if len(parts) != 3 or parts[0] not in {"P0", "P1", "P2", "P3"}:
            raise ValueError(f"Invalid priority/dependency/track: {identity}")
        if set(parts[2].split("/")) - set("CVUAPG"):
            raise ValueError(f"Unknown execution track: {identity}")
        records[identity] = {
            "priority": parts[0],
            "dependencies": [value.strip() for value in parts[1].split(",")],
            "track": parts[2],
        }
    if set(required_ids) - records.keys():
        raise ValueError(
            f"Missing preserved requirements: {sorted(set(required_ids) - records.keys())}"
        )
    for identity, row in records.items():
        missing = set(row["dependencies"]) - records.keys() - GATES
        if missing:
            raise ValueError(f"Unknown dependencies for {identity}: {sorted(missing)}")

    done = set()

    def visit(identity, active):
        if identity in active:
            raise ValueError(f"Circular prerequisite: {' -> '.join([*active, identity])}")
        if identity in done:
            return
        for dependency in records[identity]["dependencies"]:
            if dependency in records:
                visit(dependency, [*active, identity])
        done.add(identity)

    for identity in records:
        visit(identity, [])
    return records


def audit(root: Path) -> dict:
    records = parse_register(
        (root / "docs/OWNER_REQUIREMENTS.md").read_text(encoding="utf-8"), required_ids=BASE_IDS
    )
    return {
        "requirements": len(records),
        "styles": sum(identity.startswith("STYLE-") for identity in records),
        "priority_bands": dict(
            sorted(Counter(row["priority"] for row in records.values()).items())
        ),
        "dependencies_resolve": True,
        "prerequisite_cycles": False,
        "acceptance_inferred": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    print(json.dumps(audit(args.root), indent=2))


if __name__ == "__main__":
    main()
