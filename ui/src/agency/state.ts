import type { ProtocolEvent } from "../protocol/types";

export interface AgencyAction {
  id: string;
  capability: string;
  state: string;
  output?: string;
  result?: Record<string, unknown>;
  truncated?: boolean;
}
export const TERMINAL_ACTION_STATES = new Set([
  "completed",
  "failed",
  "cancelled",
  "denied",
  "stale",
]);

export function projectAgencyEvent(
  actions: readonly AgencyAction[],
  event: ProtocolEvent,
): readonly AgencyAction[] {
  if (event.type !== "capability.state") return actions;
  const { request_id: id, capability, state } = event.payload;
  if (typeof id !== "string" || typeof capability !== "string" || typeof state !== "string")
    return actions;
  const prior = actions.find((action) => action.id === id);
  // Events from another owner connection or retired operations cannot populate this console.
  if (
    !prior ||
    capability !== prior.capability ||
    !["queued", "running", ...TERMINAL_ACTION_STATES].includes(state) ||
    TERMINAL_ACTION_STATES.has(prior.state)
  )
    return actions;
  const output =
    event.payload.result !== undefined
      ? JSON.stringify(event.payload.result, null, 2)
      : typeof event.payload.error === "string"
        ? event.payload.error
        : prior.output;
  return actions.map((action) =>
    action.id === id
      ? {
          ...action,
          capability,
          state,
          output: output?.slice(0, 20_000),
          result:
            event.payload.result &&
            typeof event.payload.result === "object" &&
            !Array.isArray(event.payload.result) &&
            JSON.stringify(event.payload.result).length <= 16_384
              ? (event.payload.result as Record<string, unknown>)
              : undefined,
          truncated: event.payload.truncated === true || (output?.length ?? 0) > 20_000,
        }
      : state === "completed" &&
          ["memory.delete", "memory.correct"].includes(capability) &&
          action.capability.startsWith("memory.")
        ? { ...action, output: undefined, result: undefined, truncated: undefined }
        : action,
  );
}
