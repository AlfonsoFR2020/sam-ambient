"""Real core/control lifecycle with deterministic provider discovery and no voice."""

import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sam_ambient import cli
from tests.unit.test_cli import FakeProvider


async def discovery(_args, *, bootstrap=False):
    return FakeProvider(), "discovered-model", None


cli.discover_provider = discovery
# This real-core fixture must never open the owner's application-data memory.
memory_directory = tempfile.TemporaryDirectory(prefix="sam-fixture-memory-")
cli.default_memory_path = lambda: Path(memory_directory.name) / "memory.sqlite3"
if sys.argv[1:2] == ["--packaged"]:
    from sam_ambient.supervisor.component_launcher import main

    raise SystemExit(main(sys.argv[2:]))
raise SystemExit(cli.main(["runtime", "--no-voice", "--no-tts", *sys.argv[1:]]))
