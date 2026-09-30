import { describe, expect, it } from "vitest";
import type { ControlCommand } from "../src/protocol/types";
import { SAM_PROTOCOL_SUBPROTOCOL, WebSocketTransport } from "../src/transport/websocket";

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { reason?: string }) => void) | null = null;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(_code?: number, reason?: string): void {
    this.readyState = 3;
    this.onclose?.({ reason });
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.();
  }

  async authenticate(): Promise<void> {
    this.onmessage?.({
      data: JSON.stringify({
        type: "sam.owner.challenge",
        session: "core",
        nonce: "a".repeat(64),
        server_proof: "b".repeat(64),
      }),
    });
    await Promise.resolve();
    this.onmessage?.({ data: JSON.stringify({ type: "sam.owner.accepted" }) });
  }
}

describe("WebSocket core transport", () => {
  it("serializes commands and decodes incoming events on the real transport seam", async () => {
    const socket = new FakeSocket();
    let requestedProtocol = "";
    const transport = new WebSocketTransport(
      "ws://127.0.0.1:8765",
      (_url, protocol) => {
        requestedProtocol = protocol;
        return socket;
      },
      async () => "c".repeat(64),
    );
    const received: unknown[] = [];
    const connection = transport.connect({
      onEvent: (event) => received.push(event),
      onDisconnect() {},
    });
    socket.open();
    await socket.authenticate();
    const session = await connection;
    const command: ControlCommand = {
      protocol: 1,
      type: "control.stop_speaking",
      command_id: "stop",
      monotonic_ms: 5,
      payload: {},
    };
    await session.send(command);
    socket.onmessage?.({
      data: '{"protocol":1,"type":"system.ready","monotonic_ms":0,"payload":{}}',
    });

    expect(requestedProtocol).toBe(SAM_PROTOCOL_SUBPROTOCOL);
    expect(JSON.parse(socket.sent[1] ?? "null")).toEqual(command);
    expect(received).toHaveLength(1);
    await session.close();
  });

  it("rejects non-loopback bridge URLs", () => {
    expect(() => new WebSocketTransport("ws://192.168.1.20:8765")).toThrow("loopback");
    expect(() => new WebSocketTransport("wss://127.0.0.1:8765")).toThrow("loopback");
  });

  it("does not mistake an observer exception for invalid JSON", async () => {
    const socket = new FakeSocket();
    const transport = new WebSocketTransport(
      "ws://127.0.0.1:8765",
      () => socket,
      async () => "c".repeat(64),
    );
    const connection = transport.connect({
      onEvent: () => {
        throw new Error("render observer failed");
      },
      onDisconnect() {},
    });
    socket.open();
    await socket.authenticate();
    await connection;
    expect(() => socket.onmessage?.({ data: '{"protocol":1}' })).toThrow("render observer failed");
    expect(socket.readyState).toBe(1);
    socket.close();
  });

  it("rejects an ordinary browser tab without granting a transport session", async () => {
    const socket = new FakeSocket();
    const transport = new WebSocketTransport(
      "ws://127.0.0.1:8765",
      () => socket,
      async () => {
        throw new Error("absent");
      },
    );
    const connection = transport.connect({
      onEvent: () => {
        throw new Error("private event leaked");
      },
      onDisconnect() {},
    });
    const rejected = expect(connection).rejects.toThrow("owner window");
    socket.open();
    await socket.authenticate();
    await rejected;
    expect(socket.sent).toEqual([]);
  });
});
