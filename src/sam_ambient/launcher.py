"""End-user one-command launcher for the supervised Sam MVP."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from pathlib import Path

from sam_ambient.supervisor.cli import main as supervisor_main


def main(argv: Sequence[str] | None = None) -> int:
    arguments = list(sys.argv[1:] if argv is None else argv)
    if "--root" not in arguments:
        arguments[0:0] = ["--root", str(Path.cwd())]
    if "--open-ui" not in arguments and "--no-ui" not in arguments:
        arguments.append("--open-ui")
    return supervisor_main(arguments)
