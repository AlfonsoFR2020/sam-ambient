"""One explicitly authorized visual integration session; no standing launch permission.

--check validates passive instrumentation in a headless blank fixture. --real opens
one normal private owner window, with isolated data and disabled capture/playback.
Synthetic modes alter render uniforms only, never core events or conversation state.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import socket
import tempfile
from pathlib import Path
from unittest.mock import patch

from owner_lifecycle_probe import MODEL, Observer, active_ui, inventory, system_tab
from playwright.async_api import BrowserType, async_playwright

from sam_ambient.adapters.local_discovery import find_lms, lms_status
from sam_ambient.configuration import configure_namespace
from sam_ambient.supervisor.app_window import find_app_browser
from sam_ambient.supervisor.owner_window import OwnerWindow

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".tmp/visual-identity-III/runtime"
SAMPLER = Path(__file__).with_name("visual_identity_sampler.js").read_text(encoding="utf-8")


async def check():
    async with async_playwright() as driver:
        browser = await driver.chromium.launch(
            executable_path=find_app_browser(),
            headless=True,
            chromium_sandbox=True,
            args=["--mute-audio"],
        )
        try:
            context = await browser.new_context()
            await context.add_init_script(SAMPLER)
            page = await context.new_page()
            await page.goto("about:blank")
            result = await page.evaluate("""async()=>{
              const c=document.createElement('canvas');document.body.append(c);
              const g=c.getContext('webgl2'),p=g.createProgram();
              const sources=[
                [g.VERTEX_SHADER,'#version 300 es\\n'+
                  'void main(){gl_Position=vec4(0,0,0,1);gl_PointSize=1.;}'],
                [g.FRAGMENT_SHADER,'#version 300 es\\nprecision highp float;'+
                  'out vec4 color;void main(){color=vec4(1);}']];
              for(const [type,source] of sources){
                const s=g.createShader(type);g.shaderSource(s,source);
                g.compileShader(s);g.attachShader(p,s);
              }
              g.linkProgram(p);g.useProgram(p);samVisualProbe.begin('fixture');
              for(let i=0;i<30;i++){
                g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.drawArrays(g.POINTS,0,1);
                await new Promise(r=>setTimeout(r,10));
              }
              return {sample:samVisualProbe.report(),error:g.getError()};
            }""")
            assert result["error"] == 0 and result["sample"]["frames"] == 30
            print(json.dumps({"fixture_passed": True, "frames": 30}), flush=True)
        finally:
            await browser.close()


async def real():
    from sam_ambient.supervisor.cli import build_parser, run

    OUTPUT.mkdir(parents=True, exist_ok=True)
    marker = OUTPUT / "real-attempt.txt"
    if marker.exists():
        raise RuntimeError("A real attempt is already recorded; inspect it before any repeat")
    lms = find_lms()
    if not lms or not find_app_browser():
        raise RuntimeError("Existing provider/browser environment unavailable")
    # Check ports without interacting with a potentially pre-existing Sam instance.
    for port in (8765, 8766):
        with socket.socket() as candidate:
            candidate.bind(("127.0.0.1", port))
    before = await inventory(lms)
    status = await lms_status(lms, "server")
    observer, windows, opened = Observer(), [], asyncio.Event()
    measurements = []
    original = BrowserType.launch_persistent_context

    async def instrument(self, *args, **kwargs):
        context = await original(self, *args, **kwargs)
        await context.add_init_script(SAMPLER)
        return context

    class Window(OwnerWindow):
        attached = False

        def _asset_path(self, value, origin):
            if not self.attached and self._page is not None:
                observer.attach(self._page)
                self.attached = True
            return super()._asset_path(value, origin)

        async def open(self, url):
            result = await super().open(url)
            windows.append(self)
            opened.set()
            return result

    report = {
        "before": before,
        "initial_server_running": status.get("running"),
        "audio_disabled": True,
        "synthetic_mode_boundary": "render uniforms only",
    }
    print(json.dumps({"stage": "initial", **report}), flush=True)
    with tempfile.TemporaryDirectory(prefix="session-", dir=OUTPUT) as directory:
        root = await asyncio.to_thread(Path(directory).resolve)
        assert root.is_relative_to(OUTPUT.resolve())
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
            patch.object(BrowserType, "launch_persistent_context", instrument),
        ):
            marker.write_text(
                "One real session started; do not replay blindly.\n", encoding="utf-8"
            )
            runner = asyncio.create_task(run(args))
            try:
                await asyncio.wait_for(opened.wait(), 90)
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

                async def tab(name):
                    controls = page.get_by_role("region", name="Sam controls")
                    if not await controls.is_visible():
                        await page.get_by_role("button", name="Controls", exact=True).click()
                    await controls.get_by_role("button", name=name, exact=True).click()
                    return controls

                async def close_controls():
                    if await page.get_by_role("region", name="Sam controls").is_visible():
                        await page.get_by_role("button", name="Controls", exact=True).click()

                def visual_select(label):
                    return (
                        page.locator("label.visual-setting")
                        .filter(has=page.get_by_text(label, exact=True))
                        .locator("select")
                    )

                async def snapshot(label):
                    await page.screenshot(
                        path=str(OUTPUT / f"{label}.png"),
                        mask=[
                            page.get_by_role("region", name="Conversation history"),
                            page.locator("input,textarea,.console,.memory-manager"),
                        ],
                    )

                async def sample(label, duration=3):
                    await page.evaluate("label=>samVisualProbe.begin(label)", label)
                    await asyncio.sleep(duration)
                    result = await page.evaluate("samVisualProbe.report()")
                    measurements.append(result)
                    print(
                        json.dumps(
                            {
                                "stage": label,
                                "frames": result["frames"],
                                "interval": result["drawIntervalsMs"],
                            }
                        ),
                        flush=True,
                    )

                async def text(label):
                    await tab("Conversation")
                    await page.get_by_role("textbox", name="Text request", exact=True).fill(
                        "Explain cloud formation in six concise sentences. Do not use tools."
                    )
                    prior = max((r["elapsed_ms"] for r in observer.records), default=0)
                    await page.evaluate("label=>samVisualProbe.begin(label)", label)
                    await page.get_by_role("button", name="Send", exact=True).click()
                    await observer.wait(
                        lambda r: (
                            r["direction"] == "sent"
                            and r["type"] == "control.user_message.submit"
                            and r["elapsed_ms"] > prior
                        ),
                        5,
                    )
                    await close_controls()
                    await observer.wait(
                        lambda r: r["type"] == "model.completed" and r["elapsed_ms"] > prior, 60
                    )
                    measurements.append(await page.evaluate("samVisualProbe.report()"))
                    print(json.dumps({"stage": label, "completed": True}), flush=True)

                await tab("Device")
                await visual_select("Performance profile").select_option("high_end")
                for quality in ("low", "medium", "high"):
                    await tab("Device")
                    await visual_select("Quality").select_option(quality)
                    await close_controls()
                    await asyncio.sleep(0.8)
                    await sample(f"idle-{quality}")
                    await snapshot(f"idle-{quality}")
                    await text(f"inference-{quality}")
                await tab("Appearance")
                await page.get_by_role("button", name="Toggle fullscreen", exact=True).click()
                assert await page.evaluate("Boolean(document.fullscreenElement)")
                await close_controls()
                await sample("fullscreen-high")
                await snapshot("fullscreen-high")
                for mode in ("listening", "speaking"):
                    await page.evaluate("mode=>samVisualProbe.mode=mode", mode)
                    await sample(f"synthetic-{mode}")
                    await snapshot(f"synthetic-{mode}")
                await page.evaluate("samVisualProbe.mode='actual'")
                await tab("Appearance")
                flow = page.get_by_role("slider", name="Surface Flow", exact=True)
                await flow.focus()
                await page.keyboard.press("Home")
                assert await flow.input_value() == "0"
                await close_controls()
                await sample("flow-zero")
                await tab("Appearance")
                await page.get_by_role("slider", name="Surface Flow", exact=True).focus()
                await page.keyboard.press("End")
                await close_controls()
                await sample("flow-max")
                await tab("Appearance")
                audio = page.get_by_role("slider", name="Audio reactivity", exact=True)
                await audio.focus()
                await page.keyboard.press("Home")
                assert await audio.input_value() == "0"
                await page.evaluate("samVisualProbe.strength=0;samVisualProbe.mode='speaking'")
                await close_controls()
                await sample("synthetic-audio-zero")
                await tab("Appearance")
                await visual_select("Reduced motion").select_option("on")
                await page.evaluate("samVisualProbe.mode='actual'")
                await close_controls()
                await sample("reduced-motion")
                await page.evaluate("samVisualProbe.mode='actual'")
                await system_tab(page)
                await page.get_by_role("button", name="Quit Sam", exact=True).click()
                await page.get_by_role("button", name="Confirm quit", exact=True).click()
                report["exit_code"] = await asyncio.wait_for(runner, 35)
                report["authority_revoked"] = not windows[0].owner.active
                report["window_closed"] = windows[0]._context is None
            except BaseException as error:
                report["error_class"] = type(error).__name__
                if page is not None and not page.is_closed():
                    report["failure_sampler"] = await page.evaluate(
                        "window.samVisualProbe?.report() ?? {samplerUnavailable:true}"
                    )
                    report["pending_commands"] = observer.pending()
                    await snapshot("failure")
                raise
            finally:
                if not runner.done():
                    try:
                        if page is not None and not page.is_closed():
                            await system_tab(page)
                            await page.get_by_role("button", name="Quit Sam", exact=True).click(
                                timeout=3000
                            )
                            await page.get_by_role("button", name="Confirm quit", exact=True).click(
                                timeout=3000
                            )
                        report["exit_code"] = await asyncio.wait_for(asyncio.shield(runner), 35)
                    except Exception:
                        runner.cancel()
                        await asyncio.gather(runner, return_exceptions=True)
                report["authority_revoked"] = bool(windows) and not windows[0].owner.active
                report["window_closed"] = bool(windows) and windows[0]._context is None
                report["measurements"] = measurements
                report["events"] = list(observer.records)
                report["after"] = await inventory(lms)
                report["model_ownership_preserved"] = (
                    MODEL in report["after"]["loaded_models"]
                ) == keep
                report["endpoint_ownership_preserved"] = (
                    report["after"]["reachable"] == before["reachable"]
                )
                (OUTPUT / "session.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
                print(
                    json.dumps(
                        {
                            "stage": "cleanup",
                            "after": report["after"],
                            "exit_code": report.get("exit_code"),
                            "error": report.get("error_class"),
                        }
                    ),
                    flush=True,
                )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check", action="store_true")
    mode.add_argument("--real", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(check() if args.check else real())
