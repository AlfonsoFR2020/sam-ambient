"""Installed System.Speech → real whisper.cpp baseline; no devices or downloads.

Run: python scripts/speech_baseline.py --root . --output .sam/speech-baseline.json
Only generated, non-personal corpus text/results are retained. PCM stays in memory.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import math
import random
import re
import statistics
import sys
import time
import unicodedata
import wave
from array import array
from pathlib import Path

from sam_ambient.adapters.stt.whisper_cpp import WhisperCppServerSTT
from sam_ambient.adapters.tts.system import SystemTextToSpeech
from sam_ambient.adapters.vad.webrtc import WebRtcVoiceActivityDetector
from sam_ambient.core.turns import CancellationToken, TurnManager
from sam_ambient.core.voice import AudioFormat, AudioFrame
from sam_ambient.core.voice.pipeline import VoiceInputPipeline

RATE = 16_000
FRAME_BYTES = 640
CORPUS = {
    "en": (
        "Please tell me what time it is.",
        "Could you remind me to buy bread and apples tomorrow morning?",
        "The meeting starts at half past nine on Tuesday the fifteenth of October.",
        "Ana and Carlos are travelling from Madrid to Barcelona on Friday.",
        "I have twenty three books and need two more shelves.",
        "Before we continue, pause for a moment. Then explain the next step in plain language.",
    ),
    "es": (
        "Por favor, dime qué hora es.",
        "¿Puedes recordarme que compre pan y manzanas mañana por la mañana?",
        "La reunión empieza a las nueve y media del martes quince de octubre.",
        "Ana y Carlos viajan de Madrid a Barcelona el viernes.",
        "Tengo veintitrés libros y necesito dos estanterías más.",
        "Antes de continuar, espera un momento. "
        "Después explica el siguiente paso con palabras sencillas.",
    ),
}


def normalized(text: str) -> str:
    return " ".join(re.findall(r"\w+", unicodedata.normalize("NFC", text).casefold()))


def edit_distance(expected, actual) -> int:
    previous = list(range(len(actual) + 1))
    for row, left in enumerate(expected, 1):
        current = [row]
        for column, right in enumerate(actual, 1):
            current.append(
                min(current[-1] + 1, previous[column] + 1, previous[column - 1] + (left != right))
            )
        previous = current
    return previous[-1]


def score(reference: str, text: str) -> dict:
    expected, actual = normalized(reference), normalized(text)
    words, result = expected.split(), actual.split()
    return {
        "word_errors": edit_distance(words, result),
        "words": len(words),
        "char_errors": edit_distance(expected, actual),
        "chars": len(expected),
        "first_word_matches": bool(result) and result[0] == words[0],
        "last_word_matches": bool(result) and result[-1] == words[-1],
    }


def samples(pcm: bytes) -> array:
    data = array("h")
    data.frombytes(pcm)
    if sys.byteorder != "little":
        data.byteswap()
    return data


def condition(pcm: bytes, kind: str) -> bytes:
    if kind == "silence":
        return b"\0" * RATE + pcm + b"\0" * (RATE * 2)
    data = samples(pcm)
    rng = random.Random(731)
    rms = math.sqrt(sum(float(value) ** 2 for value in data) / max(1, len(data)))
    noise_scale = rms / 10 * math.sqrt(3)  # Fixed 20 dB active-clip RMS/noise ratio.
    changed = array(
        "h",
        (
            max(
                -32768,
                min(
                    32767,
                    round(
                        value * (0.25 if kind == "quiet" else 1)
                        + (rng.uniform(-noise_scale, noise_scale) if kind == "noise" else 0)
                    ),
                ),
            )
            for value in data
        ),
    )
    if sys.byteorder != "little":
        changed.byteswap()
    return changed.tobytes()


def wav(pcm: bytes) -> bytes:
    target = io.BytesIO()
    with wave.open(target, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(pcm)
    return target.getvalue()


def speech_bounds(pcm: bytes) -> tuple[int, int]:
    active = [index for index, value in enumerate(samples(pcm)) if abs(value) > 100]
    return (active[0] * 2, (active[-1] + 1) * 2) if active else (0, 0)


def join_segments(first: bytes, second: bytes) -> tuple[bytes, float]:
    # Separate System.Speech calls contain sentence-final/initial silence. Keep
    # the deliberately tested pause exactly 250 ms, rather than adding both.
    _, end = speech_bounds(first)
    start, _ = speech_bounds(second)
    original_gap_ms = (len(first) - end + start) / 32 + 250
    return first[:end] + b"\0" * (RATE // 2) + second[start:], original_gap_ms


class ObservedSTT(WhisperCppServerSTT):
    def __init__(self):
        super().__init__()
        self.observations = []

    async def _request(self, data, *, language, cancellation):
        start = time.perf_counter()
        result = await super()._request(data, language=language, cancellation=cancellation)
        probabilities = result.get("language_probabilities", {})
        self.observations.append(
            {
                "requested": language,
                "reported": result.get("language"),
                "probabilities": probabilities,
                "ms": round((time.perf_counter() - start) * 1000),
            }
        )
        return result


class PacedCapture:
    """Continuous 20 ms capture; silence continues after generated speech."""

    def __init__(self, pcm):
        self.pcm = pcm
        self.last_ms = 0
        self.last_active_ms = 0
        self.sequence = 0
        self.expected_last_active_ms = max(
            (index * 1000 / RATE for index, value in enumerate(samples(pcm)) if abs(value) > 100),
            default=0,
        )

    async def frames(self, cancellation):
        sequence = 0
        while True:
            cancellation.raise_if_cancelled()
            await asyncio.sleep(0.02)
            at = sequence * FRAME_BYTES
            data = self.pcm[at : at + FRAME_BYTES].ljust(FRAME_BYTES, b"\0")
            self.last_ms = time.monotonic_ns() // 1_000_000
            self.sequence = sequence
            if any(abs(value) > 100 for value in samples(data)):
                self.last_active_ms = self.last_ms
            yield AudioFrame(AudioFormat(), data, self.last_ms, sequence)
            sequence += 1


async def generated(speech, text, language):
    pcm = bytearray()
    async for frame in speech.synthesize(
        text, voice="default", language=language, cancellation=CancellationToken()
    ):
        assert frame.format == AudioFormat()
        pcm.extend(frame.data)
    return bytes(pcm)


async def pipeline_case(stt, pcm, language, reference):
    capture = PacedCapture(b"\0" * RATE + pcm)
    events = []
    endpoint_audio_ms = None

    async def publish(event):
        nonlocal endpoint_audio_ms
        events.append(event)
        if event.payload.get("reason") == "stt_finalizing":
            endpoint_audio_ms = (capture.sequence + 1) * 20

    pipeline = VoiceInputPipeline(
        capture=capture,
        vad=WebRtcVoiceActivityDetector(),
        stt=stt,
        turn_manager=TurnManager("baseline"),
        publish=publish,
        language=language,
    )
    started = time.perf_counter()
    result = await asyncio.wait_for(pipeline.run(CancellationToken()), 45)
    endpoint = next(
        (event.monotonic_ms for event in events if event.payload.get("reason") == "stt_finalizing"),
        None,
    )
    return {
        "language": language,
        "text": result.transcript.text,
        **score(reference, result.transcript.text),
        "endpoint_after_last_active_ms": endpoint - capture.last_active_ms if endpoint else None,
        "endpoint_after_corpus_ms": round(endpoint_audio_ms - capture.expected_last_active_ms)
        if endpoint_audio_ms is not None
        else None,
        "audio_complete": capture.last_ms and result.audio_frames * FRAME_BYTES >= len(capture.pcm),
        "elapsed_ms": round((time.perf_counter() - started) * 1000),
        "audio_frames": result.audio_frames,
    }


def summary(records):
    result = []
    for language in CORPUS:
        for mode in (language, "auto"):
            selected = [
                item for item in records if item["language"] == language and item["mode"] == mode
            ]
            result.append(
                {
                    "language": language,
                    "mode": mode,
                    "cases": len(selected),
                    "wer": round(
                        sum(item["word_errors"] for item in selected)
                        / sum(item["words"] for item in selected),
                        4,
                    ),
                    "cer": round(
                        sum(item["char_errors"] for item in selected)
                        / sum(item["chars"] for item in selected),
                        4,
                    ),
                    "median_ms": round(statistics.median(item["ms"] for item in selected)),
                }
            )
    return result


async def benchmark(root, output, pipeline_only=False):
    speech, stt = SystemTextToSpeech(), ObservedSTT()
    records, pipeline_records, voices = [], [], {}
    try:
        await stt.ensure_ready(root)
        clips = {}
        for language, utterances in ({} if pipeline_only else CORPUS).items():
            for index, text in enumerate(utterances):
                clips[language, index] = await generated(speech, text, language)
                voices[language] = speech.last_selection.voice.voice_id
        if pipeline_only:
            prior = json.loads(output.read_text(encoding="utf-8"))
            records, voices = prior["recognition"], prior["voices"]
        for language, utterances in ({} if pipeline_only else CORPUS).items():
            for index, reference in enumerate(utterances):
                kinds = ("clean", "quiet", "noise", "silence") if index == 0 else ("clean",)
                for kind in kinds:
                    pcm = condition(clips[language, index], kind)
                    for mode in (language, "auto"):
                        before = len(stt.observations)
                        start = time.perf_counter()
                        result = await stt.transcribe(
                            wav(pcm), language=mode, cancellation=CancellationToken()
                        )
                        record = {
                            "language": language,
                            "index": index,
                            "condition": kind,
                            "mode": mode,
                            "reference": reference,
                            "text": result.text,
                            "ms": round((time.perf_counter() - start) * 1000),
                            **score(reference, result.text),
                            "requests": stt.observations[before:],
                        }
                        records.append(record)
                        print(
                            json.dumps(
                                {
                                    key: record[key]
                                    for key in (
                                        "language",
                                        "index",
                                        "condition",
                                        "mode",
                                        "ms",
                                        "word_errors",
                                    )
                                }
                            ),
                            flush=True,
                        )
        for language in CORPUS:
            if pipeline_only:
                clips[language, 1] = await generated(speech, CORPUS[language][1], language)
            pipeline_records.append(
                await pipeline_case(stt, clips[language, 1], language, CORPUS[language][1])
            )
            text = CORPUS[language][-1]
            first, second = text.split(". ")
            multi, original_gap_ms = join_segments(
                await generated(speech, first + ".", language),
                await generated(speech, second, language),
            )
            record = await pipeline_case(stt, multi, language, text)
            record.update(segment_pause_ms=250, untrimmed_gap_ms=round(original_gap_ms))
            pipeline_records.append(record)
        report = {
            "format": "16 kHz mono PCM16; 20 ms pipeline frames",
            "model": "existing ggml-base.bin",
            "voices": voices,
            "recognition": records,
            "summary": summary(records),
            "pipeline": pipeline_records,
        }
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(
            json.dumps(
                {"summary": report["summary"], "pipeline": pipeline_records}, ensure_ascii=False
            ),
            flush=True,
        )
    finally:
        await speech.aclose()
        await stt.aclose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--output", type=Path, default=Path(".sam/speech-baseline.json"))
    parser.add_argument("--pipeline-only", action="store_true")
    args = parser.parse_args()
    asyncio.run(benchmark(args.root, args.output, args.pipeline_only))
