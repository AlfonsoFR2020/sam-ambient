import { describe, expect, it } from "vitest";
import { VF2_APPEARANCES, VF2_CASES, VF2_PLAN, VF2_SMOKE, vf2Frame } from "./fixtures/orb-vf2";
import { frameAt } from "./fixtures/visual-identity-II";

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
