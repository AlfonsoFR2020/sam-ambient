import { describe, expect, it } from "vitest";
import { drawField, FIELD_BUDGET, fieldPoint, fieldRadius, fieldShape } from "../src/ambient/field";
import { toAmbientVisualModel } from "../src/ambient/model";
import { CONVERSATIONAL_STATES, INITIAL_UI_STATE } from "../src/protocol/types";

describe("bounded ambient field", () => {
  it("has distinct silent geometry for the five principal states", () => {
    const identities = ["IDLE", "LISTENING", "COMMITTING", "THINKING", "SPEAKING"] as const;
    const shapes = identities.map((conversationalState) =>
      fieldShape(
        toAmbientVisualModel({
          ...INITIAL_UI_STATE,
          conversationalState,
        }),
      ),
    );
    expect(new Set(shapes.map((shape) => JSON.stringify(shape))).size).toBe(5);
  });
  it("articulates output without relying on microphone energy", () => {
    const model = toAmbientVisualModel({ ...INITIAL_UI_STATE, conversationalState: "SPEAKING" });
    expect(fieldShape({ ...model, pulse: 1 }).amplitude).toBeGreaterThan(
      fieldShape(model).amplitude * 3,
    );
  });
  it("scales with both viewport axes and bounds high-density rendering", () => {
    expect(fieldRadius(1440, 900)).toBeGreaterThan(fieldRadius(390, 700) * 2);
    expect(fieldRadius(800, 400)).toBeLessThan(200);
    expect(FIELD_BUDGET.particles).toBeLessThanOrEqual(80);
    expect(FIELD_BUDGET.pixelRatio).toBeLessThanOrEqual(1.5);
    expect(FIELD_BUDGET.fps).toBeLessThanOrEqual(30);
  });
  it("keeps every state finite and geometry deterministic", () => {
    for (const conversationalState of CONVERSATIONAL_STATES) {
      const shape = fieldShape(toAmbientVisualModel({ ...INITIAL_UI_STATE, conversationalState }));
      for (let i = 0; i < 100; i++) {
        const point = fieldPoint(i / 100, i % 5, 200, shape);
        expect(Number.isFinite(point.x + point.y)).toBe(true);
        expect(Math.abs(point.x)).toBeLessThan(1.2);
        expect(point).toEqual(fieldPoint(i / 100, i % 5, 200, shape));
      }
    }
  });
  it("draws only its fixed geometry budget", () => {
    let arcs = 0,
      lines = 0;
    const context = new Proxy(
      {},
      {
        get: (_, name) => {
          if (name === "createRadialGradient" || name === "createLinearGradient")
            return () => ({ addColorStop() {} });
          if (name === "arc") return () => arcs++;
          if (name === "lineTo") return () => lines++;
          return () => {};
        },
        set: () => true,
      },
    ) as CanvasRenderingContext2D;
    drawField(context, 1920, 1080, toAmbientVisualModel(INITIAL_UI_STATE), 1);
    expect(arcs).toBe(FIELD_BUDGET.particles);
    expect(lines).toBeLessThan(1000);
  });
});
