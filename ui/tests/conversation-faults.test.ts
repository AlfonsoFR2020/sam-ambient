import { describe, expect, it } from "vitest";
import { presencePresentation } from "../src/presence";
import { faultClient, typedCommand } from "./fixtures/conversation-faults";

const oldTurn = { turn_id: "old-turn", generation_id: "old-generation" };
const pendingTurn = { turn_id: "pending-turn", generation_id: "pending-generation" };
const commandPayload = (id: string) => ({
  command_id: id,
  command_type: "control.user_message.submit",
});

describe("typed request fault matrix without rendering", () => {
  it("retires ACK waiting after a correlated commitment, without needing the later ACK", async () => {
    const { client, transport, clock } = await faultClient();
    try {
      await client.sendControl(typedCommand("committed"));
      transport.emit(
        "turn.committed",
        1,
        { command_id: "committed", text: "Committed" },
        pendingTurn,
      );
      expect(client.getSnapshot().pendingCommandIds).toEqual([]);
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
      clock.advance(31_000);
      expect(client.getSnapshot().protocolError).toBeUndefined();
    } finally {
      client.stop();
    }
  });
  for (const terminal of ["component.error", "model.cancelled"])
    for (const acknowledged of [false, true]) {
      it(`${terminal}, ACK=${acknowledged}: a precommit terminal retires its Sending indicator without replacing the old turn`, async () => {
        const { client, transport, clock } = await faultClient();
        try {
          transport.emit("turn.committed", 1, { text: "Earlier committed request" }, oldTurn);
          await client.sendControl(typedCommand("pending"));
          if (acknowledged) transport.emit("control.acknowledged", 2, commandPayload("pending"));
          transport.emit(
            terminal,
            3,
            { command_id: "pending", component: "turn", error: "Synthetic precommit failure" },
            pendingTurn,
          );
          expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
          expect(client.getSnapshot().pendingCommandIds).not.toContain("pending");
          expect(client.getSnapshot().generationId).toBe(oldTurn.generation_id);
          expect(client.getSnapshot().transcript).toHaveLength(1);
          expect(client.getSnapshot().protocolError).toContain("before its turn was committed");
          clock.advance(31_000);
          expect(presencePresentation(client.getSnapshot()).phase).not.toBe("submitting");
        } finally {
          client.stop();
        }
      });
    }

  it("retains the timeout after a foreign-session ACK is rejected", async () => {
    const { client, transport, clock } = await faultClient();
    try {
      await client.sendControl(typedCommand("pending"));
      transport.emit("control.acknowledged", 2, commandPayload("pending"), {
        session_id: "retired-session",
      });
      expect(client.getSnapshot().pendingCommandIds).toContain("pending");
      clock.advance(30_000);
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
      expect(client.getSnapshot().protocolError).toContain("in time");
    } finally {
      client.stop();
    }
  });

  it("retires reordered ACKs by command without applying their older projection", async () => {
    const { client, transport, clock } = await faultClient();
    try {
      await client.sendControl(typedCommand("first"));
      await client.sendControl(typedCommand("second"));
      transport.emit("control.acknowledged", 20, commandPayload("second"));
      transport.emit("control.acknowledged", 10, commandPayload("first"));
      expect(client.getSnapshot().pendingCommandIds).toEqual([]);
      expect(client.getSnapshot().pendingUserMessageId).toBe("second");
      clock.advance(31_000);
      expect(client.getSnapshot().protocolError).toBeUndefined();
    } finally {
      client.stop();
    }
  });

  it("rejects old-socket terminals after reconnect while a fresh request is pending", async () => {
    const { client, transport, clock } = await faultClient();
    try {
      await client.sendControl(typedCommand("before-disconnect"));
      const oldSocket = transport.observers[0];
      oldSocket.onDisconnect();
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
      expect(presencePresentation(client.getSnapshot()).phase).toBe("reconnecting");
      clock.advance(600);
      await Promise.resolve();
      await Promise.resolve();
      transport.emit("system.ready", 1, { state: "IDLE", provider: "local", model: "exact-model" });
      await client.sendControl(typedCommand("fresh"));
      oldSocket.onEvent({
        protocol: 1,
        type: "component.error",
        monotonic_ms: 50,
        session_id: "session",
        payload: { command_id: "fresh", component: "turn" },
      });
      expect(client.getSnapshot().pendingUserMessageId).toBe("fresh");
      expect(client.getSnapshot().pendingCommandIds).toEqual(["fresh"]);
      transport.emit("control.rejected", 2, { ...commandPayload("fresh"), error: "Not ready" });
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
      expect(client.getSnapshot().pendingCommandIds).toEqual([]);
    } finally {
      client.stop();
    }
  });

  it("does not let a late terminal for the older request clear a newer Sending indicator", async () => {
    const { client, transport } = await faultClient();
    try {
      transport.emit("turn.committed", 1, { text: "Earlier turn" }, oldTurn);
      await client.sendControl(typedCommand("first"));
      await client.sendControl(typedCommand("second"));
      transport.emit(
        "model.cancelled",
        2,
        { command_id: "first", outcome: "superseded" },
        pendingTurn,
      );
      expect(client.getSnapshot().pendingUserMessageId).toBe("second");
      transport.emit(
        "component.error",
        3,
        { command_id: "second", component: "turn" },
        { turn_id: "newer", generation_id: "newer" },
      );
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
      transport.emit("model.cancelled", 4, { command_id: "first" }, pendingTurn);
      expect(client.getSnapshot().pendingUserMessageId).toBeUndefined();
    } finally {
      client.stop();
    }
  });

  it("shows the new submitted request while old speech or a previous error is settling", async () => {
    const { client, transport } = await faultClient();
    try {
      transport.emit("turn.committed", 1, { text: "Earlier turn" }, oldTurn);
      transport.emit("voice.state_changed", 2, { to: "SPEAKING" }, oldTurn);
      transport.emit("tts.started", 3, {}, oldTurn);
      await client.sendControl(typedCommand("during-speech"));
      expect(presencePresentation(client.getSnapshot()).phase).toBe("submitting");
      transport.emit(
        "component.error",
        4,
        { component: "model", error: "Earlier response failed" },
        oldTurn,
      );
      await client.sendControl(typedCommand("retry"));
      expect(presencePresentation(client.getSnapshot()).phase).toBe("submitting");
      expect(client.getSnapshot().pendingUserMessageId).toBe("retry");
    } finally {
      client.stop();
    }
  });
});
