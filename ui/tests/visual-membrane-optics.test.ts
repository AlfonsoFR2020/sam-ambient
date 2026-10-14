import { describe, expect, it } from "vitest";
import { createPeelDescriptors, peelDirection } from "../src/visual-engine/geometry";
import { sheetContact, sheetCoordinates } from "../src/visual-engine/membrane-optics";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { visualInput } from "./fixtures/visual-identity-II";

describe("membrane optical hierarchy", () => {
  it("uses the actual carrier inverse instead of unrelated shadow stripes", () => {
    for (const p of createPeelDescriptors(6))
      for (const u of [-0.8, -0.3, 0, 0.4, 0.8])
        for (const v of [0, 0.3, 0.7, 1]) {
          const [x, y] = sheetCoordinates(peelDirection(p, u, v), p);
          expect(x).toBeCloseTo(u, 6);
          expect(y).toBeCloseTo(v, 6);
        }
  });
  it("bounds contact, follows curl phase and leaves the opposite hemisphere unshadowed", () => {
    const m = new MotionEvaluator(0x5a17);
    const base = {
      ...m.evaluate(visualInput(0), 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.high),
    };
    for (const p of createPeelDescriptors(6)) {
      const n = peelDirection(p, 0, 0.4),
        a = sheetContact(n, p, base),
        b = sheetContact(n, p, { ...base, peelTravel: base.peelTravel + Math.PI });
      expect(Math.abs(a - b)).toBeGreaterThan(0.0001);
      expect(
        sheetContact(
          p.center.map((x) => -x),
          p,
          base,
        ),
      ).toBe(0);
      for (const phase of [0, 1, 3, 6.2831853])
        for (const u of [-1.1, -0.5, 0, 0.5, 1.1])
          for (const v of [-0.1, 0, 0.25, 0.5, 0.9, 1.1]) {
            const value = sheetContact(peelDirection(p, u, v), p, { ...base, peelTravel: phase });
            expect(Number.isFinite(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0.38);
          }
    }
  });
});
