import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import {
  MEMBRANE_RADIUS_BOUND,
  type SkinPose,
  skinNormal,
  skinOffsets,
  skinPoint,
} from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  createSkinOpenings,
  type SkinVector,
  skinNormalize,
} from "../src/visual-engine/skin-domain";
import { createSkinGeometry } from "../src/visual-engine/skin-geometry";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { frameAt } from "./fixtures/visual-identity-II";

const REST_SKIN_POSE: SkinPose = {
  travel: 0,
  opening: 0.1,
  lift: 0.002,
  width: 1,
  coherence: 0.82,
  rephase: 0,
  work: 0,
  receptive: 0,
  speech: 0,
};

describe("body-attached connected skin", () => {
  it("keeps compact formation and departure skin samples finite", () => {
    const openings = createSkinOpenings(),
      mesh = createSkinGeometry(RENDER_BUDGETS.low);
    for (const radius of [0.46, 0.5, 0.83, 1]) {
      const body = (n: SkinVector): SkinVector => [
        n[0] * radius,
        n[1] * radius * 1.06,
        n[2] * radius,
      ];
      const point = (n: SkinVector) =>
        skinPoint(n, openings, REST_SKIN_POSE, body, RENDER_BUDGETS.low.skinClearance);
      for (let index = 0; index < mesh.vertices.length; index += 3 * 7) {
        const direction = skinNormalize([
          mesh.vertices[index],
          mesh.vertices[index + 1],
          mesh.vertices[index + 2],
        ]);
        expect(point(direction).every(Number.isFinite)).toBe(true);
        expect(skinNormal(direction, point).every(Number.isFinite)).toBe(true);
      }
    }
  });
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
          expect(a[0]).toBeCloseTo(b[0], 10);
          expect(a[1]).toBeCloseTo(b[1], 10);
          const wrap = skinOffsets(0.85, theta + 2 * Math.PI, p, pose);
          expect(a[0]).toBeCloseTo(wrap[0], 10);
          expect(a[1]).toBeCloseTo(wrap[1], 10);
          radii.push(a[0]);
        }
      expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(0.01);
      const derivative = (travel: number, theta: number, axis: "time" | "rim") => {
        const h = 1e-4;
        const a = skinOffsets(0.85, theta + (axis === "rim" ? h : 0), p, {
          ...REST_SKIN_POSE,
          travel: travel + (axis === "time" ? h : 0),
        });
        const b = skinOffsets(0.85, theta - (axis === "rim" ? h : 0), p, {
          ...REST_SKIN_POSE,
          travel: travel - (axis === "time" ? h : 0),
        });
        return a.map((v, i) => (v - b[i]) / (2 * h));
      };
      for (const axis of ["time", "rim"] as const) {
        const first = derivative(0, 0, axis),
          last = derivative(2 * Math.PI, 2 * Math.PI, axis);
        expect(first[0]).toBeCloseTo(last[0], 7);
        expect(first[1]).toBeCloseTo(last[1], 7);
      }
    }
  });
  it("keeps full-surface points and normals finite through extreme existing cues", () => {
    const openings = createSkinOpenings();
    const body = (n: SkinVector): SkinVector => [n[0] * 1.22, n[1] * 1.22 * 1.06, n[2] * 1.22];
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const mesh = createSkinGeometry(budget);
      for (const travel of [0, 1.5, Math.PI * 2 - 1e-5, Math.PI * 2 + 1e-5]) {
        const pose = {
          ...REST_SKIN_POSE,
          travel,
          lift: 0.075,
          width: 1.15,
          coherence: 1,
          work: 1,
          speech: 1,
          rephase: 0.12,
        };
        const point = (n: SkinVector) => skinPoint(n, openings, pose, body, budget.skinClearance);
        // Sample every chart and rim while keeping this focused regression bounded.
        for (let i = 0; i < mesh.vertices.length; i += 3 * 13) {
          const n = skinNormalize([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]);
          const position = point(n),
            normal = skinNormal(n, point);
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
  it("keeps zero Audio Reactivity neutral at the actual skin map, retaining autonomous life", () => {
    const loud = frameAt(800, "speaking", 0.5, 0),
      silent = frameAt(800, "speaking", 0, 0);
    const openings = createSkinOpenings(),
      n = skinNormalize([0.8, 0.2, 0.7]);
    const body = (d: SkinVector): SkinVector => [d[0], d[1] * 1.06, d[2]];
    expect(skinPoint(n, openings, skinPoseFromFrame(loud), body, 0.004)).toEqual(
      skinPoint(n, openings, skinPoseFromFrame(silent), body, 0.004),
    );
    expect(frameAt(0).peelTravel).not.toBe(loud.peelTravel);
  });
  it("keeps deformed triangles nondegenerate at rim, hinge and permitted extremes", () => {
    const openings = createSkinOpenings(),
      body = (n: SkinVector): SkinVector => [n[0], n[1] * 1.06, n[2]];
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const mesh = createSkinGeometry(budget);
      for (const pose of [
        REST_SKIN_POSE,
        { ...REST_SKIN_POSE, work: 1, speech: 1, lift: 0.075, width: 1.15, rephase: 0.12 },
        { ...REST_SKIN_POSE, receptive: 1, travel: Math.PI },
      ]) {
        const points: SkinVector[] = [];
        for (let i = 0; i < mesh.vertices.length; i += 3)
          points.push(
            skinPoint(
              skinNormalize([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]),
              openings,
              pose,
              body,
              budget.skinClearance,
            ),
          );
        for (let i = 0; i < mesh.indices.length; i += 3) {
          const [a, b, c] = Array.from(mesh.indices.slice(i, i + 3), (v) => points[v]);
          const ab = b.map((v, j) => v - a[j]),
            ac = c.map((v, j) => v - a[j]);
          const area = Math.hypot(
            ab[1] * ac[2] - ab[2] * ac[1],
            ab[2] * ac[0] - ab[0] * ac[2],
            ab[0] * ac[1] - ab[1] * ac[0],
          );
          expect(area).toBeGreaterThan(1e-8);
        }
      }
    }
  });
});
