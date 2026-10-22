"""Recognizer ownership faults using memory/MockTransport only, never recognition."""

import asyncio
import json
import logging
import traceback

import httpx
import pytest

from sam_ambient.adapters.stt.whisper_cpp import (
    SpeechAudioLimitExceeded,
    SpeechRecognitionProtocolError,
    SpeechRecognitionTimeout,
    SpeechRecognitionUnavailable,
    WhisperCppServerSTT,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled
from sam_ambient.core.voice import AudioFormat, AudioFrame, Transcript, VoiceStreamContext
from sam_ambient.core.voice.recognition import recognition_language


async def populated_stream(provider, language="es"):
    token = CancellationToken()
    stream = await provider.start_stream(
        VoiceStreamContext("fixture-session", "fixture-turn", token.cancellation_id, language),
        token,
    )
    await stream.push_audio(AudioFrame(AudioFormat(), b"\0" * 640, 0, 0), token)
    return stream, token


def test_concurrent_finalizer_is_rejected_without_duplicate_request_or_mutable_audio():
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: None)) as client:
            provider = WhisperCppServerSTT(client=client)

            async def transcribe(wav, **_):
                calls.append(wav)
                entered.set()
                await release.wait()
                return Transcript("Una respuesta.", True)

            provider.transcribe = transcribe
            stream, token = await populated_stream(provider)
            first = asyncio.create_task(stream.finalize(token))
            second = None
            try:
                await asyncio.wait_for(entered.wait(), 1)
                second = asyncio.create_task(stream.finalize(token))
                await asyncio.sleep(0)
                assert len(calls) == 1
                with pytest.raises(SpeechRecognitionProtocolError, match="finalizing"):
                    await second
                with pytest.raises(SpeechRecognitionProtocolError):
                    await stream.push_audio(AudioFrame(AudioFormat(), b"\0" * 640, 20, 1), token)
                assert len(stream._audio) == 0  # No duplicate PCM retained across HTTP wait.
                release.set()
                assert (await first).text == "Una respuesta."
                assert await stream.finalize(token) == await first
            finally:
                release.set()
                await asyncio.gather(
                    *(task for task in (first, second) if task), return_exceptions=True
                )

    asyncio.run(scenario())


def test_failed_finalization_releases_pcm_and_cannot_reissue_the_request():
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: None)) as client:
            provider = WhisperCppServerSTT(client=client)
            calls = []

            async def fail(_wav, **_):
                calls.append(True)
                raise SpeechRecognitionUnavailable("synthetic failure")

            provider.transcribe = fail
            stream, token = await populated_stream(provider)
            with pytest.raises(SpeechRecognitionUnavailable):
                await stream.finalize(token)
            assert len(stream._audio) == 0
            with pytest.raises(SpeechRecognitionProtocolError):
                await stream.finalize(token)
            assert len(calls) == 1

    asyncio.run(scenario())


def test_cached_final_cannot_be_read_after_its_utterance_is_cancelled():
    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"text": "Hello"}))
        ) as client:
            stream, token = await populated_stream(WhisperCppServerSTT(client=client))
            assert (await stream.finalize(token)).text == "Hello"
            await stream.cancel(token.cancellation_id, "retired_utterance")
            with pytest.raises(OperationCancelled):
                await stream.finalize(token)

    asyncio.run(scenario())


@pytest.mark.parametrize("language", ["en", "es", "auto"])
def test_noncooperative_late_response_is_rejected_in_every_language_mode(language):
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: None)) as client:
            provider = WhisperCppServerSTT(client=client)
            token = CancellationToken()

            async def late(*_, **__):
                token.cancel("newer_utterance")
                return {"text": "stale final"}

            provider._request = late
            with pytest.raises(OperationCancelled):
                await provider.transcribe(b"synthetic", language=language, cancellation=token)
            assert provider.confirmed_language is None

    asyncio.run(scenario())


def test_reordered_auto_results_do_not_replace_newer_confirmed_language():
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: None)) as client:
            provider = WhisperCppServerSTT(client=client)

            async def request(wav, **_):
                if wav == b"older":
                    entered.set()
                    await release.wait()
                    return {"text": "Hola", "language_probabilities": {"es": 0.99}}
                return {"text": "Hello", "language_probabilities": {"en": 0.99}}

            provider._request = request
            old = asyncio.create_task(
                provider.transcribe(b"older", language="auto", cancellation=CancellationToken())
            )
            try:
                await asyncio.wait_for(entered.wait(), 1)
                await provider.transcribe(
                    b"newer", language="auto", cancellation=CancellationToken()
                )
                release.set()
                await old
                assert provider.confirmed_language == "en"
            finally:
                release.set()
                await asyncio.gather(old, return_exceptions=True)

    asyncio.run(scenario())


@pytest.mark.parametrize("status", [200, 400])
def test_recognizer_error_payload_cannot_escape_into_operational_errors(status):
    async def scenario():
        secret = "private transcript fixture never log"
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(status, json={"error": secret}))
        ) as client:
            provider = WhisperCppServerSTT(client=client)
            with pytest.raises(SpeechRecognitionUnavailable) as caught:
                await provider.transcribe(
                    b"synthetic", language="es", cancellation=CancellationToken()
                )
            assert secret not in str(caught.value)

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "language, selector", [("en-GB", "en"), ("es-ES", "es"), ("es_ES", "es"), ("EN", "en")]
)
def test_explicit_locale_remains_forced_and_never_enters_auto_fallback(language, selector):
    async def scenario():
        requests = []

        async def handler(request):
            requests.append(request.content)
            return httpx.Response(
                200, json={"text": "fixture", "language_probabilities": {"ko": 0.1}}
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WhisperCppServerSTT(client=client, preferred_languages=("en-GB", "es-ES"))
            stream, token = await populated_stream(provider, language)
            assert stream.context.language == selector
            await stream.finalize(token)
            assert len(requests) == 1 and f"\r\n{selector}\r\n".encode() in requests[0]
            assert provider.confirmed_language is None  # Forced decoding is not detected evidence.

    asyncio.run(scenario())


@pytest.mark.parametrize("language", ["--unsafe", "en-US-extra", "áá", "Spanish", "auto-ES"])
def test_invalid_recognition_selector_is_rejected(language):
    with pytest.raises(ValueError):
        recognition_language(language)


@pytest.mark.parametrize("error_type", [httpx.ConnectError, httpx.ReadTimeout])
def test_transport_error_traceback_does_not_include_reflected_private_details(error_type):
    async def scenario():
        secret = "private reflected speech or endpoint credential"

        async def handler(_):
            raise error_type(secret)

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            with pytest.raises((SpeechRecognitionUnavailable, SpeechRecognitionTimeout)) as caught:
                await WhisperCppServerSTT(client=client).transcribe(
                    b"fixture", language="es", cancellation=CancellationToken()
                )
            assert secret not in "".join(traceback.format_exception(caught.value))

    asyncio.run(scenario())


def test_untrusted_language_metadata_cannot_become_log_content_or_fallback(caplog):
    async def scenario():
        secret = "private transcript reflected as a language label"
        requests = []

        async def handler(request):
            requests.append(request.content)
            return httpx.Response(
                200,
                json={
                    "text": "Hola",
                    "language_probabilities": {secret: 0.99, "es": 0.95},
                    "duration": 10**400,
                },
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WhisperCppServerSTT(client=client)
            caplog.set_level(logging.INFO, logger="sam_ambient.adapters.stt.whisper_cpp")
            result = await provider.transcribe(
                b"fixture", language="auto", cancellation=CancellationToken()
            )
            assert result.text == "Hola" and len(requests) == 1
            assert provider.confirmed_language == "es"
            assert secret not in caplog.text
            assert "duration=0.00s" in caplog.text  # Invalid server timing is not a measurement.

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "invalid_probability", [True, float("inf"), -1.0, 2.0, pytest.param(10**400, id="huge_integer")]
)
def test_invalid_no_speech_probability_cannot_discard_ordinary_transcript(invalid_probability):
    result = WhisperCppServerSTT._decode_transcript(
        json.dumps(
            {"text": "Una pregunta", "segments": [{"no_speech_prob": invalid_probability}]}
        ).encode()
    )
    assert result.text == "Una pregunta"


def test_pcm_limit_does_not_grow_buffer_and_retired_stream_cannot_touch_fresh_utterance():
    async def scenario():
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"text": "Hello"}))
        ) as client:
            provider = WhisperCppServerSTT(client=client, max_audio_seconds=1)
            stream, token = await populated_stream(provider)
            for index in range(1, 50):
                await stream.push_audio(
                    AudioFrame(AudioFormat(), b"\0" * 640, index * 20, index), token
                )
            assert len(stream._audio) == 32_000
            with pytest.raises(SpeechAudioLimitExceeded):
                await stream.push_audio(AudioFrame(AudioFormat(), b"\0" * 640, 1000, 50), token)
            assert len(stream._audio) == 32_000
            await stream.cancel(token.cancellation_id)
            assert not stream._audio
            fresh, fresh_token = await populated_stream(provider)
            assert not await fresh.cancel(token.cancellation_id, "late old cancellation")
            assert (await fresh.finalize(fresh_token)).text == "Hello"
            assert not fresh_token.is_cancelled and not fresh._audio

    asyncio.run(scenario())


def test_response_limit_releases_pcm_and_next_utterance_can_recognize():
    async def scenario():
        calls = []

        async def handler(_):
            calls.append(True)
            return (
                httpx.Response(200, content=b"x" * 65)
                if len(calls) == 1
                else httpx.Response(200, json={"text": "Hola"})
            )

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            provider = WhisperCppServerSTT(client=client, max_response_bytes=64)
            stream, token = await populated_stream(provider)
            with pytest.raises(SpeechRecognitionProtocolError, match="size limit"):
                await stream.finalize(token)
            assert not stream._audio
            fresh, fresh_token = await populated_stream(provider)
            assert (await fresh.finalize(fresh_token)).text == "Hola"
            assert len(calls) == 2

    asyncio.run(scenario())
