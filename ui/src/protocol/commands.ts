import {
  CONTROL_COMMAND_TYPES,
  type ControlCommand,
  type ControlCommandType,
  PROTOCOL_VERSION,
  type UiState,
} from "./types";

export const EMERGENCY_STOP_TARGETS = ["model_generation", "tts_queue", "playback"] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface CommandRuntime {
  nowMs(): number;
  nextId(): string;
}

export const browserCommandRuntime: CommandRuntime = {
  nowMs: () => Math.max(0, Math.round(performance.now())),
  nextId: () => crypto.randomUUID(),
};

export function createControlCommand(
  type: ControlCommandType,
  payload: Record<string, unknown>,
  state: Pick<UiState, "sessionId" | "turnId" | "generationId">,
  runtime: CommandRuntime = browserCommandRuntime,
): ControlCommand {
  const command: ControlCommand = {
    protocol: PROTOCOL_VERSION,
    type,
    command_id: runtime.nextId(),
    monotonic_ms: runtime.nowMs(),
    payload,
  };
  if (state.sessionId) command.session_id = state.sessionId;
  if (state.turnId) command.turn_id = state.turnId;
  if (state.generationId) command.generation_id = state.generationId;
  return command;
}

export function decodeControlCommand(raw: unknown): ControlCommand {
  if (!isObject(raw)) throw new Error("control command must be an object");
  if (raw.protocol !== PROTOCOL_VERSION) throw new Error("unsupported control protocol");
  if (
    typeof raw.type !== "string" ||
    !(CONTROL_COMMAND_TYPES as readonly string[]).includes(raw.type)
  ) {
    throw new Error("unsupported control command");
  }
  if (typeof raw.command_id !== "string" || !raw.command_id.trim()) {
    throw new Error("command_id must be non-blank");
  }
  if (
    typeof raw.monotonic_ms !== "number" ||
    !Number.isSafeInteger(raw.monotonic_ms) ||
    raw.monotonic_ms < 0
  ) {
    throw new Error("monotonic_ms must be a non-negative safe integer");
  }
  if (!isObject(raw.payload)) throw new Error("command payload must be an object");
  return raw as unknown as ControlCommand;
}

export const serializeControlCommand = (command: ControlCommand): string =>
  JSON.stringify(decodeControlCommand(command));
