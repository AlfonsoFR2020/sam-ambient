import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationControls } from "../src/ConversationControls";
import { commandForAction } from "../src/controls/model";
import type { ProtocolEvent } from "../src/protocol/types";
import { ProtocolClient } from "../src/state/client";
import { conversationBlockReason } from "../src/state/conversations";
import { reduceProtocolEvent, resetUiState } from "../src/state/reducer";
import { FaultClock, FaultTransport } from "./fixtures/conversation-faults";

const ready = (session = "one", ms = 100, revision = 0, runtime = "core-a"): ProtocolEvent => ({
  protocol: 1,
  type: "system.ready",
  session_id: session,
  monotonic_ms: ms,
  payload: {
    state: "IDLE",
    conversation: {
      runtime_id: runtime,
      session_id: session,
      revision,
      launch_policy: "resume",
      persistent: true,
      history: [{ turn_id: "saved", role: "user", text: "A retained question", truncated: false }],
      retained: [{ session_id: session, message_count: 1, updated_at_ms: 1 }],
      incomplete_turns: ["saved"],
      history_limited: false,
      draft: null,
    },
  },
});

describe("authoritative session and history continuity", () => {
  it("uses the core's Unicode character limits for retained text and drafts", () => {
    const event = ready();
    const data = event.payload.conversation as Record<string, unknown>;
    const unicode = "🌊".repeat(16_384);
    data.history = [{ turn_id: "saved", role: "user", text: unicode, truncated: false }];
    data.draft = {
      turn_id: "saved",
      generation_id: "g",
      text: unicode,
      complete: false,
      interrupted: false,
    };
    const state = reduceProtocolEvent(resetUiState(), event);
    expect(state.transcript[0]?.text === unicode).toBe(true);
    expect(state.provisionalTranscript?.text === unicode).toBe(true);
  });
  it("rejects malformed ready snapshots without attaching old text to a different session", () => {
    const before = reduceProtocolEvent(resetUiState(), ready());
    const corrupt = ready("two", 120, 1);
    (corrupt.payload.conversation as Record<string, unknown>).history = [
      { role: "user", text: 42 },
    ];
    expect(reduceProtocolEvent(before, corrupt)).toBe(before);
  });
  it("rehydrates retained text on a fresh UI without inventing an answer", () => {
    const state = reduceProtocolEvent(resetUiState(), ready());
    expect(state.transcript.map((item) => item.text)).toEqual(["A retained question"]);
    expect(state.generationId).toBeUndefined();
    expect(state.pendingUserMessageId).toBeUndefined();
  });
  it("does not replay queued pre-snapshot deltas or duplicate a saved user message", () => {
    const snapshot = ready();
    snapshot.payload.state = "THINKING";
    snapshot.turn_id = "saved";
    snapshot.generation_id = "g";
    const state = reduceProtocolEvent(resetUiState(), snapshot);
    const old = { ...snapshot, type: "model.delta", monotonic_ms: 99, payload: { text: "Replay" } };
    expect(reduceProtocolEvent(state, old)).toBe(state);
    const replay = {
      ...snapshot,
      type: "transcript.final",
      monotonic_ms: 101,
      payload: { role: "user", text: "A retained question" },
    };
    expect(reduceProtocolEvent(state, replay).transcript).toHaveLength(1);
  });
  it("accepts a core restart with the same session and a reset clock", () => {
    const before = reduceProtocolEvent(resetUiState(), ready());
    const after = reduceProtocolEvent(before, ready("one", 1, 0, "core-b"));
    expect(after.lastMonotonicByType["system.ready"]).toBe(1);
    expect(after.transcript.map((item) => item.text)).toEqual(["A retained question"]);
  });
  it("accepts a correlated session change and rejects stale ready/terminal/ACK events", () => {
    const initial = reduceProtocolEvent(resetUiState(), ready());
    const changed = ready("two", 110, 1);
    changed.type = "conversation.changed";
    changed.payload.previous_session_id = "one";
    changed.payload.command_id = "new";
    const next = reduceProtocolEvent(initial, changed);
    expect(next.sessionId).toBe("two");
    for (const event of [
      ready("one", 120, 0),
      { ...ready("one", 121), type: "model.completed", payload: { text: "Old answer" } },
      { ...ready("one", 122), type: "control.acknowledged", payload: { command_id: "new" } },
    ])
      expect(reduceProtocolEvent(next, event)).toBe(next);
  });
  it("does not let an uncorrelated or reordered change select a context", () => {
    const initial = reduceProtocolEvent(resetUiState(), ready());
    const changed = ready("two", 110, 1);
    changed.type = "conversation.changed";
    changed.payload.previous_session_id = "unrelated";
    expect(reduceProtocolEvent(initial, changed)).toBe(initial);
  });
  it("returning to a retained session cannot admit an old generation's late terminal", () => {
    const initial = reduceProtocolEvent(resetUiState(), ready());
    const second = reduceProtocolEvent(initial, change("two", "one", 1));
    const resumed = reduceProtocolEvent(second, change("one", "two", 2, 120));
    const late = {
      ...ready("one", 130),
      type: "model.completed",
      generation_id: "retired-old",
      turn_id: "old",
      payload: { text: "Late old answer" },
    };
    expect(reduceProtocolEvent(resumed, late)).toBe(resumed);
  });
});

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
async function connected() {
  const transport = new FaultTransport(),
    clock = new FaultClock();
  const client = new ProtocolClient(transport, clock);
  client.start();
  await flush();
  transport.observers[0].onEvent(ready());
  return { transport, clock, client };
}
const change = (session: string, previous: string, revision: number, ms = 110): ProtocolEvent => {
  const event = ready(session, ms, revision);
  event.type = "conversation.changed";
  event.payload.previous_session_id = previous;
  event.payload.command_id = "select";
  return event;
};

describe("session transport epochs, admission and owner controls", () => {
  it("invalid ready data preserves pending ownership and reports no private payload", async () => {
    const { transport, client } = await connected();
    try {
      const command = commandForAction({ type: "conversation.new" }, client.getSnapshot());
      if (!command) throw new Error("Missing selection");
      await client.sendControl(command);
      const bad = ready("two", 120, 1);
      (bad.payload.conversation as Record<string, unknown>).history = "Private invalid fixture";
      transport.observers[0].onEvent(bad);
      expect(client.getSnapshot().sessionId).toBe("one");
      expect(client.getSnapshot().pendingCommandIds).toContain(command.command_id);
      expect(client.getSnapshot().protocolError).toContain("Invalid conversation snapshot");
      expect(client.getSnapshot().protocolError).not.toContain("Private invalid fixture");
    } finally {
      client.stop();
    }
  });
  it("a fresh UI restores a live partial draft and appends only post-snapshot output", () => {
    const event = ready();
    event.payload.state = "THINKING";
    event.turn_id = "saved";
    event.generation_id = "g";
    (event.payload.conversation as Record<string, unknown>).draft = {
      turn_id: "saved",
      generation_id: "g",
      text: "Existing draft",
      complete: false,
      interrupted: false,
    };
    const state = reduceProtocolEvent(resetUiState(), event);
    expect(state.provisionalTranscript?.text).toBe("Existing draft");
    const next = reduceProtocolEvent(state, {
      ...event,
      type: "model.delta",
      monotonic_ms: 101,
      payload: { text: " continued" },
    });
    expect(next.provisionalTranscript?.text).toBe("Existing draft continued");
    expect(next.transcript).toHaveLength(1);
  });
  it("ACK alone cannot select a session; confirmed selection retires command timeouts", async () => {
    const { transport, clock, client } = await connected();
    try {
      const command = commandForAction({ type: "conversation.new" }, client.getSnapshot());
      if (!command) throw new Error("Missing authenticated selection command");
      expect(command.payload).toEqual({ action: "new", expected_revision: 0 });
      expect(command.session_id).toBe("one");
      await client.sendControl(command);
      transport.observers[0].onEvent({
        ...ready(),
        type: "control.acknowledged",
        monotonic_ms: 105,
        payload: { command_id: command.command_id, command_type: command.type },
      });
      expect(client.getSnapshot().sessionId).toBe("one");
      transport.observers[0].onEvent(change("two", "one", 1));
      clock.advance(20_000);
      expect(client.getSnapshot().sessionId).toBe("two");
      expect(client.getSnapshot().pendingCommandIds).toEqual([]);
      expect(client.getSnapshot().protocolError).toBeUndefined();
    } finally {
      client.stop();
    }
  });
  it("ignores old-session ACKs while newer-session typing remains pending", async () => {
    const { transport, client } = await connected();
    try {
      transport.observers[0].onEvent(change("two", "one", 1));
      const command = {
        protocol: 1 as const,
        type: "control.user_message.submit" as const,
        command_id: "new-typed",
        session_id: "two",
        monotonic_ms: 111,
        payload: { text: "New question" },
      };
      await client.sendControl(command);
      transport.observers[0].onEvent({
        ...ready("one", 120),
        type: "control.rejected",
        payload: { command_id: "new-typed", error: "Old rejection" },
      });
      expect(client.getSnapshot().pendingUserMessageId).toBe("new-typed");
      expect(client.getSnapshot().pendingCommandIds).toContain("new-typed");
      expect(client.getSnapshot().protocolError).toBeUndefined();
    } finally {
      client.stop();
    }
  });
  it("reattaches after reconnect and rejects old socket/runtime ready events", async () => {
    const { transport, clock, client } = await connected();
    try {
      const oldSocket = transport.observers[0];
      oldSocket.onDisconnect();
      clock.advance(600);
      await flush();
      transport.observers[1].onEvent(ready("two", 1, 1, "core-b"));
      expect(client.getSnapshot().sessionId).toBe("two");
      oldSocket.onEvent(ready("one", 500, 0, "core-a"));
      transport.observers[1].onEvent(ready("one", 501, 0, "core-a"));
      expect(client.getSnapshot().sessionId).toBe("two");
      expect(client.getSnapshot().conversation?.runtimeId).toBe("core-b");
      expect(client.getSnapshot().transcript).toHaveLength(1);
    } finally {
      client.stop();
    }
  });
  it("projects live draft across reload and keeps generated completion separate from speech", () => {
    const event = ready();
    event.payload.state = "SPEAKING";
    event.turn_id = "saved";
    event.generation_id = "g";
    event.payload.playback_generation_id = "g";
    const data = event.payload.conversation as Record<string, unknown>;
    data.draft = {
      turn_id: "saved",
      generation_id: "g",
      text: "A complete answer",
      complete: true,
      interrupted: false,
    };
    const state = reduceProtocolEvent(resetUiState(), event);
    expect(state.transcript.map((item) => item.text)).toEqual([
      "A retained question",
      "A complete answer",
    ]);
    expect(state.playbackGenerationId).toBe("g");
    const cancelled = reduceProtocolEvent(state, {
      ...event,
      type: "tts.cancelled",
      monotonic_ms: 101,
      payload: { reason: "stop_speaking" },
    });
    expect(cancelled.transcript.at(-1)?.text).toBe("A complete answer");
    expect(cancelled.playbackGenerationId).toBeUndefined();
    expect(cancelled.transcript.at(-1)?.interrupted).toBe(true);
  });
  it("uses persisted preference commands and accessible truthful controls without changing context", () => {
    const state = { ...reduceProtocolEvent(resetUiState(), ready()), microphoneEnabled: false };
    const policy = commandForAction(
      { type: "conversation.launch_policy.set", policy: "new" },
      state,
    );
    expect(policy?.payload).toEqual({ policy: "new", expected_revision: 0 });
    expect(state.sessionId).toBe("one");
    const html = renderToStaticMarkup(
      createElement(ConversationControls, { state, act: () => {} }),
    );
    expect(html).toContain("New conversation");
    expect(html).toContain("Resume selected conversation");
    expect(html).toContain("On a new Sam launch");
    expect(html).toContain("no completed saved answer");
    expect(html).toContain("<output");
    expect(conversationBlockReason(state)).toBeUndefined();
    expect(conversationBlockReason({ ...state, microphoneEnabled: true })).toContain("Mute");
    expect(conversationBlockReason({ ...state, pendingUserMessageId: "pending" })).toContain(
      "current work",
    );
    expect(conversationBlockReason({ ...state, connection: "offline" })).toContain("Reconnect");
  });
});
