import { describe, expect, it } from "vitest";
import { createParticleGeometry, particleParameters } from "../src/visual-engine/geometry";
import { LIVING_MATERIAL_GLSL } from "../src/visual-engine/living-material";
import { particlePosition } from "../src/visual-engine/particles";
import { ORB_VERTEX, PARTICLE_VERTEX, PEEL_VERTEX } from "../src/visual-engine/webgl";

describe("wrapped visual phase continuity", () => {
  it("never multiplies a wrapped phase by a fractional cadence in the shaders", () => {
    for (const source of [ORB_VERTEX, PEEL_VERTEX, PARTICLE_VERTEX, LIVING_MATERIAL_GLSL]) {
      expect(source).not.toMatch(
        /u_(?:peel_travel|breath_phase|ripple_phase|light_phase|phase)\s*\*\s*0?\.\d/,
      );
    }
    expect(PEEL_VERTEX).toContain("sin(u_peel_travel+a_motion.y)");
    expect(PEEL_VERTEX).toContain("v_object_direction=direction");
    expect(PARTICLE_VERTEX).toContain("u_phase*a_style.y");
    expect(PARTICLE_VERTEX).not.toContain("u_object_orientation");
    expect(LIVING_MATERIAL_GLSL).not.toMatch(/ripplePhase\s*\*\s*0?\.\d/);
    expect(PARTICLE_VERTEX).not.toMatch(/angle\s*\*\s*0?\.\d/);
    for (const harmonic of [1, 2]) {
      const before = Math.sin(harmonic * (2 * Math.PI - 0.0001) + 0.7);
      const after = Math.sin(harmonic * 0.0001 + 0.7);
      expect(Math.abs(after - before)).toBeLessThan(0.0005);
    }
    const particles = createParticleGeometry(40);
    for (let index = 0; index < particles.count; index++) {
      const particle = particleParameters(particles.vertices, index);
      const before = particlePosition(particle, 2 * Math.PI - 0.0001, 1.4);
      const after = particlePosition(particle, 0.0001, 1.4);
      expect(Math.hypot(...after.map((value, axis) => value - before[axis]))).toBeLessThan(0.002);
    }
  });
});
