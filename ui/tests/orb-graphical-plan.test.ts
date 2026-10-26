import { describe, expect, it } from "vitest";
import { appearanceShaderSources } from "../src/visual-engine/webgl";
import { VF2_APPEARANCES, VF2_CASES, VF2_PLAN, VF2_SMOKE, vf2Frame } from "./fixtures/orb-vf2";
import { VF6_CASES, VF6_REFLECTION } from "./fixtures/orb-vf6";
import { frameAt, neutralFixtureMaterial, opaqueFilmAblation } from "./fixtures/visual-identity-II";

describe("V-F2 bounded hosted comparison inputs (CPU only)", () => {
  it("keeps one matched material/frame while varying only the selected structure", () => {
    expect(VF2_APPEARANCES).toEqual(["living-connected", "radial-shell-experimental"]);
    expect(VF2_PLAN.seed).toBe("0x5a17");
    const base = frameAt(0),
      frame = vf2Frame(VF2_SMOKE);
    expect(frame.peelTravel).toBeCloseTo(base.peelTravel + 1.8, 12);
    expect({ ...frame, peelTravel: base.peelTravel }).toEqual(base);
  });
  it("bounds captures and holds unrelated clocks through material and compact samples", () => {
    expect(VF2_CASES.length).toBeLessThanOrEqual(14);
    expect(new Set(VF2_CASES.map((sample) => sample.name)).size).toBe(VF2_CASES.length);
    const base = frameAt(0);
    for (const sample of VF2_CASES) {
      const frame = vf2Frame(sample);
      expect(frame.radius).toBe(sample.radius ?? base.radius);
      for (const key of ["spin", "precession", "lightPhase", "breathPhase", "ripplePhase"] as const)
        expect(frame[key]).toBe(base[key]);
    }
    expect(
      VF2_CASES.filter((sample) => sample.materialSeconds).map((sample) => sample.materialSeconds),
    ).toEqual([45, 300]);
  });
});

it("V-F6 optical ablation preserves neutral material after replacement and holds reflection clocks", () => {
  const glass = `#define SAM_FINE_OCTAVES 3\n${appearanceShaderSources("bipolar-film-experimental").skinFragment}`;
  // Match the actual nested shaderSource hooks: the outer hook neutralizes
  // first, then the inner optical replacement must neutralize its new source.
  const opaque = opaqueFilmAblation(neutralFixtureMaterial(glass), true);
  expect(opaque).toContain("#define SAM_FINE_OCTAVES 3");
  expect(opaque).toContain("pigment.albedo=vec3(.32)+");
  expect(opaque).toContain("filmPigment.albedo=vec3(.32)+");
  expect(opaqueFilmAblation(glass, false)).not.toContain("pigment.albedo=vec3(.32)+");
  expect(() => opaqueFilmAblation("no tier define", true)).toThrow("actual tier detail");
  expect(vf2Frame(VF6_REFLECTION)).toEqual(vf2Frame(VF6_CASES[0]));
  expect(VF6_REFLECTION.options).toEqual(VF6_CASES[0].options);
  expect(VF6_REFLECTION.yaw).not.toBe(VF6_CASES[0].yaw);
});
