"""Trusted `sam-supervisor` entry point."""

from __future__ import annotations

import argparse
import asyncio
import json
import signal
import sys
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from sam_ambient.supervisor import (
    ComponentSpec,
    RestartPolicy,
    SubprocessLauncher,
    Supervisor,
    SupervisorStore,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sam-supervisor", description="Sam process supervisor")
    parser.add_argument("--root", required=True, help="Trusted Sam workspace root")
    parser.add_argument("--state-db", help="Operational SQLite path")
    parser.add_argument("--port", type=int, default=8765, help="Core loopback UI port")
    parser.add_argument("--model", help="Optional local model id")
    parser.add_argument("--base-url", help="Optional Ollama base URL")
    parser.add_argument("--allow-workspace-write", action="store_true")
    action = parser.add_mutually_exclusive_group()
    action.add_argument(
        "--status", action="store_true", help="Print persisted diagnostics and exit"
    )
    action.add_argument(
        "--restore-capabilities",
        action="store_true",
        help="Explicitly leave persisted safe mode from this trusted local console",
    )
    return parser


def _trusted_core_command(args: argparse.Namespace, root: Path) -> tuple[str, ...]:
    command = [
        sys.executable,
        "-m",
        "sam_ambient",
        "runtime",
        "--root",
        str(root),
        "--port",
        str(args.port),
    ]
    if args.model:
        command.extend(("--model", args.model))
    if args.base_url:
        command.extend(("--base-url", args.base_url))
    if args.allow_workspace_write:
        command.append("--allow-workspace-write")
    return tuple(command)


def _paths(args: argparse.Namespace) -> tuple[Path, Path]:
    root = Path(args.root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("--root must be an existing directory")
    state_db = (
        Path(args.state_db).resolve(strict=False) if args.state_db else root / ".sam/state.db"
    )
    return root, state_db


async def run(args: argparse.Namespace) -> int:
    root, state_db = _paths(args)
    store = SupervisorStore(state_db)
    if args.restore_capabilities:
        restored = store.restore_capabilities_trusted()
        print(json.dumps({"security": asdict(restored)}, sort_keys=True))
        return 0
    if args.status:
        print(json.dumps(store.diagnostic_snapshot(), indent=2, sort_keys=True))
        return 0
    spec = ComponentSpec(
        "sam-core",
        _trusted_core_command(args, root),
        root,
        restart=RestartPolicy(),
    )
    supervisor = Supervisor((spec,), SubprocessLauncher(), store)
    loop = asyncio.get_running_loop()
    for requested in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(requested, lambda: asyncio.create_task(supervisor.shutdown()))
        except NotImplementedError:
            pass
    try:
        await supervisor.run_forever()
    finally:
        await supervisor.shutdown()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return asyncio.run(run(args))
    except (OSError, ValueError) as error:
        print(f"Supervisor error: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
