"""Actual shipped owner UI/handshake with passive probe and fake provider only."""

import asyncio
import json

from sam_ambient.core.owner import OwnerSession
from sam_ambient.runtime import ProviderRefresh, RuntimeConfig, SamRuntime
from scripts.owner_lifecycle_probe import MODEL, ObservedWindow, Observer, active_ui, system_tab
from tests.unit.test_cli import FakeProvider


def test_observer_preserves_handshake_correlates_controls_and_avoids_encoding_locator(tmp_path):
    class Provider(FakeProvider):
        id = "lm-studio"

    async def scenario():
        provider, owner, observer = Provider(), OwnerSession(), Observer()
        catalog = (
            {"id": "lm-studio", "running": True, "models": [MODEL], "installed_models": [MODEL]},
        )

        async def unload(p, m):
            return ProviderRefresh(None, None, "confirmed", ({**catalog[0], "models": []},))

        async def reload(p, m):
            return ProviderRefresh(provider, MODEL, "confirmed", catalog)

        runtime = SamRuntime(
            provider,
            RuntimeConfig(
                tmp_path,
                model=MODEL,
                state_db=tmp_path / "state.db",
                memory_db=tmp_path / "memory.db",
            ),
            owner_session=owner,
            provider_unloader=unload,
            provider_refresher=reload,
        )
        window = ObservedWindow(tmp_path, owner, observer=observer)
        try:
            await runtime.start()
            assert await window.open("http://127.0.0.1:8766")
            page = window._page
            await observer.wait(lambda r: r["type"] == "system.ready")
            kinds = [r["type"] for r in observer.records]
            assert kinds.index("sam.owner.challenge") < kinds.index("sam.owner.authenticate")
            assert kinds.index("sam.owner.accepted") < kinds.index("system.ready")
            assert observer.connections == 1  # no reload/replacement WebSocket
            await active_ui(page)
            summary = page.locator(".runtime-status summary")
            actual = await summary.inner_text()
            assert chr(0xB7) in actual
            damaged = f"lm-studio {chr(0xC2)}{chr(0xB7)} {MODEL}"
            assert await summary.filter(has_text=damaged).count() == 0
            await page.get_by_role("button", name="Unload active model", exact=True).click()
            terminal = await observer.terminal("control.model.unload", "unloaded")
            assert (
                terminal["payload"]["request_id"]
                == observer.command("control.model.unload")["command_id"]
            )
            assert runtime._model is None
            await page.get_by_role("button", name="Load selected model", exact=True).click()
            await observer.terminal("control.model.select", "ready")
            await active_ui(page)
            await page.get_by_role("button", name="Conversation", exact=True).click()
            await page.get_by_role("textbox", name="Text request", exact=True).fill("probe fixture")
            await page.get_by_role("button", name="Send", exact=True).click()
            await observer.wait(lambda r: r["type"] == "model.completed")
            await system_tab(page)
            await page.get_by_role("button", name="Rescan providers/models", exact=True).click()
            await observer.terminal("control.providers.rescan", "ready")
            await active_ui(page)
            assert runtime.bridge.connected.is_set()
            assert "probe fixture" not in json.dumps(list(observer.records))
        finally:
            await window.aclose()
            await runtime.close()

    asyncio.run(scenario())


def test_observer_never_retains_proofs_prompts_or_raw_payloads():
    observer = Observer()
    for event in (
        {"type": "sam.owner.authenticate", "proof": "SECRET"},
        {"type": "sam.owner.challenge", "nonce": "SECRET", "server_proof": "SECRET"},
        {"type": "control.user_message.submit", "command_id": "c", "payload": {"text": "PRIVATE"}},
        {"type": "model.completed", "payload": {"text": "PRIVATE"}},
    ):
        observer.frame(json.dumps(event), "sent")
    captured = json.dumps(list(observer.records))
    assert "SECRET" not in captured and "PRIVATE" not in captured
