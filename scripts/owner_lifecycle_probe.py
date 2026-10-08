"""Passive, content-free owner-window gate. Explicit --real uses installed LM Studio.

Observation attaches at the first private asset request, before shipped JS/auth.
No WebSocket replacement, page reload, owner binding or authority bypass.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
import time
from collections import deque
from pathlib import Path
from unittest.mock import patch

from sam_ambient.adapters.local_discovery import LocalService, find_lms, probe_service
from sam_ambient.configuration import configure_namespace
from sam_ambient.supervisor.owner_window import OwnerWindow

MODEL = "google/gemma-4-e2b"
PHASES = {"ready", "unloaded", "blocked", "failed"}


class Observer:
    def __init__(self):
        self.records = deque(maxlen=512)
        self.started = time.monotonic()
        self.connections = 0
        self.closed = 0

    def frame(self, raw, direction):
        if not isinstance(raw, str) or len(raw) > 262144:
            return
        try:
            event = json.loads(raw)
        except (ValueError, TypeError):
            return
        if not isinstance(event, dict) or not isinstance(event.get("type"), str):
            return
        kind = event["type"]
        if not (
            kind.startswith("control.")
            or kind.startswith("sam.owner.")
            or kind
            in {
                "system.ready",
                "system.stopping",
                "provider.discovery",
                "local.control",
                "model.completed",
                "model.failed",
                "model.cancelled",
                "turn.committed",
            }
        ):
            return
        record = {
            "type": kind,
            "direction": direction,
            "elapsed_ms": round((time.monotonic() - self.started) * 1000),
        }
        for key in ("command_id", "session_id", "turn_id", "generation_id", "monotonic_ms"):
            value = event.get(key)
            if isinstance(value, (str, int)):
                record[key] = value if isinstance(value, int) else value[:120]
        payload = event.get("payload", {})
        if isinstance(payload, dict):
            record["payload"] = {
                key: value[:256] if isinstance(value, str) else value
                for key in (
                    "request_id",
                    "command_id",
                    "command_type",
                    "state",
                    "outcome",
                    "provider",
                    "model",
                    "kind",
                )
                if isinstance((value := payload.get(key)), (str, bool, int))
            }
        self.records.append(record)

    def attach(self, page):
        def socket(ws):
            self.connections += 1
            ws.on("framesent", lambda raw: self.frame(raw, "sent"))
            ws.on("framereceived", lambda raw: self.frame(raw, "received"))
            ws.on("close", lambda: setattr(self, "closed", self.closed + 1))

        page.on("websocket", socket)

    def command(self, kind):
        return next(
            (r for r in reversed(self.records) if r["direction"] == "sent" and r["type"] == kind),
            None,
        )

    async def wait(self, predicate, deadline_s=30):
        async with asyncio.timeout(deadline_s):
            while True:
                result = next((r for r in reversed(self.records) if predicate(r)), None)
                if result is not None:
                    return result
                await asyncio.sleep(0.02)

    async def terminal(self, kind, phase, deadline_s=210):
        command = self.command(kind)
        assert command, f"No observed command: {kind}"
        return await self.wait(
            lambda r: (
                r["type"] == "provider.discovery"
                and r.get("payload", {}).get("request_id") == command["command_id"]
                and r["payload"].get("state") == phase
            ),
            deadline_s,
        )

    def pending(self):
        terminal_ids = {
            r.get("payload", {}).get("request_id")
            for r in self.records
            if r["type"] == "provider.discovery" and r.get("payload", {}).get("state") in PHASES
        }
        terminal_ids.update(
            r.get("payload", {}).get("command_id")
            for r in self.records
            if r["type"] in {"control.rejected", "control.acknowledged"}
            and (
                r["type"] == "control.rejected"
                or r.get("payload", {}).get("command_type")
                not in {"control.model.unload", "control.model.select", "control.providers.rescan"}
            )
        )
        return [
            r["command_id"]
            for r in self.records
            if r["direction"] == "sent"
            and "command_id" in r
            and r["command_id"] not in terminal_ids
        ]


class ObservedWindow(OwnerWindow):
    def __init__(self, root, owner, *, observer, **kwargs):
        super().__init__(root, owner, headless=True, **kwargs)
        self.observer = observer
        self.attached = False

    def _asset_path(self, value, origin):
        if not self.attached and self._page is not None:
            self.observer.attach(self._page)
            self.attached = True
        return super()._asset_path(value, origin)


async def system_tab(page):
    controls = page.get_by_role("region", name="Sam controls")
    if not await controls.is_visible():
        await page.get_by_role("button", name="Controls", exact=True).click()
    await controls.get_by_role("button", name="System", exact=True).click()
    return controls


async def active_ui(page):
    controls = await system_tab(page)
    await (
        controls.locator(".runtime-status summary").filter(has_text=MODEL).wait_for(timeout=210000)
    )
    await controls.get_by_role("button", name="Unload active model", exact=True).wait_for()
    assert await page.get_by_role("button", name="Load selected model", exact=True).count() == 0


async def inventory(lms):
    service = LocalService("lm-studio", "http://127.0.0.1:1234/v1", lms)
    await probe_service(service)
    return {"reachable": service.running, "loaded_models": service.models}


async def failure_snapshot(page, observer, lms, output):
    output.mkdir(parents=True, exist_ok=True)
    state = {
        "events": list(observer.records),
        "connections": observer.connections,
        "closed_connections": observer.closed,
        "pending_command_ids": observer.pending(),
        "provider": await inventory(lms),
    }
    if page is not None and not page.is_closed():
        state["ui"] = await page.evaluate("""() => ({
          routeSummaries:[...document.querySelectorAll('.runtime-status summary')]
            .map(e=>e.textContent),
          controlsOpen:!!document.querySelector('.controls'),
          activeTabs:[...document.querySelectorAll('.controls__tabs [aria-pressed=true]')]
            .map(e=>e.textContent),
          renderer:document.querySelector('[data-sam-renderer]')?.getAttribute('data-sam-renderer'),
          historyItems:document.querySelectorAll('.transcript__line').length,
          buttons:[...document.querySelectorAll('.controls button')]
            .map(e=>({label:e.textContent,disabled:e.disabled}))
        })""")
        await page.screenshot(
            path=str(output / "failure.png"),
            mask=[
                page.get_by_role("region", name="Conversation history"),
                page.locator("input,textarea"),
                page.locator(".console,.memory-manager"),
            ],
        )
    (output / "failure.json").write_text(json.dumps(state, indent=2), encoding="utf-8")


async def real_gate():
    from sam_ambient.supervisor.cli import build_parser, run

    lms = find_lms()
    if not lms:
        raise RuntimeError("Installed LM Studio CLI unavailable")
    before = await inventory(lms)
    print(json.dumps({"stage": "before", **before}), flush=True)
    observer, windows, started = Observer(), [], asyncio.Event()

    class Window(ObservedWindow):
        def __init__(self, root, owner):
            super().__init__(root, owner, observer=observer)
            windows.append(self)

        async def open(self, url):
            result = await super().open(url)
            started.set()
            return result

    with tempfile.TemporaryDirectory(prefix="sam-owner-lifecycle-") as directory:
        root = Path(directory)
        config = root / "sam.toml"
        keep = MODEL in before["loaded_models"]
        config.write_text(
            'schema_version=1\n[lifecycle]\nmodel_on_exit="'
            + ("keep" if keep else "unload_if_sam_loaded")
            + '"\nprovider_on_exit="stop_if_sam_started"\n',
            encoding="utf-8",
        )
        argv = [
            "--root",
            str(root),
            "--config",
            str(config),
            "--open-ui",
            "--provider",
            "lm-studio",
            "--model",
            MODEL,
            "--no-voice",
            "--no-tts",
        ]
        args = build_parser().parse_args(argv)
        configure_namespace(args, argv, supervisor=True)
        page = None
        with (
            patch.dict(os.environ, {"LOCALAPPDATA": str(root / "appdata")}),
            patch("sam_ambient.supervisor.browser.OwnerWindow", Window),
        ):
            runner = asyncio.create_task(run(args))
            try:
                await asyncio.wait_for(started.wait(), 90)
                page = windows[0]._page
                await observer.wait(
                    lambda r: (
                        r["type"] == "provider.discovery"
                        and r.get("payload", {}).get("state") == "ready"
                        and r["payload"].get("model") == MODEL
                    ),
                    210,
                )
                await active_ui(page)
                assert MODEL in (await inventory(lms))["loaded_models"]
                print(json.dumps({"stage": "active", "authenticated": True}), flush=True)

                async def text_turn(prompt):
                    await page.get_by_role("button", name="Conversation", exact=True).click()
                    history = page.get_by_role("region", name="Conversation history")
                    count = await history.locator(".transcript__line--assistant").count()
                    await page.get_by_role("textbox", name="Text request", exact=True).fill(prompt)
                    await page.get_by_role("button", name="Send", exact=True).click()
                    command = observer.command("control.user_message.submit")
                    await (
                        history.locator(".transcript__line--assistant")
                        .nth(count)
                        .wait_for(timeout=60000)
                    )
                    await observer.wait(
                        lambda r: (
                            r["type"] == "model.completed"
                            and r["elapsed_ms"] >= command["elapsed_ms"]
                        ),
                        60,
                    )
                    print(json.dumps({"stage": "text_complete", "number": count + 1}), flush=True)

                await text_turn("Reply with the single word ready. Do not use tools.")
                await system_tab(page)
                await page.get_by_role("button", name="Unload active model", exact=True).click(
                    timeout=60000
                )
                terminal = await observer.terminal("control.model.unload", "unloaded")
                unloaded = await inventory(lms)
                assert MODEL not in unloaded["loaded_models"] and unloaded["reachable"]
                load = page.get_by_role("button", name="Load selected model", exact=True)
                await load.wait_for()
                assert await load.is_enabled()
                print(
                    json.dumps(
                        {
                            "stage": "unloaded",
                            "request_id": terminal["payload"]["request_id"],
                            **unloaded,
                        }
                    ),
                    flush=True,
                )
                await load.click()
                terminal = await observer.terminal("control.model.select", "ready")
                await active_ui(page)
                assert MODEL in (await inventory(lms))["loaded_models"]
                print(
                    json.dumps(
                        {"stage": "reloaded", "request_id": terminal["payload"]["request_id"]}
                    ),
                    flush=True,
                )
                await page.evaluate("""() => {
                  window.samDraws=[];const p=WebGL2RenderingContext.prototype,o=p.drawElements;
                  p.drawElements=function(...a){
                    const t=performance.now();o.apply(this,a);window.samDraws.push(t);
                  };
                }""")
                await text_turn("Reply with the single word steady. Do not use tools.")
                await text_turn(
                    "Explain why the sky appears blue in five concise sentences. Do not use tools."
                )
                timing = await page.evaluate("""() => {
                  const frames=window.samDraws.filter((t,i,a)=>!i||t-a[i-1]>5);
                  const d=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
                  return {frames:frames.length,intervalMedianMs:d[Math.floor(d.length*.5)],
                    intervalP95Ms:d[Math.floor(d.length*.95)],gapsOver100Ms:d.filter(v=>v>100).length};
                }""")
                print(json.dumps({"stage": "inference_cadence", **timing}), flush=True)
                await system_tab(page)
                await page.get_by_role("button", name="Rescan providers/models", exact=True).click()
                await observer.terminal("control.providers.rescan", "ready")
                await active_ui(page)
                assert MODEL in (await inventory(lms))["loaded_models"]
                print(json.dumps({"stage": "rescan", "same_active_route": True}), flush=True)
                await page.get_by_role("button", name="Quit Sam", exact=True).click()
                await page.get_by_role("button", name="Confirm quit", exact=True).click()
                assert await asyncio.wait_for(runner, 35) == 0
                assert not windows[0].owner.active and windows[0]._context is None
            except BaseException:
                await failure_snapshot(page, observer, lms, Path(".sam/lifecycle-gate"))
                raise
            finally:
                if not runner.done():
                    if page is not None and not page.is_closed():
                        await page.keyboard.press("Control+q")
                        await page.get_by_role("button", name="Confirm quit", exact=True).click(
                            timeout=3000
                        )
                    try:
                        await asyncio.wait_for(asyncio.shield(runner), 35)
                    except TimeoutError:
                        runner.cancel()
                        await asyncio.gather(runner, return_exceptions=True)
    after = await inventory(lms)
    assert (MODEL in after["loaded_models"]) == keep
    assert not before["reachable"] or after["reachable"]
    print(
        json.dumps(
            {
                "stage": "quit",
                **after,
                "authority_revoked": True,
                "connections": observer.connections,
            }
        ),
        flush=True,
    )
    await asyncio.to_thread(Path(".sam/lifecycle-gate").mkdir, parents=True, exist_ok=True)
    await asyncio.to_thread(
        Path(".sam/lifecycle-gate/events.json").write_text,
        json.dumps(list(observer.records), indent=2),
        encoding="utf-8",
    )


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--real", action="store_true", required=True)
    parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(real_gate())
