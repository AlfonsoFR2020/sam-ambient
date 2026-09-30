"""Real core/control lifecycle with deterministic provider discovery and no voice."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sam_ambient import cli
from tests.unit.test_cli import FakeProvider


async def discovery(_args, *, bootstrap=False):
    return FakeProvider(), "discovered-model", None


cli.discover_provider = discovery
if sys.argv[1:2] == ["--packaged"]:
    from sam_ambient.supervisor.component_launcher import main

    raise SystemExit(main(sys.argv[2:]))
raise SystemExit(cli.main(["runtime", "--no-voice", "--no-tts", *sys.argv[1:]]))
