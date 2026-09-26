import { expect, test } from "@playwright/test";

test("particle field reaches beyond the Orb, respects depth, and stays world anchored", async ({
  page,
}) => {
  await page.goto("/?transport=demo");
  const result = await page.evaluate(async () => {
    const [
      { INITIAL_UI_STATE },
      { createParticleGeometry, particleParameters },
      { VisualInputAdapter },
      { MotionEvaluator },
      { particlePosition },
      { RENDER_BUDGETS },
      { DEFAULT_VISUAL_ENGINE_SETTINGS },
      { WebGLBackend },
    ] = await Promise.all([
      import("../../src/protocol/types"),
      import("../../src/visual-engine/geometry"),
      import("../../src/visual-engine/input"),
      import("../../src/visual-engine/motion"),
      import("../../src/visual-engine/particles"),
      import("../../src/visual-engine/quality"),
      import("../../src/visual-engine/types"),
      import("../../src/visual-engine/webgl"),
    ]);
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 is required for the particle depth regression");
    const seed = 0x5a17;
    const input = new VisualInputAdapter().ingest(
      { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
      0,
    );
    const motion = new MotionEvaluator(seed);
    const base = {
      ...motion.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.high),
    };
    let current = base;
    const supplied = { evaluate: () => current } as unknown as InstanceType<typeof MotionEvaluator>;
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, particleDensity: 1 };
    const bare = new WebGLBackend(
      canvas,
      gl,
      { ...RENDER_BUDGETS.high, particles: 0 },
      settings,
      seed,
      supplied,
    );
    const full = new WebGLBackend(canvas, gl, RENDER_BUDGETS.high, settings, seed, supplied);
    bare.update(input);
    full.update(input);
    bare.resize(480, 480, 1);
    full.resize(480, 480, 1);
    const read = (backend: InstanceType<typeof WebGLBackend>) => {
      backend.render(0);
      const pixels = new Uint8Array(480 * 480 * 4);
      gl.readPixels(0, 0, 480, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const noParticles = read(bare);
    const particles = read(full);
    const deltaAt = (a: Uint8Array, b: Uint8Array, x: number, y: number) => {
      let maximum = 0;
      for (let oy = -3; oy <= 3; oy++) {
        for (let ox = -3; ox <= 3; ox++) {
          const px = x + ox,
            py = y + oy;
          if (px < 0 || py < 0 || px >= 480 || py >= 480) continue;
          const at = (py * 480 + px) * 4;
          maximum = Math.max(
            maximum,
            Math.abs(a[at] - b[at]) +
              Math.abs(a[at + 1] - b[at + 1]) +
              Math.abs(a[at + 2] - b[at + 2]),
          );
        }
      }
      return maximum;
    };
    const geometry = createParticleGeometry(RENDER_BUDGETS.high.particles, seed);
    let farVisible = 0,
      rearOutsideVisible = 0,
      rearInsideCandidates = 0,
      rearInsideLeaks = 0;
    for (let index = 0; index < geometry.count; index++) {
      const position = particlePosition(
        particleParameters(geometry.vertices, index),
        base.particlePhase,
        base.particleDriftPhase,
      ).map((value) => value * base.radius);
      const x = Math.round(240 + position[0] * 0.56 * 240);
      const y = Math.round(240 + position[1] * 0.56 * 240);
      if (x < 8 || y < 8 || x >= 472 || y >= 472) continue;
      const projected = Math.hypot(x - 240, y - 240) / (0.56 * 240 * base.radius);
      const changed = deltaAt(noParticles, particles, x, y) > 12;
      if (projected > 1.55 && changed) farVisible++;
      if (position[2] < 0 && projected > 1.35 && changed) rearOutsideVisible++;
      if (position[2] < 0 && projected < 1) {
        rearInsideCandidates++;
        if (changed) rearInsideLeaks++;
      }
    }
    const rotated = new Float32Array([0, 0, -1, 0, 1, 0, 1, 0, 0]);
    bare.setObjectOrientation(rotated);
    full.setObjectOrientation(rotated);
    const rotatedBare = read(bare);
    const rotatedFull = read(full);
    let exteriorDifference = 0;
    for (let y = 0; y < 480; y++) {
      for (let x = 0; x < 480; x++) {
        if (Math.hypot(x - 240, y - 240) < 1.55 * 0.56 * 240 * base.radius) continue;
        const at = (y * 480 + x) * 4;
        for (let channel = 0; channel < 3; channel++)
          exteriorDifference += Math.abs(
            particles[at + channel] -
              noParticles[at + channel] -
              (rotatedFull[at + channel] - rotatedBare[at + channel]),
          );
      }
    }
    current = {
      ...base,
      reactivity: { ...base.reactivity, particleSpread: 0.14, particleOpacity: 0.26 },
    };
    const excited = read(full);
    let excitedDifference = 0;
    for (let at = 0; at < particles.length; at += 4)
      excitedDifference += Math.abs(excited[at] - rotatedFull[at]);
    const errors = [gl.getError()];
    bare.dispose();
    full.dispose();
    for (const budget of [RENDER_BUDGETS.low, RENDER_BUDGETS.medium]) {
      const backend = new WebGLBackend(canvas, gl, budget, settings, seed, supplied);
      backend.update(input);
      backend.resize(480, 480, 1);
      backend.render(0);
      errors.push(gl.getError());
      backend.dispose();
    }
    return {
      farVisible,
      rearOutsideVisible,
      rearInsideCandidates,
      rearInsideLeaks,
      exteriorDifference,
      excitedDifference,
      errors,
    };
  });
  console.info("Isolated particle depth/coverage:", result);
  expect(result.errors).toEqual([0, 0, 0]);
  expect(result.farVisible).toBeGreaterThan(0);
  expect(result.rearOutsideVisible).toBeGreaterThan(0);
  expect(result.rearInsideCandidates).toBeGreaterThan(0);
  expect(result.rearInsideLeaks).toBe(0);
  expect(result.exteriorDifference).toBe(0);
  expect(result.excitedDifference).toBeGreaterThan(100);
});
