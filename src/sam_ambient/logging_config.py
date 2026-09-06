"""Human-readable lifecycle logs; provider HTTP bodies and credentials stay private."""

import argparse
import logging


def add_logging_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--verbose", action="store_true", help="Enable Sam DEBUG diagnostics")
    parser.add_argument(
        "--log-level", choices=("DEBUG", "INFO", "WARNING", "ERROR"), default="INFO"
    )


def configure_logging(args: argparse.Namespace) -> None:
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    # HTTP debug logs can include credentials/query strings. Verbose is Sam-only.
    for name in ("httpx", "httpcore", "websockets", "asyncio"):
        logging.getLogger(name).setLevel(logging.WARNING)


def log_value(value: object, limit: int = 240) -> str:
    return "".join(char if char.isprintable() else " " for char in str(value))[:limit]
