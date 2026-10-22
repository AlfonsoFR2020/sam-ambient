"""Generate original editable SVGs with stdlib only; no rendering or external assets.

Layout/content live here. SVG text stays editable. Run from the repository root:
    python scripts/generate_architecture_diagrams.py
"""

from __future__ import annotations

import argparse
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PALETTE = {
    "background": "#10161c",
    "panel": "#17212b",
    "card": "#202d39",
    "border": "#415568",
    "text": "#f4eee5",
    "muted": "#bbc9d5",
    "control": "#e2b27f",
    "data": "#83b8e3",
    "delivery": "#76cbbb",
    "warning": "#edaaa2",
}


def estimated_width(text: str, size: int) -> float:
    """Conservative text-fit heuristic, explicitly not font metrics or rendering."""

    def width(char):
        if char in " ilI.,:;!'|":
            return 0.29
        if char in "MW@%→≠":
            return 0.85
        return 0.65 if char.isupper() else 0.55

    return round(sum(width(char) for char in text) * size, 2)


class Diagram:
    def __init__(self, title: str, description: str, height: int):
        self.height = height
        self.parts = [
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" '
            f'height="{height}" viewBox="0 0 1200 {height}" role="img" '
            'aria-labelledby="title desc" lang="en">',
            f'<title id="title">{escape(title)}</title>',
            f'<desc id="desc">{escape(description)}</desc>',
            "<defs>",
        ]
        for name in ("control", "data", "delivery", "warning"):
            self.parts.append(
                f'<marker id="arrow-{name}" markerWidth="9" markerHeight="9" '
                'refX="8" refY="4.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">'
                f'<path d="M0,0 L9,4.5 L0,9 Z" fill="{PALETTE[name]}"/></marker>'
            )
        self.parts += [
            "</defs>",
            "<style>",
            'text { font-family: "Segoe UI", Inter, Arial, sans-serif; }',
            f".title {{ fill: {PALETTE['text']}; font-size: 36px; font-weight: 650; }}",
            f".body {{ fill: {PALETTE['muted']}; font-size: 18px; }}",
            f".card-title {{ fill: {PALETTE['text']}; font-size: 22px; font-weight: 600; }}",
            "</style>",
            f'<rect width="1200" height="{height}" fill="{PALETTE["background"]}"/>',
        ]

    def text(self, x, y, text, *, style="body", size=18, color=None, available=1120):
        width = estimated_width(text, size)
        if width > available:
            raise ValueError(f"Estimated text overflow ({width}>{available}): {text}")
        # CSS class fill overrides SVG presentation attributes. An inline style
        # keeps explicitly chosen label accents above the common text class.
        fill = f' style="fill: {PALETTE[color]}"' if color else ""
        self.parts.append(
            f'<text x="{x}" y="{y}" class="{style}"{fill} '
            f'data-estimated-width="{width}">{escape(text)}</text>'
        )

    def panel(self, identity, x, y, w, h, label, *, accent="data"):
        self.parts.append(
            f'<g id="{identity}" data-kind="boundary">'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" '
            f'fill="{PALETTE["panel"]}" stroke="{PALETTE["border"]}" '
            'stroke-width="1.3" stroke-dasharray="7 6"/>'
        )
        self.text(x + 20, y + 29, label, color=accent, available=w - 40)
        self.parts.append("</g>")

    def edge(
        self,
        points,
        kind="data",
        *,
        dashed=False,
        arrow=True,
        identity=None,
        source=None,
        target=None,
        both=False,
    ):
        d = "M" + " L".join(f"{x},{y}" for x, y in points)
        dash = ' stroke-dasharray="7 6"' if dashed else ""
        marker = f' marker-end="url(#arrow-{kind})"' if arrow else ""
        if both:
            marker += f' marker-start="url(#arrow-{kind})"'
        metadata = (
            ""
            if identity is None
            else (f' id="{identity}" data-source="{source}" data-target="{target}"')
        )
        self.parts.append(
            f'<path data-kind="{kind}"{metadata} d="{d}" fill="none" stroke="{PALETTE[kind]}" '
            f'stroke-width="2.3" stroke-linejoin="round"{dash}{marker}/>'
        )

    def card(self, identity, x, y, w, h, title, body, *, accent="data"):
        if y + 62 + (len(body) - 1) * 24 + 5 > y + h - 10:
            raise ValueError(f"Vertical text overflow: {identity}")
        self.parts.append(
            f'<g id="{identity}" data-kind="node" data-bounds="{x} {y} {w} {h}">'
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="11" '
            f'fill="{PALETTE["card"]}" stroke="{PALETTE["border"]}" stroke-width="1.1"/>'
            f'<path d="M{x + 15},{y + 1} H{x + w - 15}" '
            f'stroke="{PALETTE[accent]}" stroke-width="2"/>'
        )
        self.text(x + 18, y + 32, title, style="card-title", size=22, available=w - 36)
        for row, line in enumerate(body):
            self.text(x + 18, y + 62 + row * 24, line, available=w - 36)
        self.parts.append("</g>")

    def header(self, title, subtitle, *, lifecycle=False):
        self.text(40, 51, title, style="title", size=36)
        self.text(40, 83, subtitle)
        items = [
            (40, "control", "Control / authority"),
            (330, "data", "Data / projection"),
            (630, "warning", "Cancel / failure"),
            (900, "delivery", "Optional delivery"),
        ]
        if not lifecycle:
            items = [*items[:2], (630, "delivery", "Local voice / delivery")]
        for x, color, label in items:
            self.edge([(x, 116), (x + 26, 116)], color)
            self.text(x + 36, 122, label, available=250)

    def finish(self):
        return "\n".join([*self.parts, "</svg>", ""])


def system_architecture() -> str:
    d = Diagram(
        "Sam system architecture and trust boundaries",
        "The authenticated owner interface projects state from trusted Python authority. "
        "The supervisor owns lifecycle and staged updates; TurnManager owns committed turns "
        "and immutable model routes. Capability policy mediates approved OS access. "
        "Local voice and separate private operational and reviewed-memory stores remain bounded. "
        "Runtime mediates reviewed local recall; stored claims confer no instructions or permissions. "
        "Capture and recognition return to runtime; synthesized delivery travels to local output. "
        "Models receive no direct OS, update or owner authority. "
        "Cloud use requires explicit policy.",
        980,
    )
    d.header(
        "Sam / system & trust boundaries",
        "Shared architecture • owner intent becomes bounded authority through trusted code.",
    )
    d.panel("presentation", 40, 150, 260, 550, "PRESENTATION")
    d.panel("authority", 340, 150, 480, 550, "CORE AUTHORITY", accent="control")
    d.panel("external", 860, 150, 300, 755, "SERVICES / RESOURCES")
    d.panel("persistence", 40, 745, 780, 160, "PRIVATE PERSISTENCE", accent="delivery")
    d.edge([(170, 300), (170, 330)], "control")
    d.edge([(170, 480), (170, 535)], "control")
    d.edge([(280, 595), (320, 595), (320, 425), (360, 425)], "control")
    d.edge([(360, 375), (280, 375)], "data")
    d.edge([(580, 300), (580, 330)], "control")
    d.edge([(800, 380), (880, 380)], "control")
    d.edge([(880, 425), (800, 425)], "data")
    d.edge([(460, 480), (460, 535)], "control")
    d.edge(
        [(725, 480), (725, 535)],
        "control",
        identity="runtime-delivery",
        source="runtime",
        target="voice",
    )
    d.edge(
        [(665, 535), (665, 480)],
        "data",
        identity="recognized-input",
        source="voice",
        target="runtime",
    )
    d.edge(
        [(800, 575), (880, 575)],
        "delivery",
        identity="local-output",
        source="voice",
        target="speech-services",
    )
    d.edge(
        [(880, 630), (800, 630)],
        "data",
        identity="local-input",
        source="speech-services",
        target="voice",
    )
    d.edge([(460, 660), (460, 720), (1010, 720), (1010, 760)], "control")
    d.edge(
        [(580, 480), (580, 690), (420, 690), (420, 790), (230, 790), (230, 805)],
        "data",
        dashed=True,
        identity="durable-history",
        source="runtime",
        target="operational-store",
    )
    d.edge(
        [(780, 480), (780, 505), (810, 505), (810, 775), (740, 775), (740, 805)],
        "data",
        dashed=True,
        both=True,
        identity="reviewed-recall",
        source="runtime",
        target="reviewed-memory",
    )
    d.card(
        "owner",
        60,
        195,
        220,
        105,
        "Owner",
        ["Choices + approvals", "Revocation + Quit"],
        accent="control",
    )
    d.card(
        "react-ui",
        60,
        330,
        220,
        150,
        "React UI",
        ["Living Visual Engine", "Chat / Controls", "State + meters"],
    )
    d.card(
        "owner-proof",
        60,
        535,
        220,
        125,
        "Private binding",
        ["Fresh mutual proof", "Trusted assets only", "Commands / events"],
        accent="control",
    )
    d.card(
        "supervisor",
        360,
        195,
        440,
        105,
        "Supervisor & recovery",
        ["Managed lifecycle, crash recovery, safe mode", "Independent staged-update authority"],
        accent="control",
    )
    d.card(
        "runtime",
        360,
        330,
        440,
        150,
        "Python runtime / TurnManager",
        [
            "Committed turns + cancellation identities",
            "Frozen provider / model route per turn",
            "Model output is data, never authority",
        ],
        accent="control",
    )
    d.card(
        "agency-policy",
        360,
        535,
        200,
        125,
        "Policy / Agency",
        ["Typed schemas", "Owner approval", "Lease + cancel"],
        accent="control",
    )
    d.card(
        "voice",
        600,
        535,
        200,
        125,
        "Voice pipeline",
        ["Capture → STT", "TTS → playback", "Separate lifetimes"],
        accent="delivery",
    )
    d.card(
        "providers",
        880,
        330,
        260,
        150,
        "Model providers",
        ["Local-first inference", "Exact provider / model", "Cloud: explicit opt-in"],
    )
    d.card(
        "speech-services",
        880,
        535,
        260,
        125,
        "Local speech",
        ["whisper.cpp / system TTS", "OS audio device access", "No model downloads"],
        accent="delivery",
    )
    d.card(
        "os-resources",
        880,
        760,
        260,
        125,
        "OS / workspace",
        ["Bounded OS actions", "No model-owned privileges", "External ownership kept"],
        accent="control",
    )
    d.card(
        "operational-store",
        60,
        805,
        340,
        85,
        "Operational store",
        ["Committed history / runtime state"],
    )
    d.card(
        "reviewed-memory",
        460,
        805,
        340,
        85,
        "Reviewed personal Memory",
        ["Reviewed data / scoped local recall"],
        accent="delivery",
    )
    d.text(540, 711, "Policy-approved resource access", color="control", available=400)
    d.text(40, 941, "Models, webpages and stored claims never become owner permissions.")
    d.text(
        40,
        967,
        "Local-first by default. Cloud routes require explicit policy; "
        "reviewed Memory stays local.",
    )
    return d.finish()


def conversation_lifecycle() -> str:
    d = Diagram(
        "Sam development conversation, recognition and delivery lifecycle",
        "Text enters authenticated command admission; ACK is not commitment or readiness. "
        "Microphone PCM and VAD feed provisional recognition. Core commitment establishes "
        "turn, generation and cancellation ownership and a frozen exact inference route. "
        "Completed written text and optional synthesized/playback delivery have separate "
        "lifetimes. Accepted PCM writes drive visual observations, not acoustic timestamps. "
        "Cancellation and terminal failures reject late work and preserve typed recovery.",
        1000,
    )
    d.header(
        "Conversation / recognition / delivery",
        "Development lifecycle • recognition is evidence; text and speech finish separately.",
        lifecycle=True,
    )
    d.panel("input-commit", 20, 150, 1160, 310, "INPUT & CORE COMMITMENT", accent="control")
    d.panel("text-generation", 20, 510, 1160, 220, "TEXT GENERATION")
    d.panel("optional-delivery", 590, 530, 590, 200, "OPTIONAL SPEECH DELIVERY", accent="delivery")
    d.panel("recovery", 20, 780, 1160, 200, "CANCELLATION / FAILURE / RECOVERY", accent="warning")
    d.edge([(270, 257), (320, 257)], "control")
    d.edge([(270, 385), (320, 385)], "data")
    d.edge([(550, 257), (590, 257), (590, 322), (610, 322)], "control")
    d.edge([(550, 385), (590, 385), (590, 350), (610, 350)], "data")
    d.edge([(840, 322), (900, 322)], "control")
    d.edge([(1030, 390), (1030, 482), (155, 482), (155, 560)], "data")
    d.edge([(270, 627), (320, 627)], "data")
    d.edge([(550, 627), (610, 627)], "delivery", dashed=True)
    d.edge([(840, 627), (900, 627)], "delivery")
    d.edge(
        [(1160, 627), (1170, 627), (1170, 810), (1030, 810), (1030, 830)],
        "delivery",
        identity="playback-observation",
        source="playback",
        target="visual-observer",
    )
    d.edge(
        [(435, 440), (435, 450), (580, 450), (580, 760), (230, 760), (230, 830)],
        "warning",
        dashed=True,
        identity="stt-retirement",
        source="recognition",
        target="retire-work",
    )
    d.edge(
        [(155, 695), (155, 830)],
        "warning",
        dashed=True,
        identity="stream-retirement",
        source="stream",
        target="retire-work",
    )
    d.edge(
        [(1100, 695), (1100, 780), (310, 780), (310, 830)],
        "warning",
        dashed=True,
        identity="playback-retirement",
        source="playback",
        target="retire-work",
    )
    d.edge([(380, 892), (440, 892)], "control")
    d.card(
        "typed-input",
        40,
        205,
        230,
        105,
        "Typed request",
        ["Owner command", "Local pending status"],
        accent="control",
    )
    d.card(
        "authenticated-admission",
        320,
        205,
        230,
        105,
        "Owner admission",
        ["Fresh owner proof", "ACK ≠ readiness"],
        accent="control",
    )
    d.card(
        "capture",
        40,
        330,
        230,
        110,
        "Microphone input",
        ["PCM + pre-roll + VAD", "Utterance token"],
    )
    d.card(
        "recognition",
        320,
        330,
        230,
        110,
        "Provisional STT",
        ["en / es / auto", "Final ≠ commitment"],
    )
    d.card(
        "turn-commit",
        610,
        255,
        230,
        135,
        "Commit user turn",
        ["Turn + generation", "Cancellation identity", "Freeze exact route"],
        accent="control",
    )
    d.card(
        "request-dispatch",
        900,
        255,
        260,
        135,
        "Confirm & dispatch",
        ["Exact provider + model", "Loading ≠ Active", "No silent replacement"],
        accent="control",
    )
    d.card(
        "stream",
        40,
        560,
        230,
        135,
        "Stream response",
        ["Headers / first token", "Provisional deltas", "Bounded wait + cancel"],
    )
    d.card(
        "completed-text",
        320,
        560,
        230,
        135,
        "Completed answer",
        ["Committed text", "Model completed", "Preserved after Stop"],
        accent="control",
    )
    d.card(
        "synthesis",
        610,
        560,
        230,
        135,
        "Prepare speech",
        ["WAV / PCM synthesis", "No text regeneration", "May fail / be stopped"],
        accent="delivery",
    )
    d.card(
        "playback",
        900,
        560,
        260,
        135,
        "Playback & drain",
        ["Bounded PCM writes", "Drain retires delivery", "Writes ≠ sound clock"],
        accent="delivery",
    )
    d.card(
        "retire-work",
        40,
        830,
        340,
        125,
        "Retire matching work",
        ["Stop / supersede / failure", "Reject late IDs and results", "Never acquire a newer turn"],
        accent="warning",
    )
    d.card(
        "typed-recovery",
        440,
        830,
        360,
        125,
        "Typed recovery",
        [
            "Committed answers remain",
            "A fresh turn gets its own route",
            "Real failure stays visible",
        ],
        accent="control",
    )
    d.card(
        "visual-observer",
        900,
        830,
        260,
        125,
        "Living presence",
        ["Lifecycle + scalar meters", "Accepted output writes", "No physical sound clock"],
        accent="delivery",
    )
    d.text(610, 756, "Stops preserve completed text.", available=450)
    return d.finish()


def generated_diagrams() -> dict[str, str]:
    return {
        "sam-system-architecture.svg": system_architecture(),
        "sam-conversation-lifecycle.svg": conversation_lifecycle(),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify files without writing")
    args = parser.parse_args()
    target = ROOT / "docs/diagrams"
    for name, content in generated_diagrams().items():
        path = target / name
        if args.check:
            if not path.is_file() or path.read_text(encoding="utf-8") != content:
                raise SystemExit(f"Diagram differs from its editable source: {name}")
        else:
            target.mkdir(exist_ok=True, parents=True)
            path.write_text(content, encoding="utf-8", newline="\n")
    print(
        "Two SVG sources match."
        if args.check
        else "Wrote two editable SVG diagrams; no rendering performed."
    )


if __name__ == "__main__":
    main()
