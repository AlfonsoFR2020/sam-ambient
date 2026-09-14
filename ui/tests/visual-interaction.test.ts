import { describe, expect, it } from "vitest";
import { OrbInteraction } from "../src/visual-engine/interaction";

describe("orb interaction", () => {
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

  it("decays inertia consistently and suppresses it for reduced motion", () => {
    const first = new OrbInteraction();
    const second = new OrbInteraction();
    for (const interaction of [first, second]) {
      interaction.begin(0, 0, 0);
      interaction.move(40, 10, 20);
      interaction.end();
    }
    first.step(0.04);
    second.step(0.02);
    second.step(0.02);
    expect(first.snapshot().velocityY).toBeCloseTo(second.snapshot().velocityY, 5);
    first.end(true);
    expect(first.snapshot().velocityY).toBe(0);
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
