import { expect, test } from "@playwright/test";

test("shared WebGL material visibly changes with fixed Orb orientation and light", async ({
  page,
}) => {
  await page.goto("/?transport=demo");
  const result = await page.evaluate(async () => {
    const [
      { INITIAL_UI_STATE },
      { VisualInputAdapter },
      { MotionEvaluator },
      { RENDER_BUDGETS },
      { DEFAULT_VISUAL_ENGINE_SETTINGS },
      { WebGLBackend },
    ] = await Promise.all([
      import("../../src/protocol/types"),
      import("../../src/visual-engine/input"),
      import("../../src/visual-engine/motion"),
      import("../../src/visual-engine/quality"),
      import("../../src/visual-engine/types"),
      import("../../src/visual-engine/webgl"),
    ]);
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is required for this material regression");
    const seed = 0x5a17;
    const motion = new MotionEvaluator(seed);
    const input = new VisualInputAdapter().ingest(
      { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
      0,
    );
    const first = {
      ...motion.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low),
    };
    const early = {
      ...motion.evaluate(input, 50, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low),
    };
    for (let time = 100; time <= 6_000; time += 50)
      motion.evaluate(input, time, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const last = motion.currentFrame;
    // Keep orientation, relief breath, lighting and palette fixed: only field transport changes.
    const nextFrame = {
      ...first,
      fieldPhase1: early.fieldPhase1,
      fieldPhase2: early.fieldPhase2,
      fieldTwist1: early.fieldTwist1,
      fieldTwist2: early.fieldTwist2,
    };
    const second = {
      ...first,
      fieldPhase1: last.fieldPhase1,
      fieldPhase2: last.fieldPhase2,
      fieldTwist1: last.fieldTwist1,
      fieldTwist2: last.fieldTwist2,
    };
    let current = first;
    const suppliedMotion = { evaluate: () => current } as unknown as InstanceType<
      typeof MotionEvaluator
    >;
    const backend = new WebGLBackend(
      canvas,
      gl,
      RENDER_BUDGETS.low,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      suppliedMotion,
    );
    backend.update(input);
    backend.resize(480, 480, 1);
    const read = () => {
      backend.render(0);
      const pixels = new Uint8Array(480 * 480 * 4);
      gl.readPixels(0, 0, 480, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const before = read();
    current = nextFrame;
    const afterFrame = read();
    current = second;
    const after = read();
    let total = 0;
    let changed = 0;
    let frameTotal = 0;
    let count = 0;
    for (let y = 140; y < 340; y += 2) {
      for (let x = 140; x < 340; x += 2) {
        const index = (y * 480 + x) * 4;
        if (before[index + 3] < 250 || after[index + 3] < 250) continue;
        const delta =
          (Math.abs(before[index] - after[index]) +
            Math.abs(before[index + 1] - after[index + 1]) +
            Math.abs(before[index + 2] - after[index + 2])) /
          3;
        total += delta;
        frameTotal +=
          (Math.abs(before[index] - afterFrame[index]) +
            Math.abs(before[index + 1] - afterFrame[index + 1]) +
            Math.abs(before[index + 2] - afterFrame[index + 2])) /
          3;
        changed += Number(delta > 12);
        count++;
      }
    }
    const error = gl.getError();
    backend.dispose();
    return {
      meanChannelDelta: total / count,
      frameChannelDelta: frameTotal / count,
      changedFraction: changed / count,
      count,
      error,
    };
  });
  console.info("Fixed-orientation material pixel change:", {
    meanChannelDelta: result.meanChannelDelta,
    frameChannelDelta: result.frameChannelDelta,
    changedFraction: result.changedFraction,
    count: result.count,
  });
  expect(result.count).toBeGreaterThan(2_000);
  expect(result.error).toBe(0);
  expect(result.meanChannelDelta).toBeGreaterThan(8);
  expect(result.frameChannelDelta).toBeLessThan(3);
  expect(result.changedFraction).toBeGreaterThan(0.25);
});
