"""File-only SVG/link checks; no browser, font measurement or visual acceptance."""

import re
import xml.etree.ElementTree as ET
from itertools import combinations
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

from scripts.generate_architecture_diagrams import PALETTE, generated_diagrams

ROOT = Path(__file__).resolve().parents[2]
SVG = "{http://www.w3.org/2000/svg}"
DIAGRAMS = tuple(generated_diagrams())
PUBLIC_DOCS = (
    "README.md",
    "CONTRIBUTING.md",
    "docs/GETTING_STARTED.md",
    "docs/USER_GUIDE.md",
    "docs/TROUBLESHOOTING.md",
    "docs/SPEECH_RECOGNITION_VB.md",
    "docs/PUBLIC_DOCUMENTATION_VB.md",
    "docs/diagrams/README.md",
)


@pytest.mark.parametrize("name", DIAGRAMS)
def test_svg_is_reproducible_accessible_and_self_contained(name):
    text = (ROOT / "docs/diagrams" / name).read_text(encoding="utf-8")
    assert text == generated_diagrams()[name]
    root = ET.fromstring(text)
    assert root.tag == SVG + "svg"
    assert root.attrib["role"] == "img"
    assert root.attrib["aria-labelledby"] == "title desc"
    assert root.find(SVG + "title").text
    assert root.find(SVG + "desc").text
    identities = [node.attrib["id"] for node in root.iter() if "id" in node.attrib]
    assert len(identities) == len(set(identities))
    for node in root.iter():
        assert node.tag not in {SVG + "script", SVG + "foreignObject", SVG + "image"}
        for key, value in node.attrib.items():
            assert not key.casefold().startswith("on")
            assert not key.endswith("href")
            for target in re.findall(r"url\(#([^)]+)\)", value):
                assert target in identities
    assert "@import" not in text
    assert "<!DOCTYPE" not in text
    assert "https://" not in text
    assert "http://" not in text.replace("http://www.w3.org/2000/svg", "")


@pytest.mark.parametrize("name", DIAGRAMS)
def test_svg_node_and_estimated_text_bounds(name):
    root = ET.parse(ROOT / "docs/diagrams" / name).getroot()
    left, top, width, height = map(float, root.attrib["viewBox"].split())
    assert left == top == 0 and width >= height
    nodes = [node for node in root.iter() if node.attrib.get("data-kind") == "node"]
    assert len(nodes) >= 10
    bounds = [tuple(map(float, node.attrib["data-bounds"].split())) for node in nodes]
    for x, y, w, h in bounds:
        assert 0 <= x < x + w <= width
        assert 0 <= y < y + h <= height
    for (x, y, w, h), (a, b, c, d) in combinations(bounds, 2):
        assert x + w <= a or a + c <= x or y + h <= b or b + d <= y
    for node in root.iter(SVG + "text"):
        x, y = float(node.attrib["x"]), float(node.attrib["y"])
        estimate = float(node.attrib["data-estimated-width"])
        assert 0 <= x <= x + estimate <= width - 10
        assert 18 <= y <= height - 10
        assert "fill" not in node.attrib  # Class CSS would override a presentation fill.
    for node, (x, y, w, h) in zip(nodes, bounds, strict=True):
        for label in node.iter(SVG + "text"):
            tx, ty = float(label.attrib["x"]), float(label.attrib["y"])
            assert x + 10 <= tx
            assert tx + float(label.attrib["data-estimated-width"]) <= x + w - 10
            assert y + 18 <= ty <= y + h - 10


def luminance(color):
    values = [int(color[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
    return sum(v * weight for v, weight in zip(linear, (0.2126, 0.7152, 0.0722), strict=True))


def test_all_diagram_text_accents_have_readable_surface_contrast():
    for ink in ("text", "muted", "control", "data", "delivery", "warning"):
        for surface in ("background", "panel", "card"):
            darker, lighter = sorted((luminance(PALETTE[ink]), luminance(PALETTE[surface])))
            assert (lighter + 0.05) / (darker + 0.05) >= 4.5, (ink, surface)


def markdown_anchors(text):
    result = set()
    duplicates = {}
    for line in text.splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
        if not match:
            continue
        slug = re.sub(r"[^\w -]", "", match[1].casefold()).replace(" ", "-")
        count = duplicates.get(slug, 0)
        duplicates[slug] = count + 1
        result.add(f"{slug}-{count}" if count else slug)
    return result


@pytest.mark.parametrize("name", PUBLIC_DOCS)
def test_public_documentation_relative_links_and_images_exist(name):
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    links = re.findall(r"!?\[[^\]\n]*\]\(([^)\n]+)\)", text)
    links += re.findall(r'<img\s+[^>]*src="([^"]+)"', text)
    for link in links:
        url = urlsplit(link.strip("<>"))
        if url.scheme or url.netloc:
            continue  # Offline verification; no network access or remote claim.
        target = (path.parent / unquote(url.path)).resolve() if url.path else path
        assert target.is_relative_to(ROOT), (name, link)
        assert target.exists(), (name, link)
        if url.fragment and target.suffix == ".md":
            assert unquote(url.fragment) in markdown_anchors(target.read_text(encoding="utf-8")), (
                name,
                link,
            )


def test_public_landing_page_preserves_release_and_attribution_boundaries():
    text = (ROOT / "README.md").read_text(encoding="utf-8")
    assert "Copyright 2026 Alfonso Ernesto de la Fuente Ruiz, PhD" in text
    assert "Original Sam material is licensed under the Apache License, Version 2.0." in text
    assert 'src="sam-logo.png"' in text
    assert "--branch v0.2.5" in text
    assert "**Released · v0.2.5**" in text and "**Development · v0.2.6+" in text
    assert "**Future**" in text
    assert "principal\nvalidated development/runtime path" in text
    assert "0.2.3" not in text and "remaining hosted Ubuntu" not in text
    assert "No public Windows installer" in text or "no\npublic Windows installer" in text


def test_lifecycle_explains_separate_lifetimes_and_non_acoustic_observations():
    text = generated_diagrams()["sam-conversation-lifecycle.svg"]
    root = ET.fromstring(text)
    labels = " ".join(root.itertext())
    assert "ACK ≠ readiness" in labels
    assert "Final ≠ commitment" in labels
    assert "Completed answer" in labels and "Playback & drain" in labels
    assert "Writes ≠ sound clock" in labels
    assert "Reject late IDs and results" in labels
    assert "Typed recovery" in labels
    assert "No model-owned privileges" in generated_diagrams()["sam-system-architecture.svg"]
