import { describe, expect, it } from "vitest";
import {
  createParticleGeometry,
  createPeelDescriptors,
  createPeelGeometry,
  createSphereGeometry,
  PEEL_VERTEX_STRIDE,
  particleParameters,
} from "../src/visual-engine/geometry";
import {
  PARTICLE_GOLD,
  PARTICLE_POINT_SIZE_RANGE,
  PARTICLE_RADIUS_RANGE,
  particleIsVisible,
  particlePosition,
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
    expect(RENDER_BUDGETS.high.membraneDepthPass).toBe(true);
    expect(RENDER_BUDGETS.medium.membraneDepthPass).toBe(false);
    expect(RENDER_BUDGETS.low.membraneDepthPass).toBe(false);
    expect(RENDER_BUDGETS.high.particles).toBe(64);
  });

  it("uses identical deterministic broad sheets with bounded tier sampling", () => {
    const reference = createPeelDescriptors(RENDER_BUDGETS.high.peels);
    for (const budget of Object.values(RENDER_BUDGETS)) {
      expect(createPeelDescriptors(budget.peels)).toEqual(reference);
      const geometry = createPeelGeometry(budget);
      expect(geometry.vertices.length).toBe(
        budget.peels * (budget.peelSamples + 1) * (budget.peelRows + 1) * PEEL_VERTEX_STRIDE,
      );
      expect(geometry.indices.length).toBe(budget.peels * budget.peelSamples * budget.peelRows * 6);
      expect(Array.from(geometry.vertices).every(Number.isFinite)).toBe(true);
      expect(Math.max(...geometry.indices)).toBeLessThan(
        geometry.vertices.length / PEEL_VERTEX_STRIDE,
      );
      expect(createPeelGeometry(budget).vertices).toEqual(geometry.vertices);
    }
    const count = (budget: typeof RENDER_BUDGETS.high) =>
      createSphereGeometry(budget.sphereLongitude, budget.sphereLatitude).vertices.length / 6 +
      createPeelGeometry(budget).vertices.length / PEEL_VERTEX_STRIDE;
    expect(count(RENDER_BUDGETS.low)).toBeLessThan(count(RENDER_BUDGETS.medium) * 0.3);
    expect(count(RENDER_BUDGETS.medium)).toBeLessThan(count(RENDER_BUDGETS.high) * 0.65);
    expect(count(RENDER_BUDGETS.high)).toBeLessThanOrEqual(20_000);
  });

  it("keeps the restrained halo opacity bounded", () => {
    expect(HALO_OPACITY_SCALE).toBeLessThanOrEqual(0.08);
    expect(haloOpacity(0, 1)).toBeCloseTo(0.04);
    expect(haloOpacity(1, 1)).toBeCloseTo(HALO_OPACITY_SCALE);
  });

  it("creates bounded deterministic sparse particle parameters", () => {
    const lowParticles = createParticleGeometry(RENDER_BUDGETS.low.particles).vertices;
    const highParticles = createParticleGeometry(RENDER_BUDGETS.high.particles).vertices;
    expect(highParticles.slice(0, lowParticles.length)).toEqual(lowParticles);
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const particles = createParticleGeometry(budget.particles);
      expect(particles.count).toBe(budget.particles);
      expect(particles.vertices).toEqual(createParticleGeometry(budget.particles).vertices);
      const radii: number[] = [];
      for (let index = 0; index < particles.count; index++) {
        const particle = particleParameters(particles.vertices, index);
        radii.push(particle.radius);
        expect(particle.radius).toBeGreaterThanOrEqual(PARTICLE_RADIUS_RANGE.minimum);
        expect(particle.radius).toBeLessThanOrEqual(PARTICLE_RADIUS_RANGE.maximum);
        expect(particle.size).toBeGreaterThanOrEqual(PARTICLE_POINT_SIZE_RANGE.minimum);
        expect(particle.size).toBeLessThanOrEqual(PARTICLE_POINT_SIZE_RANGE.maximum);
        expect([-2, -1, 1, 2]).toContain(particle.cadence);
        expect(particle.opacity).toBeGreaterThanOrEqual(0.38);
        expect(particle.opacity).toBeLessThanOrEqual(0.73);
        expect(particle.tint).toBeGreaterThanOrEqual(0);
        expect(particle.tint).toBeLessThanOrEqual(1);
        for (const phase of [0, 0.7, 2.9, 5.6]) {
          const position = particlePosition(particle, phase, phase * 0.32);
          expect(Math.hypot(...position)).toBeGreaterThan(1.16);
          expect(Math.hypot(...position)).toBeLessThan(2.5);
        }
      }
      expect(radii.filter((value) => value < 1.45).length).toBeGreaterThan(2);
      expect(radii.filter((value) => value >= 1.45 && value < 2).length).toBeGreaterThan(1);
      expect(radii.some((value) => value > 2)).toBe(true);
      const inclinations = Array.from(
        { length: particles.count },
        (_, index) => particleParameters(particles.vertices, index).inclination,
      );
      expect(Math.max(...inclinations) - Math.min(...inclinations)).toBeGreaterThan(1);
    }
  });

  it("maps density to a deterministic visible share of actual gold particles", () => {
    const particles = createParticleGeometry(RENDER_BUDGETS.high.particles);
    const visibleAt = (density: number) => {
      let count = 0;
      for (let index = 0; index < particles.count; index++) {
        if (particleIsVisible(particleParameters(particles.vertices, index).phase, density))
          count++;
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
