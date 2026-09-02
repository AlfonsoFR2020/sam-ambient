"""Local-first STT adapter for a separately managed whisper.cpp server."""

from __future__ import annotations

import asyncio
import io
import json
import wave
from ipaddress import ip_address
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
    ) -> None:
        if timeout_s <= 0:
            raise ValueError("timeout_s must be positive")
        if max_response_bytes <= 0 or max_audio_seconds <= 0:
            raise ValueError("STT size limits must be positive")
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
        cancellation.raise_if_cancelled()
        task = asyncio.current_task()
        if task is None:
            raise RuntimeError("STT request requires an asyncio task")
        remove_callback = cancellation.add_callback(lambda _reason: task.cancel())
        fields = {"response_format": "json"}
        if language != "auto":
            fields["language"] = language
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
        return self._decode_transcript(bytes(raw))

    async def aclose(self) -> None:
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
