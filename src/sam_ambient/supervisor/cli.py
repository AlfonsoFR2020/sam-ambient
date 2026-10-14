"""Trusted `sam-supervisor` entry point."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal
import sys
import time
from collections.abc import Sequence
from dataclasses import asdict
from pathlib import Path

from sam_ambient import __version__
from sam_ambient.configuration import ConfigurationError, configure_namespace
from sam_ambient.core.owner import OwnerSession
from sam_ambient.diagnostic_log import (
    DiagnosticLogError,
    diagnostic,
    finish_session,
    open_session_log,
)
from sam_ambient.logging_config import add_logging_arguments, configure_logging, operational_enabled
from sam_ambient.supervisor import (
    ComponentSpec,
    RestartPolicy,
    SubprocessLauncher,
    Supervisor,
    SupervisorStore,
)
from sam_ambient.supervisor.browser import BrowserHandoff
from sam_ambient.supervisor.owner_native import start_native_owner_channel
from sam_ambient.supervisor.single_instance import InstanceLock

log = logging.getLogger(__name__)


def _packaged_sibling(name: str) -> str | None:
    """Return a trusted frozen companion executable beside this process."""

    if not getattr(sys, "frozen", False):
        return None
    suffix = ".exe" if os.name == "nt" else ""
    executable = Path(sys.executable).with_name(f"{name}{suffix}")
    if not executable.is_file():
        raise OSError(f"packaged Sam component is missing: {executable}")
    return str(executable)


def _log_path(value: str) -> Path:
    if not value.strip() or "\x00" in value:
        raise argparse.ArgumentTypeError("--log-file needs a non-empty file path")
    return Path(value).expanduser()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sam-supervisor",
        description="Sam shared launcher and process supervisor",
        allow_abbrev=False,
        add_help=False,
        epilog=(
            "Examples: Start Sam.cmd --verbose --keep-console | "
            "Start Sam.cmd --keep-provider --log-file PATH"
        ),
    )
    parser.add_argument(
        "-h", "--help", action="store_true", help="Show options without starting Sam"
    )
    console = parser.add_mutually_exclusive_group()
    console.add_argument(
        "--keep-console",
        action="store_true",
        default=None,
        help="Keep the interactive console after exit, independently of logging",
    )
    console.add_argument(
        "--no-keep-console",
        dest="keep_console",
        action="store_false",
        help="Override diagnostic preset's successful-exit console hold",
    )
    parser.add_argument(
        "--log-file",
        type=_log_path,
        help="Bounded JSONL path (relative to effective root); enables file diagnostics",
    )
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
    parser.add_argument("--native-owner-channel", action="store_true", help=argparse.SUPPRESS)
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
    parser.add_argument(
        "--keep-model", action="store_true", help="Keep Sam-loaded models for this session only"
    )
    parser.add_argument(
        "--keep-provider",
        action="store_true",
        help="Keep Sam-started serving endpoints for this session only",
    )
    parser.add_argument("--stt-url", default="http://127.0.0.1:8080")
    parser.add_argument(
        "--stt-language", default="auto", help="Hard recognition language code, or auto"
    )
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
    packaged = _packaged_sibling("sam-core")
    command = [
        *(
            [packaged]
            if packaged
            else [sys.executable, "-m", "sam_ambient.supervisor.component_launcher"]
        ),
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
    for flag in ("verbose", "keep_model", "keep_provider"):
        if getattr(args, flag, False):
            command.append("--" + flag.replace("_", "-"))
    if operational_enabled(args):
        command.extend(("--diagnostic", "--diagnostic-child"))
    if args.tts_voice != "default":
        command.extend(("--tts-voice", args.tts_voice))
    if args.preferred_languages != ("en", "es"):
        command.extend(("--preferred-languages", ",".join(args.preferred_languages)))
    if args.stt_url:
        command.extend(("--stt-url", args.stt_url))
    if getattr(args, "stt_language", "auto") != "auto":
        command.extend(("--stt-language", args.stt_language))
    return tuple(command)


def _trusted_ui_command(args: argparse.Namespace) -> tuple[str, ...]:
    packaged = _packaged_sibling("sam-ui")
    command = [
        *([packaged] if packaged else [sys.executable, "-m", "sam_ambient", "ui"]),
        "--port",
        str(args.ui_port),
        "--log-level",
        "DEBUG" if args.verbose else args.log_level,
    ]
    if args.verbose:
        command.append("--verbose")
    if operational_enabled(args):
        command.extend(("--diagnostic", "--diagnostic-child"))
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
    handler = None
    exit_code = 2
    try:
        if operational_enabled(args):
            raw_path = getattr(args, "log_file", None)
            path = (root / raw_path).resolve(strict=False) if raw_path is not None else None
            handler = open_session_log(
                root,
                path=path,
                console_only=not (args.diagnostic or raw_path is not None),
                verbose=args.verbose,
            )
        exit_code = await _run_locked(args, root, state_db)
        return exit_code
    except BaseException as error:
        exit_code = 130 if isinstance(error, (KeyboardInterrupt, asyncio.CancelledError)) else 2
        diagnostic("supervisor.failed", state="failed", error_class=type(error).__name__)
        raise
    finally:
        if handler is not None:
            finish_session(handler, exit_code)
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
            # Exit may spend 2 s retiring tasks, then 8 s each on model unload and service stop.
            restart=RestartPolicy(startup_timeout_s=90, shutdown_timeout_s=24),
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
    diagnostic(
        "supervisor.start",
        keep_model=args.keep_model,
        keep_provider=args.keep_model or args.keep_provider,
    )
    owner_session = OwnerSession()
    browser = BrowserHandoff(
        args.ui_port, mode=args.ui_mode, root=root, owner_session=owner_session
    )
    browser_task = None

    def ready(_component_id: str) -> None:
        nonlocal browser_task
        # A ready callback may fire repeatedly as components restart. The browser
        # belongs to this supervisor lifetime, never to a component lifetime.
        ui = supervisor.statuses.get("sam-ui")
        if args.open_ui and ui is not None and browser_task is None and ui.health == "HEALTHY":
            browser_task = asyncio.create_task(open_and_watch_window())

    shutdown_task = None
    restart_task = None

    def request_shutdown() -> None:
        nonlocal shutdown_task
        if shutdown_task is None:
            shutdown_task = asyncio.create_task(supervisor.shutdown())

    def request_restart() -> None:
        nonlocal restart_task
        if restart_task is None or restart_task.done():
            restart_task = asyncio.create_task(supervisor.restart_component("sam-core"))

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
        SubprocessLauncher(
            request_shutdown=request_shutdown,
            request_restart=request_restart,
            owner_session=owner_session,
        ),
        store,
        on_ready=ready,
    )
    if args.native_owner_channel:
        start_native_owner_channel(
            owner_session,
            lambda: supervisor.statuses["sam-core"].instance_id,
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
        if restart_task is not None:
            await asyncio.gather(restart_task, return_exceptions=True)
        if browser_task is not None:
            browser_task.cancel()
            await asyncio.gather(browser_task, return_exceptions=True)
        owner_session.revoke()
        await browser.aclose()
    return 0


def _hold_console(args: argparse.Namespace, exit_code: int) -> None:
    keep = args.keep_console if args.keep_console is not None else args.diagnostic
    # The CMD wrapper owns failure retention, including executable/bootstrap errors.
    if not keep or (exit_code != 0 and os.environ.get("SAM_CMD_WRAPPER") == "1"):
        return
    if sys.stdin is not None and sys.stdin.isatty():
        try:
            input(f"Sam finished with exit code {exit_code}. Press Enter to close this console...")
        except (EOFError, KeyboardInterrupt):
            pass


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    arguments = list(sys.argv[1:] if argv is None else argv)
    args = None
    exit_code = 2
    try:
        args = parser.parse_args(arguments)
        if args.help:
            parser.print_help()
            exit_code = 0
            return exit_code
        try:
            configure_namespace(args, arguments, supervisor=True)
        except ConfigurationError as error:
            parser.error(str(error))
        configure_logging(args)
        if args.keep_model or args.keep_provider:
            print(
                "Session-only retention: "
                + (
                    "model and serving endpoint."
                    if args.keep_model
                    else "serving endpoint; model follows saved cleanup preferences."
                ),
                file=sys.stderr,
            )
        exit_code = asyncio.run(run(args))
    except SystemExit as error:
        exit_code = int(error.code or 0)
    except (OSError, ValueError) as error:
        detail = (
            type(error).__name__
            if args is not None
            and operational_enabled(args)
            and not isinstance(error, DiagnosticLogError)
            else str(error)
        )
        print(f"Supervisor error: {detail}", file=sys.stderr)
        print(
            "Check the checkout, configuration and --log-file path/permissions. "
            "Windows launchers retain failures for inspection.",
            file=sys.stderr,
        )
    except KeyboardInterrupt:
        exit_code = 130
    finally:
        if args is not None:
            _hold_console(args, exit_code)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
