from pathlib import Path

import pytest

from sam_ambient.cli import build_parser as build_sam_parser
from sam_ambient.configuration import (
    ConfigurationError,
    apply_cli_overrides,
    configure_namespace,
    load_settings,
)
from sam_ambient.supervisor.cli import (
    _trusted_core_command,
)
from sam_ambient.supervisor.cli import (
    build_parser as build_supervisor_parser,
)


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def test_precedence_defaults_user_project_environment_cli(tmp_path):
    user = tmp_path / "user"
    project = tmp_path / "project"
    _write(user / "sam-ambient/sam.toml", '[provider]\npreference = "ollama"\nmodel = "user"\n')
    _write(
        project / "config/sam.toml",
        '[provider]\nmodel = "project"\n[voice]\npreferred_languages = ["fr"]\n',
    )
    environment = {
        "XDG_CONFIG_HOME": str(user),
        "SAM_MODEL": "environment",
        "SAM_STT_ENABLED": "false",
    }
    settings = load_settings(project_root=project, environment=environment)
    assert settings.provider.preference == "ollama"
    assert settings.provider.model == "environment"
    assert settings.voice.preferred_languages == ("fr",)
    assert not settings.voice.stt_enabled

    parser = build_supervisor_parser()
    argv = ["--root", str(project), "--model", "command-line"]
    args = parser.parse_args(argv)
    resolved = apply_cli_overrides(settings, args, argv, supervisor=True)
    assert resolved.provider.model == "command-line"
    assert resolved.application.root == project


def test_missing_config_uses_safe_defaults_and_explicit_missing_fails(tmp_path):
    settings = load_settings(project_root=tmp_path, environment={})
    assert settings.provider.preference == "auto"
    assert settings.voice.preferred_languages == ("en", "es")
    assert not settings.capabilities.workspace_write
    assert not settings.privacy.allow_cloud
    with pytest.raises(ConfigurationError, match="does not exist"):
        load_settings(
            project_root=tmp_path, explicit_path=tmp_path / "missing.toml", environment={}
        )


@pytest.mark.parametrize(
    ("contents", "message"),
    [
        ("not = [valid", "cannot read configuration"),
        ("unknown = true", "unknown configuration key"),
        ("schema_version = 2", "unsupported schema_version"),
        ('[provider]\npreference = "cloud-magic"', "provider.preference"),
        ("[voice]\npreferred_languages = []", "non-empty array"),
        ('[voice]\npreferred_languages = ["en-US"]', "language codes"),
        ('[privacy]\nallow_cloud = "yes"', "must be a boolean"),
        ('[provider]\napi_key = "secret"', "provider.api_key"),
    ],
)
def test_invalid_configuration_is_actionable(tmp_path, contents, message):
    path = tmp_path / "sam.toml"
    _write(path, contents)
    with pytest.raises(ConfigurationError, match=message):
        load_settings(project_root=tmp_path, explicit_path=path, environment={})


def test_cli_configuration_preserves_old_flags_and_runtime_state_is_separate(tmp_path, monkeypatch):
    config = tmp_path / "settings.toml"
    _write(
        config,
        """schema_version = 1
[application]
root = "."
[provider]
preference = "lm-studio"
model = "configured"
[voice]
stt_enabled = false
tts_voice = "Spanish Voice"
[capabilities]
workspace_write = true
""",
    )
    monkeypatch.chdir(tmp_path)
    parser = build_sam_parser()
    argv = ["--config", str(config), "runtime", "--provider", "ollama", "--model", "cli"]
    args = parser.parse_args(argv)
    settings = configure_namespace(args, argv)
    assert args.provider == "ollama" and args.model == "cli"
    assert args.no_voice and args.tts_voice == "Spanish Voice"
    assert args.allow_workspace_write
    assert settings.sources == (config.resolve(),)
    assert not hasattr(settings, "last_good_provider")


def test_supervisor_receives_configured_runtime_values(tmp_path, monkeypatch):
    config = tmp_path / "config/sam.toml"
    _write(
        config,
        """[provider]
preference = "lm-studio"
[voice]
preferred_languages = ["es", "en"]
stt_url = "http://127.0.0.1:9090"
tts_enabled = false
[application]
open_ui = false
""",
    )
    monkeypatch.chdir(tmp_path)
    parser = build_supervisor_parser()
    args = parser.parse_args([])
    configure_namespace(args, [], supervisor=True)
    assert args.provider == "lm-studio"
    assert args.preferred_languages == ("es", "en")
    assert args.stt_url.endswith(":9090")
    assert args.no_tts and args.no_ui


def test_trusted_mcp_server_configuration_is_structured_and_bounded(tmp_path):
    config = tmp_path / "mcp.toml"
    _write(
        config,
        """[external]
mcp_servers = [
  { id = "desktop-local", command = ["server.exe", "--stdio"], timeout_s = 12 }
]
""",
    )
    settings = load_settings(
        project_root=tmp_path, explicit_path=config, environment={"XDG_CONFIG_HOME": str(tmp_path)}
    )
    server = settings.external.mcp_servers[0]
    assert server.server_id == "desktop-local"
    assert server.command == ("server.exe", "--stdio")
    assert server.timeout_s == 12


@pytest.mark.parametrize(
    "value",
    [
        'mcp_servers = [{ id = "bad id", command = ["x"] }]',
        'mcp_servers = [{ id = "ok", command = [] }]',
        'mcp_servers = [{ id = "ok", command = ["x"], environment = { X = "y" } }]',
    ],
)
def test_invalid_mcp_launch_configuration_fails_closed(tmp_path, value):
    config = tmp_path / "mcp.toml"
    _write(config, f"[external]\n{value}\n")
    with pytest.raises(ConfigurationError):
        load_settings(
            project_root=tmp_path,
            explicit_path=config,
            environment={"XDG_CONFIG_HOME": str(tmp_path)},
        )


def test_project_config_cannot_define_process_launch_authority(tmp_path):
    _write(
        tmp_path / "config/sam.toml",
        '[external]\nmcp_servers = [{ id = "unsafe", command = ["server"] }]\n',
    )
    with pytest.raises(ConfigurationError, match="not allowed in project config"):
        load_settings(
            project_root=tmp_path,
            environment={"XDG_CONFIG_HOME": str(tmp_path / "user")},
        )


def test_supervisor_propagates_explicit_trusted_config_to_core(tmp_path):
    config = tmp_path / "trusted.toml"
    _write(config, "schema_version = 1\n")
    parser = build_supervisor_parser()
    args = parser.parse_args(["--config", str(config)])
    command = _trusted_core_command(args, tmp_path)
    index = command.index("--config")
    assert command[index + 1] == str(config.resolve())
    core_args = build_sam_parser().parse_args(["runtime", "--config", command[index + 1]])
    assert core_args.config == str(config.resolve())
