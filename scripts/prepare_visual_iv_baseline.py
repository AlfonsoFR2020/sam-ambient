"""Prepare ignored test-only v0.2.5 modules from local Git; never launch a renderer.

Run only as part of an authorized verification pass. Production imports never use
this directory. No worktree, package installation, network or remote operation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from pathlib import Path

BASELINE = "dc64c5d180fb44cf7a29bf4d0d1ae2f853347709"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare", action="store_true", required=True)
    parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    destination = root / "ui/tests/fixtures/.baseline-0.2.5"
    if destination.is_symlink() or destination.is_junction():
        raise RuntimeError("Baseline destination must not redirect outside the fixture tree")
    marker = destination / "baseline.json"
    if destination.exists() and not marker.is_file():
        raise RuntimeError("Refusing to overwrite an unrecognized baseline directory")
    if (
        marker.is_file()
        and json.loads(marker.read_text(encoding="utf-8"))["sourceCommit"] != BASELINE
    ):
        raise RuntimeError("Unexpected baseline identity")

    def git(*args: str) -> bytes:
        return subprocess.check_output(["git", *args], cwd=root)

    paths = (
        git("ls-tree", "-r", "--name-only", BASELINE, "--", "ui/src/visual-engine")
        .decode()
        .splitlines()
    )
    destination.mkdir(parents=True, exist_ok=True)
    if marker.is_symlink() or marker.is_junction():
        raise RuntimeError("Baseline marker must not redirect")
    marker.write_text(
        json.dumps({"sourceCommit": BASELINE, "preparing": True}) + "\n", encoding="utf-8"
    )
    records = {}

    def safe_target(relative: Path) -> Path:
        target = destination / relative
        cursor = target
        while cursor != root:
            if cursor.is_symlink() or cursor.is_junction():
                raise RuntimeError("Baseline path must not contain links or junctions")
            cursor = cursor.parent
        if not target.resolve().is_relative_to(destination.resolve()):
            raise RuntimeError("Baseline path escapes destination")
        return target

    for name in paths:
        path = Path(name)
        if not name.endswith(".ts") or path.parts[:3] != ("ui", "src", "visual-engine"):
            raise RuntimeError("Unexpected baseline path")
        content = git("show", f"{BASELINE}:{name}")
        target = safe_target(path.relative_to("ui"))
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        records[name] = hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()
    # The identical current test harness surrounds both engines. It is not a
    # historical engine file and its hash is explicitly recorded as such.
    harness = {}
    for name in ("visual-identity-II.ts", "palette-before.ts"):
        origin = root / "ui/tests/fixtures" / name
        content = origin.read_bytes()
        target = safe_target(Path("tests/fixtures") / name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        harness[name] = hashlib.sha256(content.replace(b"\r\n", b"\n")).hexdigest()
    marker.write_text(
        json.dumps(
            {
                "sourceCommit": BASELINE,
                "sourceSha256Lf": records,
                "currentHarnessSha256Lf": harness,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Prepared {len(records)} local baseline modules; no renderer or tests launched")


if __name__ == "__main__":
    main()
