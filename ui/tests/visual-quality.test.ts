import { describe, expect, it } from "vitest";
import {
  createPeelDescriptors,
  createPeelGeometry,
  createSphereGeometry,
} from "../src/visual-engine/geometry";
import {
  effectivePixelRatio,
  RENDER_BUDGETS,
  resolveRenderBudget,
} from "../src/visual-engine/quality";
import { resolveVisualEngineSettings } from "../src/visual-engine/settings";

describe("visual quality and geometry", () => {
  it("starts auto conservatively and honors device profile caps", () => {
    expect(resolveRenderBudget({ quality: "auto", deviceProfile: "auto" }).quality).toBe("low");
    expect(resolveRenderBudget({ quality: "high", deviceProfile: "auto" }).quality).toBe("high");
    expect(resolveRenderBudget({ quality: "high", deviceProfile: "mobile_2020" }).quality).toBe(
      "low",
    );
    expect(resolveRenderBudget({ quality: "auto", deviceProfile: "desktop" }).quality).toBe(
      "medium",
    );
    expect(
      resolveRenderBudget(
        { quality: "auto", deviceProfile: "high_end" },
        { measuredQuality: "high" },
      ).quality,
    ).toBe("high");
  });

  it("enforces the formal mobile budget and DPR cap", () => {
    const budget = RENDER_BUDGETS.low;
    expect(budget).toMatchObject({
      peels: 6,
      peelSamples: 16,
      lights: 1,
      idleFps: 24,
      activeFps: 30,
      antialias: false,
    });
    expect(effectivePixelRatio(390, 844, 3, budget)).toBe(1);
  });

  it("creates deterministic bounded fragmented peels in one geometry batch", () => {
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const descriptors = createPeelDescriptors(budget.peels);
      const geometry = createPeelGeometry(budget);
      expect(descriptors).toHaveLength(budget.peels);
      expect(geometry.vertices.length).toBe(budget.peels * budget.peelSamples * 2 * 12);
      expect(geometry.indices.length).toBe(budget.peels * (budget.peelSamples - 1) * 6);
      for (const peel of descriptors) {
        expect(peel.halfLength).toBeGreaterThanOrEqual(0.22);
        expect(peel.halfLength).toBeLessThanOrEqual(0.58);
        expect(peel.width).toBeGreaterThanOrEqual(0.018);
        expect(peel.width).toBeLessThanOrEqual(0.055);
        expect(peel.lift).toBeGreaterThanOrEqual(0.01);
        expect(peel.lift).toBeLessThanOrEqual(0.032);
      }
      expect(createPeelGeometry(budget).vertices).toEqual(geometry.vertices);
    }
  });

  it("bounds sphere topology and validates session settings", () => {
    const sphere = createSphereGeometry(48, 24);
    expect(sphere.vertices.length / 6).toBe(1225);
    expect(sphere.indices.length / 3).toBe(2208);
    expect(() => resolveVisualEngineSettings({ intensity: Number.NaN })).toThrow(/intensity/);
    expect(resolveVisualEngineSettings({ deviceProfile: "mobile_2020" }).deviceProfile).toBe(
      "mobile_2020",
    );
  });
});
