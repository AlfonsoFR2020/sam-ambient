"""Rescore retained generated-speech transcripts; never capture, synthesize or recognize.

Only aggregate errors/counts and input hashes are exported. This is an audit of
historical decoder output, not a new recognition or speed measurement.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from scripts.speech_baseline import normalized, score

MAX_REPORT_BYTES = 8 * 1024 * 1024
MAX_CASES = 4096


def read_report(path: Path):
    if path.stat().st_size > MAX_REPORT_BYTES:
        raise ValueError("Historical report exceeds the offline audit size bound")
    data = path.read_bytes()
    return json.loads(data), {"name": path.name, "sha256": hashlib.sha256(data).hexdigest()}


def aggregate(records):
    records = list(records)
    if not records or len(records) > MAX_CASES:
        raise ValueError("Expected a bounded nonempty set of reference/transcript pairs")
    totals = dict.fromkeys(("word_errors", "words", "char_errors", "chars"), 0)
    cached_mismatches = 0
    for row in records:
        if not isinstance(row["reference"], str) or not isinstance(row["text"], str):
            raise ValueError("Historical reference and transcript must be strings")
        if len(row["reference"]) > 8192 or len(row["text"]) > 8192:
            raise ValueError("Historical transcript exceeds the offline audit bound")
        if not normalized(row["reference"]):
            raise ValueError("Each historical case needs a scoreable reference")
        result = score(row["reference"], row["text"])
        cached_mismatches += any(key in row and row[key] != result[key] for key in totals)
        for key in totals:
            totals[key] += result[key]
    if not totals["words"] or not totals["chars"]:
        raise ValueError("References must contain scoreable words")
    return {
        "cases": len(records),
        **totals,
        "wer": round(totals["word_errors"] / totals["words"], 6),
        "cer": round(totals["char_errors"] / totals["chars"], 6),
        "cached_metric_mismatches": cached_mismatches,
    }


def rescore(baseline: Path, sequence: Path):
    historical, baseline_hash = read_report(baseline)
    sequenced, sequence_hash = read_report(sequence)
    records = historical["recognition"]
    if len(records) > MAX_CASES or len(sequenced) > MAX_CASES:
        raise ValueError("Historical report exceeds case bound")
    groups = []
    for language in ("en", "es"):
        for mode in (language, "auto"):
            rows = [r for r in records if r["language"] == language and r["mode"] == mode]
            groups.append(
                {
                    "language": language,
                    "mode": "auto" if mode == "auto" else "forced",
                    **aggregate(rows),
                }
            )
    sequence_groups = [
        {"language": row["language"], **aggregate(row["transcripts"])} for row in sequenced
    ]
    return {
        "format": 1,
        "scope": "offline_transcript_rescore_only",
        "historical_source": "SPEECH_BASELINE_2026-10-01.md",
        "normalization": (
            "NFC, casefold, word tokens; accents retained; CER includes normalized spaces"
        ),
        "new_recognition_executed": False,
        "new_latency_measurement": False,
        "owner_representative_audio": False,
        "inputs": [baseline_hash, sequence_hash],
        "recognition": groups,
        "paced_sequence": sequence_groups,
        "limits": [
            "Retained transcripts from generated System.Speech clips, not natural owner speech.",
            "Original PCM was not retained; no new decoding or acoustic comparison is possible.",
            "Historical pipeline rows without references are not independently rescored.",
            "Control-flow repairs do not establish accuracy or latency gains.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, default=Path(".sam/speech-baseline.json"))
    parser.add_argument("--sequence", type=Path, default=Path(".sam/voice-sequence.json"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = rescore(args.baseline, args.sequence)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("Wrote aggregate historical transcript audit; no recognition/audio run.")


if __name__ == "__main__":
    main()
