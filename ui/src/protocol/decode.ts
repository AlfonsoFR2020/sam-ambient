import { PROTOCOL_VERSION, type ProtocolEvent } from "./types";

const OPTIONAL_IDS = [
  "session_id",
  "turn_id",
  "generation_id",
  "cancellation_id",
  "tool_call_id",
  "update_tx_id",
] as const;

export class ProtocolDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolDecodeError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function decodeProtocolEvent(raw: unknown): ProtocolEvent {
  if (!isObject(raw)) throw new ProtocolDecodeError("protocol message must be an object");
  if (raw.protocol !== PROTOCOL_VERSION) {
    throw new ProtocolDecodeError(
      `unsupported protocol ${String(raw.protocol)}; expected ${PROTOCOL_VERSION}`,
    );
  }
  if (typeof raw.type !== "string" || !raw.type.includes(".") || raw.type.trim() !== raw.type) {
    throw new ProtocolDecodeError("event type must be a namespaced string");
  }
  if (
    !Number.isSafeInteger(raw.monotonic_ms) ||
    typeof raw.monotonic_ms !== "number" ||
    raw.monotonic_ms < 0
  ) {
    throw new ProtocolDecodeError("monotonic_ms must be a non-negative safe integer");
  }
  if (!isObject(raw.payload)) throw new ProtocolDecodeError("payload must be an object");

  const event: ProtocolEvent = {
    protocol: PROTOCOL_VERSION,
    type: raw.type,
    monotonic_ms: raw.monotonic_ms,
    payload: raw.payload,
  };
  for (const key of OPTIONAL_IDS) {
    const value = raw[key];
    if (value !== undefined) {
      if (typeof value !== "string" || value.trim() === "") {
        throw new ProtocolDecodeError(`${key} must be a non-blank string`);
      }
      event[key] = value;
    }
  }
  return event;
}
