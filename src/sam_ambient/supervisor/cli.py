"""Trusted `sam-supervisor` entry point."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import signal
import sys
import time
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from sam_ambient import __version__
from sam_ambient.configuration import ConfigurationError, configure_namespace
from sam_ambient.logging_config import add_logging_arguments, configure_logging
from sam_ambient.supervisor import (
    ComponentSpec,
    RestartPolicy,
    SubprocessLauncher,
    Supervisor,
    SupervisorStore,
)
from sam_ambient.supervisor.browser import BrowserHandoff
from sam_ambient.supervisor.single_instance import InstanceLock

log = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sam-supervisor", description="Sam process supervisor")
    parser.add_argument("--config", help="Explicit Sam TOML configuration file")
    parser.add_argument("--root", default=".", help="Trusted Sam workspace root")
    parser.add_argument("--state-db", help="Operational SQLite path")
    parser.add_argument("--port", type=int, default=8765, help="Core loopback UI port")
    parser.add_argument("--ui-port", type=int, default=8766, help="Packaged UI HTTP port")
    parser.add_argument("--open-ui", action="store_true", help="Open the packaged UI in a browser")
    parser.add_argument(
        "--ui-mode",
        choices=("app", "browser"),
        default="app",
        help="Dedicated app window (default), or normal browser for debugging",
    )
    parser.add_argument("--no-ui", action="store_true", help="Run only the supervised core")
    parser.add_argument("--model", help="Optional local model id")
    parser.add_argument("--base-url", help="Optional Ollama base URL")
    parser.add_argument(
        "--provider", choices=("auto", "ollama", "lm-studio", "openai-compatible"), default="auto"
    )
    parser.add_argument("--local-compatible-url", help="Additional loopback compatible endpoint")
    add_logging_arguments(parser)
    parser.add_argument("--allow-workspace-write", action="store_true")
    parser.add_argument("--allow-cloud", action="store_true")
    parser.add_argument("--no-voice", action="store_true")
    parser.add_argument("--no-tts", action="store_true")
    parser.add_argument("--stt-url", default="http://127.0.0.1:8080")
    parser.add_argument(
        "--preferred-languages",
        type=lambda value: tuple(part.strip() for part in value.split(",") if part.strip()),
        default=("en", "es"),
    )
    parser.add_argument("--tts-voice", default="default")
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
        "sam_ambient.supervisor.component_launcher",
        "--component-root",
        str(root / ".sam/components/sam-core"),
        "--",
        "--root",
        str(root),
        "--port",
        str(args.port),
        "--provider",
        args.provider,
        "--log-level",
        "DEBUG" if args.verbose else args.log_level,
    ]
    if args.config:
        command.extend(("--config", str(Path(args.config).resolve(strict=True))))
    if args.model:
        command.extend(("--model", args.model))
    if args.base_url:
        command.extend(("--base-url", args.base_url))
    if args.provider == "openai-compatible":
        command.append("--compatible-is-local")
    if args.local_compatible_url:
        command.extend(("--local-compatible-url", args.local_compatible_url))
    if args.allow_workspace_write:
        command.append("--allow-workspace-write")
    if args.allow_cloud:
        command.append("--allow-cloud")
    if args.no_voice:
        command.append("--no-voice")
    if args.no_tts:
        command.append("--no-tts")
    if args.tts_voice != "default":
        command.extend(("--tts-voice", args.tts_voice))
    if args.preferred_languages != ("en", "es"):
        command.extend(("--preferred-languages", ",".join(args.preferred_languages)))
    if args.stt_url:
        command.extend(("--stt-url", args.stt_url))
    return tuple(command)


def _trusted_ui_command(args: argparse.Namespace) -> tuple[str, ...]:
    command = [
        sys.executable,
        "-m",
        "sam_ambient",
        "ui",
        "--port",
        str(args.ui_port),
        "--log-level",
        "DEBUG" if args.verbose else args.log_level,
    ]
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
    instance = InstanceLock(root / ".sam/supervisor.lock")
    if not instance.acquire():
        url = f"http://127.0.0.1:{args.ui_port}"
        log.info("Sam is already running. Existing UI: %s", url)
        return 0
    try:
        return await _run_locked(args, root, state_db)
    finally:
        instance.release()


async def _run_locked(args: argparse.Namespace, root: Path, state_db: Path) -> int:
    store = SupervisorStore(state_db)
    if args.restore_capabilities:
        restored = store.restore_capabilities_trusted()
        print(json.dumps({"security": asdict(restored)}, sort_keys=True))
        return 0
    if args.status:
        print(json.dumps(store.diagnostic_snapshot(), indent=2, sort_keys=True))
        return 0
    components = [
        ComponentSpec(
            "sam-core",
            _trusted_core_command(args, root),
            root,
            restart=RestartPolicy(startup_timeout_s=90),  # Bounded provider/model + STT bootstrap.
        )
    ]
    if not args.no_ui:
        components.append(
            ComponentSpec(
                "sam-ui",
                _trusted_ui_command(args),
                root,
                critical=False,
                restart=RestartPolicy(),
            )
        )
    log.info("Sam %s starting", __version__)
    browser = BrowserHandoff(args.ui_port, mode=args.ui_mode, root=root)
    browser_task = None

    def ready(_component_id: str) -> None:
        nonlocal browser_task
        # A ready callback may fire repeatedly as components restart. The browser
        # belongs to this supervisor lifetime, never to a component lifetime.
        ui = supervisor.statuses.get("sam-ui")
        if args.open_ui and ui is not None and browser_task is None and ui.health == "HEALTHY":
            browser_task = asyncio.create_task(open_and_watch_window())

    shutdown_task = None

    def request_shutdown() -> None:
        nonlocal shutdown_task
        if shutdown_task is None:
            shutdown_task = asyncio.create_task(supervisor.shutdown())

    async def open_and_watch_window() -> None:
        opened_at = time.monotonic()
        if await browser.open_once() and await browser.wait_for_app_close():
            if time.monotonic() - opened_at < 1:
                log.warning(
                    "Sam window exited during launch; Sam remains available at http://127.0.0.1:%d",
                    args.ui_port,
                )
                return
            log.info("Sam window closed; shutting down")
            request_shutdown()

    supervisor = Supervisor(
        tuple(components),
        SubprocessLauncher(request_shutdown=request_shutdown),
        store,
        on_ready=ready,
    )
    if not args.no_ui:
        log.info("UI address: http://127.0.0.1:%d", args.ui_port)
    loop = asyncio.get_running_loop()
    for requested in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(requested, request_shutdown)
        except NotImplementedError:
            pass
    try:
        await supervisor.run_forever()
    finally:
        await supervisor.shutdown()
        if shutdown_task is not None:
            await shutdown_task
        if browser_task is not None:
            browser_task.cancel()
            await asyncio.gather(browser_task, return_exceptions=True)
        browser.close()
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    arguments = list(sys.argv[1:] if argv is None else argv)
    args = parser.parse_args(arguments)
    try:
        configure_namespace(args, arguments, supervisor=True)
    except ConfigurationError as error:
        parser.error(str(error))
    configure_logging(args)
    try:
        return asyncio.run(run(args))
    except (OSError, ValueError) as error:
        print(f"Supervisor error: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
