import { describe, expect, it } from "vitest";
import {
  createParticleGeometry,
  createPeelDescriptors,
  createPeelGeometry,
  createSphereGeometry,
  PEEL_LIFT_RANGE,
  PEEL_WIDTH_RANGE,
} from "../src/visual-engine/geometry";
import {
  PARTICLE_GOLD,
  PARTICLE_POINT_SIZE_RANGE,
  PARTICLE_SHELL_RANGE,
  particleIsVisible,
} from "../src/visual-engine/particles";
import {
  effectivePixelRatio,
  RENDER_BUDGETS,
  resolveRenderBudget,
} from "../src/visual-engine/quality";
import { resolveVisualEngineSettings } from "../src/visual-engine/settings";
import { HALO_OPACITY_SCALE, haloOpacity } from "../src/visual-engine/tuning";

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
    expect(resolveRenderBudget({ quality: "auto", deviceProfile: "high_end" }).quality).toBe(
      "high",
    );
    expect(
      resolveRenderBudget(
        { quality: "auto", deviceProfile: "high_end" },
        { measuredQuality: "high" },
      ).quality,
    ).toBe("high");
    expect(
      resolveRenderBudget(
        { quality: "auto", deviceProfile: "desktop" },
        { measuredQuality: "high" },
      ).quality,
    ).toBe("high");
  });

  it("enforces the formal mobile budget and DPR cap", () => {
    const budget = RENDER_BUDGETS.low;
    expect(budget).toMatchObject({
      fineOctaves: 0,
      peels: 6,
      peelSamples: 16,
      particles: 12,
      lights: 1,
      idleFps: 24,
      activeFps: 30,
      antialias: false,
    });
    expect(effectivePixelRatio(390, 844, 3, budget)).toBe(1);
    expect(RENDER_BUDGETS.medium.fineOctaves).toBe(1);
    expect(RENDER_BUDGETS.high.fineOctaves).toBe(2);
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
        expect(peel.width).toBeGreaterThanOrEqual(PEEL_WIDTH_RANGE.minimum);
        expect(peel.width).toBeLessThanOrEqual(PEEL_WIDTH_RANGE.maximum);
        expect(peel.lift).toBeGreaterThanOrEqual(PEEL_LIFT_RANGE.minimum);
        expect(peel.lift).toBeLessThanOrEqual(PEEL_LIFT_RANGE.maximum);
        expect(Math.abs(peel.tiltX)).toBeLessThanOrEqual(Math.PI / 4.5);
        expect(Math.abs(peel.tiltZ)).toBeLessThanOrEqual(Math.PI / 4.5);
      }
      expect(
        Math.max(...descriptors.map((peel) => peel.lift)) -
          Math.min(...descriptors.map((peel) => peel.lift)),
      ).toBeGreaterThan(0.004);
      expect(createPeelGeometry(budget).vertices).toEqual(geometry.vertices);
    }
  });

  it("keeps the restrained halo opacity bounded", () => {
    expect(HALO_OPACITY_SCALE).toBeLessThanOrEqual(0.08);
    expect(haloOpacity(0, 1)).toBeCloseTo(0.04);
    expect(haloOpacity(1, 1)).toBeCloseTo(HALO_OPACITY_SCALE);
  });

  it("keeps maximum peel displacement inside the Visual Engine radius bound", () => {
    const maximumDeformation = 0.04;
    const maximumLift = PEEL_LIFT_RANGE.maximum + 0.018;
    const maximumSpheroidDistance = (1.1 + maximumDeformation + maximumLift) * 1.06;
    expect(maximumSpheroidDistance).toBeLessThanOrEqual(1.31);
  });

  it("creates bounded deterministic sparse particle parameters", () => {
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const particles = createParticleGeometry(budget.particles);
      expect(particles.count).toBe(budget.particles);
      expect(particles.vertices).toEqual(createParticleGeometry(budget.particles).vertices);
      for (let index = 0; index < particles.count; index++) {
        expect(particles.vertices[index * 4 + 1]).toBeGreaterThanOrEqual(
          PARTICLE_SHELL_RANGE.minimum,
        );
        expect(particles.vertices[index * 4 + 1]).toBeLessThanOrEqual(PARTICLE_SHELL_RANGE.maximum);
        expect(particles.vertices[index * 4 + 3]).toBeGreaterThanOrEqual(
          PARTICLE_POINT_SIZE_RANGE.minimum,
        );
        expect(particles.vertices[index * 4 + 3]).toBeLessThanOrEqual(
          PARTICLE_POINT_SIZE_RANGE.maximum,
        );
      }
      const inclinations = Array.from(
        { length: particles.count },
        (_, index) => particles.vertices[index * 4 + 2],
      );
      expect(Math.max(...inclinations) - Math.min(...inclinations)).toBeGreaterThan(1);
    }
  });

  it("maps density to a deterministic visible share of actual gold particles", () => {
    const particles = createParticleGeometry(RENDER_BUDGETS.high.particles);
    const visibleAt = (density: number) => {
      let count = 0;
      for (let index = 0; index < particles.count; index++) {
        if (particleIsVisible(particles.vertices[index * 4], density)) count++;
      }
      return count;
    };

    expect(visibleAt(0)).toBe(0);
    expect(visibleAt(0.25)).toBeGreaterThan(0);
    expect(visibleAt(0.25)).toBeLessThan(visibleAt(0.75));
    expect(visibleAt(0.75)).toBeLessThan(visibleAt(1));
    expect(visibleAt(1)).toBe(particles.count);
    expect(PARTICLE_GOLD).toEqual({ red: 0.831, green: 0.686, blue: 0.216 });
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
