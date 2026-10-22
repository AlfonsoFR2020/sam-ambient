"""Offline scoring/report privacy, not recognition accuracy."""

import json

import pytest

from scripts.rescore_speech_baseline import MAX_REPORT_BYTES, aggregate, read_report, rescore


def test_aggregate_uses_corpus_weighting_and_preserves_accents():
    rows = [
        {"reference": "¿Qué hora es?", "text": "Que hora es", "char_errors": 0},
        {"reference": "Please explain the next step", "text": "Please explain next step"},
    ]
    result = aggregate(rows)
    assert result["cases"] == 2
    assert result["word_errors"] == 2 and result["words"] == 8
    assert result["wer"] == 0.25
    assert result["cached_metric_mismatches"] == 1
    assert "reference" not in result and "text" not in result


@pytest.mark.parametrize("reference", ["", "   ", "?!"])
def test_unscoreable_references_are_rejected(reference):
    with pytest.raises(ValueError):
        aggregate([{"reference": reference, "text": ""}])


def test_reports_are_bounded_before_reading(tmp_path):
    path = tmp_path / "oversized.json"
    with path.open("wb") as target:
        target.truncate(MAX_REPORT_BYTES + 1)
    with pytest.raises(ValueError, match="size bound"):
        read_report(path)


def test_report_excludes_transcripts_paths_and_latency_measurement(tmp_path):
    rows = [
        {"language": lang, "mode": mode, "reference": "private fixture", "text": "private fixture"}
        for lang in ("en", "es")
        for mode in (lang, "auto")
    ]
    baseline, sequence = tmp_path / "baseline.json", tmp_path / "sequence.json"
    baseline.write_text(json.dumps({"recognition": rows}), encoding="utf-8")
    sequence.write_text(json.dumps([{"language": "es", "transcripts": rows[:1]}]), encoding="utf-8")
    report = rescore(baseline, sequence)
    encoded = json.dumps(report)
    assert "private fixture" not in encoded and str(tmp_path) not in encoded
    assert len(report["inputs"][0]["sha256"]) == 64
    assert report["new_recognition_executed"] is False
    assert report["new_latency_measurement"] is False
