import { expect, test } from "@playwright/test";

test("measured output pulse expands and illuminates the fixed body", async ({ page }) => {
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
    const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is required for the speaking regression");
    const seed = 0x5a17;
    const adapter = new VisualInputAdapter();
    const state = {
      ...INITIAL_UI_STATE,
      connection: "connected" as const,
      provider: "demo",
      model: "demo",
      sessionId: "session",
      generationId: "generation",
      conversationalState: "SPEAKING" as const,
      ttsOutputEnabled: true,
    };
    const quiet = adapter.ingest(state, 0);
    const motion = new MotionEvaluator(seed);
    for (let time = 0; time <= 300; time += 50)
      motion.evaluate(quiet, time, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.high);
    const baseline = {
      ...motion.currentFrame,
      reactivity: { ...motion.currentFrame.reactivity },
    };
    const active = adapter.ingest(
      {
        ...state,
        lastMonotonicByType: { "tts.level": 350 },
        metrics: { ...state.metrics, playbackEnvelope: 0.7 },
      },
      350,
    );
    for (let time = 350; time <= 500; time += 50)
      motion.evaluate(active, time, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.high);
    const pulse = {
      ...baseline,
      radius: motion.currentFrame.radius,
      glow: motion.currentFrame.glow,
      highlight: motion.currentFrame.highlight,
      reactivity: { ...motion.currentFrame.reactivity },
    };
    let current = baseline;
    const fixedMotion = { evaluate: () => current } as unknown as InstanceType<
      typeof MotionEvaluator
    >;
    const backend = new WebGLBackend(
      canvas,
      gl,
      { ...RENDER_BUDGETS.high, peels: 0 },
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      fixedMotion,
    );
    backend.update(quiet);
    backend.resize(480, 480, 1);
    const read = () => {
      backend.render(0);
      const pixels = new Uint8Array(480 * 480 * 4);
      gl.readPixels(0, 0, 480, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const before = read();
    current = pulse;
    const after = read();
    let beforeArea = 0;
    let afterArea = 0;
    let centerLight = 0;
    let centerCount = 0;
    for (let y = 80; y < 400; y++) {
      for (let x = 80; x < 400; x++) {
        const at = (y * 480 + x) * 4;
        beforeArea += Number(before[at + 3] > 250);
        afterArea += Number(after[at + 3] > 250);
        if (x < 190 || x > 290 || y < 190 || y > 290) continue;
        centerLight +=
          (after[at] -
            before[at] +
            after[at + 1] -
            before[at + 1] +
            after[at + 2] -
            before[at + 2]) /
          3;
        centerCount++;
      }
    }
    const error = gl.getError();
    backend.dispose();
    return { areaGain: afterArea - beforeArea, lightGain: centerLight / centerCount, error };
  });
  console.info("Fixed-body speaking response:", result);
  expect(result.error).toBe(0);
  expect(result.areaGain).toBeGreaterThan(500);
  expect(result.lightGain).toBeGreaterThan(2);
});

test("high-tier fixed body and membrane retain measurable lifted coverage", async ({ page }) => {
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
    const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is required for the form regression");
    const seed = 0x5a17;
    const input = new VisualInputAdapter().ingest(
      { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
      0,
    );
    const motion = new MotionEvaluator(seed);
    const frame = {
      ...motion.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.high),
    };
    const fixedMotion = { evaluate: () => frame } as unknown as InstanceType<
      typeof MotionEvaluator
    >;
    const bare = new WebGLBackend(
      canvas,
      gl,
      { ...RENDER_BUDGETS.high, peels: 0 },
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      fixedMotion,
    );
    const composed = new WebGLBackend(
      canvas,
      gl,
      RENDER_BUDGETS.high,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      fixedMotion,
    );
    bare.update(input);
    composed.update(input);
    bare.resize(600, 600, 1);
    composed.resize(600, 600, 1);
    const read = (backend: InstanceType<typeof WebGLBackend>) => {
      backend.render(0);
      const pixels = new Uint8Array(600 * 600 * 4);
      gl.readPixels(0, 0, 600, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const body = read(bare);
    const membrane = read(composed);
    let changed = 0;
    let outside = 0;
    let count = 0;
    for (let y = 70; y < 530; y += 2) {
      for (let x = 70; x < 530; x += 2) {
        const at = (y * 600 + x) * 4;
        if (body[at + 3] > 250) count++;
        if (body[at + 3] < 10 && membrane[at + 3] > 80) outside++;
        if (
          body[at + 3] > 250 &&
          Math.abs(body[at] - membrane[at]) +
            Math.abs(body[at + 1] - membrane[at + 1]) +
            Math.abs(body[at + 2] - membrane[at + 2]) >
            24
        )
          changed++;
      }
    }
    const error = gl.getError();
    bare.dispose();
    composed.dispose();
    return { changed, outside, count, error };
  });
  console.info("Fixed high-tier body/membrane comparison:", result);
  expect(result.error).toBe(0);
  expect(result.count).toBeGreaterThan(10_000);
  expect(result.changed).toBeGreaterThan(500);
  expect(result.outside).toBeGreaterThan(20);
});

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
      ...motion.evaluate(input, 1000 / 60, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low),
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

test("membrane depth, moving illumination, and palette act on one fixed body", async ({ page }) => {
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
    canvas.id = "isolated-surface";
    document.body.append(canvas);
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is required for this composition regression");
    const seed = 0x5a17;
    const input = new VisualInputAdapter().ingest(
      { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
      0,
    );
    const motion = new MotionEvaluator(seed);
    const base = {
      ...motion.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low),
    };
    let current = base;
    const suppliedMotion = { evaluate: () => current } as unknown as InstanceType<
      typeof MotionEvaluator
    >;
    const body = new WebGLBackend(
      canvas,
      gl,
      { ...RENDER_BUDGETS.low, peels: 0 },
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      suppliedMotion,
    );
    const composed = new WebGLBackend(
      canvas,
      gl,
      RENDER_BUDGETS.low,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      seed,
      suppliedMotion,
    );
    body.update(input);
    composed.update(input);
    body.resize(480, 480, 1);
    composed.resize(480, 480, 1);
    const read = (backend: InstanceType<typeof WebGLBackend>) => {
      backend.render(0);
      const pixels = new Uint8Array(480 * 480 * 4);
      gl.readPixels(0, 0, 480, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const bare = read(body);
    const membrane = read(composed);
    current = { ...base, lightPhase: base.lightPhase + 1.7 };
    const relit = read(body);
    current = { ...base, paletteBalance: 0.75, paletteContrast: 1.14 };
    const paletteA = read(body);
    current = { ...base, paletteBalance: 0.61, paletteContrast: 0.86 };
    const paletteB = read(body);
    let coverage = 0;
    let tintAgreement = 0;
    let lightSum = 0;
    let lightSquare = 0;
    let paletteDelta = 0;
    let count = 0;
    for (let y = 90; y < 390; y += 2) {
      for (let x = 90; x < 390; x += 2) {
        const at = (y * 480 + x) * 4;
        if (bare[at + 3] < 250) continue;
        const dr = membrane[at] - bare[at];
        const dg = membrane[at + 1] - bare[at + 1];
        const db = membrane[at + 2] - bare[at + 2];
        if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) > 15) {
          coverage++;
          const original = [bare[at], bare[at + 1], bare[at + 2]];
          const outer = [membrane[at], membrane[at + 1], membrane[at + 2]];
          const norm = (v: number[]) => Math.hypot(...v);
          tintAgreement +=
            (original[0] * outer[0] + original[1] * outer[1] + original[2] * outer[2]) /
            (norm(original) * norm(outer));
        }
        const light =
          (relit[at] - bare[at] + (relit[at + 1] - bare[at + 1]) + (relit[at + 2] - bare[at + 2])) /
          3;
        lightSum += light;
        lightSquare += light * light;
        paletteDelta +=
          (Math.abs(paletteA[at] - paletteB[at]) +
            Math.abs(paletteA[at + 1] - paletteB[at + 1]) +
            Math.abs(paletteA[at + 2] - paletteB[at + 2])) /
          3;
        count++;
      }
    }
    const error = gl.getError();
    body.dispose();
    composed.dispose();
    const tierErrors: number[] = [];
    current = base;
    for (const budget of [RENDER_BUDGETS.medium, RENDER_BUDGETS.high]) {
      const backend = new WebGLBackend(
        canvas,
        gl,
        budget,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        seed,
        suppliedMotion,
      );
      backend.update(input);
      backend.resize(480, 480, 1);
      backend.render(0);
      tierErrors.push(gl.getError());
      backend.dispose();
    }
    return {
      coverage,
      tintAgreement: tintAgreement / coverage,
      lightSpatialDeviation: Math.sqrt(lightSquare / count - (lightSum / count) ** 2),
      paletteMeanDelta: paletteDelta / count,
      count,
      error,
      tierErrors,
    };
  });
  console.info("Isolated membrane/light/palette pixels:", result);
  expect(result.error).toBe(0);
  expect(result.tierErrors).toEqual([0, 0]);
  expect(result.count).toBeGreaterThan(5_000);
  expect(result.coverage).toBeGreaterThan(250);
  expect(result.tintAgreement).toBeGreaterThan(0.94);
  expect(result.lightSpatialDeviation).toBeGreaterThan(2);
  expect(result.paletteMeanDelta).toBeGreaterThan(1);
});
