import { describe, expect, it } from "vitest";
import { decodeProtocolEvent, ProtocolDecodeError } from "../src/protocol/decode";

describe("protocol decoding", () => {
  it("decodes protocol v1 with correlation identifiers", () => {
    expect(
      decodeProtocolEvent({
        protocol: 1,
        type: "voice.state_changed",
        monotonic_ms: 42,
        session_id: "session-1",
        turn_id: "turn-1",
        payload: { to: "LISTENING" },
      }),
    ).toMatchObject({ type: "voice.state_changed", monotonic_ms: 42, turn_id: "turn-1" });
  });

  it("rejects unsupported versions and malformed envelopes", () => {
    expect(() =>
      decodeProtocolEvent({ protocol: 2, type: "system.ready", monotonic_ms: 0, payload: {} }),
    ).toThrowError(ProtocolDecodeError);
    expect(() =>
      decodeProtocolEvent({ protocol: 1, type: "ready", monotonic_ms: -1, payload: [] }),
    ).toThrowError(ProtocolDecodeError);
  });
});
