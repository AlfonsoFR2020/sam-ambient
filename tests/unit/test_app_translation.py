import json

from sam_ambient.supervisor.app_window import prepare_translation_preferences


def test_translation_is_disabled_only_in_the_requested_sam_profile(tmp_path):
    profile = tmp_path / ".sam" / "owner-ui-profile"
    preferences = profile / "Default" / "Preferences"
    preferences.parent.mkdir(parents=True)
    existing = {"translate": {"enabled": True, "other": "preserved"}, "unrelated": {"x": 1}}
    preferences.write_text(json.dumps(existing), encoding="utf-8")
    prepare_translation_preferences(profile)
    result = json.loads(preferences.read_text(encoding="utf-8"))
    assert result == {**existing, "translate": {"enabled": False, "other": "preserved"}}
    assert not list(preferences.parent.glob("Preferences.sam-*"))
    before = preferences.read_bytes()
    prepare_translation_preferences(profile)
    assert preferences.read_bytes() == before


def test_new_profile_is_prepared_but_malformed_preferences_are_preserved(tmp_path):
    profile = tmp_path / "private"
    prepare_translation_preferences(profile)
    preferences = profile / "Default" / "Preferences"
    assert json.loads(preferences.read_bytes()) == {"translate": {"enabled": False}}
    preferences.write_bytes(b"invalid existing data")
    prepare_translation_preferences(profile)
    assert preferences.read_bytes() == b"invalid existing data"


def test_oversized_preferences_are_not_rewritten(tmp_path):
    preferences = tmp_path / "Default" / "Preferences"
    preferences.parent.mkdir()
    preferences.write_bytes(b" " * (2 * 1024 * 1024 + 1))
    prepare_translation_preferences(tmp_path)
    assert preferences.stat().st_size == 2 * 1024 * 1024 + 1
