import { serializeControlCommand } from "../protocol/commands";
import type { ControlCommand } from "../protocol/types";
import type { ProtocolTransport, TransportObserver, TransportSession } from "./transport";

export const DEFAULT_CORE_BRIDGE_URL = "ws://127.0.0.1:8765";
export const SAM_PROTOCOL_SUBPROTOCOL = "sam.protocol.v1";

interface WebSocketLike {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: ((event: { reason?: string }) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

type WebSocketFactory = (url: string, protocol: string) => WebSocketLike;

const browserWebSocketFactory: WebSocketFactory = (url, protocol) =>
  new WebSocket(url, protocol) as unknown as WebSocketLike;

export class WebSocketTransport implements ProtocolTransport {
  readonly name = "websocket-core";

  constructor(
    readonly url = DEFAULT_CORE_BRIDGE_URL,
    private readonly factory: WebSocketFactory = browserWebSocketFactory,
  ) {
    const parsed = new URL(url);
    const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);
    if (
      parsed.protocol !== "ws:" ||
      !loopback.has(parsed.hostname) ||
      parsed.username ||
      parsed.password
    ) {
      throw new Error("Sam core WebSocket must use an unauthenticated loopback ws:// URL");
    }
  }

  connect(observer: TransportObserver): Promise<TransportSession> {
    return new Promise((resolve, reject) => {
      const socket = this.factory(this.url, SAM_PROTOCOL_SUBPROTOCOL);
      let connected = false;
      let intentionallyClosed = false;
      socket.onmessage = ({ data }) => {
        if (typeof data !== "string") {
          socket.close(1003, "binary protocol events are unsupported");
          return;
        }
        try {
          observer.onEvent(JSON.parse(data));
        } catch {
          socket.close(1002, "invalid JSON protocol event");
        }
      };
      socket.onerror = () => {
        if (!connected) reject(new Error("Sam core WebSocket connection failed"));
      };
      socket.onclose = ({ reason }) => {
        if (!connected) {
          reject(new Error(reason || "Sam core WebSocket closed during connection"));
        } else if (!intentionallyClosed) {
          observer.onDisconnect(reason || "Sam core WebSocket disconnected");
        }
      };
      socket.onopen = () => {
        connected = true;
        resolve({
          send: (message) => {
            if (socket.readyState !== 1) throw new Error("Sam core is offline");
            socket.send(serializeControlCommand(message as ControlCommand));
          },
          close: () => {
            intentionallyClosed = true;
            socket.close(1000, "Sam UI transport closed");
          },
        });
      };
    });
  }
}
