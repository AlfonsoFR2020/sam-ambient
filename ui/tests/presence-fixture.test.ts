import { describe, expect, it } from "vitest";
import {
  PRESENCE_SCENES,
  PRESENCE_SEED,
  presenceFixtureFrame,
} from "./fixtures/responsive-presence";

describe("responsive-presence fixture data without a renderer", () => {
  it("provides deterministic finite lifecycle frames and all required control states", () => {
    expect(PRESENCE_SEED).toBe(0x5a17);
    expect(new Set(PRESENCE_SCENES.map((scene) => scene.name)).size).toBe(18);
    for (const scene of PRESENCE_SCENES) {
      const first = presenceFixtureFrame(scene);
      expect(first).toEqual(presenceFixtureFrame(scene));
      expect(
        Object.values(first)
          .filter((value) => typeof value === "number")
          .every(Number.isFinite),
      ).toBe(true);
      expect(first.radius).toBeGreaterThan(0);
      expect(first.radius).toBeLessThanOrEqual(1.18);
    }
    const speech = PRESENCE_SCENES.find((scene) => scene.name === "synthetic-speech");
    if (!speech) throw new Error("Synthetic speech fixture missing");
    expect(presenceFixtureFrame(speech).reactivity.outputPulse).toBeGreaterThan(0);
    expect(presenceFixtureFrame(speech, false, true).reactivity.outputPulse).toBe(0);
    expect(presenceFixtureFrame(speech, true).reactivity.outputPulse).toBe(0);
  });
});
