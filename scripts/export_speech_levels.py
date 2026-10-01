"""Freeze tiny scalar-only fixtures from the opt-in installed speech gates."""

import json
from pathlib import Path


def bounded_levels(rows):
    first = next(index for index, row in enumerate(rows) if row[1] > 0.01)
    rows = rows[max(0, first - 5) : max(0, first - 5) + 160 : 3]
    origin = rows[0][0]
    return [[round(row[0] - origin), *[round(value, 5) for value in row[1:]]] for row in rows]


def export():
    events = json.loads(Path(".sam/speech-persona-events.json").read_text(encoding="utf-8"))
    voice = json.loads(Path(".sam/voice-sequence.json").read_text(encoding="utf-8"))
    output = {}
    for event in events:
        selection = event["payload"].get("tts_selection")
        if selection and selection["requested_language"] not in output:
            language = selection["requested_language"]
            generation = event["generation_id"]
            rows = [
                [item["monotonic_ms"], item["payload"]["envelope"], item["payload"]["peak"]]
                for item in events
                if item["type"] == "tts.level" and item["generation_id"] == generation
            ]
            output[language] = bounded_levels(rows)
    fixture = {
        "provenance": "2026-10-01 installed Hazel/Helena PCM; runtime TTS meters "
        "and paced capture/VAD meters; no audio",
        "output": output,
        "input": {report["language"]: bounded_levels(report["input_levels"]) for report in voice},
    }
    Path("ui/tests/fixtures/installed-speech-levels.json").write_text(
        json.dumps(fixture, indent=2) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    export()
