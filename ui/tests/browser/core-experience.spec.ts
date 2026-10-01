import { expect, test } from "@playwright/test";
import { coreSimulatorEvents } from "./core-simulator.mjs";

test("composed core events preserve history, speech response and Controls through recovery", async ({
  page,
}) => {
  test.setTimeout(45_000);
  // This invokes the composed synthetic runtime, never real devices/providers.
  const records = coreSimulatorEvents();
  await page.goto("/?transport=browser");
  const result = await page.evaluate(async (records) => {
    const [
      { INITIAL_UI_STATE },
      { reduceProtocolEvent },
      { VisualInputAdapter },
      { MotionEvaluator },
      { DEFAULT_VISUAL_ENGINE_SETTINGS },
      { RENDER_BUDGETS },
    ] = await Promise.all([
      import("../../src/protocol/types"),
      import("../../src/state/reducer"),
      import("../../src/visual-engine/input"),
      import("../../src/visual-engine/motion"),
      import("../../src/visual-engine/types"),
      import("../../src/visual-engine/quality"),
    ]);
    let state = INITIAL_UI_STATE;
    let outputPulse = 0;
    const adapter = new VisualInputAdapter();
    const motion = new MotionEvaluator(1234);
    for (const event of records) {
      if (event.type === "application.stopped") break;
      state = reduceProtocolEvent(state, event);
      if (event.type === "tts.level" && Number(event.payload.envelope) > 0) {
        const input = adapter.ingest(state, event.monotonic_ms);
        for (let offset = 0; offset <= 100; offset += 20) {
          outputPulse = Math.max(
            outputPulse,
            motion.evaluate(
              input,
              event.monotonic_ms + offset,
              DEFAULT_VISUAL_ENGINE_SETTINGS,
              RENDER_BUDGETS.high,
            ).reactivity.outputPulse,
          );
        }
      }
      window.dispatchEvent(new CustomEvent("sam-protocol-event", { detail: event }));
    }
    return { outputPulse, model: state.model, voice: state.ttsSelection };
  }, records);
  expect(result.outputPulse).toBeGreaterThan(0.1);
  expect(result.outputPulse).toBeLessThanOrEqual(1);
  expect(result.model).toBe("chat");
  expect(result.voice).toBeTruthy();
  const dismiss = page.getByRole("button", { name: "Dismiss startup information" });
  if (await dismiss.isVisible()) await dismiss.click();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const status = page.locator(".controls__speech-status");
  await expect(status).toContainText("Speech recognition service unavailable");
  await expect(status).toContainText(result.voice ?? "");
  const transcript = page.getByRole("button", { name: "Transcript hidden" });
  if (await transcript.isVisible()) await transcript.click();
  const history = page.getByRole("region", { name: "Conversation history" });
  await expect(history.locator(".transcript__meta span")).toHaveText([
    "You",
    "Sam",
    "You",
    "Sam",
    "You",
    "Sam",
  ]);
  await expect(history).toContainText("Synthetic voice request.");
  await expect(history).toContainText("Typed recovery request.");
  await expect(history).not.toContainText("Speech recognition service unavailable");
  await expect(page.locator('[data-sam-renderer="webgl2"]')).toHaveCount(1);
});
