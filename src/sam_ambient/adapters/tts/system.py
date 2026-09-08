"""Real local TTS through an installed operating-system speech command."""

from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import re
import shutil
import tempfile
import time
import wave
from collections.abc import AsyncIterator, Sequence
from pathlib import Path

from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import AudioFormat, AudioFrame, SampleFormat
from sam_ambient.core.voice.speech import (
    SpeechCapabilities,
    SpeechVoice,
    VoiceSelection,
    select_voice,
)

log = logging.getLogger(__name__)

_MAX_TEXT_CHARS = 4_000
_MAX_WAVE_BYTES = 32 * 1024 * 1024
_MAX_ERROR_BYTES = 16 * 1024


class TextToSpeechUnavailable(RuntimeError):
    pass


class TextToSpeechError(RuntimeError):
    pass


class SystemTextToSpeech:
    """Synthesize PCM using Windows System.Speech or an external eSpeak process."""

    def __init__(
        self,
        command: Sequence[str] | None = None,
        *,
        backend_id: str | None = None,
        audio_format: AudioFormat | None = None,
        timeout_s: float = 45.0,
    ) -> None:
        if timeout_s <= 0:
            raise ValueError("TTS timeout must be positive")
        if command is None:
            discovered_command, discovered_backend, discovered_format = _discover_backend()
        else:
            discovered_command = tuple(command)
            discovered_backend = "custom-system-tts"
            discovered_format = AudioFormat()
        self.command = tuple(discovered_command)
        if not self.command or any(not item or "\x00" in item for item in self.command):
            raise TextToSpeechUnavailable("no supported system TTS backend was found")
        self.backend_id = backend_id or discovered_backend
        self.audio_format = audio_format or discovered_format
        self.timeout_s = timeout_s
        self._processes: set[asyncio.subprocess.Process] = set()
        self._closed = False
        self.capabilities = SpeechCapabilities(
            voice_enumeration=self.backend_id == "windows-system-speech"
        )
        self.last_selection: VoiceSelection | None = None
        self._voices: tuple[SpeechVoice, ...] | None = None
        self._default_voice = SpeechVoice("default", "auto")

    async def list_voices(self) -> tuple[SpeechVoice, ...]:
        if not self.capabilities.voice_enumeration:
            return ()  # External eSpeak resolves its own installed language voices.
        if self._voices is not None:
            return self._voices
        process = await asyncio.create_subprocess_exec(
            *self.command,
            "-ListVoices",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        self._processes.add(process)
        try:
            async with asyncio.timeout(min(self.timeout_s, 5.0)):
                assert process.stdout is not None
                raw = await _read_bounded(process.stdout, _MAX_ERROR_BYTES)
                if await process.wait():
                    raise TextToSpeechUnavailable("installed System.Speech voices unavailable")
            inventory = json.loads(raw)
            self._default_voice = SpeechVoice(**inventory["default"])
            self._voices = tuple(SpeechVoice(**item) for item in inventory["voices"])
            return self._voices
        finally:
            if process.returncode is None:
                process.kill()
            await process.wait()
            self._processes.discard(process)

    async def synthesize(
        self,
        text: str,
        *,
        voice: str,
        language: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[AudioFrame]:
        if self._closed:
            raise RuntimeError("TTS adapter is closed")
        normalized = " ".join(text.split())
        if not normalized:
            raise ValueError("TTS text must be non-blank")
        if len(normalized) > _MAX_TEXT_CHARS:
            raise ValueError("TTS text exceeds 4000 characters")
        cancellation.raise_if_cancelled()
        task = asyncio.current_task()
        assert task is not None
        loop = asyncio.get_running_loop()
        remove = cancellation.add_callback(lambda _reason: loop.call_soon_threadsafe(task.cancel))
        try:
            voices = await self.list_voices()
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(cancellation.cancellation_id, "cancelled") from error
            raise
        finally:
            remove()
        cancellation.raise_if_cancelled()
        selection = select_voice(voices, language, voice, self._default_voice)
        if self.backend_id in {"espeak", "espeak-ng"}:
            selection = VoiceSelection(
                language,
                SpeechVoice(language, language),
                "external backend resolves requested language",
            )
        wave_bytes = await self._synthesize_wave(normalized, cancellation, selection=selection)
        self.last_selection = selection
        log.info(
            "TTS language=%s voice=%s locale=%s selection=%s",
            language,
            selection.voice.voice_id,
            selection.voice.locale,
            selection.reason,
        )
        pcm = self._decode_wave(wave_bytes)
        samples_per_frame = self.audio_format.samples_for_ms(20)
        bytes_per_chunk = samples_per_frame * self.audio_format.bytes_per_frame
        started_ms = time.monotonic_ns() // 1_000_000
        for sequence, offset in enumerate(range(0, len(pcm), bytes_per_chunk)):
            cancellation.raise_if_cancelled()
            yield AudioFrame(
                self.audio_format,
                pcm[offset : offset + bytes_per_chunk],
                monotonic_ms=started_ms + sequence * 20,
                sequence=sequence,
            )

    async def probe(self) -> None:
        token = CancellationToken("system-tts-probe")
        async for _frame in self.synthesize(
            "Sam voice ready.",
            voice="default",
            language="en",
            cancellation=token,
        ):
            return
        raise TextToSpeechError("system TTS produced no audio")

    async def aclose(self) -> None:
        if self._closed:
            return
        self._closed = True
        processes = tuple(self._processes)
        for process in processes:
            if process.returncode is None:
                process.kill()
        await asyncio.gather(*(process.wait() for process in processes), return_exceptions=True)
        self._processes.clear()

    async def _synthesize_wave(
        self, text: str, cancellation: CancellationToken, *, selection: VoiceSelection
    ) -> bytes:
        output_path: Path | None = None
        command = self.command
        input_data = text.encode("utf-8")
        if self.backend_id == "windows-system-speech":
            descriptor, raw_path = tempfile.mkstemp(prefix="sam-tts-", suffix=".wav")
            os.close(descriptor)
            output_path = Path(raw_path)
            command = (*command, "-OutputPath", str(output_path))
            input_data = json.dumps({"text": text, "voice": selection.voice.voice_id}).encode()
        elif self.backend_id in {"espeak", "espeak-ng"}:
            language = selection.requested_language
            if language != "auto":
                if not re.fullmatch(r"[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*", language):
                    raise ValueError("invalid speech locale")
                command = (*command, "-v", language.replace("_", "-"))
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except (OSError, asyncio.CancelledError):
            if output_path is not None:
                output_path.unlink(missing_ok=True)
            raise
        self._processes.add(process)
        task = asyncio.current_task()
        if task is None:  # pragma: no cover - always called from an async task
            raise RuntimeError("TTS synthesis requires an asyncio task")
        loop = asyncio.get_running_loop()
        remove_callback = cancellation.add_callback(
            lambda _reason: loop.call_soon_threadsafe(task.cancel)
        )
        stdout_task: asyncio.Task[bytes] | None = None
        stderr_task: asyncio.Task[bytes] | None = None
        try:
            assert process.stdin is not None
            assert process.stdout is not None and process.stderr is not None
            stdout_task = asyncio.create_task(_read_bounded(process.stdout, _MAX_WAVE_BYTES))
            stderr_task = asyncio.create_task(_read_bounded(process.stderr, _MAX_ERROR_BYTES))
            async with asyncio.timeout(self.timeout_s):
                process.stdin.write(input_data)
                await process.stdin.drain()
                process.stdin.close()
                await process.stdin.wait_closed()
                stdout, stderr = await asyncio.gather(stdout_task, stderr_task)
                exit_code = await process.wait()
            if exit_code:
                detail = stderr.decode("utf-8", errors="replace").strip()[:500]
                raise TextToSpeechError(
                    f"{self.backend_id} exited with {exit_code}: {detail or 'no detail'}"
                )
            if output_path is not None:
                if output_path.stat().st_size > _MAX_WAVE_BYTES:
                    raise TextToSpeechError("system TTS output exceeded its bounded limit")
                stdout = await asyncio.to_thread(output_path.read_bytes)
            if not stdout:
                raise TextToSpeechError(f"{self.backend_id} produced no audio")
            return stdout
        except TimeoutError as error:
            raise TextToSpeechError(f"{self.backend_id} synthesis timed out") from error
        except asyncio.CancelledError as error:
            if cancellation.is_cancelled:
                raise OperationCancelled(
                    cancellation.cancellation_id,
                    cancellation.reason or "cancelled",
                ) from error
            raise
        finally:
            remove_callback()
            for read_task in (stdout_task, stderr_task):
                if read_task is not None and not read_task.done():
                    read_task.cancel()
            await asyncio.gather(
                *(reader for reader in (stdout_task, stderr_task) if reader is not None),
                return_exceptions=True,
            )
            if process.returncode is None:
                process.kill()
            await process.wait()
            self._processes.discard(process)
            if output_path is not None:
                output_path.unlink(missing_ok=True)

    def _decode_wave(self, data: bytes) -> bytes:
        try:
            with wave.open(io.BytesIO(data), "rb") as source:
                actual = AudioFormat(
                    sample_rate_hz=source.getframerate(),
                    channels=source.getnchannels(),
                    sample_format=SampleFormat.PCM_S16LE,
                )
                if source.getsampwidth() != 2 or source.getcomptype() != "NONE":
                    raise TextToSpeechError("system TTS returned unsupported non-PCM16 audio")
                if actual != self.audio_format:
                    raise TextToSpeechError(
                        f"system TTS format changed: expected {self.audio_format}, got {actual}"
                    )
                pcm = source.readframes(source.getnframes())
        except (EOFError, wave.Error) as error:
            raise TextToSpeechError("system TTS returned an invalid WAV stream") from error
        if not pcm:
            raise TextToSpeechError("system TTS WAV contains no PCM frames")
        return pcm


async def _read_bounded(reader: asyncio.StreamReader, maximum: int) -> bytes:
    result = bytearray()
    while chunk := await reader.read(64 * 1024):
        if len(result) + len(chunk) > maximum:
            raise TextToSpeechError("system TTS output exceeded its bounded limit")
        result.extend(chunk)
    return bytes(result)


def system_tts_status() -> tuple[bool, str]:
    try:
        _command, backend, _audio_format = _discover_backend()
    except TextToSpeechUnavailable as error:
        return False, str(error)
    return True, backend


def _discover_backend() -> tuple[tuple[str, ...], str, AudioFormat]:
    if os.name == "nt":
        powershell = shutil.which("powershell.exe") or shutil.which("powershell")
        script = Path(__file__).with_name("windows_system_speech.ps1")
        if powershell and script.is_file():
            return (
                (
                    powershell,
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(script),
                ),
                "windows-system-speech",
                AudioFormat(sample_rate_hz=16_000),
            )
    for executable in ("espeak-ng", "espeak"):
        path = shutil.which(executable)
        if path:
            return (
                (path, "--stdin", "--stdout"),
                executable,
                AudioFormat(sample_rate_hz=22_050),
            )
    raise TextToSpeechUnavailable(
        "no supported TTS backend (Windows System.Speech or external eSpeak) was found"
    )
