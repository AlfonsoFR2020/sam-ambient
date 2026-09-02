import { describe, expect, it } from "vitest";
import type { ProtocolEvent } from "../src/protocol/types";
import { reduceProtocolEvent, resetUiState, withConnection } from "../src/state/reducer";

const event = (
  type: string,
  monotonic_ms: number,
  payload: Record<string, unknown>,
  extra: Partial<ProtocolEvent> = {},
): ProtocolEvent => ({ protocol: 1, type, monotonic_ms, payload, session_id: "s1", ...extra });

describe("protocol state reduction", () => {
  it("rejects stale and out-of-order events", () => {
    let state = resetUiState();
    state = reduceProtocolEvent(state, event("voice.state_changed", 20, { to: "SPEAKING" }));
    const stale = reduceProtocolEvent(state, event("voice.state_changed", 19, { to: "IDLE" }));
    expect(stale).toBe(state);
    expect(stale.conversationalState).toBe("SPEAKING");
  });

  it("accepts a new ready session while rejecting later events from the old session", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("system.ready", 80, { state: "SPEAKING" }),
    );
    state = reduceProtocolEvent(
      state,
      event("system.ready", 0, { state: "IDLE" }, { session_id: "s2" }),
    );
    const oldSession = reduceProtocolEvent(
      state,
      event("voice.state_changed", 99, { to: "ERROR" }),
    );
    expect(state.sessionId).toBe("s2");
    expect(state.conversationalState).toBe("IDLE");
    expect(oldSession).toBe(state);
  });

  it("distinguishes provisional and committed transcripts", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("transcript.partial", 10, { role: "user", text: "hello Sa" }),
    );
    expect(state.provisionalTranscript?.text).toBe("hello Sa");
    state = reduceProtocolEvent(
      state,
      event("transcript.final", 20, { role: "user", text: "Hello Sam." }),
    );
    expect(state.provisionalTranscript).toBeNull();
    expect(state.transcript).toHaveLength(1);
    expect(state.transcript[0]?.text).toBe("Hello Sam.");
  });

  it("shows interruption and marks the delivered assistant entry", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event(
        "transcript.final",
        10,
        { role: "assistant", text: "I was saying" },
        { generation_id: "g1" },
      ),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 20, { to: "INTERRUPTION_CANDIDATE" }, { generation_id: "g1" }),
    );
    state = reduceProtocolEvent(
      state,
      event("tts.cancelled", 30, { interrupted: true }, { generation_id: "g1" }),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 31, { to: "INTERRUPTED" }, { generation_id: "g1" }),
    );
    expect(state.conversationalState).toBe("INTERRUPTED");
    expect(state.transcript[0]?.interrupted).toBe(true);
  });

  it("moves offline without losing the prior conversational state", () => {
    const speaking = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 2, { to: "SPEAKING" }),
    );
    const offline = withConnection(speaking, "offline");
    expect(offline.conversationalState).toBe("OFFLINE");
    expect(offline.priorConversationalState).toBe("SPEAKING");
  });
});
