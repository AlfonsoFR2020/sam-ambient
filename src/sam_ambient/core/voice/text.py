"""Delivery-only Markdown normalization; formatted model/history text is untouched."""

from __future__ import annotations

import re


def speech_text(text: str) -> str:
    """Speak common Markdown as text, preserving prose, inline code and arithmetic.

    This is a presentation boundary, not an HTML renderer or instruction parser.
    URLs attached to readable link text and fence language tags are not spoken.
    """
    text = re.sub(r"(?m)^\s*(`{3,}|~{3,})[^\n]*$", "", text)
    text = re.sub(r"!?(\[([^\]\n]*)\])\([^\)\n]*\)", r"\2", text)
    text = re.sub(r"(?m)^\s*(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)", "", text)
    text = re.sub(r"(?m)^\s*(?:[-*_]\s*){3,}$", "", text)
    for marker in ("**", "__", "~~", "*", "_", "`"):
        escaped = re.escape(marker)
        text = re.sub(rf"(?<!\w){escaped}(\S(?:.*?\S)?){escaped}(?!\w)", r"\1", text)
    return " ".join(text.split())
