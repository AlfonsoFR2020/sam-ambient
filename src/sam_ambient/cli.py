"""Text-mode development and diagnostics command line for Sam."""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

from sam_ambient import __version__
from sam_ambient.adapters.ollama import (
    DEFAULT_OLLAMA_BASE_URL,
    OllamaProvider,
    find_ollama_executable,
)
from sam_ambient.adapters.openai_compatible import OpenAICompatibleProvider
from sam_ambient.adapters.ui.demo import run_demo_bridge
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    MessageRole,
    ModelEventKind,
    ProviderError,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.runtime import RuntimeConfig, SamRuntime


def _add_provider_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--provider",
        choices=("ollama", "openai-compatible"),
        default="ollama",
    )
    parser.add_argument("--base-url", help="Provider API base URL")
    parser.add_argument("--model", help="Model id; defaults to the first discovered model")
    parser.add_argument(
        "--api-key-env",
        default="OPENAI_API_KEY",
        help="Environment variable containing the compatible-provider API key",
    )
    parser.add_argument(
        "--compatible-is-local",
        action="store_true",
        help="Mark an explicitly configured compatible endpoint as local",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sam",
        description="Sam development harness",
    )
    parser.add_argument("--version", action="version", version=f"Sam {__version__}")
    subparsers = parser.add_subparsers(dest="command")

    chat = subparsers.add_parser("chat", help="Stream a text conversation")
    _add_provider_arguments(chat)
    chat.add_argument("prompt", nargs="?", help="Single prompt; omit for interactive mode")

    models = subparsers.add_parser("models", help="List provider models")
    _add_provider_arguments(models)

    doctor = subparsers.add_parser("doctor", help="Check Ollama text-mode readiness")
    doctor.add_argument("--base-url", help="Ollama API base URL")

    bridge = subparsers.add_parser("bridge", help="Serve the local UI protocol bridge")
    bridge.add_argument("--demo", action="store_true", help="Publish deterministic core events")
    bridge.add_argument("--port", type=int, default=8765, help="Loopback WebSocket port")

    runtime = subparsers.add_parser("runtime", help="Serve the composed local Sam runtime")
    _add_provider_arguments(runtime)
    runtime.add_argument("--port", type=int, default=8765, help="Loopback WebSocket port")
    runtime.add_argument(
        "--root",
        required=True,
        help="Authorized workspace root exposed as the 'workspace' capability root",
    )
    runtime.add_argument(
        "--allow-workspace-write",
        action="store_true",
        help="Permit approval-gated files.write within the authorized workspace root",
    )
    runtime.add_argument(
        "--allow-cloud",
        action="store_true",
        help="Permit the explicitly configured cloud provider before private tool data exists",
    )
    return parser


def create_provider(args: argparse.Namespace) -> LLMProvider:
    if args.provider == "ollama":
        base_url = args.base_url or os.environ.get("OLLAMA_HOST") or DEFAULT_OLLAMA_BASE_URL
        return OllamaProvider(base_url=base_url)
    if not args.base_url:
        raise ValueError("--base-url is required for an OpenAI-compatible provider")
    api_key = os.environ.get(args.api_key_env)
    boundary = DataBoundary.LOCAL if args.compatible_is_local else DataBoundary.CLOUD
    return OpenAICompatibleProvider(
        provider_id="openai-compatible",
        base_url=args.base_url,
        api_key=api_key,
        data_boundary=boundary,
    )


async def select_model(
    provider: LLMProvider,
    requested_model: str | None,
    cancellation: CancellationToken,
) -> str:
    if requested_model:
        return requested_model
    models = await provider.list_models(cancellation)
    if not models:
        raise ProviderError(f"{provider.id} has no installed/available models")
    return models[0].id


async def stream_response(
    provider: LLMProvider,
    messages: Sequence[Message],
    *,
    model: str,
    cancellation: CancellationToken,
    write: Callable[[str], None] | None = None,
) -> str:
    output = write or sys.stdout.write
    parts: list[str] = []
    async for event in provider.stream_chat(
        messages,
        (),
        model=model,
        cancellation=cancellation,
    ):
        if event.kind is ModelEventKind.TEXT_DELTA:
            parts.append(event.text)
            output(event.text)
    return "".join(parts)


async def run_chat(args: argparse.Namespace) -> int:
    provider = create_provider(args)
    try:
        cancellation = CancellationToken()
        model = await select_model(provider, args.model, cancellation)
        history: list[Message] = []
        prompt = args.prompt

        while True:
            if prompt is None:
                try:
                    prompt = await asyncio.to_thread(input, "You> ")
                except EOFError:
                    return 0
                if prompt.strip().lower() in {"/exit", "/quit"}:
                    return 0
                if not prompt.strip():
                    prompt = None
                    continue
            history.append(Message(MessageRole.USER, prompt))
            if args.prompt is None:
                print("Sam> ", end="", flush=True)
            assistant = await stream_response(
                provider,
                history,
                model=model,
                cancellation=cancellation,
            )
            print()
            history.append(Message(MessageRole.ASSISTANT, assistant))
            if args.prompt is not None:
                return 0
            prompt = None
    finally:
        await provider.aclose()


async def run_models(args: argparse.Namespace) -> int:
    provider = create_provider(args)
    try:
        models = await provider.list_models(CancellationToken())
        for model in models:
            context = f" context={model.context_window}" if model.context_window else ""
            license_summary = model.license.splitlines()[0][:100] if model.license else ""
            license_name = f" license={license_summary}" if license_summary else ""
            print(f"{model.id}{context}{license_name}")
        return 0
    finally:
        await provider.aclose()


async def run_doctor(args: argparse.Namespace) -> int:
    base_url = args.base_url or os.environ.get("OLLAMA_HOST") or DEFAULT_OLLAMA_BASE_URL
    provider = OllamaProvider(base_url=base_url)
    try:
        cancellation = CancellationToken()
        executable = find_ollama_executable()
        health = await provider.health(cancellation)
        print(f"Sam {__version__}")
        print(f"Ollama executable: {executable or 'not found'}")
        print(
            f"Ollama service: {'healthy' if health.available else 'unavailable'} ({health.detail})"
        )
        if health.version:
            print(f"Ollama version: {health.version}")
        if not health.available:
            return 1
        models = await provider.list_models(cancellation)
        print(f"Installed models: {len(models)}")
        return 0 if models else 1
    finally:
        await provider.aclose()


async def run_runtime(args: argparse.Namespace) -> int:
    provider = create_provider(args)
    runtime = SamRuntime(
        provider,
        RuntimeConfig(
            workspace_root=Path(args.root),
            port=args.port,
            model=args.model,
            allow_cloud=args.allow_cloud,
            workspace_writable=args.allow_workspace_write,
        ),
    )
    try:
        await runtime.start()
        print(f"Sam runtime listening on ws://127.0.0.1:{runtime.bridge.port}")
        await runtime.serve_forever()
        return 0
    finally:
        await runtime.close()


async def _dispatch(args: argparse.Namespace) -> int:
    if args.command == "chat":
        return await run_chat(args)
    if args.command == "models":
        return await run_models(args)
    if args.command == "doctor":
        return await run_doctor(args)
    if args.command == "bridge":
        if not args.demo:
            raise ValueError("bridge currently requires --demo until the core lifecycle is wired")
        await run_demo_bridge(args.port)
        return 0
    if args.command == "runtime":
        return await run_runtime(args)
    raise AssertionError(f"unhandled command: {args.command}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    try:
        return asyncio.run(_dispatch(args))
    except OperationCancelled:
        print("Cancelled.", file=sys.stderr)
        return 130
    except (ProviderError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 130
