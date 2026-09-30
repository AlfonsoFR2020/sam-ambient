import { invoke } from "@tauri-apps/api/core";
import { serializeControlCommand } from "../protocol/commands";
import type { ControlCommand } from "../protocol/types";
import type { ProtocolTransport, TransportObserver, TransportSession } from "./transport";

export const DEFAULT_CORE_BRIDGE_URL = "ws://127.0.0.1:8765";
export const SAM_PROTOCOL_SUBPROTOCOL = "sam.protocol.v1";

export interface OwnerChallenge {
  type: "sam.owner.challenge";
  session: string;
  nonce: string;
  server_proof: string;
}
export type OwnerProof = (challenge: OwnerChallenge) => Promise<string>;

declare global {
  interface Window {
    samOwnerProof?: OwnerProof;
  }
}

const ownerProof: OwnerProof = async (challenge) => {
  if ("__TAURI_INTERNALS__" in window) return invoke<string>("owner_proof", { challenge });
  if (!window.samOwnerProof) throw new Error("Open Sam's owner window to connect");
  return window.samOwnerProof(challenge);
};

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
    private readonly proveOwner: OwnerProof = ownerProof,
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
      let authenticating = false;
      let proofSent = false;
      const timeout = setTimeout(() => {
        if (!connected) {
          reject(new Error("Sam owner authentication timed out"));
          socket.close(1008, "Owner authentication required");
        }
      }, 6000);
      socket.onmessage = ({ data }) => {
        if (typeof data !== "string") {
          socket.close(1003, "binary protocol events are unsupported");
          return;
        }
        let event: unknown;
        try {
          event = JSON.parse(data);
        } catch {
          socket.close(1002, "invalid JSON protocol event");
          return;
        }
        const envelope = event as Partial<OwnerChallenge>;
        if (!connected) {
          if (envelope?.type === "sam.owner.challenge" && !authenticating) {
            authenticating = true;
            void this.proveOwner(envelope as OwnerChallenge).then(
              (proof) => {
                if (socket.readyState === 1) {
                  socket.send(JSON.stringify({ type: "sam.owner.authenticate", proof }));
                  proofSent = true;
                }
              },
              () => {
                clearTimeout(timeout);
                reject(new Error("Open Sam's owner window to connect"));
                socket.close(1008, "Owner authentication required");
              },
            );
            return;
          }
          if ((event as { type?: string })?.type !== "sam.owner.accepted" || !proofSent) {
            clearTimeout(timeout);
            reject(new Error("Sam owner authentication failed"));
            socket.close(1008, "Owner authentication required");
            return;
          }
          clearTimeout(timeout);
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
          return;
        }
        observer.onEvent(event);
      };
      socket.onerror = () => {
        if (!connected) {
          clearTimeout(timeout);
          reject(new Error("Sam core WebSocket connection failed"));
        }
      };
      socket.onclose = ({ reason }) => {
        clearTimeout(timeout);
        if (!connected) {
          reject(new Error(reason || "Sam core WebSocket closed during connection"));
        } else if (!intentionallyClosed) {
          observer.onDisconnect(reason || "Sam core WebSocket disconnected");
        }
      };
      socket.onopen = () => {};
    });
  }
}
