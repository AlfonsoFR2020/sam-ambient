import xml.etree.ElementTree as ET
from pathlib import Path

from scripts.check_public_docs import check_svg
from scripts.generate_visual_subsystem_diagram import TARGET, visual_subsystem_diagram

ROOT = Path(__file__).resolve().parents[2]
SVG = "{http://www.w3.org/2000/svg}"


def test_visual_diagram_is_safe_reproducible_and_structurally_bounded():
    content = (ROOT / TARGET).read_text(encoding="utf-8")
    digest = check_svg(content, visual_subsystem_diagram())
    assert len(digest) == 64
    assert visual_subsystem_diagram() == visual_subsystem_diagram()


def test_visual_diagram_connects_presentation_and_static_setup_without_core_authority():
    root = ET.fromstring(visual_subsystem_diagram())
    edges = {
        item.attrib["id"]: (item.attrib["data-source"], item.attrib["data-target"])
        for item in root.iter(SVG + "path")
        if "data-source" in item.attrib
    }
    assert edges == {
        "live-frame": ("motion", "renderer"),
        "material-source": ("material", "renderer"),
        "selected-structure": ("appearance", "skin"),
        "selected-material": ("appearance", "material"),
        "setup-resources": ("skin", "renderer"),
        "failed-surface": ("renderer", "recovery"),
    }
    assert "No visual module owns microphone" in root.find(SVG + "desc").text
    assert "not rendered acceptance" in root.find(SVG + "desc").text
