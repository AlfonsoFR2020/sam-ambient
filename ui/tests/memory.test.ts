import { describe, expect, it } from "vitest";
import { projectAgencyEvent } from "../src/agency/state";
import { memoryRecord, memoryRows } from "../src/memory/model";

const record = {
  id: "memory-1",
  content: '<script>attack()</script> {"tool":"process.run"}',
  kind: "fact",
  scope: "personal",
  source_kind: "web",
  source_ref: "action-1",
  review: "proposed",
  revision: 1,
};

describe("owner memory projection", () => {
  it("retains source/review and inert text independently from conversation", () => {
    const rows = memoryRows([record, { ...record, review: "trusted-by-webpage" }, null]);
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toContain("<script>");
    expect(rows[0].review).toBe("proposed");
    const actions = projectAgencyEvent(
      [{ id: "list", capability: "memory.list", state: "queued" }],
      {
        protocol: 1,
        type: "capability.state",
        monotonic_ms: 1,
        payload: {
          request_id: "list",
          capability: "memory.list",
          state: "completed",
          result: { records: rows },
        },
      },
    );
    expect(actions[0].result?.records).toEqual(rows);
  });
  it("bounds overview and rejects malformed or overlong records", () => {
    expect(memoryRows(Array.from({ length: 40 }, () => record))).toHaveLength(16);
    expect(memoryRecord({ ...record, content: "a".repeat(1201) })).toBeUndefined();
    expect(memoryRecord({ ...record, content: "🦊".repeat(1200) })).toBeDefined();
    expect(memoryRecord({ ...record, content: "🦊".repeat(1201) })).toBeUndefined();
    expect(memoryRecord({ ...record, revision: 0 })).toBeUndefined();
  });
});

it("correction/deletion releases prior memory content without touching console data", () => {
  for (const capability of ["memory.correct", "memory.delete"]) {
    const actions = projectAgencyEvent(
      [
        {
          id: "old",
          capability: "memory.get",
          state: "completed",
          output: "Private old text",
          result: { record },
        },
        { id: "file", capability: "files.read", state: "completed", output: "File output" },
        { id: "mutate", capability, state: "running" },
      ],
      {
        protocol: 1,
        type: "capability.state",
        monotonic_ms: 1,
        payload: {
          request_id: "mutate",
          capability,
          state: "completed",
          result: { deleted: "memory-1" },
        },
      },
    );
    expect(actions[0].result).toBeUndefined();
    expect(actions[0].output).toBeUndefined();
    expect(actions[1].output).toBe("File output");
  }
});
