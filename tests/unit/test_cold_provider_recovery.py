import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters import local_discovery as discovery
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, SamRuntime
from tests.unit.test_conversation_context import ConversationProvider


@pytest.mark.parametrize(
    "body,code,error,status",
    [
        ([{"modelKey": "google/gemma-4-e2b", "type": "llm"}], 0, None, "available"),
        ([], 0, None, "empty"),
        ({"models": []}, 0, None, "empty"),
        ({}, 0, None, "malformed"),
        ({"models": "bad"}, 0, None, "malformed"),
        ("not json", 0, None, "malformed"),
        ([], 1, None, "cli_failed"),
        ([], 0, TimeoutError(), "timeout"),
        ([], 0, FileNotFoundError(), "unavailable"),
    ],
)
def test_inventory_outcomes_are_not_empty(monkeypatch, body, code, error, status):
    consumed = False

    async def read(_limit):
        nonlocal consumed
        if error is not None:
            raise error
        if consumed:
            return b""
        consumed = True
        return body.encode() if isinstance(body, str) else json.dumps(body).encode()

    process = SimpleNamespace(
        stdout=SimpleNamespace(read=read), returncode=code, wait=AsyncMock(return_value=code)
    )
    monkeypatch.setattr(
        discovery.asyncio, "create_subprocess_exec", AsyncMock(return_value=process)
    )
    result = asyncio.run(discovery.lms_models("lms"))
    assert result.status == status
    assert result.models == (("google/gemma-4-e2b",) if status == "available" else ())


def unavailable(status="timeout", retryable=True):
    return ProviderRefresh(
        None,
        None,
        "LM Studio is running; model inventory is temporarily unavailable",
        (
            {
                "id": "lm-studio",
                "running": True,
                "inventory_status": status,
                "inventory_retryable": retryable,
                "models": [],
                "installed_models": [],
            },
        ),
    )


async def observe(runtime):
    records = []
    subscription = await runtime.events.subscribe()

    async def collect():
        async for event in subscription:
            records.append(event)

    return records, asyncio.create_task(collect())


def test_inventory_reads_every_stdout_chunk_and_never_logs_body(monkeypatch, caplog):
    chunks = [b'[{"model', b'Key":"gemma","type":"llm"}]', b""]
    process = SimpleNamespace(
        stdout=SimpleNamespace(read=AsyncMock(side_effect=chunks)),
        returncode=0,
        wait=AsyncMock(return_value=0),
    )
    monkeypatch.setattr(
        discovery.asyncio, "create_subprocess_exec", AsyncMock(return_value=process)
    )
    result = asyncio.run(discovery.lms_models("lms"))
    assert result.status == "available" and result.models == ("gemma",)
    assert not caplog.text


def test_cancelled_inventory_reaps_only_its_cli_child(monkeypatch):
    async def scenario():
        reading = asyncio.Event()

        async def read(_limit):
            reading.set()
            await asyncio.Event().wait()

        process = SimpleNamespace(
            stdout=SimpleNamespace(read=read), returncode=None, wait=AsyncMock(return_value=0)
        )
        killed = []

        def kill():
            killed.append(True)
            process.returncode = 0

        process.kill = kill
        monkeypatch.setattr(
            discovery.asyncio, "create_subprocess_exec", AsyncMock(return_value=process)
        )
        task = asyncio.create_task(discovery.lms_models("lms"))
        await reading.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert killed == [True]
        process.wait.assert_awaited_once()

    asyncio.run(scenario())


def test_oversized_inventory_is_permanent_malformed_not_empty(monkeypatch):
    process = SimpleNamespace(
        stdout=SimpleNamespace(read=AsyncMock(return_value=b"x" * 262_145)),
        returncode=0,
        wait=AsyncMock(return_value=0),
    )
    monkeypatch.setattr(
        discovery.asyncio, "create_subprocess_exec", AsyncMock(return_value=process)
    )
    result = asyncio.run(discovery.lms_models("lms"))
    assert result.status == "malformed" and not result.retryable


@pytest.mark.parametrize("initially_ready", [True, False])
def test_real_discovery_retries_installed_intent_then_loads_exactly_once(
    tmp_path, monkeypatch, initially_ready
):
    import sam_ambient.runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", (0, 0, 0))
    monkeypatch.setattr(discovery, "find_lms", lambda: "lms")
    monkeypatch.setattr(discovery.shutil, "which", lambda _: None)
    monkeypatch.setattr(
        discovery,
        "lms_status",
        AsyncMock(
            return_value={
                "running": initially_ready,
                "status": "running" if initially_ready else "stopped",
            }
        ),
    )
    inventories = [
        discovery.ModelInventory("timeout"),
        discovery.ModelInventory("available", ("gemma",)),
    ]
    monkeypatch.setattr(discovery, "lms_models", AsyncMock(side_effect=inventories))
    loaded = []
    commands = []

    async def command(argv, **_kwargs):
        commands.append(argv)
        if argv[1] == "load":
            loaded.append(argv[2])

    monkeypatch.setattr(discovery, "_local_command", command)

    class Transport:
        def __init__(self, **_kwargs):
            pass

        async def request_json(self, method, url, **_kwargs):
            if url.endswith("api/tags"):
                return {"models": []}
            if not initially_ready and not commands:
                raise TimeoutError()
            return {"data": [{"id": model, "state": "loaded", "type": "llm"} for model in loaded]}

        async def aclose(self):
            pass

    monkeypatch.setattr(discovery, "HttpxJsonTransport", Transport)
    snapshots = []
    selected = ConversationProvider()
    selected.id = "lm-studio"

    async def scenario():
        async def refresh(provider, model):
            if snapshots and not initially_ready:
                assert "is running" not in runtime._provider_discovery_reason
            result = await discovery.discover_local(provider=provider, model=model, bootstrap=True)
            snapshots.append(result)
            assert (
                result.pending_model == "gemma"
                if result.selected is None
                else result.model == "gemma"
            )
            return ProviderRefresh(
                selected if result.selected else None,
                result.model,
                result.reason,
                tuple(result.to_dict()["providers"]),
            )

        runtime = SamRuntime(
            ConversationProvider(),
            RuntimeConfig(
                tmp_path,
                startup_provider="lm-studio",
                startup_model="gemma",
                model_unavailable_reason="waiting",
            ),
            provider_refresher=refresh,
        )
        try:
            await runtime._refresh_providers(None, None, False, "cold")
            await runtime._provider_refresh_task
            assert snapshots[0].selected is None
            assert snapshots[0].services[1].inventory_retryable
            assert snapshots[-1].model == runtime._model == "gemma"
            assert len(commands) == (1 if initially_ready else 2)
            assert sum(argv[1:3] == ("load", "gemma") for argv in commands) == 1
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_transient_inventory_recovers_without_false_active_model(tmp_path, monkeypatch):
    import sam_ambient.runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", (0, 0, 0), raising=False)

    async def scenario():
        provider = ConversationProvider()
        provider.id = "lm-studio"
        calls = []

        async def refresh(provider_id, model):
            calls.append((provider_id, model))
            assert runtime._ready_event().payload["model"] is None
            return unavailable() if len(calls) < 3 else ProviderRefresh(provider, "gemma", "ready")

        runtime = SamRuntime(
            ConversationProvider(),
            RuntimeConfig(
                tmp_path,
                model_unavailable_reason="waiting",
                startup_provider="lm-studio",
                startup_model="gemma",
            ),
            provider_refresher=refresh,
        )
        try:
            await runtime._refresh_providers(None, None, False, "cold")
            await runtime._provider_refresh_task
            assert len(calls) == 3
            assert runtime._model == "gemma"
            assert not runtime._provider_scan_active
            runtime.submit_user_message("ready")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_definitive_empty_inventory_does_not_retry(tmp_path):
    async def scenario():
        refresh = AsyncMock(return_value=unavailable("empty", False))
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        try:
            await runtime._refresh_providers(None, None, False, "empty")
            await runtime._provider_refresh_task
            refresh.assert_awaited_once()
            assert runtime._model is None
            assert not runtime._provider_scan_active
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("failures", [0, 1, 3, 4])
def test_retry_bound_and_no_duplicate_route_commit(tmp_path, monkeypatch, failures):
    import sam_ambient.runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", (0, 0, 0))

    async def scenario():
        selected = ConversationProvider()
        selected.id = "lm-studio"
        calls = 0

        async def refresh(_provider, _model):
            nonlocal calls
            calls += 1
            return (
                unavailable("cli_failed")
                if calls <= failures
                else ProviderRefresh(selected, "gemma", "ready")
            )

        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        records, collector = await observe(runtime)
        try:
            await runtime._refresh_providers(None, None, False, "retry")
            await runtime._provider_refresh_task
            await asyncio.sleep(0)
            assert calls == min(failures + 1, 4)
            assert runtime._model == ("gemma" if failures < 4 else None)
            assert not runtime._provider_scan_active
            assert sum(
                e.type == "provider.discovery" and e.payload["state"] == "ready" for e in records
            ) == (failures < 4)
        finally:
            await runtime.close()
            await collector

    asyncio.run(scenario())


@pytest.mark.parametrize("terminal", ["empty", "unavailable", "malformed"])
def test_provider_disappearance_or_definitive_result_ends_existing_retry(
    tmp_path, monkeypatch, terminal
):
    import sam_ambient.runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", (0, 0, 0))

    async def scenario():
        refresh = AsyncMock(side_effect=[unavailable(), unavailable(terminal, False)])
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        try:
            await runtime._refresh_providers(None, None, False, "disappearance")
            await runtime._provider_refresh_task
            assert refresh.await_count == 2
            assert runtime._model is None and not runtime._provider_scan_active
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("status", ["empty", "malformed", "unavailable"])
def test_permanent_inventory_results_are_terminal_without_retry(tmp_path, status):
    async def scenario():
        refresh = AsyncMock(return_value=unavailable(status, False))
        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        events, collector = await observe(runtime)
        try:
            await runtime._refresh_providers(None, None, False, "terminal")
            await runtime._provider_refresh_task
            await asyncio.sleep(0)
            refresh.assert_awaited_once()
            assert events[-1].payload["state"] == ("blocked" if status == "empty" else "failed")
        finally:
            await runtime.close()
            await collector

    asyncio.run(scenario())


def test_failed_inventory_rescan_preserves_good_route(tmp_path, monkeypatch):
    import sam_ambient.runtime as runtime_module

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", ())

    async def scenario():
        current = ConversationProvider()
        runtime = SamRuntime(
            current,
            RuntimeConfig(tmp_path, model="good"),
            provider_refresher=AsyncMock(return_value=unavailable()),
        )
        try:
            await runtime._refresh_providers(None, None, False, "failed")
            await runtime._provider_refresh_task
            assert runtime.provider is current and runtime._model == "good"
            runtime.submit_user_message("recovery")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
        finally:
            await runtime.close()

    asyncio.run(scenario())


def test_new_choice_retires_late_old_result_and_future_rescan_uses_choice(tmp_path):
    async def scenario():
        entered = asyncio.Event()
        old = ConversationProvider()
        old.aclose = AsyncMock()
        new = ConversationProvider()
        new.id = "lm-studio"
        calls = []

        async def refresh(provider, model):
            calls.append((provider, model))
            if model == "old":
                entered.set()
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    return ProviderRefresh(old, "old", "late")
            return ProviderRefresh(new, "new", "ready")

        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        try:
            await runtime._refresh_providers("lm-studio", "old", False, "old-scan")
            await entered.wait()
            await runtime._refresh_providers("lm-studio", "new", False, "new-scan")
            await runtime._provider_refresh_task
            assert runtime.provider is new and runtime._model == "new"
            old.aclose.assert_awaited_once()
            await runtime._refresh_providers(None, None, False, "rescan")
            await runtime._provider_refresh_task
            assert calls[-1] == (new.id, "new")
        finally:
            await runtime.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("operation", ["quit", "disconnect", "rescan"])
def test_pending_retry_cancels_and_reconnect_can_recover(tmp_path, monkeypatch, operation):
    import sam_ambient.runtime as runtime_module
    from sam_ambient.core.protocol import ControlCommand, ControlCommandType

    monkeypatch.setattr(runtime_module, "_PROVIDER_RETRY_DELAYS", (100,))

    async def scenario():
        waiting = asyncio.Event()
        ready = ConversationProvider()
        first = True

        async def refresh(_provider, _model):
            nonlocal first
            if first:
                first = False
                waiting.set()
                return unavailable()
            return ProviderRefresh(ready, "gemma", "ready")

        runtime = SamRuntime(
            ConversationProvider(), RuntimeConfig(tmp_path), provider_refresher=refresh
        )
        try:
            await runtime._refresh_providers(None, None, False, "waiting")
            task = runtime._provider_refresh_task
            await waiting.wait()
            await asyncio.sleep(0)
            if operation == "quit":
                await runtime._request_shutdown(
                    ControlCommand(
                        type=ControlCommandType.APPLICATION_QUIT,
                        command_id="quit",
                        monotonic_ms=1,
                        session_id=runtime.session_id,
                    )
                )
                await asyncio.gather(task, return_exceptions=True)
            elif operation == "disconnect":
                runtime.owner_actions.detach = AsyncMock()
                runtime.owned_browser.close = AsyncMock()
                await runtime._detach_owner(SimpleNamespace(connection_id="owner"))
            else:
                await runtime._refresh_providers(None, None, False, "newer")
                await runtime._provider_refresh_task
            assert task.done() and not runtime._provider_scan_active
            if operation != "quit":
                await runtime._refresh_providers(None, None, False, "reconnect")
                await runtime._provider_refresh_task
                assert runtime._model == "gemma"
        finally:
            await runtime.close()
        assert not runtime._tasks

    asyncio.run(scenario())
