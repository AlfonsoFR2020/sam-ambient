import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters import local_discovery as discovery
from sam_ambient.core.protocol import ControlCommand, ControlCommandType
from sam_ambient.core.providers import DataBoundary
from sam_ambient.core.storage.sqlite import SQLiteSessionStore
from sam_ambient.core.turns import CancellationToken
from sam_ambient.runtime import (
    ProviderRefresh,
    RuntimeConfig,
    SamRuntime,
    _looks_like_playback_echo,
)
from tests.unit.test_conversation_context import ConversationProvider


def test_stopped_lms_starts_and_loads_existing_preferred_model(monkeypatch):
    commands = []
    service = discovery.LocalService("lm-studio", discovery.LM_STUDIO_URL, "lms.exe")

    async def command(argv, **_options):
        commands.append(argv)

    async def probe(item):
        item.running = True
        item.available_models = ["alpha", "previous"]
        item.models = ["previous"] if len(commands) == 2 else []

    monkeypatch.setattr(discovery, "_local_command", command)
    monkeypatch.setattr(discovery, "probe_service", probe)

    async def scenario():
        owned = []
        await discovery.bootstrap_service(service, "previous", owned)
        assert commands[0] == (
            "lms.exe",
            "server",
            "start",
            "--port",
            "1234",
            "--bind",
            "127.0.0.1",
        )
        assert commands[1][:3] == ("lms.exe", "load", "previous")
        assert "--ttl" in commands[1]
        assert service.started_by_sam and service.models == ["previous"]
        assert owned == []  # Shared LM daemon/server is not a privately owned child.
        assert "retained" in service.detail

    asyncio.run(scenario())


def test_running_provider_is_not_restarted_or_evicted(monkeypatch):
    command = AsyncMock()
    monkeypatch.setattr(discovery, "_local_command", command)
    service = discovery.LocalService("lm-studio", discovery.LM_STUDIO_URL, "lms", True, ["current"])
    asyncio.run(discovery.bootstrap_service(service, "different", []))
    command.assert_not_called()
    assert service.models == ["current"] and not service.started_by_sam


def test_preference_and_stale_preference_fallback(monkeypatch):
    monkeypatch.delenv("OLLAMA_HOST", raising=False)
    monkeypatch.setattr(discovery, "find_lms", lambda: None)
    monkeypatch.setattr(discovery.shutil, "which", lambda _: None)

    async def probe(service):
        service.running = True
        service.models = ["alpha", "previous"]

    monkeypatch.setattr(discovery, "probe_service", probe)

    async def scenario():
        result = await discovery.discover_local(bootstrap=True, preferred=("lm-studio", "previous"))
        assert (result.selected.id, result.model) == ("lm-studio", "previous")
        result = await discovery.discover_local(preferred=("lm-studio", "deleted"))
        assert result.model is None
        assert "Several local conversational models" in result.reason

        async def unavailable_lm(service):
            if service.id == "ollama":
                await probe(service)

        monkeypatch.setattr(discovery, "probe_service", unavailable_lm)
        result = await discovery.discover_local(bootstrap=True, preferred=("lm-studio", "previous"))
        assert result.selected is None
        assert "Several local conversational models" in result.reason
        result = await discovery.discover_local(provider="lm-studio", preferred=("ollama", "alpha"))
        assert result.selected is None  # Explicit configuration is never silently replaced.

    asyncio.run(scenario())


def test_bootstrap_timeout_is_bounded_and_ownership_cleanup_idempotent(monkeypatch):
    deadlines = []
    real_timeout = asyncio.timeout

    def deadline(seconds):
        deadlines.append(seconds)
        return real_timeout(0)  # Virtual immediate deadline; never wait twenty seconds.

    monkeypatch.setattr(discovery.asyncio, "timeout", deadline)
    monkeypatch.setattr(discovery, "_local_command", AsyncMock(side_effect=lambda *_: None))

    async def blocked_probe(service):
        await asyncio.Event().wait()

    monkeypatch.setattr(discovery, "probe_service", blocked_probe)

    async def scenario():
        service = discovery.LocalService("lm-studio", discovery.LM_STUDIO_URL, "lms")
        await discovery.bootstrap_service(service, None, [])
        assert deadlines == [205] and "TimeoutError" in service.detail
        process = SimpleNamespace(returncode=None, terminate=lambda: None, wait=AsyncMock())
        stopped = []
        process.terminate = lambda: stopped.append(True)
        result = discovery.Discovery([], None, None, "failed", [process])
        await result.aclose()
        await result.aclose()
        assert stopped == [True]
        process.wait.assert_awaited_once()

    asyncio.run(scenario())


def test_playback_echo_match_requires_strong_multiword_overlap():
    spoken = "The answer is forty two and here is why."
    assert _looks_like_playback_echo("the answer is forty two", spoken)
    assert not _looks_like_playback_echo("please stop now", spoken)
    assert not _looks_like_playback_echo("stop", spoken)


def test_lm_studio_auto_loads_only_one_unambiguous_installed_model(monkeypatch):
    commands = []

    async def command(argv, **options):
        commands.append((argv, options))

    async def probe(service):
        service.running = True
        service.models = []

    monkeypatch.setattr(discovery, "_local_command", command)
    monkeypatch.setattr(discovery, "probe_service", probe)
    multiple = discovery.LocalService(
        "lm-studio", discovery.LM_STUDIO_URL, "lms", True, [], ["alpha", "beta"]
    )
    asyncio.run(discovery.bootstrap_service(multiple, None, []))
    assert commands == []
    assert "several conversational models" in multiple.detail

    async def loaded_probe(service):
        service.running = True
        service.models = ["only"] if commands else []

    monkeypatch.setattr(discovery, "probe_service", loaded_probe)
    single = discovery.LocalService("lm-studio", discovery.LM_STUDIO_URL, "lms", True, [], ["only"])
    asyncio.run(discovery.bootstrap_service(single, None, []))
    assert commands[0][0][1:3] == ("load", "only")
    assert commands[0][1]["timeout_s"] == 180


def test_lm_studio_model_load_failure_is_bounded_and_cancellation_propagates(monkeypatch):
    service = discovery.LocalService(
        "lm-studio",
        discovery.LM_STUDIO_URL,
        "lms",
        True,
        [],
        ["google/gemma"],
    )
    monkeypatch.setattr(discovery, "probe_service", AsyncMock())
    command = AsyncMock(side_effect=TimeoutError("fixture model-load deadline"))
    monkeypatch.setattr(discovery, "_local_command", command)

    asyncio.run(discovery.bootstrap_service(service, "google/gemma", []))
    assert "startup/load failed (TimeoutError)" in service.detail
    assert command.call_args.kwargs["timeout_s"] == 180

    command.side_effect = asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(discovery.bootstrap_service(service, "google/gemma", []))


def test_owned_ollama_child_is_reaped_but_running_services_are_not(monkeypatch):
    from unittest.mock import Mock

    process = SimpleNamespace(returncode=None, terminate=Mock(), wait=AsyncMock())
    launch = AsyncMock(return_value=process)
    monkeypatch.setattr(discovery.asyncio, "create_subprocess_exec", launch)

    async def probe(service):
        service.running = True
        service.models = ["chat"]

    monkeypatch.setattr(discovery, "probe_service", probe)

    async def scenario():
        owned = []
        service = discovery.LocalService("ollama", "http://127.0.0.1:11434", "ollama")
        await discovery.bootstrap_service(service, None, owned)
        assert launch.call_args.args == ("ollama", "serve")
        assert len(owned) == 1
        await discovery.Discovery([service], service, "chat", "started", owned).aclose()
        process.terminate.assert_called_once()
        launch.reset_mock()
        await discovery.bootstrap_service(service, None, owned)
        launch.assert_not_called()

    asyncio.run(scenario())


def test_runtime_rescan_hot_adopts_ready_local_provider(tmp_path):
    async def scenario():
        initial = ConversationProvider()
        selected = ConversationProvider()
        selected.id = "lm-studio"

        async def refresh(provider, model):
            assert (provider, model) == ("lm-studio", "google/gemma")
            return ProviderRefresh(
                selected,
                "google/gemma",
                "explicit owner selection",
                ({"id": "lm-studio", "running": True, "models": ["google/gemma"]},),
            )

        runtime = SamRuntime(
            initial,
            RuntimeConfig(tmp_path, port=0),
            provider_refresher=refresh,
        )
        try:
            event = await runtime.controls.dispatch(
                ControlCommand(
                    type=ControlCommandType.MODEL_SELECT,
                    command_id="select",
                    monotonic_ms=1,
                    session_id=runtime.session_id,
                    payload={
                        "provider": "lm-studio",
                        "model": "google/gemma",
                        "remember": True,
                    },
                )
            )
            assert event.payload["provider_refresh_started"] is True
            assert runtime._provider_refresh_task is not None
            await runtime._provider_refresh_task
            assert runtime.provider is selected
            assert runtime._model == "google/gemma"
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_embedding_models_and_unverified_ollama_capabilities_rejected(monkeypatch):
    async def request(self, method, url, **kwargs):
        if url.endswith("tags"):
            return {"models": [{"name": name} for name in ("chat", "vectors", "broken", "embed-x")]}
        model = kwargs["body"]["model"]
        if model == "broken":
            raise OSError("unavailable")
        return {"capabilities": ["completion" if model == "chat" else "embedding"]}

    monkeypatch.setattr(discovery.HttpxJsonTransport, "request_json", request)
    service = discovery.LocalService("ollama", "http://127.0.0.1:11434")
    asyncio.run(discovery.probe_service(service))
    assert service.running and service.models == ["chat"]
    assert (
        discovery._ids([{"id": "vectors", "type": "embeddings"}, {"id": "--download"}], "id") == []
    )


def test_optional_preference_survives_reload_and_corruption_is_ignored(tmp_path):
    path = tmp_path / "state.db"
    store = SQLiteSessionStore(path)
    assert store.last_local_model() is None
    store.remember_local_model("lm-studio", "previous")
    assert SQLiteSessionStore(path).last_local_model() == ("lm-studio", "previous")
    store.remember_local_model("cloud", "other")
    assert store.last_local_model() == ("lm-studio", "previous")
    with store._connect() as connection:
        connection.execute("UPDATE runtime_metadata SET value=?", (json.dumps([{}, "bad"]),))
    assert store.last_local_model() is None


@pytest.mark.parametrize("boundary", [DataBoundary.LOCAL, DataBoundary.CLOUD])
def test_only_successful_local_response_remembers_model(tmp_path, boundary):
    async def scenario():
        provider = ConversationProvider()
        provider.id = "lm-studio"
        provider.data_boundary = boundary
        runtime = SamRuntime(provider, RuntimeConfig(tmp_path, state_db=tmp_path / "state.db"))
        try:
            runtime.submit_user_message("Hello")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            expected = ("lm-studio", "discovered-model") if boundary is DataBoundary.LOCAL else None
            assert runtime.state.last_local_model() == expected
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_unavailable_chat_cannot_bypass_discovery_filter(tmp_path):
    async def scenario():
        runtime = SamRuntime(
            ConversationProvider(),
            RuntimeConfig(tmp_path, model_unavailable_reason="Only embeddings found"),
        )
        try:
            with pytest.raises(RuntimeError, match="Only embeddings"):
                await runtime._select_model(CancellationToken())
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_cli_reads_last_good_and_reaps_owned_children_after_failure(tmp_path, monkeypatch):
    from sam_ambient import cli

    store = SQLiteSessionStore(tmp_path / ".sam/state.db")
    store.remember_local_model("lm-studio", "previous")
    result = discovery.Discovery([], None, None, "no service")
    result.aclose = AsyncMock()
    discover = AsyncMock(return_value=result)
    monkeypatch.setattr(cli, "discover_local", discover)
    provider = ConversationProvider()
    provider.aclose = AsyncMock()

    async def scenario():
        args = cli.build_parser().parse_args(["runtime", "--root", str(tmp_path)])
        # An empty result isn't used by real discovery; test just its preference seam.
        result.services = [discovery.LocalService("ollama", "http://127.0.0.1:11434")]
        monkeypatch.setattr(cli, "provider_for", lambda _: provider)
        monkeypatch.setattr(cli, "_serve_runtime", AsyncMock(side_effect=RuntimeError("fixture")))
        with pytest.raises(RuntimeError, match="fixture"):
            await cli.run_runtime(args)
        assert discover.call_args.kwargs["preferred"] == ("lm-studio", "previous")
        assert discover.call_args.kwargs["bootstrap"] is False
        result.aclose.assert_awaited_once()
        provider.aclose.assert_awaited_once()
        args = cli.build_parser().parse_args(["doctor", "--root", str(tmp_path)])
        await cli.discover_provider(args)
        assert discover.call_args.kwargs["bootstrap"] is False
        assert discover.call_args.kwargs["preferred"] == ("lm-studio", "previous")

    asyncio.run(scenario())


def test_failed_response_does_not_overwrite_last_good(tmp_path):
    class FailedProvider(ConversationProvider):
        id = "lm-studio"

        async def stream_chat(self, *args, **kwargs):
            raise RuntimeError("fixture inference failure")
            yield  # Keep the provider's async iterator contract.

    async def scenario():
        runtime = SamRuntime(
            FailedProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db")
        )
        runtime.state.remember_local_model("ollama", "good")
        try:
            runtime.submit_user_message("Hello")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert runtime.state.last_local_model() == ("ollama", "good")
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_user_guides_are_linked_and_local_document_links_resolve():
    import re
    from pathlib import Path

    root = Path(__file__).resolve().parents[2]
    readme = (root / "README.md").read_text(encoding="utf-8")
    for name in ("GETTING_STARTED", "USER_GUIDE"):
        assert f"docs/{name}.md" in readme
        path = root / "docs" / f"{name}.md"
        for target in re.findall(r"\]\(([^)]+\.md)\)", path.read_text(encoding="utf-8")):
            assert (path.parent / target).is_file(), target
