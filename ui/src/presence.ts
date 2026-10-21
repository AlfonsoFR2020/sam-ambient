import type { UiState } from "./protocol/types";
import { providerPresentation } from "./provider-lifecycle";

export type PresencePhase =
  | "starting"
  | "reconnecting"
  | "discovering"
  | "loading"
  | "unloading"
  | "unloaded"
  | "ready"
  | "listening"
  | "submitting"
  | "submitted"
  | "thinking"
  | "responding"
  | "preparing_speech"
  | "speaking"
  | "recovering"
  | "failed"
  | "departing"
  | "retiring";

export interface PresencePresentation {
  phase: PresencePhase;
  key: string;
  label: string;
  detail: string;
  busy: boolean;
}

/** Read-only projection of admitted lifecycle facts, never readiness/progress inference. */
export function presencePresentation(state: UiState): PresencePresentation {
  const provider = providerPresentation(state);
  const lastCommitted = state.transcript.at(-1);
  let phase: PresencePhase,
    label: string,
    detail: string,
    busy = false;
  if (state.applicationStopped || state.pendingShutdownId) {
    phase = state.applicationStopped ? "retiring" : "departing";
    label = state.applicationStopped ? "Shutdown requested" : "Requesting shutdown";
    detail = state.applicationStopped
      ? "Sam accepted Quit. Local cleanup may continue after this window closes."
      : "Waiting for Sam to acknowledge Quit. Work is cancelled by the core.";
  } else if (
    state.connection !== "connected" ||
    !state.sessionId ||
    state.providerDiscovery.status === "stale"
  ) {
    phase = state.sessionId ? "reconnecting" : "starting";
    label = state.sessionId ? "Reconnecting to Sam" : "Starting Sam";
    detail = "Waiting for the local service; model readiness is not confirmed.";
    busy = true;
  } else if (state.conversationalState === "ERROR") {
    phase = "failed";
    label = "Needs attention";
    detail = "The last operation failed. Details and recovery controls remain available.";
  } else if (state.playbackGenerationId || state.conversationalState === "SPEAKING") {
    const started = state.lastMonotonicByType["tts.started"] ?? -1;
    const level = state.lastMonotonicByType["tts.level"] ?? -1;
    phase = level > started ? "speaking" : "preparing_speech";
    label = phase === "speaking" ? "Speaking" : "Preparing spoken response";
    detail =
      phase === "speaking"
        ? "Speech output is being delivered. Stop speaking preserves the written answer."
        : "The written answer is ready; waiting for speech output.";
    busy = phase === "preparing_speech";
  } else if (state.pendingUserMessageId) {
    phase = "submitting";
    label = "Sending request";
    detail = "Waiting for the core to commit your typed turn.";
    busy = true;
  } else if (state.provisionalTranscript?.role === "assistant") {
    phase = "responding";
    label = "Writing response";
    detail = "The local model is producing a response.";
    busy = true;
  } else if (state.conversationalState === "THINKING") {
    phase = "thinking";
    label = "Thinking";
    detail = "Your turn is committed. Waiting for the local model's response.";
    busy = true;
  } else if (
    state.turnId &&
    lastCommitted?.role === "user" &&
    lastCommitted.turnId === state.turnId &&
    !["INTERRUPTED", "RECOVERING"].includes(state.conversationalState)
  ) {
    phase = "submitted";
    label = "Request received";
    detail = "Your turn is committed. Waiting for inference dispatch.";
    busy = true;
  } else if (["INTERRUPTED", "RECOVERING"].includes(state.conversationalState)) {
    phase = "recovering";
    label = "Settling";
    detail = "The interrupted operation is settling; text controls remain available.";
  } else if (provider.busy || provider.phase === "failed" || provider.phase === "unloaded") {
    phase =
      provider.phase === "switching"
        ? "loading"
        : provider.phase === "connecting"
          ? "discovering"
          : (provider.phase as PresencePhase);
    ({ label, detail, busy } = provider);
  } else if (
    state.microphoneEnabled &&
    ["LISTENING", "USER_SPEAKING", "ENDPOINT_CANDIDATE"].includes(state.conversationalState)
  ) {
    phase = "listening";
    label = "Listening";
    detail = "Microphone input and spoken output have separate controls.";
  } else {
    phase = "ready";
    label = "Ready";
    detail = provider.detail;
  }
  return {
    phase,
    label,
    detail,
    busy,
    key: JSON.stringify([
      state.sessionId ?? "unbound",
      phase,
      state.pendingShutdownId ??
        state.pendingUserMessageId ??
        state.generationId ??
        state.turnId ??
        provider.key,
    ]),
  };
}
