"""End-user one-command launcher for the supervised Sam MVP."""

from __future__ import annotations

from collections.abc import Sequence

from sam_ambient.supervisor.cli import main as supervisor_main


def main(argv: Sequence[str] | None = None) -> int:
    return supervisor_main(argv)
