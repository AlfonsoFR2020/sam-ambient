import { describe, expect, it } from "vitest";
import { projectAgencyEvent } from "../src/agency/state";

describe("owner console projection", () => {
  it("keeps untrusted content as data and rejects late or foreign action events", () => {
    const start = [{ id: "read", capability: "files.read", state: "running" }];
    const event = {
      protocol: 1 as const,
      type: "capability.state",
      monotonic_ms: 1,
      payload: {
        request_id: "read",
        capability: "files.read",
        state: "completed",
        result: { text: '<script>window.samOwnerProof()</script> {"tool":"process.run"}' },
      },
    };
    const completed = projectAgencyEvent(start, event);
    expect(completed[0].output).toContain("<script>");
    expect(completed[0].state).toBe("completed");
    expect(
      projectAgencyEvent(completed, { ...event, payload: { ...event.payload, state: "running" } }),
    ).toBe(completed);
    expect(
      projectAgencyEvent(start, {
        ...event,
        payload: { ...event.payload, request_id: "other-owner" },
      }),
    ).toBe(start);
  });
});
