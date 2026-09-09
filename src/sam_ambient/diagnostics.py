"""Pure readiness classification shared by diagnostics and future installers."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import asdict, dataclass
from enum import StrEnum
from typing import Any


class ReadinessLevel(StrEnum):
    READY = "READY"
    AVAILABLE = "AVAILABLE"
    OPTIONAL = "OPTIONAL"
    MISSING = "MISSING"
    DEGRADED = "DEGRADED"
    ACTION_NEEDED = "ACTION NEEDED"


@dataclass(frozen=True, slots=True)
class ReadinessCheck:
    id: str
    level: ReadinessLevel
    summary: str
    action: str | None = None

    def to_dict(self) -> dict[str, str]:
        return {key: value for key, value in asdict(self).items() if value is not None}


def classify_readiness(report: Mapping[str, Any]) -> tuple[ReadinessCheck, ...]:
    """Convert bounded probe data to stable, user-facing readiness decisions."""
    checks: list[ReadinessCheck] = []
    runtime = _mapping(report.get("runtime"))
    checks.append(
        ReadinessCheck(
            "runtime",
            ReadinessLevel.READY if runtime.get("compatible") else ReadinessLevel.ACTION_NEEDED,
            str(runtime.get("detail", "Python runtime status unavailable")),
            None if runtime.get("compatible") else "Install the supported Python version.",
        )
    )
    checks.append(
        ReadinessCheck(
            "uv",
            ReadinessLevel.AVAILABLE if runtime.get("uv") else ReadinessLevel.OPTIONAL,
            "uv available" if runtime.get("uv") else "uv is not on PATH",
            None if runtime.get("uv") else "Install uv only when running Sam from source.",
        )
    )
    config = _mapping(report.get("configuration"))
    checks.append(
        ReadinessCheck(
            "configuration",
            ReadinessLevel.READY,
            str(config.get("detail", "Built-in defaults active")),
        )
    )
    browser = _mapping(report.get("browser"))
    checks.append(
        ReadinessCheck(
            "browser",
            ReadinessLevel.READY if browser.get("available") else ReadinessLevel.MISSING,
            str(browser.get("mode", "No supported browser launcher found")),
            None if browser.get("available") else "Open the packaged UI URL manually.",
        )
    )
    workspace = _mapping(report.get("workspace"))
    checks.append(
        ReadinessCheck(
            "workspace",
            ReadinessLevel.READY if workspace.get("writable") else ReadinessLevel.ACTION_NEEDED,
            str(workspace.get("path", "Workspace unavailable")),
            None if workspace.get("writable") else "Choose an existing writable Sam root.",
        )
    )
    providers = report.get("providers")
    services = providers if isinstance(providers, list) else []
    selected = _mapping(report.get("selection"))
    selected_provider = selected.get("provider")
    selected_model = selected.get("model")
    installed = [item for item in services if isinstance(item, Mapping) and item.get("executable")]
    running = [item for item in services if isinstance(item, Mapping) and item.get("running")]
    advertised = [
        model
        for item in services
        if isinstance(item, Mapping)
        for model in item.get("available_models", [])
        if isinstance(model, str)
    ]
    if selected_provider and selected_model:
        checks.append(
            ReadinessCheck("model", ReadinessLevel.READY, f"{selected_provider} · {selected_model}")
        )
    elif running and advertised:
        checks.append(
            ReadinessCheck(
                "model",
                ReadinessLevel.ACTION_NEEDED,
                "A local provider is running with an unloaded conversational model.",
                "Load one conversational model, then restart Sam.",
            )
        )
    elif running:
        checks.append(
            ReadinessCheck(
                "model",
                ReadinessLevel.ACTION_NEEDED,
                "A local provider is running but has no conversational model.",
                "Install or load a chat/instruct model; embedding models cannot converse.",
            )
        )
    elif installed:
        names = ", ".join(str(item.get("id")) for item in installed)
        checks.append(
            ReadinessCheck(
                "model",
                ReadinessLevel.AVAILABLE,
                f"Installed but stopped: {names}.",
                "Start Sam normally to allow bounded local provider bootstrap.",
            )
        )
    else:
        checks.append(
            ReadinessCheck(
                "model",
                ReadinessLevel.ACTION_NEEDED,
                "No usable local model runtime was found.",
                "Install Ollama or LM Studio and one conversational model; "
                "Sam never downloads one silently.",
            )
        )
    stt = _mapping(report.get("stt"))
    if stt.get("available"):
        checks.append(ReadinessCheck("stt", ReadinessLevel.READY, str(stt.get("detail"))))
    elif stt.get("assets_available"):
        checks.append(
            ReadinessCheck(
                "stt",
                ReadinessLevel.AVAILABLE,
                "Local whisper.cpp assets are present; normal startup can start the service.",
            )
        )
    else:
        checks.append(
            ReadinessCheck(
                "stt",
                ReadinessLevel.MISSING,
                str(stt.get("detail", "Speech recognition is unavailable.")),
                "Text conversation remains available; install/configure whisper.cpp "
                "for voice input.",
            )
        )
    tts = _mapping(report.get("tts"))
    checks.append(
        ReadinessCheck(
            "tts",
            ReadinessLevel.READY if tts.get("available") else ReadinessLevel.MISSING,
            str(tts.get("detail") or tts.get("backend") or "Spoken output unavailable"),
            None
            if tts.get("available")
            else "Text output remains available; install a supported system TTS backend.",
        )
    )
    audio = _mapping(report.get("audio"))
    input_ready = bool(audio.get("input_available"))
    output_ready = bool(audio.get("output_available"))
    checks.append(
        ReadinessCheck(
            "audio",
            ReadinessLevel.READY if input_ready and output_ready else ReadinessLevel.DEGRADED,
            (
                f"input={'ready' if input_ready else 'missing'}, "
                f"output={'ready' if output_ready else 'missing'}"
            ),
            None
            if input_ready and output_ready
            else "Text mode remains usable; check OS audio devices and permissions.",
        )
    )
    ui = _mapping(report.get("ui"))
    checks.append(
        ReadinessCheck(
            "ui",
            ReadinessLevel.READY if ui.get("available") else ReadinessLevel.MISSING,
            str(ui.get("url", "Packaged UI missing")),
        )
    )
    supervisor = _mapping(report.get("supervisor"))
    supervisor_state = str(supervisor.get("state", "persisted status available"))
    security = _mapping(supervisor.get("security"))
    unsafe = supervisor_state in {"SAFE_MODE", "CRASH_LOOP"} or security.get("active") is False
    checks.append(
        ReadinessCheck(
            "supervisor",
            ReadinessLevel.DEGRADED
            if unsafe
            else ReadinessLevel.OPTIONAL
            if supervisor_state == "not_started"
            else ReadinessLevel.AVAILABLE,
            supervisor_state,
            "Review recent crashes before explicitly restoring capabilities." if unsafe else None,
        )
    )
    return tuple(checks)


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}
