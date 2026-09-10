"""cx_Freeze entry point for Sam's trusted supervisor."""

from sam_ambient.supervisor.cli import main

raise SystemExit(main())
