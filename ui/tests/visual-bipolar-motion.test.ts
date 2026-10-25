import { describe, expect, it } from "vitest";
import * as candidate from "../src/visual-engine/bipolar-peel";
import {
  bipolarBasis,
  bipolarLift,
  bipolarParameter,
  bipolarPeelPoint,
  createBipolarPeels,
} from "../src/visual-engine/bipolar-peel";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { type SkinVector, skinDot } from "../src/visual-engine/skin-domain";
import { bipolarTriangles, clearancePoses } from "./fixtures/bipolar-clearance";
import { vf5SequenceFrames } from "./fixtures/orb-vf5";
import { subtract } from "./fixtures/skin-analysis";
import { surfaceClearance } from "./fixtures/triangle-clearance";

describe("V-F5 differentiated continuous deformation", () => {
  const peels = createBipolarPeels();
  it("retains C1 roots and outward body clearance through the continuous sequence", () => {
    const frames = vf5SequenceFrames();
    expect(frames.filter((s) => s.name.startsWith("time-")).length).toBeGreaterThanOrEqual(18);
    for (const { frame } of frames) {
      const pose = skinPoseFromFrame(frame),
        r = frame.radius;
      for (const [i, p] of peels.entries())
        for (const t of [0.04, 0.08, 0.2, 0.55, 0.85, 1])
          for (const v of [-1, 0, 1]) {
            const body = (n: SkinVector): SkinVector => [n[0] * r, n[1] * r * 1.06, n[2] * r];
            const material = bipolarBasis(p, t, v).material,
              point = bipolarPeelPoint(bipolarParameter(p, t, v), peels, pose, body, 0.004);
            const d = subtract(point, body(material));
            const radial = skinDot([d[0], d[1] / 1.06, d[2]], material);
            expect(radial).toBeGreaterThanOrEqual(0.00399);
            if (t > 0.2) expect(radial).toBeGreaterThan(0.02 * r);
            if (t <= 0.08)
              expect(
                Math.hypot(
                  ...subtract(d, [
                    0.004 * material[0],
                    0.004 * material[1] * 1.06,
                    0.004 * material[2],
                  ]),
                ),
              ).toBeLessThan(1e-12);
            expect(bipolarLift(t, v, i, p, pose).every(Number.isFinite)).toBe(true);
          }
    }
  });
  it("genuine late speech changes bend and twist, with autonomous motion surviving silence", () => {
    const frames = vf5SequenceFrames();
    const late = skinPoseFromFrame(
      frames.find((s) => s.name === "speech-quiet")?.frame ?? frames[0].frame,
    );
    const changes = peels.map((p, i) => {
      const a = bipolarLift(0.8, 0.4, i, p, late),
        b = bipolarLift(0.8, 0.4, i, p, { ...late, speech: 0 });
      expect(Math.abs(a[1] - b[1])).toBeGreaterThan(0.0002);
      expect(Math.abs(a[2] - b[2])).toBeGreaterThan(0.001);
      return a[2] - b[2];
    });
    expect(Math.max(...changes) - Math.min(...changes)).toBeGreaterThan(0.0001);
    const silent = skinPoseFromFrame(
      frames.find((s) => s.name === "speech-silence")?.frame ?? frames[0].frame,
    );
    for (const [i, p] of peels.entries()) {
      expect(bipolarLift(0.8, 0, i, p, silent)[0]).toBeGreaterThan(0.05);
      expect(
        Math.hypot(
          ...subtract(
            bipolarLift(0.8, 0, i, p, silent),
            bipolarLift(0.8, 0, i, p, { ...silent, travel: silent.travel + 0.1 }),
          ),
        ),
      ).toBeGreaterThan(0.0001);
    }
  });
  it("clearance survives additional phase/state transitions without a frame collision solver", () => {
    const base = clearancePoses()[0].pose;
    for (let i = 0; i < 16; i++) {
      const pose = {
        ...base,
        travel: (i * Math.PI) / 8,
        speech: i % 3 === 0 ? 1 : 0,
        work: i % 3 === 1 ? 1 : 0,
        settling: i % 3 === 2 ? 1 : 0,
        rephase: i % 4 === 0 ? 1 : 0,
      };
      const report = surfaceClearance(bipolarTriangles(candidate, pose, "medium"), 0.025);
      expect(
        report.pairs.filter((p) => p.intersections || (p.surfaces[0] !== p.surfaces[1] && p.near)),
        `phase ${i}`,
      ).toEqual([]);
    }
  });
});
