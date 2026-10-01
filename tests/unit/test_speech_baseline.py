"""Scoring/signal checks only; the opt-in benchmark uses real installed speech."""

from scripts.speech_baseline import condition, edit_distance, join_segments, samples, score, wav


def test_scores_normalize_case_punctuation_but_preserve_spanish_letters():
    assert score("¿Qué hora es?", "qué hora es.")["word_errors"] == 0
    assert score("qué hora es", "que hora es")["char_errors"] == 1
    assert edit_distance(["one", "two"], ["one"]) == 1
    assert score("first middle last", "middle")["first_word_matches"] is False
    assert score("first middle last", "middle")["last_word_matches"] is False


def test_conditions_keep_deterministic_bounded_pcm_and_correct_silence():
    pcm = b"\x00\x10" * 320
    assert samples(condition(pcm, "quiet"))[0] == 1024
    assert condition(pcm, "noise") == condition(pcm, "noise")
    assert len(condition(pcm, "noise")) == len(pcm)
    assert len(condition(pcm, "silence")) == len(pcm) + 48_000
    assert wav(pcm).startswith(b"RIFF")


def test_multisegment_pause_excludes_synthesis_padding():
    active = b"\x00\x10" * 320
    first, second = active + b"\0" * 32000, b"\0" * 16000 + active
    combined, original = join_segments(first, second)
    assert combined == active + b"\0" * 8000 + active
    assert original == 1750
