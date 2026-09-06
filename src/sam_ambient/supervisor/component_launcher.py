"""Stable trusted launcher for the active version of a packaged component."""

from __future__ import annotations

import argparse
import os
import runpy
import sys
from collections.abc import Sequence
from pathlib import Path

from sam_ambient.supervisor.update_layout import read_active_pointer
from sam_ambient.supervisor.update_models import UpdateError


def resolve_core_command(
    component_root: Path,
    runtime_arguments: Sequence[str],
) -> tuple[str, ...]:
    """Resolve active Sam core code, falling back only when no pointer exists yet."""

    root = component_root.resolve(strict=False)
    pointer = root / "active.json"
    if not pointer.exists():
        return (sys.executable, "-m", "sam_ambient", "runtime", *runtime_arguments)

    active = read_active_pointer("sam-core", root)
    artifact = Path(str(active["path"])).resolve(strict=True)
    entrypoint = (artifact / "sam_core.py").resolve(strict=True)
    if not entrypoint.is_file() or not entrypoint.is_relative_to(artifact):
        raise UpdateError("active Sam core has no contained sam_core.py entry point")
    return (sys.executable, str(entrypoint), *runtime_arguments)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Launch the trusted active Sam core")
    parser.add_argument("--component-root", required=True)
    parser.add_argument("runtime_arguments", nargs=argparse.REMAINDER)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    runtime_arguments = args.runtime_arguments
    if runtime_arguments[:1] == ["--"]:
        runtime_arguments = runtime_arguments[1:]
    try:
        command = resolve_core_command(Path(args.component_root), runtime_arguments)
    except (OSError, UpdateError, ValueError) as error:
        print(f"Sam core activation error: {error}", file=sys.stderr)
        return 2
    if os.name == "nt":
        # Windows CRT exec spawns a descendant then exits the observed process.
        # Execute the resolved entry point in this child instead, preserving
        # supervisor PID/pipe ownership and its bounded graceful-stop channel.
        if command[1] == "-m":
            sys.argv = [command[2], *command[3:]]
            runpy.run_module(command[2], run_name="__main__", alter_sys=True)
        else:
            sys.argv = list(command[1:])
            sys.path[0] = str(Path(command[1]).parent)
            runpy.run_path(command[1], run_name="__main__")
        return 0
    os.execv(command[0], command)
    return 127  # pragma: no cover - exec never returns


if __name__ == "__main__":
    raise SystemExit(main())
