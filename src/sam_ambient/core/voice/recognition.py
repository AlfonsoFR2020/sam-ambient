"""Pure recognition selectors; regional locales do not imply dialect decoding."""

import re


def recognition_language(value: str, *, allow_auto: bool = True) -> str:
    """Resolve a primary code or common locale to whisper.cpp's language selector."""

    if not isinstance(value, str):
        raise ValueError("recognition language must be a code or locale")
    value = value.strip()
    if allow_auto and value.casefold() == "auto":
        return "auto"
    match = re.fullmatch(
        r"([A-Za-z]{2,3})(?:[-_][A-Za-z]{4})?(?:[-_](?:[A-Za-z]{2}|[0-9]{3}))?", value
    )
    if match is None:
        raise ValueError("recognition language must be a language code or locale")
    return match[1].lower()
