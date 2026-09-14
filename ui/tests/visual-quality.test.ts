import { describe, expect, it } from "vitest";
import {
  createParticleGeometry,
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
      particles: 12,
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
        expect(peel.width).toBeGreaterThanOrEqual(0.042);
        expect(peel.width).toBeLessThanOrEqual(0.1);
        expect(peel.lift).toBeGreaterThanOrEqual(0.02);
        expect(peel.lift).toBeLessThanOrEqual(0.05);
        expect(Math.abs(peel.tiltX)).toBeLessThanOrEqual(Math.PI / 4.5);
        expect(Math.abs(peel.tiltZ)).toBeLessThanOrEqual(Math.PI / 4.5);
      }
      expect(createPeelGeometry(budget).vertices).toEqual(geometry.vertices);
    }
  });

  it("creates bounded deterministic sparse particle parameters", () => {
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const particles = createParticleGeometry(budget.particles);
      expect(particles.count).toBe(budget.particles);
      expect(particles.vertices).toEqual(createParticleGeometry(budget.particles).vertices);
      for (let index = 0; index < particles.count; index++) {
        expect(particles.vertices[index * 4 + 1]).toBeGreaterThanOrEqual(1.1);
        expect(particles.vertices[index * 4 + 1]).toBeLessThanOrEqual(1.4);
      }
    }
  });

  it("bounds sphere topology and validates session settings", () => {
    expect(createSphereGeometry(32, 16).vertices.length / 6).toBe(561);
    const sphere = createSphereGeometry(72, 36);
    expect(sphere.vertices.length / 6).toBe(2701);
    expect(sphere.indices.length / 3).toBe(5040);
    expect(createSphereGeometry(96, 48).indices.length / 3).toBe(9024);
    expect(() => resolveVisualEngineSettings({ intensity: Number.NaN })).toThrow(/intensity/);
    expect(resolveVisualEngineSettings({ deviceProfile: "mobile_2020" }).deviceProfile).toBe(
      "mobile_2020",
    );
  });
});
