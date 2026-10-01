import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from sam_ambient.adapters import local_discovery as discovery
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, SamRuntime
from tests.unit.test_conversation_context import ConversationProvider


@pytest.mark.xfail(strict=True, reason="inventory outcomes currently collapse to list")
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
    async def read(_limit):
        if error is not None:
            raise error
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


@pytest.mark.xfail(strict=True, reason="runtime currently has no inventory recovery")
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
