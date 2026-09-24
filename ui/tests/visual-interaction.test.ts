import { describe, expect, it } from "vitest";
import { OrbInteraction } from "../src/visual-engine/interaction";

describe("orb interaction", () => {
  it("moves the front-facing material downward when the pointer is dragged downward", () => {
    const interaction = new OrbInteraction();
    interaction.begin(100, 100, 0);
    interaction.move(100, 140, 20);
    expect(interaction.orientationMatrix()[7]).toBeGreaterThan(0);
  });

  it("retains a moderate amount of post-drag inertia", () => {
    const interaction = new OrbInteraction();
    interaction.begin(0, 0, 0);
    interaction.move(40, 0, 20);
    interaction.end();
    interaction.step(0.05);
    interaction.step(0.05);
    interaction.step(0.05);
    interaction.step(0.05);
    interaction.step(0.05);
    expect(interaction.snapshot().velocityY).toBeGreaterThan(1);
  });
  it("maps two-axis drag into a stable bounded orientation", () => {
    const interaction = new OrbInteraction();
    const identity = [...interaction.snapshot().matrix];
    interaction.begin(100, 100, 0);
    expect(interaction.move(160, 130, 16)).toBe(true);
    const moved = interaction.snapshot();
    expect([...moved.matrix]).not.toEqual(identity);
    expect(Math.abs(moved.velocityX)).toBeLessThanOrEqual(4);
    expect(Math.abs(moved.velocityY)).toBeLessThanOrEqual(4);
    for (const value of moved.matrix) expect(Number.isFinite(value)).toBe(true);
  });

  it("integrates inertia consistently across frame cadences", () => {
    const first = new OrbInteraction();
    const second = new OrbInteraction();
    for (const interaction of [first, second]) {
      interaction.begin(0, 0, 0);
      interaction.move(40, 0, 20);
      interaction.end();
    }
    first.step(0.04);
    second.step(0.02);
    second.step(0.02);
    expect(first.snapshot().velocityY).toBeCloseTo(second.snapshot().velocityY, 5);
    const firstMatrix = first.snapshot().matrix;
    const secondMatrix = second.snapshot().matrix;
    for (let index = 0; index < firstMatrix.length; index++) {
      expect(firstMatrix[index]).toBeCloseTo(secondMatrix[index] ?? Number.NaN, 5);
    }
  });

  it("scales flick travel and suppresses inertia for reduced motion", () => {
    const full = new OrbInteraction();
    const slow = new OrbInteraction();
    for (const interaction of [full, slow]) {
      interaction.begin(0, 0, 0);
      interaction.move(40, 0, 20);
      interaction.end();
    }
    full.step(0.04, false, 1);
    slow.step(0.04, false, 0.25);
    expect(Math.abs(full.snapshot().matrix[2] ?? 0)).toBeGreaterThan(
      Math.abs(slow.snapshot().matrix[2] ?? 0),
    );
    full.end(true);
    expect(full.snapshot().velocityY).toBe(0);
  });

  it("cancellation ends capture and removes residual velocity", () => {
    const interaction = new OrbInteraction();
    interaction.begin(0, 0, 0);
    interaction.move(20, 20, 16);
    interaction.cancel();
    expect(interaction.snapshot()).toMatchObject({ dragging: false, velocityX: 0, velocityY: 0 });
    expect(interaction.move(40, 40, 32)).toBe(false);
  });
});
