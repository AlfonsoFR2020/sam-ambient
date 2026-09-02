"""Deterministic sentence/semantic chunking for streamed model text."""

from __future__ import annotations

_CLOSERS = frozenset("\"'\u2019\u201d)]}")
_ABBREVIATIONS = frozenset(
    {
        "dr.",
        "e.g.",
        "etc.",
        "i.e.",
        "jr.",
        "mr.",
        "mrs.",
        "ms.",
        "prof.",
        "sr.",
        "st.",
        "vs.",
    }
)


class SentenceChunker:
    """Turn arbitrary text deltas into bounded, speakable text chunks."""

    def __init__(self, *, min_chars: int = 24, max_chars: int = 240) -> None:
        if min_chars < 1:
            raise ValueError("min_chars must be positive")
        if max_chars < min_chars:
            raise ValueError("max_chars must be at least min_chars")
        self.min_chars = min_chars
        self.max_chars = max_chars
        self._buffer = ""

    @property
    def pending_text(self) -> str:
        return self._buffer

    def push(self, delta: str) -> tuple[str, ...]:
        if not isinstance(delta, str):
            raise TypeError("delta must be a string")
        self._buffer += delta
        return self._drain(final=False)

    def flush(self) -> tuple[str, ...]:
        return self._drain(final=True)

    def _drain(self, *, final: bool) -> tuple[str, ...]:
        chunks: list[str] = []
        while self._buffer:
            boundary = self._sentence_boundary(final=final)
            if boundary is None and len(self._buffer) > self.max_chars:
                boundary = self._hard_boundary()
            if boundary is None:
                break
            self._emit(boundary, chunks)
        if final and self._buffer.strip():
            chunks.append(self._buffer.strip())
            self._buffer = ""
        elif final:
            self._buffer = ""
        return tuple(chunks)

    def _sentence_boundary(self, *, final: bool) -> int | None:
        for index, character in enumerate(self._buffer):
            if character == "\n":
                if len(self._buffer[:index].strip()) >= self.min_chars:
                    return index + 1
                continue
            if character not in ".?!":
                continue
            end = index + 1
            while end < len(self._buffer) and self._buffer[end] in _CLOSERS:
                end += 1
            if end == len(self._buffer) and not final:
                continue
            if end < len(self._buffer) and not self._buffer[end].isspace():
                continue
            candidate = self._buffer[:end].strip()
            if len(candidate) < self.min_chars or self._looks_like_abbreviation(candidate):
                continue
            return end
        return None

    def _hard_boundary(self) -> int:
        window = self._buffer[: self.max_chars + 1]
        whitespace = max(window.rfind(" "), window.rfind("\n"), window.rfind("\t"))
        return whitespace + 1 if whitespace >= self.min_chars else self.max_chars

    def _looks_like_abbreviation(self, candidate: str) -> bool:
        last_word = candidate.lower().rsplit(maxsplit=1)[-1]
        if last_word in _ABBREVIATIONS:
            return True
        if len(last_word) == 2 and last_word[0].isalpha() and last_word[1] == ".":
            return True
        return False

    def _emit(self, boundary: int, chunks: list[str]) -> None:
        chunk = self._buffer[:boundary].strip()
        self._buffer = self._buffer[boundary:].lstrip()
        if chunk:
            chunks.append(chunk)
