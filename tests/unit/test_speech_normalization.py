import pytest

from sam_ambient.core.voice.text import speech_text
from sam_ambient.runtime import _screen_playback_transcript


@pytest.mark.parametrize(
    "formatted,expected",
    [
        ("# About Sam\n\n**Hello**, _owner_.", "About Sam Hello, owner."),
        ("- **First**\n2. Second\n> Listen", "First Second Listen"),
        ("See [Sam](https://example.com). `uv run sam-ambient`", "See Sam. uv run sam-ambient"),
        ("```python\nprint('hello')\n```", "print('hello')"),
        ("2 * 3 = 6; snake_case; C#; 3.14", "2 * 3 = 6; snake_case; C#; 3.14"),
    ],
)
def test_speech_text_removes_presentation_only(formatted, expected):
    assert speech_text(formatted) == expected


def test_spoken_formatting_words_do_not_evade_known_playback_screen():
    answer = "I am **Gemma**, a **large language model** from **Google DeepMind**."
    echo = (
        "I am asterisk asterisk Gemma asterisk asterisk a large language model from Google DeepMind"
    )
    assert _screen_playback_transcript(echo, answer) == (None, "playback_echo")
    assert _screen_playback_transcript("stop", answer) == ("stop", None)
