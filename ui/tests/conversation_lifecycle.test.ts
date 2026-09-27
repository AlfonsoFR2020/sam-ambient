import { describe, expect, it } from "vitest";
import type { ProtocolEvent } from "../src/protocol/types";
import { reduceProtocolEvent, resetUiState, withConnection } from "../src/state/reducer";

const event = (
  type: string,
  monotonic_ms: number,
  payload: Record<string, unknown>,
  turn_id?: string,
  generation_id?: string,
): ProtocolEvent => ({
  protocol: 1,
  type,
  monotonic_ms,
  session_id: "session",
  payload,
  turn_id,
  generation_id,
});

describe("conversation identity projection", () => {
  it("records a typed local-control outcome without adopting a conversation turn", () => {
    const state = reduceProtocolEvent(
      resetUiState(),
      event("local.control", 1, {
        kind: "switch_inference",
        outcome: "blocked",
        provider: null,
        model: null,
      }),
    );
    expect(state.lastLocalControl).toMatchObject({ kind: "switch_inference", outcome: "blocked" });
    expect(state.turnId).toBeUndefined();
    expect(state.transcript).toHaveLength(0);
  });
  it("converges synthetic voice capture and typed requests on one response lifecycle", () => {
    const voiceEvents = [
      event("voice.state_changed", 1, { to: "LISTENING" }, "voice"),
      event("voice.state_changed", 2, { to: "USER_SPEAKING" }, "voice"),
      event("transcript.partial", 3, { role: "user", text: "hello" }, "voice"),
      event("transcript.final", 4, { role: "user", text: "hello Sam" }, "voice"),
      event("turn.committed", 5, { role: "user", text: "hello Sam" }, "voice"),
      event("voice.state_changed", 6, { to: "THINKING" }, "voice", "voice-generation"),
      event("model.delta", 7, { text: "Hello" }, "voice", "voice-generation"),
      event("model.completed", 8, { text: "Hello there" }, "voice", "voice-generation"),
      event("voice.state_changed", 9, { to: "SPEAKING" }, "voice", "voice-generation"),
      event("tts.completed", 10, {}, "voice", "voice-generation"),
      event("voice.state_changed", 11, { to: "IDLE" }, "voice", "voice-generation"),
    ];
    const voice = voiceEvents.reduce(reduceProtocolEvent, resetUiState());
    expect(voice.transcript.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "hello Sam"],
      ["assistant", "Hello there"],
    ]);
    expect(voice.conversationalState).toBe("IDLE");
    expect(voice.turnId).toBeUndefined();

    const textEvents = [
      event(
        "transcript.final",
        20,
        { role: "user", text: "typed", source: "text" },
        "typed",
        "text-generation",
      ),
      event("voice.state_changed", 21, { to: "THINKING" }, "typed", "text-generation"),
      event("model.completed", 22, { text: "answer" }, "typed", "text-generation"),
      event("voice.state_changed", 23, { to: "SPEAKING" }, "typed", "text-generation"),
      event("voice.state_changed", 24, { to: "IDLE" }, "typed", "text-generation"),
    ];
    const text = textEvents.reduce(reduceProtocolEvent, voice);
    expect(text.transcript.slice(-2).map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "typed"],
      ["assistant", "answer"],
    ]);
    expect(text.conversationalState).toBe("IDLE");
  });

  it("keeps final voice recognition provisional until turn commitment", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "LISTENING" }, "voice-turn"),
    );
    state = reduceProtocolEvent(
      state,
      event("transcript.final", 2, { role: "user", text: "recognized words" }, "voice-turn"),
    );
    expect(state.transcript).toHaveLength(0);
    expect(state.provisionalTranscript?.text).toBe("recognized words");
    state = reduceProtocolEvent(
      state,
      event("stt.cancelled", 3, { reason: "microphone_muted" }, "voice-turn"),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 4, { to: "IDLE" }, "voice-turn"),
    );
    expect(state.transcript).toHaveLength(0);
    expect(state.provisionalTranscript).toBeNull();
    expect(state.conversationalState).toBe("IDLE");
    const late = reduceProtocolEvent(
      state,
      event("transcript.partial", 5, { role: "user", text: "late" }, "voice-turn"),
    );
    expect(late).toBe(state);
  });

  it("does not reopen a failed generation with a late model chunk", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "turn", "generation"),
    );
    state = reduceProtocolEvent(
      state,
      event(
        "component.error",
        2,
        { component: "runtime", reason: "provider failed" },
        "turn",
        "generation",
      ),
    );
    expect(state.conversationalState).toBe("ERROR");
    const late = reduceProtocolEvent(
      state,
      event("model.delta", 3, { text: "late" }, "turn", "generation"),
    );
    expect(late).toBe(state);
    expect(state.provisionalTranscript).toBeNull();
  });

  it("treats repeated cancellation as an inert late event", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "turn", "generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("model.cancelled", 2, { reason: "owner_stop" }, "turn", "generation"),
    );
    const repeated = reduceProtocolEvent(
      state,
      event("model.cancelled", 3, { reason: "owner_stop" }, "turn", "generation"),
    );
    expect(repeated).toBe(state);
    expect(state.conversationalState).toBe("IDLE");
  });

  it("rejects a terminal model event missing its required active generation identity", () => {
    const state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "turn", "generation"),
    );
    const malformed = reduceProtocolEvent(
      state,
      event("model.cancelled", 2, { reason: "uncorrelated" }, "turn"),
    );
    expect(malformed).toBe(state);
  });

  it("keeps an active turn running through an unrelated uncorrelated component error", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "turn", "generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("component.error", 2, { component: "device", reason: "optional input failed" }),
    );
    expect(state.conversationalState).toBe("THINKING");
    expect(state.turnId).toBe("turn");
    expect(state.diagnosticReason).toContain("optional input failed");
  });

  it("rejects a malformed state transition without adopting its turn identity", () => {
    const state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "current", "current-generation"),
    );
    const malformed = reduceProtocolEvent(
      state,
      event("voice.state_changed", 2, { to: "IMPOSSIBLE" }, "current", "current-generation"),
    );
    expect(malformed).toBe(state);
  });

  it("reports capture failure without killing an active model response", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "turn", "generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("component.health", 2, {
        component: "voice_input",
        state: "degraded",
        reason: "Microphone stream failed",
        retrying: false,
      }),
    );
    expect(state.conversationalState).toBe("THINKING");
    expect(state.voiceInputHealth?.status).toBe("degraded");
    expect(state.diagnosticReason).toContain("Microphone stream failed");
    state = reduceProtocolEvent(
      state,
      event("component.health", 3, {
        component: "voice_input",
        state: "healthy",
        reason: "ready",
        retrying: false,
      }),
    );
    expect(state.voiceInputHealth?.status).toBe("healthy");
    expect(state.diagnosticReason).toBeUndefined();
    expect(state.conversationalState).toBe("THINKING");
  });

  it("keeps capture, recognition, synthesis and playback health independent", () => {
    let state = resetUiState();
    for (const [index, [component, reason]] of [
      ["voice_input", "input missing"],
      ["stt", "recognizer missing"],
      ["synthesis", "voice missing"],
      ["playback", "output missing"],
    ].entries()) {
      state = reduceProtocolEvent(
        state,
        event("component.health", index + 1, {
          component,
          state: "degraded",
          reason,
          retrying: false,
        }),
      );
    }
    expect(state.voiceInputHealth?.reason).toBe("input missing");
    expect(state.sttHealth?.reason).toBe("recognizer missing");
    expect(state.synthesisHealth?.reason).toBe("voice missing");
    expect(state.playbackHealth?.reason).toBe("output missing");
    state = reduceProtocolEvent(
      state,
      event("component.health", 5, {
        component: "stt",
        state: "healthy",
        reason: "ready",
        retrying: false,
      }),
    );
    expect(state.sttHealth?.status).toBe("healthy");
    expect(state.voiceInputHealth?.status).toBe("degraded");
    expect(state.synthesisHealth?.status).toBe("degraded");
    expect(state.playbackHealth?.status).toBe("degraded");
  });

  it("recovers after a speech-output failure and ignores its late completion", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "SPEAKING" }, "old", "old-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("model.completed", 2, { text: "answer remains readable" }, "old", "old-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event(
        "tts.failed",
        3,
        { status: "failed", reason: "playback unavailable" },
        "old",
        "old-generation",
      ),
    );
    expect(state.conversationalState).toBe("ERROR");
    expect(state.diagnosticReason).toContain("Speech output failed");
    expect(state.transcript.at(-1)?.text).toBe("answer remains readable");
    expect(reduceProtocolEvent(state, event("tts.completed", 4, {}, "old", "old-generation"))).toBe(
      state,
    );
    state = reduceProtocolEvent(state, event("voice.state_changed", 5, { to: "LISTENING" }, "new"));
    expect(state.conversationalState).toBe("LISTENING");
    expect(state.turnId).toBe("new");
  });

  it("keeps a speaking turn authoritative until candidate interruption is confirmed", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "SPEAKING" }, "old", "old-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 2, { to: "INTERRUPTION_CANDIDATE" }, "candidate"),
    );
    expect(state.turnId).toBe("old");
    expect(state.generationId).toBe("old-generation");
    expect(state.conversationalState).toBe("INTERRUPTION_CANDIDATE");

    state = reduceProtocolEvent(
      state,
      event(
        "transcript.partial",
        3,
        { role: "user", text: "new words", candidate: true },
        "candidate",
      ),
    );
    expect(state.turnId).toBe("old");
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 4, { to: "USER_SPEAKING" }, "candidate"),
    );
    expect(state.turnId).toBe("candidate");
    expect(state.generationId).toBeUndefined();
    expect(state.provisionalTranscript?.text).toBe("new words");
  });

  it("rejects late cancelled, partial, complete and error events from a superseded generation", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "old", "old-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("transcript.final", 2, { role: "user", text: "new request" }, "new", "new-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 3, { to: "THINKING" }, "new", "new-generation"),
    );
    for (const [index, [type, payload]] of (
      [
        ["model.cancelled", { reason: "superseded" }],
        ["model.delta", { text: "late" }],
        ["model.completed", { text: "late" }],
        ["component.error", { reason: "late failure" }],
        ["voice.state_changed", { to: "IDLE" }],
        ["transcript.partial", { role: "user", text: "late" }],
        ["tts.completed", {}],
      ] as const
    ).entries()) {
      const prior = state;
      state = reduceProtocolEvent(state, event(type, 10 + index, payload, "old", "old-generation"));
      expect(state).toBe(prior);
    }
    expect(state.conversationalState).toBe("THINKING");
    expect(state.provisionalTranscript).toBeNull();
  });

  it("retires an interrupted turn and ignores its late speech completion", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "SPEAKING" }, "old", "old-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 2, { to: "USER_SPEAKING" }, "new"),
    );
    const late = reduceProtocolEvent(
      state,
      event("voice.state_changed", 3, { to: "IDLE" }, "old", "old-generation"),
    );
    expect(late).toBe(state);
    expect(state.conversationalState).toBe("USER_SPEAKING");
  });

  it("retires active work on disconnect and accepts a fresh ready snapshot", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "old", "old-generation"),
    );
    state = withConnection(state, "offline");
    expect(state.provisionalTranscript).toBeNull();
    state = withConnection(state, "connected");
    state = reduceProtocolEvent(state, event("system.ready", 2, { state: "IDLE" }));
    const late = reduceProtocolEvent(
      state,
      event("model.completed", 3, { text: "late answer" }, "old", "old-generation"),
    );
    expect(late).toBe(state);
    expect(state.conversationalState).toBe("IDLE");
  });

  it("reattaches only the turn identified by the core on reconnect", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("voice.state_changed", 1, { to: "THINKING" }, "active", "active-generation"),
    );
    state = withConnection(state, "offline");
    state = reduceProtocolEvent(
      withConnection(state, "connected"),
      event("system.ready", 2, { state: "THINKING" }, "active", "active-generation"),
    );
    expect(state.turnId).toBe("active");
    expect(state.generationId).toBe("active-generation");
    state = reduceProtocolEvent(
      state,
      event("model.delta", 3, { text: "resumed" }, "active", "active-generation"),
    );
    expect(state.provisionalTranscript?.text).toBe("resumed");
  });

  it("keeps an active turn bound while provider discovery changes future availability", () => {
    let state = reduceProtocolEvent(
      resetUiState(),
      event("system.ready", 1, { state: "IDLE", provider: "local", model: "chosen" }),
    );
    state = reduceProtocolEvent(
      state,
      event("voice.state_changed", 2, { to: "THINKING" }, "active", "active-generation"),
    );
    state = reduceProtocolEvent(
      state,
      event("provider.discovery", 3, {
        state: "blocked",
        catalog: [],
        reason: "model disappeared",
      }),
    );
    expect(state.model).toBeUndefined();
    expect(state.turnId).toBe("active");
    expect(state.generationId).toBe("active-generation");
    state = reduceProtocolEvent(
      state,
      event("model.completed", 4, { text: "already running" }, "active", "active-generation"),
    );
    expect(state.transcript.at(-1)?.text).toBe("already running");
  });
});
