import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { PALETTE_BANKS, paletteBank, samplePalette } from "../src/visual-engine/palette";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const field = { broad: 0.46, medium: 0.52, palette: 0.45 };
const difference = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((x, i) => x - b[i]));
const frame = (cadence: number, reduced = false) => {
  const evaluator = new MotionEvaluator(42);
  const input = new VisualInputAdapter().ingest(
    { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
    0,
  );
  const settings = {
    ...DEFAULT_VISUAL_ENGINE_SETTINGS,
    surfaceFlow: 0,
    reducedMotion: reduced ? ("on" as const) : ("off" as const),
  };
  for (let i = 0; i <= cadence * 15; i++)
    evaluator.evaluate(input, (i * 1000) / cadence, settings, RENDER_BUDGETS.low);
  return evaluator.currentFrame;
};

describe("composed local palette evolution", () => {
  it("interpolates smoothly across every bank boundary and the wrapped clock", () => {
    for (const bank of PALETTE_BANKS)
      for (let k = 0; k <= 4; k++) {
        const t = (k * Math.PI) / 2;
        expect(difference(paletteBank(bank, t - 1e-5), paletteBank(bank, t + 1e-5))).toBeLessThan(
          1e-7,
        );
      }
  });
  it("changes fixed material regions over time without moving field coordinates", () => {
    const initial = samplePalette(field, 0.68, 1, [0.4, 1.1]).albedo;
    expect(
      difference(
        initial,
        samplePalette(field, 0.68, 1, [0.4 + 0.027 * 120, 1.1 + 0.016 * 120]).albedo,
      ),
    ).toBeGreaterThan(0.2);
    const upper = { broad: 0.85, medium: 0.5, palette: 0.85 };
    const lower = { broad: 0.2, medium: 0.6, palette: 0.25 };
    const delta = (f: typeof field) =>
      samplePalette(f, 0.68, 1, [2, 3]).albedo.map(
        (x, i) => x - samplePalette(f, 0.68, 1, [0.4, 1.1]).albedo[i],
      );
    expect(difference(delta(upper), delta(lower))).toBeGreaterThan(0.2);
  });
  it("retains bounds and meaningful red, green and blue regions across the composition", () => {
    const dominant = new Set<number>();
    for (const t of [0, 15, 45, 120, 300])
      for (let i = 0; i < 50; i++) {
        const f = { broad: i / 49, medium: ((i * 17) % 49) / 49, palette: i / 49 };
        const { albedo } = samplePalette(f, 0.68, 1, [0.4 + 0.027 * t, 1.1 + 0.016 * t]);
        for (const x of albedo) expect(x).toBeGreaterThanOrEqual(0);
        for (const x of albedo) expect(x).toBeLessThanOrEqual(1);
        if (Math.max(...albedo) - Math.min(...albedo) > 0.12)
          dominant.add(albedo.indexOf(Math.max(...albedo)));
      }
    expect([...dominant].sort()).toEqual([0, 1, 2]);
  });
  it("does not depend on cadence or Surface Flow, and freezes under Reduced Motion", () => {
    const a = frame(30),
      b = frame(60),
      still = frame(60, true);
    expect(a.palettePhase).toBeCloseTo(b.palettePhase, 9);
    expect(a.paletteContrastPhase).toBeCloseTo(b.paletteContrastPhase, 9);
    expect(a.fieldPhase1).toBe(b.fieldPhase1);
    expect(a.palettePhase).not.toBeCloseTo(still.palettePhase, 2);
    expect(still.palettePhase).toBeCloseTo(new MotionEvaluator(42).currentFrame.palettePhase, 9);
  });
});
