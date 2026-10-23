"""Editable V-F1 visual subsystem diagram; stdlib/shared SVG tooling, no rendering.

Run: python -m scripts.generate_visual_subsystem_diagram [--check]
"""

from __future__ import annotations

import argparse
from pathlib import Path

from scripts.generate_architecture_diagrams import Diagram

ROOT = Path(__file__).resolve().parents[1]
TARGET = Path("docs/diagrams/sam-orb-appearance.svg")


def visual_subsystem_diagram() -> str:
    d = Diagram(
        "Sam Orb appearance boundaries",
        "Presentation-only motion and measured input remain shared. A trusted internal "
        "appearance definition selects the existing living material and either the default "
        "connected skin or an experimental connected radial-sector skin. Each setup strategy "
        "pairs geometry, descriptors, equations, CPU reference and contact. One renderer owns "
        "resources and per-frame uniforms. Canvas and static recovery preserve existing "
        "semantics. No visual module owns microphone, conversation, model or tool authority. "
        "This is source architecture, not rendered acceptance of the prototype.",
        850,
    )
    d.text(40, 51, "Sam / Orb appearance boundaries", style="title", size=36)
    d.text(40, 83, "V-F1 feature architecture: shared life, explicit structure, one renderer.")
    for x, kind, label in [
        (40, "data", "Live presentation inputs"),
        (440, "control", "Trusted static composition"),
        (840, "warning", "Failure / shared recovery"),
    ]:
        d.edge([(x, 116), (x + 26, 116)], kind)
        d.text(x + 36, 122, label, available=285)
    d.card(
        "motion",
        40,
        175,
        320,
        165,
        "Shared life & signals",
        [
            "State / measured envelopes",
            "Interaction + separate clocks",
            "Reduced Motion / visibility",
        ],
    )
    d.card(
        "material",
        440,
        175,
        320,
        165,
        "Living material",
        [
            "Unit object-direction field",
            "Transport / regional palette",
            "Shared light + particle colour",
        ],
        accent="delivery",
    )
    d.card(
        "appearance",
        840,
        175,
        320,
        165,
        "Appearance definition",
        [
            "Default: living-connected",
            "Internal: radial-shell trial",
            "No owner theme preference",
        ],
        accent="control",
    )
    d.card(
        "renderer",
        40,
        435,
        720,
        205,
        "Shared WebGL renderer / resource owner",
        [
            "Shared displaced body, satin film and High depth/contact support",
            "One owner: 4 programs / 7 buffers / bounded draws",
            "Frame uniforms only; no mesh rebuild or strategy callbacks",
            "Presentation never owns microphone, turns, routes or tools",
        ],
    )
    d.card(
        "skin",
        840,
        435,
        320,
        205,
        "Skin strategy / setup",
        [
            "Parent skin / radial sectors",
            "Mesh + descriptors + equations",
            "CPU reference / contact paired",
            "Same object-direction pigment",
        ],
        accent="control",
    )
    d.card(
        "recovery",
        40,
        705,
        1120,
        105,
        "Shared recovery preserves its own identity",
        [
            "Canvas/static keep existing semantics. New representations require explicit "
            "compatibility and bounded proof.",
        ],
        accent="warning",
    )
    for identity, source, target, points, kind in [
        ("live-frame", "motion", "renderer", [(200, 340), (200, 435)], "data"),
        ("material-source", "material", "renderer", [(600, 340), (600, 435)], "delivery"),
        ("selected-structure", "appearance", "skin", [(1000, 340), (1000, 435)], "control"),
        ("selected-material", "appearance", "material", [(840, 255), (760, 255)], "control"),
        ("setup-resources", "skin", "renderer", [(840, 535), (760, 535)], "control"),
        ("failed-surface", "renderer", "recovery", [(400, 640), (400, 705)], "warning"),
    ]:
        d.edge(points, kind, identity=identity, source=source, target=target)
    d.text(774, 520, "setup", available=65)
    d.text(418, 682, "Existing fallback / governor / accessibility contracts")
    return d.finish()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = visual_subsystem_diagram()
    target = ROOT / TARGET
    if args.check:
        if target.read_text(encoding="utf-8") != content:
            raise SystemExit("Orb appearance SVG differs from its generator")
        print("Orb appearance SVG matches; no rendering performed.")
    else:
        target.write_text(content, encoding="utf-8", newline="\n")
        print("Wrote editable Orb appearance SVG; no rendering performed.")


if __name__ == "__main__":
    main()
