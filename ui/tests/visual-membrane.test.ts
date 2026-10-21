import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { skinNormal, skinOffsets, skinPoint, MEMBRANE_RADIUS_BOUND, type SkinPose } from "../src/visual-engine/membrane";
import { createSkinOpenings, skinNormalize, type SkinVector } from "../src/visual-engine/skin-domain";
import { createSkinGeometry } from "../src/visual-engine/skin-geometry";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

export const REST_SKIN_POSE: SkinPose = { travel: 0, opening: 0.1, lift: 0.002, width: 1,
  coherence: 0.82, rephase: 0, work: 0, receptive: 0, speech: 0 };

describe("body-attached connected skin", () => {
  it("has C1 hinges, periodic rim/clock derivatives and real free-edge flex", () => {
    for (const p of createSkinOpenings()) {
      const radii: number[] = [];
      for (const theta of [0, 0.4, 1.8, Math.PI * 2])
        for (const travel of [0, 0.7, 3.1, Math.PI * 2]) {
          const pose = { ...REST_SKIN_POSE, travel };
          expect(skinOffsets(0, theta, p, pose)).toEqual([0, 0]);
          expect(Math.hypot(...skinOffsets(1e-5, theta, p, pose))).toBeLessThan(1e-9);
          const a = skinOffsets(0.85, theta, p, pose);
          const b = skinOffsets(0.85, theta, p, { ...pose, travel: travel + 2 * Math.PI });
          expect(a[0]).toBeCloseTo(b[0], 10); expect(a[1]).toBeCloseTo(b[1], 10);
          const wrap = skinOffsets(0.85, theta + 2 * Math.PI, p, pose);
          expect(a[0]).toBeCloseTo(wrap[0], 10); expect(a[1]).toBeCloseTo(wrap[1], 10);
          radii.push(a[0]);
        }
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.01);
    }
  });
  it("keeps full-surface points and normals finite through extreme existing cues", () => {
    const openings = createSkinOpenings();
    const body = (n: SkinVector): SkinVector => [n[0] * 1.22, n[1] * 1.22 * 1.06, n[2] * 1.22];
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const mesh = createSkinGeometry(budget);
      for (const travel of [0, 1.5, Math.PI * 2 - 1e-5, Math.PI * 2 + 1e-5]) {
        const pose = { ...REST_SKIN_POSE, travel, lift: 0.075, width: 1.15, coherence: 1, work: 1, speech: 1, rephase: 0.12 };
        const point = (n: SkinVector) => skinPoint(n, openings, pose, body, budget.skinClearance);
        // Sample every chart and rim while keeping this focused regression bounded.
        for (let i = 0; i < mesh.vertices.length; i += 3 * 13) {
          const n = skinNormalize([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]);
          const position = point(n), normal = skinNormal(n, point);
          expect(position.every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...position)).toBeLessThan(MEMBRANE_RADIUS_BOUND);
          expect(normal.every(Number.isFinite)).toBe(true);
          expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
        }
      }
    }
  });
  it("owns a geometry clock independent of Surface Flow and freezes it under Reduced Motion", () => {
    const adapter = new VisualInputAdapter();
    const input = adapter.ingest(
      {
        ...INITIAL_UI_STATE,
        connection: "connected",
        provider: "local",
        model: "model",
        conversationalState: "IDLE",
      },
      0,
    );
    const motion = new MotionEvaluator();
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, surfaceFlow: 0 };
    const first = { ...motion.evaluate(input, 0, settings, RENDER_BUDGETS.high) };
    for (let t = 20; t <= 4000; t += 20) motion.evaluate(input, t, settings, RENDER_BUDGETS.high);
    const moving = { ...motion.currentFrame };
    expect(moving.peelTravel).not.toBe(first.peelTravel);
    expect(moving.fieldPhase1).toBe(first.fieldPhase1);
    for (let t = 4020; t <= 8000; t += 20)
      motion.evaluate(input, t, { ...settings, reducedMotion: "on" }, RENDER_BUDGETS.high);
    expect(motion.currentFrame.peelTravel).toBe(moving.peelTravel);
  });
});
