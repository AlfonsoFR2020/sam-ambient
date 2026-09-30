import { describe, expect, it } from "vitest";
import {
  createParticleGeometry,
  createPeelDescriptors,
  createPeelGeometry,
  createSphereGeometry,
  PEEL_EDGE_LIFT,
  PEEL_LIFT_RANGE,
  PEEL_WIDTH_RANGE,
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
  });

  it("creates deterministic bounded fragmented peels in one geometry batch", () => {
    // The body mesh is already subpixel smooth at a normal desktop radius;
    // high-tier membrane edges need enough samples to avoid imposing facets.
    expect(1 - Math.cos(Math.PI / RENDER_BUDGETS.high.sphereLatitude)).toBeLessThan(0.0022);
    expect(RENDER_BUDGETS.high.peelSamples).toBeGreaterThanOrEqual(40);
    expect(RENDER_BUDGETS.high.peelSamples).toBeGreaterThan(RENDER_BUDGETS.medium.peelSamples);
    expect(
      createPeelDescriptors(RENDER_BUDGETS.high.peels).slice(0, RENDER_BUDGETS.low.peels),
    ).toEqual(createPeelDescriptors(RENDER_BUDGETS.low.peels));
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const descriptors = createPeelDescriptors(budget.peels);
      const geometry = createPeelGeometry(budget);
      expect(descriptors).toHaveLength(budget.peels);
      expect(geometry.vertices.length).toBe(budget.peels * (1 + budget.peelSamples * 3) * 10);
      expect(geometry.indices.length).toBe(budget.peels * budget.peelSamples * 15);
      for (const peel of descriptors) {
        expect(Math.hypot(...peel.center)).toBeCloseTo(1);
        expect(peel.angularRadius).toBeGreaterThanOrEqual(PEEL_WIDTH_RANGE.minimum);
        expect(peel.angularRadius).toBeLessThanOrEqual(PEEL_WIDTH_RANGE.maximum);
        expect(peel.lift).toBeGreaterThanOrEqual(PEEL_LIFT_RANGE.minimum);
        expect(peel.lift).toBeLessThanOrEqual(PEEL_LIFT_RANGE.maximum);
        expect(peel.opacity).toBeGreaterThanOrEqual(0.9);
      }
      expect(
        Math.max(...descriptors.map((peel) => peel.lift)) -
          Math.min(...descriptors.map((peel) => peel.lift)),
      ).toBeGreaterThan(0.004);
      expect(createPeelGeometry(budget).vertices).toEqual(geometry.vertices);
      const patchVertices = 1 + budget.peelSamples * 3;
      for (let patch = 0; patch < budget.peels; patch++) {
        const start = patch * patchVertices * 10;
        expect(geometry.vertices[start + 3]).toBe(0);
        expect(geometry.vertices[start + (patchVertices - 1) * 10 + 3]).toBe(1);
        const radii = new Set<number>();
        for (let sample = 0; sample < budget.peelSamples; sample++) {
          const at = start + (1 + budget.peelSamples * 2 + sample) * 10;
          const center = descriptors[patch].center;
          const dot =
            center[0] * geometry.vertices[at] +
            center[1] * geometry.vertices[at + 1] +
            center[2] * geometry.vertices[at + 2];
          radii.add(Math.round(Math.acos(dot) * 1000));
        }
        expect(radii.size).toBeGreaterThan(3);
      }
    }
  });

  it("keeps the restrained halo opacity bounded", () => {
    expect(HALO_OPACITY_SCALE).toBeLessThanOrEqual(0.08);
    expect(haloOpacity(0, 1)).toBeCloseTo(0.04);
    expect(haloOpacity(1, 1)).toBeCloseTo(HALO_OPACITY_SCALE);
  });

  it("keeps maximum peel displacement inside the Visual Engine radius bound", () => {
    const maximumDeformation = 0.04;
    const maximumLift = PEEL_EDGE_LIFT + (PEEL_LIFT_RANGE.maximum + 0.018) * 1.07 * 1.05;
    const maximumSpheroidDistance = (1.14 + maximumDeformation + maximumLift) * 1.06;
    expect(maximumSpheroidDistance).toBeLessThanOrEqual(1.38);
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
