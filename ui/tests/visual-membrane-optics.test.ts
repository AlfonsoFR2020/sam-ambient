import { describe, expect, it } from "vitest";
import { skinOffsets } from "../src/visual-engine/membrane";
import { skinContact, skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  createSkinOpenings,
  type SkinVector,
  skinDot,
  skinNormalize,
  skinRegion,
  skinRimRadius,
} from "../src/visual-engine/skin-domain";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { visualInput } from "./fixtures/visual-identity-II";

describe("connected skin optical footprint", () => {
  it("curls perpendicular to the actual irregular rim in spherical space", () => {
    for (const p of createSkinOpenings())
      for (const theta of [0, 0.6, 2.1, 4.8]) {
        const point = (angle: number): SkinVector => {
          const r = skinRimRadius(p, angle);
          return skinNormalize(
            p.center.map(
              (v, i) =>
                v +
                p.tangent[i] * (p.x + r * Math.cos(angle)) +
                p.side[i] * (p.y + r * Math.sin(angle)),
            ) as unknown as SkinVector,
          );
        };
        const n = point(theta),
          region = skinRegion(n, p),
          plus = point(theta + 1e-5),
          minus = point(theta - 1e-5);
        const tangent = skinNormalize(plus.map((v, i) => v - minus[i]) as unknown as SkinVector);
        expect(Math.abs(skinDot(region.inward, n))).toBeLessThan(1e-7);
        expect(Math.abs(skinDot(region.inward, tangent))).toBeLessThan(1e-5);
      }
  });
  it("recovers each real opening/collar rather than six obsolete carrier shadows", () => {
    for (const p of createSkinOpenings())
      for (const theta of [0, 1.1, 3, 5.6])
        for (const q of [0, 0.3, 0.8, 1]) {
          const r = skinRimRadius(p, theta) + p.collar * (1 - q);
          const n = skinNormalize(
            p.center.map(
              (v, i) =>
                v +
                p.tangent[i] * (p.x + r * Math.cos(theta)) +
                p.side[i] * (p.y + r * Math.sin(theta)),
            ) as unknown as SkinVector,
          );
          expect(skinRegion(n, p).q).toBeCloseTo(q, 8);
        }
  });
  it("bounds ambient contact and excludes the opposite hemisphere and exposed centers", () => {
    const frame = new MotionEvaluator(0x5a17).evaluate(
      visualInput(0),
      0,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.high,
    );
    const pose = skinPoseFromFrame(frame);
    for (const p of createSkinOpenings()) {
      const opposite = p.center.map((x) => -x) as unknown as SkinVector;
      expect(skinContact(opposite, p, pose, frame.radius, 0.004)).toBe(0);
      expect(skinContact(p.center, p, pose, frame.radius, 0.004)).toBe(0);
      for (const q of [0, 0.25, 0.6, 1]) {
        const r = skinRimRadius(p, 0) + p.collar * (1 - q);
        const n = skinNormalize(
          p.center.map(
            (v, i) => v + p.tangent[i] * (p.x + r) + p.side[i] * p.y,
          ) as unknown as SkinVector,
        );
        const a = skinContact(n, p, pose, frame.radius, 0.004);
        expect(Number.isFinite(a)).toBe(true);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(0.38);
        expect(skinOffsets(q, 0, p, pose).every(Number.isFinite)).toBe(true);
      }
    }
  });
});
