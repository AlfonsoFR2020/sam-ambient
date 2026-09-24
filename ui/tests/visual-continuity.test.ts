import { describe, expect, it } from "vitest";
import { LIVING_MATERIAL_GLSL } from "../src/visual-engine/living-material";
import { ORB_VERTEX, PARTICLE_VERTEX, PEEL_VERTEX } from "../src/visual-engine/webgl";

describe("wrapped visual phase continuity", () => {
  it("never multiplies a wrapped phase by a fractional cadence in the shaders", () => {
    for (const source of [ORB_VERTEX, PEEL_VERTEX, PARTICLE_VERTEX, LIVING_MATERIAL_GLSL]) {
      expect(source).not.toMatch(
        /u_(?:peel_travel|breath_phase|ripple_phase|light_phase|phase)\s*\*\s*0?\.\d/,
      );
    }
    expect(PEEL_VERTEX).toContain("float cadence=abs(a_motion.x)<.012?1.:2.;");
    expect(PEEL_VERTEX).toContain("v_facing=1.");
    expect(PARTICLE_VERTEX).toContain("float cadence=rank<.5?1.:2.;");
    expect(LIVING_MATERIAL_GLSL).not.toMatch(/ripplePhase\s*\*\s*0?\.\d/);
    expect(PARTICLE_VERTEX).not.toMatch(/angle\s*\*\s*0?\.\d/);
    for (const harmonic of [1, 2]) {
      const before = Math.sin(harmonic * (2 * Math.PI - 0.0001) + 0.7);
      const after = Math.sin(harmonic * 0.0001 + 0.7);
      expect(Math.abs(after - before)).toBeLessThan(0.0005);
    }
  });
});
