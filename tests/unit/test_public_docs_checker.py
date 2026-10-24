"""Offline documentation checks only; no browser or application imports."""

from pathlib import Path

import pytest

from scripts.check_public_docs import anchors, check_links, check_svg, links
from scripts.generate_architecture_diagrams import generated_diagrams


def test_current_generated_vectors_are_safe_and_have_source_integrity():
    for text in generated_diagrams().values():
        assert len(check_svg(text, text)) == 64


@pytest.mark.parametrize("payload", ["<script/>", '<image href="https://example.invalid/x"/>'])
def test_active_or_external_svg_content_is_rejected(payload):
    text = next(iter(generated_diagrams().values())).replace("</svg>", payload + "</svg>")
    with pytest.raises(ValueError, match="Unsafe SVG"):
        check_svg(text)


def test_reference_and_inline_links_are_checked_but_code_examples_are_not():
    text = "[intent][source]\n[source]: target.md\n`[example](missing.md)`\n[local](ok.md)"
    assert links(text) == {"target.md", "ok.md"}
    assert "visible-id" in anchors('<a id="visible-id"></a>\n## Heading\n## Heading')
    assert "heading-1" in anchors("## Heading\n## Heading")
    assert "recognition-language" in anchors("## `Recognition` language")


def test_reviewed_memory_and_voice_are_trusted_directional_data_paths():
    import xml.etree.ElementTree as ET

    from scripts.check_public_docs import SVG

    root = ET.fromstring(generated_diagrams()["sam-system-architecture.svg"])
    edges = {node.attrib.get("id"): node for node in root.iter(SVG + "path")}
    recall = edges["reviewed-recall"].attrib
    assert recall["data-kind"] == "data" and "marker-start" in recall
    assert (recall["data-source"], recall["data-target"]) == ("runtime", "reviewed-memory")
    assert edges["local-input"].attrib["data-source"] == "speech-services"
    assert edges["recognized-input"].attrib["data-target"] == "runtime"
    assert edges["local-output"].attrib["data-target"] == "speech-services"


def test_exception_routes_end_at_retirement_and_playback_projection_has_its_own_route():
    import xml.etree.ElementTree as ET

    from scripts.check_public_docs import SVG

    text = generated_diagrams()["sam-conversation-lifecycle.svg"]
    root = ET.fromstring(text)
    edges = {node.attrib.get("id"): node for node in root.iter(SVG + "path")}
    for identity in ("stt-retirement", "stream-retirement", "playback-retirement"):
        edge = edges[identity].attrib
        assert edge["data-target"] == "retire-work"
        assert edge["data-kind"] == "warning" and "stroke-dasharray" in edge
    assert edges["playback-observation"].attrib["data-target"] == "visual-observer"
    with pytest.raises(ValueError, match="Floating SVG endpoint"):
        check_svg(text.replace("1030,830", "1030,820"))


@pytest.mark.parametrize("link", ["missing.md", "target.md#missing", "../outside.md"])
def test_missing_or_escaping_links_fail(tmp_path, link):
    (tmp_path / "README.md").write_text(f"[link]({link})", encoding="utf-8")
    (tmp_path / "target.md").write_text("# Real", encoding="utf-8")
    with pytest.raises(ValueError):
        check_links(tmp_path.resolve(), ["README.md"])


def test_wrong_case_or_ignored_file_is_not_a_valid_public_link(tmp_path):
    (tmp_path / "README.md").write_text("[link](target.md)", encoding="utf-8")
    (tmp_path / "target.md").write_text("# Real", encoding="utf-8")
    with pytest.raises(ValueError, match="Untracked/wrong-case"):
        check_links(tmp_path.resolve(), ["README.md"], tracked=["README.md"])


def test_current_checkout_prominent_links_resolve():
    from scripts.check_public_docs import audit

    root = Path(__file__).resolve().parents[2]
    profile = "release" if (root / "docs/DEVELOPMENT_STATUS.md").exists() else "development"
    assert audit(root, profile)["rendered"] is False


@pytest.mark.parametrize("fault", ["mixed-history", "runtime-diff", "merge"])
def test_release_guard_rejects_runtime_or_mixed_history_even_if_later_reverted(monkeypatch, fault):
    from scripts import check_public_docs as checker

    def fake_git(_root, *args):
        if args[0] == "merge-base":
            return "release"
        if args[0] == "rev-list":
            if fault == "mixed-history":
                return "first release\nlast first"
            return "doc release other-parent" if fault == "merge" else "doc release"
        if args[0] == "diff-tree":
            return "src/runtime.py" if fault == "mixed-history" else "README.md"
        if args[0] == "diff":
            return "src/runtime.py" if fault == "runtime-diff" else "README.md"
        return ""  # Other file/hash calls are unreachable for these rejected histories.

    monkeypatch.setattr(checker, "git", fake_git)
    with pytest.raises(ValueError, match=r"Non-documentation|not linear"):
        checker.check_release_diff(Path("."), "release")


@pytest.mark.parametrize("intermediate_runtime", [False, True])
def test_four_documentation_commits_keep_every_intermediate_scope_check(
    monkeypatch, intermediate_runtime
):
    from scripts import check_public_docs as checker

    inspected = []

    def fake_git(_root, *args):
        if args[0] == "merge-base":
            return "release"
        if args[0] == "rev-list":
            return "first release\nsecond first\nthird second\nfourth third"
        if args[0] == "diff-tree":
            inspected.append(args[-1])
            return "src/runtime.py" if intermediate_runtime and args[-1] == "third" else "README.md"
        if args[0] == "diff":
            return "README.md"
        if args[0] == "ls-files":
            return ""
        return "same-unchanged-license-or-logo-blob"

    monkeypatch.setattr(checker, "git", fake_git)
    if intermediate_runtime:
        with pytest.raises(ValueError, match="Non-documentation commit"):
            checker.check_release_diff(Path("."), "release")
        assert inspected == ["first", "second", "third"]
    else:
        assert checker.check_release_diff(Path("."), "release")["commits"] == 4
        assert inspected == ["first", "second", "third", "fourth"]
