"""Exact idle model lifecycle, confirmed absence, correlation and route recovery."""

import asyncio
from unittest.mock import patch

from sam_ambient.adapters.local_discovery import (
    CleanupResult,
    CleanupStatus,
    Discovery,
    LocalService,
)
from sam_ambient.cli import _unload_selected_model
from sam_ambient.core.protocol import (
    ControlCommand,
    ControlCommandType,
    LocalControlIntent,
    LocalControlKind,
    LocalControlOutcome,
)
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, SamRuntime
from tests.unit.test_local_controls import RecordingProvider


def test_unload_then_reload_preserves_exact_intent_and_typed_progress(tmp_path):
    async def scenario():
        provider = RecordingProvider("lm-studio")
        entered, release = asyncio.Event(), asyncio.Event()
        calls = []

        async def unload(p, m):
            calls.append((p, m))
            entered.set()
            await release.wait()
            return ProviderRefresh(
                None,
                None,
                "confirmed",
                ({"id": p, "running": True, "models": [], "installed_models": [m]},),
            )

        async def refresh(p, m):
            return ProviderRefresh(
                provider,
                m,
                "loaded",
                ({"id": p, "running": True, "models": [m], "installed_models": [m]},),
            )

        runtime = SamRuntime(
            provider,
            RuntimeConfig(tmp_path, model="gemma"),
            provider_unloader=unload,
            provider_refresher=refresh,
        )
        try:
            command = ControlCommand(
                type=ControlCommandType.MODEL_UNLOAD,
                command_id="unload",
                monotonic_ms=1,
                payload={"provider": "lm-studio", "model": "gemma"},
            )
            first = await runtime.controls.dispatch(command)
            assert first.payload["outcome"] == "started"
            assert await runtime.controls.dispatch(command) == first
            await entered.wait()
            try:
                runtime.submit_user_message("during unload")
            except RuntimeError:
                pass
            else:
                raise AssertionError("generation must not start during unload")
            blocked = await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.UNLOAD_INFERENCE, "lm-studio", "gemma")
            )
            assert blocked.outcome is LocalControlOutcome.BLOCKED
            release.set()
            await runtime._provider_refresh_task
            assert runtime._model is None and not runtime._provider_scan_active
            assert (runtime._desired_provider, runtime._desired_model) == ("lm-studio", "gemma")
            assert calls == [("lm-studio", "gemma")]
            loaded = await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.SWITCH_INFERENCE, "lm-studio", "gemma")
            )
            assert loaded.outcome is LocalControlOutcome.SUCCESS and runtime._model == "gemma"
            runtime.submit_user_message("after reload")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert provider.models_used == ["gemma"]
        finally:
            release.set()
            await runtime.close()

    asyncio.run(scenario())


def test_unload_blocks_active_generation_and_failure_preserves_valid_route(tmp_path):
    async def scenario():
        gate = asyncio.Event()
        provider = RecordingProvider("lm-studio", gate)

        async def fail(p, m):
            raise RuntimeError("fixture")

        runtime = SamRuntime(
            provider, RuntimeConfig(tmp_path, model="gemma"), provider_unloader=fail
        )
        intent = LocalControlIntent(LocalControlKind.UNLOAD_INFERENCE, "lm-studio", "gemma")
        try:
            runtime.submit_user_message("hold")
            await provider.started.wait()
            assert (
                await runtime.execute_local_control(intent)
            ).outcome is LocalControlOutcome.BLOCKED
            gate.set()
            await runtime._active_done.wait()
            assert (
                await runtime.execute_local_control(intent)
            ).outcome is LocalControlOutcome.FAILED
            assert runtime._model == "gemma" and runtime._model_unavailable_reason is None
            assert not runtime._provider_scan_active
        finally:
            gate.set()
            await runtime.close()

    asyncio.run(scenario())


def test_explicit_owner_unload_does_not_claim_or_stop_external_service():
    async def scenario():
        service = LocalService(
            "lm-studio",
            "http://127.0.0.1:1234/v1",
            "lms",
            True,
            ["gemma"],
            installed_models=["gemma"],
        )
        discovery = Discovery([service], service, "gemma", "fixture")

        async def confirmed(s, m):
            s.models = []
            return CleanupResult("model", s.id, CleanupStatus.SUCCEEDED, "confirmed absent")

        with patch("sam_ambient.adapters.local_discovery.unload_owned_model", confirmed):
            result = await _unload_selected_model([discovery], "lm-studio", "gemma")
        assert result.model is None and result.catalog[0]["models"] == []
        assert service.running and not service.started_by_sam

    asyncio.run(scenario())


def test_rescan_supersedes_cancelled_unload_without_adopting_its_late_result(tmp_path):
    async def scenario():
        first, second = RecordingProvider("lm-studio"), RecordingProvider("lm-studio")
        entered = asyncio.Event()

        async def late(p, m):
            entered.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                return ProviderRefresh(None, None, "late old absence")

        async def refresh(p, m):
            return ProviderRefresh(second, "new-model", "confirmed")

        runtime = SamRuntime(
            first,
            RuntimeConfig(tmp_path, model="old-model"),
            provider_unloader=late,
            provider_refresher=refresh,
        )
        try:
            await runtime.execute_local_control(
                LocalControlIntent(LocalControlKind.UNLOAD_INFERENCE, "lm-studio", "old-model"),
                "old",
            )
            await entered.wait()
            await runtime._refresh_providers(None, None, False, "new")
            await runtime._provider_refresh_task
            assert runtime.provider is second and runtime._model == "new-model"
            assert runtime._model_unavailable_reason is None
            assert not runtime._provider_scan_active
        finally:
            await runtime.close()

    asyncio.run(scenario())
