import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import {
  createPeelDescriptors,
  createPeelGeometry,
  PEEL_VERTEX_STRIDE,
} from "../src/visual-engine/geometry";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MEMBRANE_RADIUS_BOUND, membraneOffsets } from "../src/visual-engine/membrane";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

describe("attached living membrane", () => {
  it("welds the hinge to the body at every flex phase while the free lip rises and returns", () => {
    for (const peel of createPeelDescriptors(6)) {
      const values = [];
      for (let phase = 0; phase < Math.PI * 2; phase += 0.15) {
        expect(membraneOffsets(0.1, 0, peel.lift, peel.curlRadius, peel.phase, phase)).toEqual([
          0, 0,
        ]);
        const offset = membraneOffsets(0.1, 1, peel.lift, peel.curlRadius, peel.phase, phase);
        expect(offset[0]).toBeGreaterThan(0.1);
        expect(offset[1]).toBeLessThan(-0.04);
        values.push(offset[0]);
      }
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0.025);
      expect(membraneOffsets(0.1, 1, peel.lift, peel.curlRadius, peel.phase, 0)[0]).toBeCloseTo(
        membraneOffsets(0.1, 1, peel.lift, peel.curlRadius, peel.phase, Math.PI * 2)[0],
        10,
      );
    }
  });
  it("has smooth short-step motion and stays inside the documented compound body/skin bound", () => {
    for (const peel of createPeelDescriptors(6))
      for (let phase = 0; phase < 6.3; phase += 0.3) {
        for (const u of [-1, -0.7, 0, 0.7, 1])
          for (const v of [0, 0.3, 0.7, 1]) {
            const a = membraneOffsets(
              u,
              v,
              peel.lift,
              peel.curlRadius,
              peel.phase,
              phase,
              1,
              0.075,
              1.15,
              1,
              0.12,
            );
            const b = membraneOffsets(
              u,
              v,
              peel.lift,
              peel.curlRadius,
              peel.phase,
              phase + 0.01,
              1,
              0.075,
              1.15,
              1,
              0.12,
            );
            expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeLessThan(0.003);
            expect(Math.hypot(1.18 + 0.04 + a[0], a[1]) * 1.06).toBeLessThan(MEMBRANE_RADIUS_BOUND);
          }
      }
  });
  it("stores smooth carrier/side derivatives without degenerate triangles or pole seams", () => {
    const mesh = createPeelGeometry(RENDER_BUDGETS.high);
    for (let i = 0; i < mesh.vertices.length; i += PEEL_VERTEX_STRIDE) {
      const n = Array.from(mesh.vertices.slice(i, i + 3)),
        du = Array.from(mesh.vertices.slice(i + 7, i + 10)),
        dv = Array.from(mesh.vertices.slice(i + 10, i + 13));
      const dot = (a: number[], b: number[]) => a.reduce((s, v, j) => s + v * b[j], 0);
      expect(Math.abs(dot(n, du))).toBeLessThan(0.001);
      expect(Math.abs(dot(n, dv))).toBeLessThan(0.001);
      expect(Math.hypot(...du)).toBeGreaterThan(0.5);
      expect(Math.hypot(...dv)).toBeGreaterThan(0.3);
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
