import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from sam_ambient.adapters.stt import SpeechRecognitionUnavailable, WhisperCppServerSTT, whisper_cpp


@pytest.fixture
def installation(tmp_path, monkeypatch):
    monkeypatch.setattr(whisper_cpp, "os", SimpleNamespace(name="nt"))
    executable = tmp_path / ".sam/runtime/whisper-b4938/Release/whisper-server.exe"
    model = tmp_path / ".sam/models/ggml-base.bin"
    for path, header in ((executable, b"MZ"), (model, b"lmgg")):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(header)
    return tmp_path, executable, model


def test_healthy_external_service_is_not_started_or_stopped(tmp_path, monkeypatch):
    async def scenario():
        spawn = AsyncMock()
        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(200, json={"status": "ok"})
            )
        ) as client:
            stt = WhisperCppServerSTT(client=client)
            await stt.ensure_ready(tmp_path)
            await stt.aclose()
            await stt.aclose()
            spawn.assert_not_called()
            assert stt._process is None

    asyncio.run(scenario())


@pytest.mark.parametrize("mode", ["ready", "exit", "timeout", "cancel"])
def test_owned_service_readiness_and_cleanup(installation, monkeypatch, mode):
    async def scenario():
        root, executable, model = installation
        process = SimpleNamespace(pid=123, returncode=9 if mode == "exit" else None)
        stopped = []

        def terminate():
            stopped.append(True)
            process.returncode = 0

        process.terminate = terminate
        process.wait = AsyncMock(return_value=0)
        spawn = AsyncMock(return_value=process)
        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
        stt = WhisperCppServerSTT()
        probes = 0

        async def ready():
            nonlocal probes
            probes += 1
            if probes > 1 and mode == "timeout":
                await asyncio.Event().wait()
            if probes > 1 and mode == "cancel":
                raise asyncio.CancelledError
            return probes > 1

        monkeypatch.setattr(stt, "_ready", ready)
        try:
            if mode == "ready":
                await stt.ensure_ready(root)
                await stt.ensure_ready(root)
                assert not stopped
            else:
                error = asyncio.CancelledError if mode == "cancel" else SpeechRecognitionUnavailable
                with pytest.raises(error):
                    await stt.ensure_ready(root, startup_timeout_s=0.01)
            args, kwargs = spawn.call_args
            assert args == (
                str(executable),
                "--model",
                str(model),
                "--host",
                "127.0.0.1",
                "--port",
                "8080",
            )
            assert kwargs["cwd"] == executable.parent
            assert not kwargs.get("shell", False)
            spawn.assert_awaited_once()
        finally:
            await stt.aclose()
            await stt.aclose()
        assert len(stopped) == (0 if mode == "exit" else 1)
        assert stt._process is None

    asyncio.run(scenario())


@pytest.mark.parametrize(
    "asset, invalid", [("executable", False), ("model", False), ("model", True)]
)
def test_missing_or_invalid_assets_name_expected_path(installation, monkeypatch, asset, invalid):
    async def scenario():
        root, executable, model = installation
        target = executable if asset == "executable" else model
        if invalid:
            target.write_bytes(b"bad")
        else:
            target.unlink()
        stt = WhisperCppServerSTT()
        monkeypatch.setattr(stt, "_ready", AsyncMock(return_value=False))
        spawn = AsyncMock()
        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
        try:
            with pytest.raises(SpeechRecognitionUnavailable) as failure:
                await stt.ensure_ready(root)
            assert str(target) in str(failure.value)
            spawn.assert_not_called()
        finally:
            await stt.aclose()

    asyncio.run(scenario())


@pytest.mark.parametrize("status, body", [(503, {"status": "loading"}), (200, {"other": True})])
def test_unready_or_unrelated_service_is_left_untouched(tmp_path, monkeypatch, status, body):
    async def scenario():
        spawn = AsyncMock()
        monkeypatch.setattr(asyncio, "create_subprocess_exec", spawn)
        async with httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(status, json=body))
        ) as client:
            stt = WhisperCppServerSTT(client=client)
            with pytest.raises(
                SpeechRecognitionUnavailable, match="existing service left untouched"
            ):
                await stt.ensure_ready(tmp_path)
            spawn.assert_not_called()
            await stt.aclose()

    asyncio.run(scenario())


def test_unavailable_stt_keeps_text_runtime_available(tmp_path, monkeypatch, caplog):
    from sam_ambient import cli

    async def scenario():
        provider = SimpleNamespace(health=AsyncMock(return_value=SimpleNamespace(available=True)))
        monkeypatch.setattr(
            cli, "discover_provider", AsyncMock(return_value=(provider, "fake", None))
        )
        stt = SimpleNamespace(
            ensure_ready=AsyncMock(
                side_effect=SpeechRecognitionUnavailable("missing model: expected-path")
            ),
            aclose=AsyncMock(),
        )
        monkeypatch.setattr(cli, "WhisperCppServerSTT", lambda **kwargs: stt)

        def forbidden_capture():
            raise AssertionError("unavailable STT must not start microphone capture")

        monkeypatch.setattr(cli, "SoundDeviceCapture", forbidden_capture)
        runtime = SimpleNamespace(
            start=AsyncMock(),
            close=AsyncMock(),
            serve_forever=AsyncMock(),
            bridge=SimpleNamespace(port=8765),
            shutdown_requested=asyncio.Event(),
            capability_authority=SimpleNamespace(snapshot=SimpleNamespace(active=True)),
        )

        def create_runtime(*args, **kwargs):
            assert kwargs["voice"] is None
            return runtime

        monkeypatch.setattr(cli, "SamRuntime", create_runtime)

        async def serve(awaitable, stop):
            await awaitable

        monkeypatch.setattr(cli, "serve_until_stop", serve)
        args = cli.build_parser().parse_args(["runtime", "--root", str(tmp_path), "--no-tts"])
        assert await cli.run_runtime(args) == 0
        runtime.start.assert_awaited_once()
        runtime.serve_forever.assert_awaited_once()
        runtime.close.assert_awaited_once()
        stt.aclose.assert_awaited_once()
        assert "expected-path" in caplog.text
        assert "text input remains available" in caplog.text

    asyncio.run(scenario())
