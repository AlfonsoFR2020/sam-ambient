"""Text-mode development and diagnostics command line for Sam."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
from collections.abc import Callable, Sequence
from importlib.resources import files
from pathlib import Path
from urllib.parse import urlsplit

import sounddevice

from sam_ambient import __version__
from sam_ambient.adapters.audio import SoundDeviceCapture, SoundDeviceOutput
from sam_ambient.adapters.local_discovery import Discovery, discover_local, provider_for
from sam_ambient.adapters.ollama import (
    DEFAULT_OLLAMA_BASE_URL,
    OllamaProvider,
)
from sam_ambient.adapters.openai_compatible import OpenAICompatibleProvider
from sam_ambient.adapters.stt import (
    DEFAULT_WHISPER_CPP_URL,
    SpeechRecognitionError,
    WhisperCppServerSTT,
)
from sam_ambient.adapters.tts import SystemTextToSpeech, TextToSpeechUnavailable
from sam_ambient.adapters.ui.demo import run_demo_bridge
from sam_ambient.adapters.vad import WebRtcVoiceActivityDetector
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    MessageRole,
    ModelEventKind,
    ProviderError,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.lifecycle import parent_stop_event, serve_until_stop
from sam_ambient.logging_config import add_logging_arguments, configure_logging, log_value
from sam_ambient.runtime import RuntimeConfig, RuntimeVoiceAdapters, SamRuntime
from sam_ambient.static_server import StaticUiServer, StaticUiUnavailable
from sam_ambient.supervisor import SupervisorStore, UpdateError, UpdateStore, read_active_pointer
from sam_ambient.supervisor.browser import BrowserHandoff, ui_http_ready

log = logging.getLogger(__name__)


def _add_provider_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--provider",
        choices=("auto", "ollama", "lm-studio", "openai-compatible"),
        default="auto",
    )
    parser.add_argument("--base-url", help="Provider API base URL")
    parser.add_argument(
        "--local-compatible-url", help="Additional explicit loopback compatible endpoint"
    )
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

    doctor = subparsers.add_parser("doctor", help="Check complete local MVP readiness")
    _add_provider_arguments(doctor)
    doctor.add_argument("--root", default=".", help="Sam workspace/authorized root")
    doctor.add_argument("--state-db", help="Operational SQLite path")
    doctor.add_argument("--stt-url", default=DEFAULT_WHISPER_CPP_URL)
    doctor.add_argument("--json", action="store_true", help="Print machine-readable diagnostics")
    doctor.add_argument("--ui-port", type=int, default=8766)

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
    runtime.add_argument("--runtime-instance-id", help=argparse.SUPPRESS)
    runtime.add_argument("--capability-epoch", type=int, default=0, help=argparse.SUPPRESS)
    runtime.add_argument("--capabilities-revoked", action="store_true", help=argparse.SUPPRESS)
    runtime.add_argument("--safe-mode", action="store_true", help=argparse.SUPPRESS)
    runtime.add_argument("--state-db", help=argparse.SUPPRESS)
    runtime.add_argument("--no-voice", action="store_true", help="Disable microphone/VAD/STT")
    runtime.add_argument("--no-tts", action="store_true", help="Disable spoken output")
    runtime.add_argument("--stt-url", default=DEFAULT_WHISPER_CPP_URL)

    ui = subparsers.add_parser("ui", help="Serve the packaged ambient UI on loopback")
    ui.add_argument("--port", type=int, default=8766, help="Loopback HTTP port")
    ui.add_argument("--open-browser", action="store_true")
    ui.add_argument("--runtime-instance-id", help=argparse.SUPPRESS)
    for command in (chat, models, doctor, bridge, runtime, ui):
        add_logging_arguments(command)
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


async def discover_provider(
    args: argparse.Namespace,
) -> tuple[LLMProvider, str | None, Discovery | None]:
    if args.provider == "openai-compatible" and not args.compatible_is_local:
        return create_provider(args), args.model, None
    discovery = await discover_local(
        provider=args.provider,
        base_url=args.base_url,
        model=args.model,
        compatible_url=args.local_compatible_url,
    )
    for service in discovery.services:
        log.info(
            "Provider %s: installed=%s running=%s models=%d; %s",
            service.id,
            bool(service.executable),
            service.running,
            len(service.models),
            service.detail,
        )
        log.debug("Discovery endpoint: %s", service.endpoint)
    selected = discovery.selected
    log.info(
        "Selected provider=%s model=%s; %s",
        selected.id if selected else "none",
        log_value(discovery.model or "none"),
        discovery.reason,
    )
    fallback = next(
        (service for service in discovery.services if service.id == args.provider),
        discovery.services[0],
    )
    return provider_for(selected or fallback), discovery.model, discovery


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
    provider, requested, _ = await discover_provider(args)
    try:
        cancellation = CancellationToken()
        model = await select_model(provider, requested or args.model, cancellation)
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
    provider, _, _ = await discover_provider(args)
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
    provider, selected_model, discovery = await discover_provider(args)
    root, state_db = _doctor_paths(args)
    report: dict[str, object] = {"sam_version": __version__, "authorized_roots": [str(root)]}
    try:
        cancellation = CancellationToken()
        health = await provider.health(cancellation)
        models = (
            ([selected_model] if selected_model else [])
            if discovery
            else [item.id for item in await provider.list_models(cancellation)]
            if health.available
            else []
        )
        if discovery:
            report.update(discovery.to_dict())
        report["provider"] = {
            "id": provider.id,
            "available": health.available,
            "detail": "reachable" if health.available else "unavailable",
            "version": health.version,
            "models": models,
        }
        try:
            devices = await asyncio.to_thread(sounddevice.query_devices)
            device_names = [str(device["name"])[:200] for device in devices]
            default_devices = list(sounddevice.default.device)
            report["audio"] = {
                "available": bool(device_names),
                "devices": device_names[:32],
                "truncated": len(device_names) > 32,
                "default": default_devices,
            }
        except Exception as error:
            report["audio"] = {"available": False, "detail": str(error)[:300]}

        tts_available = False
        tts_detail = "unavailable"
        try:
            tts = SystemTextToSpeech()
            try:
                await tts.probe()
                tts_available = True
                tts_detail = tts.backend_id
            finally:
                await tts.aclose()
        except Exception as error:
            tts_detail = str(error)[:300]
        report["tts"] = {"available": tts_available, "backend": tts_detail}

        try:
            parsed_stt = urlsplit(args.stt_url)
            stt_host = parsed_stt.hostname or "127.0.0.1"
            stt_port = parsed_stt.port or (443 if parsed_stt.scheme == "https" else 80)
            async with asyncio.timeout(2):
                _reader, writer = await asyncio.open_connection(stt_host, stt_port)
            writer.close()
            await writer.wait_closed()
            stt_available = True
            stt_detail = "TCP reachable"
        except Exception as error:
            stt_available = False
            stt_detail = f"{type(error).__name__}: {error}"[:300]
        report["stt"] = {
            "available": stt_available,
            "endpoint": args.stt_url,
            "detail": stt_detail,
        }

        ui_index = files("sam_ambient").joinpath("static/index.html")
        report["ui"] = {
            "available": ui_index.is_file(),
            "transport": "localhost-websocket",
            "url": f"http://127.0.0.1:{args.ui_port}",
            "running": await ui_http_ready(args.ui_port),
        }
        component_root = root / ".sam/components/sam-core"
        active: dict[str, object] = {"version": __version__, "source": "python-package"}
        if (component_root / "active.json").exists():
            try:
                pointer = read_active_pointer("sam-core", component_root)
                active = {
                    "version": pointer["version"],
                    "artifact_hash": pointer["artifact_hash"],
                    "source": "active.json",
                }
            except UpdateError as error:
                active = {"error": str(error), "source": "invalid-active.json"}
        report["active_component"] = active

        if state_db.is_file():
            report["supervisor"] = SupervisorStore(state_db).diagnostic_snapshot()
            try:
                report["updates"] = [
                    {
                        "update_tx_id": item.update_tx_id,
                        "component_id": item.component_id,
                        "state": item.state,
                    }
                    for item in UpdateStore(state_db).incomplete()
                ]
            except UpdateError as error:
                report["updates"] = {"error": str(error)}
        else:
            report["supervisor"] = {"state": "not_started", "state_db": str(state_db)}
            report["updates"] = []

        if args.json:
            print(json.dumps(report, indent=2, sort_keys=True, default=str))
        else:
            _print_doctor(report)
        return 0 if health.available and bool(models) and ui_index.is_file() else 1
    finally:
        await provider.aclose()


def _doctor_paths(args: argparse.Namespace) -> tuple[Path, Path]:
    root = Path(args.root).resolve(strict=True)
    state_db = (
        Path(args.state_db).resolve(strict=False) if args.state_db else root / ".sam/state.db"
    )
    return root, state_db


def _print_doctor(report: dict[str, object]) -> None:
    provider = report["provider"]
    audio = report["audio"]
    tts = report["tts"]
    stt = report["stt"]
    ui = report["ui"]
    active = report["active_component"]
    assert isinstance(provider, dict)
    assert isinstance(audio, dict)
    assert isinstance(tts, dict)
    assert isinstance(stt, dict)
    assert isinstance(ui, dict)
    assert isinstance(active, dict)
    print(f"Sam {report['sam_version']}")
    supervisor = report["supervisor"]
    assert isinstance(supervisor, dict)
    print(f"Supervisor: {supervisor.get('state', 'persisted component status below')}")
    if "components" in supervisor:
        for component in supervisor["components"].values():
            print(f"  {component['component_id']}: {component['health']}")
    print(f"Security: {supervisor.get('security', {})}")
    print(f"Active core: {active.get('version', active.get('error', 'unknown'))}")
    print(
        f"Packaged UI: {'ready' if ui['available'] else 'missing'}; "
        f"{ui['url']}; running={ui['running']}"
    )
    print(f"Audio devices: {len(audio.get('devices', [])) if audio.get('available') else 0}")
    print(f"STT: {'reachable' if stt['available'] else 'unavailable'} ({stt['detail']})")
    print(f"TTS: {'ready' if tts['available'] else 'unavailable'} ({tts['backend']})")
    print(
        f"Provider: {'healthy' if provider['available'] else 'unavailable'} "
        f"({provider['detail']}); models={len(provider['models'])}"
    )
    for service in report.get("providers", []):
        print(
            f"{service['id']}: installed={bool(service['executable'])} "
            f"running={service['running']} "
            f"models={service['models']}; {service['detail']}"
        )
    print(f"Selected: {report.get('selection', {'provider': provider['id']})}")
    print(f"Authorized roots: {', '.join(report['authorized_roots'])}")


async def run_runtime(args: argparse.Namespace) -> int:
    provider, model, discovery = await discover_provider(args)
    stop = parent_stop_event() if args.runtime_instance_id else asyncio.Event()
    tts = None
    output = None
    if not args.no_tts:
        try:
            tts = SystemTextToSpeech()
            output = SoundDeviceOutput(tts.audio_format)
        except TextToSpeechUnavailable:
            log.warning("TTS unavailable; text output remains available")
    log.info("TTS: %s", tts.backend_id if tts else "disabled/unavailable")
    voice = None
    if not args.no_voice:
        stt = WhisperCppServerSTT(base_url=args.stt_url)
        try:
            await stt.ensure_ready(Path(args.root))
            voice = RuntimeVoiceAdapters(SoundDeviceCapture(), WebRtcVoiceActivityDetector(), stt)
        except SpeechRecognitionError as error:
            await stt.aclose()
            log.warning("STT unavailable: %s; text input remains available", error)
        except BaseException:
            await stt.aclose()
            raise
    log.info(
        "Microphone/STT: %s",
        "configured (availability checked on capture)" if voice else "disabled",
    )
    runtime = SamRuntime(
        provider,
        RuntimeConfig(
            workspace_root=Path(args.root),
            port=args.port,
            model=model or args.model,
            provider_selection_reason=discovery.reason if discovery else "explicit configuration",
            allow_cloud=args.allow_cloud,
            workspace_writable=args.allow_workspace_write,
            runtime_instance_id=args.runtime_instance_id,
            capability_epoch=args.capability_epoch,
            capabilities_active=not (args.capabilities_revoked or args.safe_mode),
            capability_reason=(
                "supervisor_safe_mode"
                if args.safe_mode
                else "supervisor_revoked_after_failure"
                if args.capabilities_revoked
                else None
            ),
            state_db=Path(args.state_db) if args.state_db else None,
        ),
        voice=voice,
        tts=tts,
        audio_output=output,
    )
    try:
        await runtime.start()
        health_state = "HEALTHY"
        health_detail = "runtime ready"
        try:
            async with asyncio.timeout(3):
                provider_health = await provider.health(CancellationToken())
            if not provider_health.available:
                health_state = "DEGRADED"
                health_detail = "provider unavailable; run sam doctor for discovery status"
        except Exception as error:
            health_state = "DEGRADED"
            health_detail = f"provider health failed: {type(error).__name__}"[:500]
        if not runtime.capability_authority.snapshot.active:
            health_state = "DEGRADED"
            health_detail = "runtime ready with computer-action capabilities revoked"
        if discovery is not None and discovery.selected is None:
            health_state, health_detail = "DEGRADED", discovery.reason
        log.info("Core %s: %s", health_state, health_detail)
        if args.runtime_instance_id:
            print(
                "SAM_READY "
                + json.dumps(
                    {
                        "health": health_state,
                        "instance_id": args.runtime_instance_id,
                        "detail": health_detail,
                        "port": runtime.bridge.port,
                    },
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                flush=True,
            )
        log.info("Core bridge: ws://127.0.0.1:%d", runtime.bridge.port)

        async def await_quit() -> None:
            await runtime.shutdown_requested.wait()
            if args.runtime_instance_id:
                print(
                    "SAM_SHUTDOWN " + json.dumps({"instance_id": args.runtime_instance_id}),
                    flush=True,
                )
            else:
                stop.set()

        quit_task = asyncio.create_task(await_quit())
        try:
            await serve_until_stop(runtime.serve_forever(), stop)
        finally:
            quit_task.cancel()
            await asyncio.gather(quit_task, return_exceptions=True)
        return 0
    finally:
        await runtime.close()
        log.info("Core stopped")


async def run_ui(args: argparse.Namespace) -> int:
    server = StaticUiServer(port=args.port)
    try:
        await server.start()
        if args.runtime_instance_id:
            print(
                "SAM_READY "
                + json.dumps(
                    {
                        "health": "HEALTHY",
                        "instance_id": args.runtime_instance_id,
                        "detail": "packaged ambient UI ready",
                        "port": server.port,
                    },
                    separators=(",", ":"),
                    sort_keys=True,
                ),
                flush=True,
            )
        log.info("Sam UI: http://127.0.0.1:%d", server.port)
        if args.open_browser:
            await BrowserHandoff(server.port).open_once()
        stop = parent_stop_event() if args.runtime_instance_id else asyncio.Event()
        await serve_until_stop(server.serve_forever(), stop)
        return 0
    finally:
        await server.close()


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
    if args.command == "ui":
        return await run_ui(args)
    raise AssertionError(f"unhandled command: {args.command}")


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command is None:
        parser.print_help()
        return 0
    configure_logging(args)
    try:
        return asyncio.run(_dispatch(args))
    except OperationCancelled:
        print("Cancelled.", file=sys.stderr)
        return 130
    except (ProviderError, StaticUiUnavailable, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 130
