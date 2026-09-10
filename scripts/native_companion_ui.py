"""cx_Freeze entry point for Sam's packaged UI server."""

import sys

from sam_ambient.cli import main

raise SystemExit(main(["ui", *sys.argv[1:]]))
