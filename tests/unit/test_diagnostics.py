import pytest

from sam_ambient.diagnostics import ReadinessLevel, classify_readiness


def _report(**overrides):
    report = {
        "runtime": {"compatible": True, "detail": "Python ready"},
        "configuration": {"detail": "Built-in defaults active"},
        "browser": {"available": True, "mode": "system browser"},
        "workspace": {"writable": True, "path": "workspace"},
        "providers": [
            {
                "id": "ollama",
                "executable": "ollama",
                "running": True,
                "available_models": ["chat"],
            }
        ],
        "selection": {"provider": "ollama", "model": "chat"},
        "stt": {"available": True, "assets_available": True, "detail": "reachable"},
        "tts": {"available": True, "detail": "system speech"},
        "audio": {"input_available": True, "output_available": True},
        "ui": {"available": True, "url": "http://127.0.0.1:8766"},
        "supervisor": {"state": "not_started"},
    }
    report.update(overrides)
    return report


def _check(report, check_id):
    return next(item for item in classify_readiness(report) if item.id == check_id)


def test_ready_machine_has_ready_critical_checks():
    checks = classify_readiness(_report())
    assert {item.id: item.level for item in checks} == {
        "runtime": ReadinessLevel.READY,
        "uv": ReadinessLevel.OPTIONAL,
        "configuration": ReadinessLevel.READY,
        "browser": ReadinessLevel.READY,
        "workspace": ReadinessLevel.READY,
        "model": ReadinessLevel.READY,
        "stt": ReadinessLevel.READY,
        "tts": ReadinessLevel.READY,
        "audio": ReadinessLevel.READY,
        "ui": ReadinessLevel.READY,
        "supervisor": ReadinessLevel.OPTIONAL,
    }


@pytest.mark.parametrize(
    ("providers", "expected", "phrase"),
    [
        ([], ReadinessLevel.ACTION_NEEDED, "No usable"),
        (
            [{"id": "lm-studio", "executable": "lms", "running": False}],
            ReadinessLevel.AVAILABLE,
            "installed but stopped",
        ),
        (
            [{"id": "lm-studio", "executable": "lms", "running": True}],
            ReadinessLevel.ACTION_NEEDED,
            "no conversational model",
        ),
        (
            [
                {
                    "id": "lm-studio",
                    "executable": "lms",
                    "running": True,
                    "available_models": ["installed-chat"],
                }
            ],
            ReadinessLevel.ACTION_NEEDED,
            "unloaded conversational model",
        ),
    ],
)
def test_model_runtime_states_are_actionable(providers, expected, phrase):
    report = _report(providers=providers, selection={"provider": None, "model": None})
    check = _check(report, "model")
    assert check.level is expected and phrase.lower() in check.summary.lower()
    assert check.action


def test_embedding_only_inventory_is_not_reported_as_chat_ready():
    report = _report(
        providers=[
            {"id": "lm-studio", "executable": "lms", "running": True, "available_models": []}
        ],
        selection={"provider": None, "model": None},
    )
    assert _check(report, "model").level is ReadinessLevel.ACTION_NEEDED


@pytest.mark.parametrize(
    ("field", "value", "check_id", "level"),
    [
        (
            "stt",
            {"available": False, "assets_available": False, "detail": "whisper missing"},
            "stt",
            ReadinessLevel.MISSING,
        ),
        (
            "stt",
            {"available": False, "assets_available": True, "detail": "service stopped"},
            "stt",
            ReadinessLevel.AVAILABLE,
        ),
        ("tts", {"available": False, "detail": "TTS missing"}, "tts", ReadinessLevel.MISSING),
        (
            "audio",
            {"input_available": False, "output_available": True},
            "audio",
            ReadinessLevel.DEGRADED,
        ),
    ],
)
def test_voice_failures_preserve_actionable_text_mode(field, value, check_id, level):
    report = _report(**{field: value})
    check = _check(report, check_id)
    assert check.level is level
    if level in {ReadinessLevel.MISSING, ReadinessLevel.DEGRADED}:
        assert check.action and "Text" in check.action
