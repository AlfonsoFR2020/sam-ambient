"""Development command-line entry point for Sam."""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from sam_ambient import __version__


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sam",
        description="Sam development harness",
    )
    parser.add_argument("--version", action="version", version=f"Sam {__version__}")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    build_parser().parse_args(argv)
    print("Sam core is ready. Conversational text mode arrives in Phase 2.")
    return 0
