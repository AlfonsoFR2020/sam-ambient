import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS } from "../src/demo/scenarios";

describe("deterministic demo protocol scenarios", () => {
  it("uses production protocol events for turn, interruption, recovery, pressure, and reconnect", () => {
    const firstEvents = DEMO_SCENARIOS.firstConnection.flatMap((step) =>
      step.event ? [step.event] : [],
    );
    const states = firstEvents
      .filter((event) => event.type === "voice.state_changed")
      .map((event) => event.payload.to);

    expect(states).toEqual(
      expect.arrayContaining([
        "LISTENING",
        "USER_SPEAKING",
        "ENDPOINT_CANDIDATE",
        "THINKING",
        "SPEAKING",
        "INTERRUPTION_CANDIDATE",
        "INTERRUPTED",
        "RECOVERING",
      ]),
    );
    expect(firstEvents.filter((event) => event.type === "voice.level").length).toBeGreaterThan(30);
    expect(DEMO_SCENARIOS.firstConnection.some((step) => step.disconnect)).toBe(true);
    expect(DEMO_SCENARIOS.reconnected[0]?.event?.type).toBe("system.ready");
  });
});
