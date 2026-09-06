"""Real core/control lifecycle with deterministic provider discovery and no voice."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sam_ambient import cli
from tests.unit.test_cli import FakeProvider


async def discovery(_args):
    return FakeProvider(), "discovered-model", None


cli.discover_provider = discovery
raise SystemExit(cli.main(["runtime", "--no-voice", "--no-tts", *sys.argv[1:]]))
