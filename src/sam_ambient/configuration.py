"""Validated Sam configuration with explicit, testable precedence."""

from __future__ import annotations

import os
import tomllib
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

CONFIG_SCHEMA_VERSION = 1


class ConfigurationError(ValueError):
    """A configuration source could not be safely interpreted."""


@dataclass(frozen=True, slots=True)
class ProviderSettings:
    preference: str = "auto"
    model: str | None = None
    base_url: str | None = None
    local_compatible_url: str | None = None
    compatible_is_local: bool = False


@dataclass(frozen=True, slots=True)
class VoiceSettings:
    stt_enabled: bool = True
    stt_url: str = "http://127.0.0.1:8080"
    preferred_languages: tuple[str, ...] = ("en", "es")
    tts_enabled: bool = True
    tts_voice: str = "default"


@dataclass(frozen=True, slots=True)
class ApplicationSettings:
    root: Path = field(default_factory=Path.cwd)
    open_ui: bool = True


@dataclass(frozen=True, slots=True)
class CapabilitySettings:
    workspace_write: bool = False


@dataclass(frozen=True, slots=True)
class PrivacySettings:
    allow_cloud: bool = False


@dataclass(frozen=True, slots=True)
class McpServerSettings:
    """Trusted local MCP launch specification (never model-controlled)."""

    server_id: str
    command: tuple[str, ...]
    working_directory: Path | None = None
    timeout_s: float = 20.0
    result_limit_bytes: int = 131_072


@dataclass(frozen=True, slots=True)
class ExternalSettings:
    mcp_servers: tuple[McpServerSettings, ...] = ()


@dataclass(frozen=True, slots=True)
class SamSettings:
    schema_version: int = CONFIG_SCHEMA_VERSION
    provider: ProviderSettings = field(default_factory=ProviderSettings)
    voice: VoiceSettings = field(default_factory=VoiceSettings)
    application: ApplicationSettings = field(default_factory=ApplicationSettings)
    capabilities: CapabilitySettings = field(default_factory=CapabilitySettings)
    privacy: PrivacySettings = field(default_factory=PrivacySettings)
    external: ExternalSettings = field(default_factory=ExternalSettings)
    sources: tuple[Path, ...] = ()


_SCHEMA: dict[str, frozenset[str]] = {
    "provider": frozenset(
        {"preference", "model", "base_url", "local_compatible_url", "compatible_is_local"}
    ),
    "voice": frozenset(
        {"stt_enabled", "stt_url", "preferred_languages", "tts_enabled", "tts_voice"}
    ),
    "application": frozenset({"root", "open_ui"}),
    "capabilities": frozenset({"workspace_write"}),
    "privacy": frozenset({"allow_cloud"}),
    "external": frozenset({"mcp_servers"}),
}

_ENV: dict[str, tuple[str, str]] = {
    "SAM_PROVIDER": ("provider", "preference"),
    "SAM_MODEL": ("provider", "model"),
    "SAM_BASE_URL": ("provider", "base_url"),
    "SAM_LOCAL_COMPATIBLE_URL": ("provider", "local_compatible_url"),
    "SAM_COMPATIBLE_IS_LOCAL": ("provider", "compatible_is_local"),
    "SAM_ROOT": ("application", "root"),
    "SAM_OPEN_UI": ("application", "open_ui"),
    "SAM_STT_ENABLED": ("voice", "stt_enabled"),
    "SAM_STT_URL": ("voice", "stt_url"),
    "SAM_PREFERRED_LANGUAGES": ("voice", "preferred_languages"),
    "SAM_TTS_ENABLED": ("voice", "tts_enabled"),
    "SAM_TTS_VOICE": ("voice", "tts_voice"),
    "SAM_ALLOW_WORKSPACE_WRITE": ("capabilities", "workspace_write"),
    "SAM_ALLOW_CLOUD": ("privacy", "allow_cloud"),
}


def user_config_path(environment: Mapping[str, str] | None = None) -> Path:
    env = os.environ if environment is None else environment
    if os.name == "nt" and env.get("APPDATA"):
        return Path(env["APPDATA"]) / "Sam" / "sam.toml"
    base = Path(env.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "sam-ambient" / "sam.toml"


def load_settings(
    *,
    project_root: Path | None = None,
    explicit_path: Path | None = None,
    environment: Mapping[str, str] | None = None,
) -> SamSettings:
    """Load defaults, user/project files, an explicit file, then environment."""
    env = os.environ if environment is None else environment
    root = (project_root or Path.cwd()).resolve(strict=False)
    paths = [user_config_path(env), root / "config" / "sam.toml"]
    if explicit_path is not None:
        paths.append(explicit_path)
    merged: dict[str, Any] = {}
    loaded: list[Path] = []
    seen: set[Path] = set()
    explicit_resolved = explicit_path.expanduser().resolve(strict=False) if explicit_path else None
    user_resolved = user_config_path(env).expanduser().resolve(strict=False)
    for candidate in paths:
        resolved = candidate.expanduser().resolve(strict=False)
        if resolved in seen:
            continue
        seen.add(resolved)
        if resolved == explicit_resolved and not resolved.is_file():
            raise ConfigurationError(f"configuration file does not exist: {resolved}")
        if not resolved.is_file():
            continue
        try:
            with resolved.open("rb") as stream:
                values = tomllib.load(stream)
        except (OSError, tomllib.TOMLDecodeError) as error:
            raise ConfigurationError(f"cannot read configuration {resolved}: {error}") from error
        _validate_document(
            values,
            resolved,
            allow_external=resolved in {user_resolved, explicit_resolved},
        )
        _merge(merged, values)
        loaded.append(resolved)
    _apply_environment(merged, env)
    return _build_settings(merged, tuple(loaded))


def apply_cli_overrides(
    settings: SamSettings, args: Any, argv: list[str], *, supervisor: bool = False
) -> SamSettings:
    """Apply only command-line options actually present in argv."""
    explicit = {token.split("=", 1)[0] for token in argv if token.startswith("--")}
    provider = settings.provider
    voice = settings.voice
    application = settings.application
    capabilities = settings.capabilities
    privacy = settings.privacy
    if "--provider" in explicit:
        provider = replace(provider, preference=args.provider)
    if "--model" in explicit:
        provider = replace(provider, model=args.model)
    if "--base-url" in explicit:
        provider = replace(provider, base_url=args.base_url)
    if "--local-compatible-url" in explicit:
        provider = replace(provider, local_compatible_url=args.local_compatible_url)
    if "--compatible-is-local" in explicit:
        provider = replace(provider, compatible_is_local=args.compatible_is_local)
    if "--root" in explicit:
        application = replace(application, root=Path(args.root))
    if "--open-ui" in explicit:
        application = replace(application, open_ui=True)
    if "--no-ui" in explicit:
        application = replace(application, open_ui=False)
    if "--no-voice" in explicit:
        voice = replace(voice, stt_enabled=False)
    if "--stt-url" in explicit:
        voice = replace(voice, stt_url=args.stt_url)
    if "--preferred-languages" in explicit:
        voice = replace(voice, preferred_languages=args.preferred_languages)
    if "--no-tts" in explicit:
        voice = replace(voice, tts_enabled=False)
    if "--tts-voice" in explicit:
        voice = replace(voice, tts_voice=args.tts_voice)
    if "--allow-workspace-write" in explicit:
        capabilities = replace(capabilities, workspace_write=True)
    if "--allow-cloud" in explicit:
        privacy = replace(privacy, allow_cloud=True)
    return replace(
        settings,
        provider=provider,
        voice=voice,
        application=application,
        capabilities=capabilities,
        privacy=privacy,
    )


def configure_namespace(args: Any, argv: list[str], *, supervisor: bool = False) -> SamSettings:
    """Resolve configuration and project it onto an existing argparse namespace."""
    root_value = getattr(args, "root", None)
    root_hint = Path(root_value) if root_value else Path.cwd()
    explicit_config = getattr(args, "config", None)
    settings = load_settings(
        project_root=root_hint,
        explicit_path=Path(explicit_config) if explicit_config else None,
    )
    settings = apply_cli_overrides(settings, args, argv, supervisor=supervisor)
    assignments = {
        "provider": settings.provider.preference,
        "model": settings.provider.model,
        "base_url": settings.provider.base_url,
        "local_compatible_url": settings.provider.local_compatible_url,
        "compatible_is_local": settings.provider.compatible_is_local,
        "root": str(settings.application.root),
        "open_ui": settings.application.open_ui,
        "no_ui": not settings.application.open_ui,
        "no_voice": not settings.voice.stt_enabled,
        "stt_url": settings.voice.stt_url,
        "preferred_languages": settings.voice.preferred_languages,
        "no_tts": not settings.voice.tts_enabled,
        "tts_voice": settings.voice.tts_voice,
        "allow_workspace_write": settings.capabilities.workspace_write,
        "allow_cloud": settings.privacy.allow_cloud,
    }
    for name, value in assignments.items():
        if hasattr(args, name):
            setattr(args, name, value)
    args._sam_settings = settings
    return settings


def _validate_document(
    values: Mapping[str, Any], source: Path, *, allow_external: bool = True
) -> None:
    allowed = frozenset({"schema_version", *_SCHEMA})
    unknown = sorted(set(values) - allowed)
    if unknown:
        raise ConfigurationError(f"unknown configuration key in {source}: {unknown[0]}")
    version = values.get("schema_version", CONFIG_SCHEMA_VERSION)
    if type(version) is not int or version != CONFIG_SCHEMA_VERSION:
        raise ConfigurationError(
            f"unsupported schema_version in {source}: expected {CONFIG_SCHEMA_VERSION}"
        )
    if values.get("external") and not allow_external:
        raise ConfigurationError(
            f"external MCP launch specifications are not allowed in project config: {source}"
        )
    for section, keys in _SCHEMA.items():
        value = values.get(section, {})
        if not isinstance(value, Mapping):
            raise ConfigurationError(f"{section} in {source} must be a table")
        extra = sorted(set(value) - keys)
        if extra:
            raise ConfigurationError(f"unknown configuration key in {source}: {section}.{extra[0]}")


def _merge(target: dict[str, Any], values: Mapping[str, Any]) -> None:
    for key, value in values.items():
        if isinstance(value, Mapping):
            target.setdefault(key, {}).update(value)
        else:
            target[key] = value


def _apply_environment(target: dict[str, Any], env: Mapping[str, str]) -> None:
    for variable, (section, key) in _ENV.items():
        if variable not in env:
            continue
        raw = env[variable]
        expected = _expected_type(key)
        if expected is bool:
            value: Any = _parse_bool(raw, variable)
        elif expected is tuple:
            value = [part.strip() for part in raw.split(",") if part.strip()]
        else:
            value = raw
        target.setdefault(section, {})[key] = value


def _build_settings(values: Mapping[str, Any], sources: tuple[Path, ...]) -> SamSettings:
    provider = values.get("provider", {})
    voice = values.get("voice", {})
    application = values.get("application", {})
    capabilities = values.get("capabilities", {})
    privacy = values.get("privacy", {})
    external = values.get("external", {})
    preference = _string(provider.get("preference", "auto"), "provider.preference")
    if preference not in {"auto", "ollama", "lm-studio", "openai-compatible"}:
        raise ConfigurationError(
            "provider.preference must be auto, ollama, lm-studio, or openai-compatible"
        )
    languages = voice.get("preferred_languages", ["en", "es"])
    if not isinstance(languages, list) or not languages:
        raise ConfigurationError("voice.preferred_languages must be a non-empty array")
    normalized_languages = tuple(_language(item) for item in languages)
    root = Path(_string(application.get("root", str(Path.cwd())), "application.root")).expanduser()
    return SamSettings(
        provider=ProviderSettings(
            preference=preference,
            model=_optional_string(provider.get("model"), "provider.model"),
            base_url=_optional_string(provider.get("base_url"), "provider.base_url"),
            local_compatible_url=_optional_string(
                provider.get("local_compatible_url"), "provider.local_compatible_url"
            ),
            compatible_is_local=_boolean(
                provider.get("compatible_is_local", False), "provider.compatible_is_local"
            ),
        ),
        voice=VoiceSettings(
            stt_enabled=_boolean(voice.get("stt_enabled", True), "voice.stt_enabled"),
            stt_url=_string(voice.get("stt_url", "http://127.0.0.1:8080"), "voice.stt_url"),
            preferred_languages=normalized_languages,
            tts_enabled=_boolean(voice.get("tts_enabled", True), "voice.tts_enabled"),
            tts_voice=_string(voice.get("tts_voice", "default"), "voice.tts_voice"),
        ),
        application=ApplicationSettings(
            root=root.resolve(strict=False),
            open_ui=_boolean(application.get("open_ui", True), "application.open_ui"),
        ),
        capabilities=CapabilitySettings(
            workspace_write=_boolean(
                capabilities.get("workspace_write", False), "capabilities.workspace_write"
            )
        ),
        privacy=PrivacySettings(
            allow_cloud=_boolean(privacy.get("allow_cloud", False), "privacy.allow_cloud")
        ),
        external=ExternalSettings(mcp_servers=_mcp_servers(external.get("mcp_servers", []))),
        sources=sources,
    )


def _mcp_servers(value: Any) -> tuple[McpServerSettings, ...]:
    if not isinstance(value, list):
        raise ConfigurationError("external.mcp_servers must be an array of tables")
    servers: list[McpServerSettings] = []
    seen: set[str] = set()
    allowed = {"id", "command", "working_directory", "timeout_s", "result_limit_bytes"}
    for index, item in enumerate(value):
        name = f"external.mcp_servers[{index}]"
        if not isinstance(item, Mapping):
            raise ConfigurationError(f"{name} must be a table")
        extra = sorted(set(item) - allowed)
        if extra:
            raise ConfigurationError(f"unknown configuration key: {name}.{extra[0]}")
        server_id = _string(item.get("id"), f"{name}.id").lower()
        if (
            len(server_id) > 64
            or not server_id[0].isalpha()
            or any(
                character not in "abcdefghijklmnopqrstuvwxyz0123456789_-" for character in server_id
            )
        ):
            raise ConfigurationError(f"{name}.id must be a lowercase local identifier")
        if server_id in seen:
            raise ConfigurationError(f"duplicate MCP server id: {server_id}")
        seen.add(server_id)
        command = item.get("command")
        if not isinstance(command, list) or not 1 <= len(command) <= 32:
            raise ConfigurationError(f"{name}.command must contain 1 to 32 argv strings")
        argv = tuple(_string(part, f"{name}.command item") for part in command)
        if any(len(part) > 4096 or "\x00" in part for part in argv):
            raise ConfigurationError(f"{name}.command contains an invalid argv string")
        raw_cwd = item.get("working_directory")
        cwd = None if raw_cwd is None else Path(_string(raw_cwd, f"{name}.working_directory"))
        if cwd is not None and not cwd.is_absolute():
            raise ConfigurationError(f"{name}.working_directory must be an absolute path")
        timeout = item.get("timeout_s", 20.0)
        if (
            not isinstance(timeout, (int, float))
            or isinstance(timeout, bool)
            or not 1 <= timeout <= 120
        ):
            raise ConfigurationError(f"{name}.timeout_s must be between 1 and 120")
        limit = item.get("result_limit_bytes", 131_072)
        if type(limit) is not int or not 1024 <= limit <= 524_288:
            raise ConfigurationError(f"{name}.result_limit_bytes must be 1024 to 524288")
        servers.append(McpServerSettings(server_id, argv, cwd, float(timeout), limit))
    return tuple(servers)


def _expected_type(key: str) -> type:
    if key in {
        "compatible_is_local",
        "open_ui",
        "stt_enabled",
        "tts_enabled",
        "workspace_write",
        "allow_cloud",
    }:
        return bool
    return tuple if key == "preferred_languages" else str


def _parse_bool(value: str, name: str) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ConfigurationError(f"{name} must be true or false")


def _boolean(value: Any, name: str) -> bool:
    if type(value) is not bool:
        raise ConfigurationError(f"{name} must be a boolean")
    return value


def _string(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ConfigurationError(f"{name} must be a non-empty string")
    return value.strip()


def _optional_string(value: Any, name: str) -> str | None:
    return None if value is None else _string(value, name)


def _language(value: Any) -> str:
    code = _string(value, "voice.preferred_languages item").lower()
    if not code.isalpha() or len(code) not in (2, 3):
        raise ConfigurationError("voice.preferred_languages items must be language codes")
    return code
