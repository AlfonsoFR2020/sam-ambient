"""Local-first STT adapter with optional ownership of an existing local server."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import math
import os
import wave
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import httpx

from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import (
    AudioFormat,
    AudioFrame,
    SampleFormat,
    SpeechToTextStream,
    Transcript,
    VoiceStreamContext,
)

DEFAULT_WHISPER_CPP_URL = "http://127.0.0.1:8080"
log = logging.getLogger(__name__)


class SpeechRecognitionError(RuntimeError):
    pass


class SpeechRecognitionUnavailable(SpeechRecognitionError):
    pass


class SpeechRecognitionTimeout(SpeechRecognitionError):
    pass


class SpeechRecognitionProtocolError(SpeechRecognitionError):
    pass


class SpeechAudioLimitExceeded(SpeechRecognitionError):
    pass


def normalize_whisper_cpp_url(value: str) -> str:
    normalized = value.strip()
    if "://" not in normalized:
        normalized = f"http://{normalized}"
    parsed = urlsplit(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("whisper.cpp URL must use http or https and include a host")
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "")).rstrip("/")


def _is_loopback_url(value: str) -> bool:
    host = urlsplit(value).hostname or ""
    if host.lower() == "localhost":
        return True
    try:
        return ip_address(host).is_loopback
    except ValueError:
        return False


def _local_assets(root: Path) -> tuple[Path, Path]:
    root = root.resolve()
    executable = root / ".sam/runtime/whisper-b4938/Release/whisper-server.exe"
    model = root / ".sam/models/ggml-base.bin"
    for path, magic in ((executable, b"MZ"), (model, b"lmgg")):
        try:
            with path.open("rb") as stream:
                valid = stream.read(len(magic)) == magic
        except OSError as error:
            raise SpeechRecognitionUnavailable(f"STT asset missing/unreadable: {path}") from error
        if not valid:
            raise SpeechRecognitionUnavailable(f"STT asset has invalid header: {path}")
    return executable, model


class WhisperCppServerSTT:
    """Finalize utterances through whisper.cpp's multipart `/inference` API."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_WHISPER_CPP_URL,
        client: httpx.AsyncClient | None = None,
        timeout_s: float = 120.0,
        max_response_bytes: int = 4 * 1024 * 1024,
        max_audio_seconds: int = 120,
        allow_remote: bool = False,
        preferred_languages: tuple[str, ...] = ("en", "es"),
        language_confidence: float = 0.8,
    ) -> None:
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")
        if max_response_bytes <= 0 or max_audio_seconds <= 0:
            raise ValueError("STT size limits must be positive")
        if not preferred_languages or any(
            not code.isalpha() or len(code) not in (2, 3) for code in preferred_languages
        ):
            raise ValueError("preferred languages must be language codes")
        if not 0.5 <= language_confidence <= 1.0:
            raise ValueError("language confidence must be between 0.5 and 1")
        self._preferred_languages = preferred_languages
        self._language_confidence = language_confidence
        self._recent_language: str | None = None
        self.base_url = normalize_whisper_cpp_url(base_url)
        if not _is_loopback_url(self.base_url) and not allow_remote:
            raise ValueError(
                "remote STT would export microphone audio; set allow_remote=True explicitly"
            )
        self._client = client or httpx.AsyncClient(
            follow_redirects=False,
            trust_env=False,
            verify=self.base_url.startswith("https://"),
        )
        self._owns_client = client is None
        self._timeout_s = timeout_s
        self._max_response_bytes = max_response_bytes
        self._max_audio_seconds = max_audio_seconds
        self._process: asyncio.subprocess.Process | None = None

    async def _ready(self) -> bool:
        try:
            async with self._client.stream(
                "GET", f"{self.base_url}/health", timeout=0.5
            ) as response:
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > 1024:
                        break
                if response.status_code == 200 and len(raw) <= 1024:
                    try:
                        if json.loads(raw).get("status") == "ok":
                            return True
                    except (ValueError, AttributeError):
                        pass
                raise SpeechRecognitionUnavailable(
                    f"STT endpoint {self.base_url}/health is not ready "
                    f"(HTTP {response.status_code}); existing service left untouched"
                )
        except (httpx.ConnectError, httpx.ConnectTimeout):
            return False
        except httpx.RequestError as error:
            raise SpeechRecognitionUnavailable(
                f"STT health request failed at {self.base_url}: {type(error).__name__}"
            ) from error

    async def ensure_ready(self, root: Path, *, startup_timeout_s: float = 8.0) -> None:
        """Reuse a healthy server; otherwise start only the known local installation."""
        if await self._ready():
            log.info("STT ready at %s (existing service)", self.base_url)
            return
        if self.base_url != DEFAULT_WHISPER_CPP_URL or os.name != "nt":
            raise SpeechRecognitionUnavailable(
                f"STT server is not running at {self.base_url}; "
                "start the configured whisper.cpp server"
            )
        executable, model = await asyncio.to_thread(_local_assets, root)
        try:
            log.info("Starting existing whisper.cpp: model=%s endpoint=%s", model, self.base_url)
            self._process = await asyncio.create_subprocess_exec(
                str(executable),
                "--model",
                str(model),
                "--host",
                "127.0.0.1",
                "--port",
                "8080",
                cwd=executable.parent,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
                creationflags=0x08000000,  # CREATE_NO_WINDOW; Windows-only launch above.
            )
            async with asyncio.timeout(startup_timeout_s):
                while self._process.returncode is None:
                    if await self._ready():
                        log.info(
                            "STT ready at %s (Sam-owned pid=%s)", self.base_url, self._process.pid
                        )
                        return
                    await asyncio.sleep(0.1)
            raise SpeechRecognitionUnavailable(
                f"whisper.cpp exited ({self._process.returncode}); check runtime/DLLs at "
                f"{executable.parent} and model {model}"
            )
        except (TimeoutError, OSError) as error:
            await self._stop_owned_process()
            raise SpeechRecognitionUnavailable(
                f"STT startup failed ({type(error).__name__}) at {self.base_url}; "
                f"runtime={executable}, model={model}"
            ) from error
        except BaseException:
            await self._stop_owned_process()
            raise

    async def _stop_owned_process(self) -> None:
        process, self._process = self._process, None
        if process is None:
            return
        if process.returncode is None:
            try:
                process.terminate()
            except ProcessLookupError:
                pass
        try:
            await asyncio.wait_for(process.wait(), 2)
        except TimeoutError:
            process.kill()
            await process.wait()
        log.info("Stopped Sam-owned STT pid=%s", process.pid)

    async def start_stream(
        self,
        context: VoiceStreamContext,
        cancellation: CancellationToken,
    ) -> SpeechToTextStream:
        cancellation.raise_if_cancelled()
        if cancellation.cancellation_id != context.cancellation_id:
            raise ValueError("STT context and token cancellation IDs must match")
        return _WhisperCppStream(self, context, cancellation, self._max_audio_seconds)

    async def transcribe(
        self,
        wav_data: bytes,
        *,
        language: str,
        cancellation: CancellationToken,
    ) -> Transcript:
        value = await self._request(wav_data, language=language, cancellation=cancellation)
        result = self._decode_transcript(json.dumps(value).encode())
        if not result.text or language != "auto":
            return result
        probabilities = value.get("language_probabilities", {})
        scores = (
            {
                code: score
                for code, score in probabilities.items()
                if isinstance(code, str)
                and isinstance(score, int | float)
                and not isinstance(score, bool)
                and math.isfinite(score)
                and 0 <= score <= 1
            }
            if isinstance(probabilities, dict)
            else {}
        )
        if not scores:  # Older servers may omit detection metadata; do not invent confidence.
            return result
        detected = max(scores, key=scores.get)
        confidence = scores[detected]
        selected = detected
        if confidence < self._language_confidence:
            preferred = max(self._preferred_languages, key=lambda code: scores.get(code, 0))
            selected = self._recent_language or preferred
        duration = value.get("duration", 0)
        if not isinstance(duration, int | float) or not math.isfinite(duration) or duration < 0:
            duration = 0
        log.info(
            "STT language=%s probability=%.2f selected=%s duration=%.2fs",
            detected,
            confidence,
            selected,
            duration,
        )
        if selected != detected:
            value = await self._request(wav_data, language=selected, cancellation=cancellation)
            result = self._decode_transcript(json.dumps(value).encode())
        cancellation.raise_if_cancelled()
        # A forced fallback is not new evidence. Only confident auto-detection may
        # change the conversational language, including languages outside preferences.
        if result.text and confidence >= self._language_confidence:
            self._recent_language = detected
        return result

    async def _request(
        self,
        wav_data: bytes,
        *,
        language: str,
        cancellation: CancellationToken,
    ) -> dict:
        cancellation.raise_if_cancelled()
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("STT request requires an asyncio task")
        remove_callback = cancellation.add_callback(lambda _reason: task.cancel())
        fields = {"response_format": "verbose_json", "language": language}
        try:
            async with self._client.stream(
                "POST",
                f"{self.base_url}/inference",
                data=fields,
                files={"file": ("speech.wav", wav_data, "audio/wav")},
                timeout=httpx.Timeout(self._timeout_s),
            ) as response:
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > self._max_response_bytes:
                        raise SpeechRecognitionProtocolError(
                            "whisper.cpp response exceeded configured size limit"
                        )
                if response.status_code >= 400:
                    detail = bytes(raw).decode("utf-8", errors="replace")[:500]
                    raise SpeechRecognitionUnavailable(
                        f"whisper.cpp returned HTTP {response.status_code}: {detail}"
                    )
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        except httpx.TimeoutException as error:
            raise SpeechRecognitionTimeout(f"whisper.cpp request timed out: {error}") from error
        except httpx.RequestError as error:
            raise SpeechRecognitionUnavailable(f"whisper.cpp unavailable: {error}") from error
        finally:
            remove_callback()
        self._decode_transcript(bytes(raw))  # Validate the response before using metadata.
        return json.loads(raw)

    async def aclose(self) -> None:
        await self._stop_owned_process()
        if self._owns_client:
            await self._client.aclose()

    @staticmethod
    def _decode_transcript(raw: bytes) -> Transcript:
        try:
            value = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise SpeechRecognitionProtocolError("whisper.cpp returned invalid JSON") from error
        if not isinstance(value, dict):
            raise SpeechRecognitionProtocolError("whisper.cpp response must be an object")
        error_detail = value.get("error")
        if error_detail:
            raise SpeechRecognitionUnavailable(f"whisper.cpp failed: {str(error_detail)[:500]}")
        text = value.get("text")
        if not isinstance(text, str):
            raise SpeechRecognitionProtocolError("whisper.cpp response omitted transcript text")
        segments = value.get("segments", [])
        if (
            isinstance(segments, list)
            and segments
            and all(
                isinstance(segment, dict)
                and isinstance(segment.get("no_speech_prob"), int | float)
                and segment["no_speech_prob"] >= 0.8
                for segment in segments
            )
        ):
            text = ""
        if text.strip().casefold() in {
            "[blank_audio]",
            "[no_speech]",
            "[silence]",
            "[music]",
            "[música]",
            "[applause]",
            "[laughter]",
        }:
            text = ""
        return Transcript(text=text, is_final=True, confidence=None)


class _WhisperCppStream:
    def __init__(
        self,
        provider: WhisperCppServerSTT,
        context: VoiceStreamContext,
        cancellation: CancellationToken,
        max_audio_seconds: int,
    ) -> None:
        self._provider = provider
        self._context = context
        self._cancellation = cancellation
        self._max_audio_seconds = max_audio_seconds
        self._audio_format: AudioFormat | None = None
        self._audio = bytearray()
        self._result: Transcript | None = None

    @property
    def context(self) -> VoiceStreamContext:
        return self._context

    async def push_audio(
        self,
        frame: AudioFrame,
        cancellation: CancellationToken,
    ) -> None:
        self._ensure_active(cancellation)
        if frame.format.sample_format is not SampleFormat.PCM_S16LE:
            raise SpeechRecognitionProtocolError("whisper.cpp STT requires signed 16-bit PCM")
        if frame.format.channels != 1:
            raise SpeechRecognitionProtocolError("whisper.cpp STT requires mono PCM")
        if frame.dropped_before:
            raise SpeechRecognitionProtocolError("audio discontinuity reached STT")
        if self._audio_format is None:
            self._audio_format = frame.format
        elif frame.format != self._audio_format:
            raise SpeechRecognitionProtocolError("STT audio format changed during a turn")
        maximum = (
            frame.format.sample_rate_hz * frame.format.bytes_per_frame * self._max_audio_seconds
        )
        if len(self._audio) + len(frame.data) > maximum:
            raise SpeechAudioLimitExceeded("utterance exceeded configured STT audio limit")
        self._audio.extend(frame.data)

    async def partial_transcript(self) -> Transcript | None:
        return None

    async def finalize(self, cancellation: CancellationToken) -> Transcript:
        self._ensure_token(cancellation)
        if self._result is not None:
            return self._result
        self._cancellation.raise_if_cancelled()
        if self._audio_format is None or not self._audio:
            raise SpeechRecognitionProtocolError("cannot finalize an empty STT stream")
        wav_data = self._encode_wav(self._audio_format, bytes(self._audio))
        self._result = await self._provider.transcribe(
            wav_data,
            language=self.context.language,
            cancellation=self._cancellation,
        )
        self._audio.clear()
        return self._result

    async def cancel(self, cancellation_id: str, reason: str = "cancelled") -> bool:
        if cancellation_id != self.context.cancellation_id:
            return False
        self._audio.clear()
        return self._cancellation.cancel(reason)

    def _ensure_active(self, cancellation: CancellationToken) -> None:
        self._ensure_token(cancellation)
        cancellation.raise_if_cancelled()
        if self._result is not None:
            raise SpeechRecognitionProtocolError("cannot append audio after STT finalization")

    def _ensure_token(self, cancellation: CancellationToken) -> None:
        if cancellation is not self._cancellation:
            raise ValueError("STT stream requires its original cancellation token")

    @staticmethod
    def _encode_wav(audio_format: AudioFormat, pcm: bytes) -> bytes:
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(audio_format.channels)
            wav_file.setsampwidth(audio_format.sample_format.bytes_per_sample)
            wav_file.setframerate(audio_format.sample_rate_hz)
            wav_file.writeframes(pcm)
        return buffer.getvalue()
