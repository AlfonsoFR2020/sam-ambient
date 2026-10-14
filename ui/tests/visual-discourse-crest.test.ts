import { describe, expect, it } from "vitest";
import { discourseCrest } from "../src/visual-engine/discourse-crest";

describe("shared discourse crest", () => {
  it("meets the same surface point across layers and reaches farther particles later", () => {
    const axis = [0.36, 0.84, 0.4],
      length = Math.hypot(...axis),
      n = axis.map((x) => x / length);
    const skin = n.map((x) => x * 1.15),
      near = n.map((x) => x * 1.7);
    const phase = (r: number) => 2.4 + 1.7 * (r - 1);
    expect(discourseCrest(n, 1, phase(1))).toBeCloseTo(1, 10);
    expect(discourseCrest(skin, 1, phase(1.15))).toBeCloseTo(1, 10);
    expect(discourseCrest(near, 1, phase(1.7))).toBeCloseTo(1, 10);
    expect(discourseCrest(near, 1, phase(1))).toBeLessThan(0.1);
  });
  it("is bounded and continuous at wrapped phase, independent of presentation cadence", () => {
    for (const point of [
      [0, 0, 0],
      [0.8, 0.3, 0.5],
      [-1.2, -0.8, 1],
      [2, 1, -1],
    ])
      for (const phase of [0, 0.02, 1, 3, 6.28]) {
        const value = discourseCrest(point, 1.115, phase);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(discourseCrest(point, 1.115, phase + 2 * Math.PI)).toBeCloseTo(value, 10);
      }
  });
});
