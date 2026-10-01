import type { UiState } from "./protocol/types";

export interface StatusPresentation {
  label?: string;
  notice?: string;
  limitations: readonly string[];
}

const unavailable = (value: string | undefined): boolean => {
  const status = value?.toLowerCase() ?? "";
  return (
    !status ||
    ["unavailable", "missing", "failed", "disabled"].some((word) => status.includes(word))
  );
};

export const friendlyStartupReason = (reason: string | undefined): string | undefined => {
  if (!reason) return undefined;
  if (/inventory.*temporarily unavailable|waiting for.*model inventory/i.test(reason))
    return "Sam is waiting for LM Studio’s model inventory.";
  if (/inventory could not be read/i.test(reason))
    return "Sam could not read LM Studio’s models. Rescan or check the local service.";
  if (/no conversational model installed/i.test(reason))
    return "LM Studio responded, but no conversational model is installed.";
  if (/several local conversational models/i.test(reason))
    return "Several local models are available. Choose one to continue.";
  if (/no usable local chat model|no conversational model/i.test(reason))
    return "No conversational model is ready. Start or load a local model, then rescan.";
  if (/no supported local provider|no local provider/i.test(reason))
    return "No local AI service is ready. Start one, then rescan.";
  if (/startup\/load failed|startup failed/i.test(reason))
    return "A local model could not be loaded. Retry or choose another model.";
  if (/timed out/i.test(reason)) return "Local model setup took too long. Retry or rescan.";
  return "Local setup needs attention. Check details or rescan.";
};

export function statusPresentation(state: UiState): StatusPresentation {
  if (state.applicationStopped) return { label: "Stopped", limitations: [] };
  if (state.connection !== "connected") {
    return {
      label: state.sessionId ? "Reconnecting" : "Starting Sam",
      notice:
        state.connection === "offline" && state.protocolError
          ? "Sam cannot reach its local service. It will keep retrying."
          : state.sessionId
            ? "The local service disconnected. Sam is reconnecting."
            : "Connecting to Sam’s local service…",
      limitations: [],
    };
  }
  if (!state.sessionId) {
    return {
      label: "Preparing Sam",
      notice: "Connected to the local service. Waiting for startup status…",
      limitations: [],
    };
  }
  if (state.providerDiscovery.status === "scanning") {
    return {
      label: "Checking local models",
      notice: state.providerDiscovery.retrying
        ? "Sam is waiting for its model inventory and will retry shortly."
        : state.startupLifecycle === "loading_model"
          ? `Loading ${state.pendingModel ?? "a local model"}…`
          : "Checking available local services and conversational models…",
      limitations: [],
    };
  }
  const limitations: string[] = [];
  if (!state.model) {
    const modelNotice =
      state.startupLifecycle === "loading_model"
        ? `Loading ${state.pendingModel ?? "a local model"}…`
        : state.startupLifecycle === "waiting_for_model_choice"
          ? "Choose a local conversational model to continue."
          : (friendlyStartupReason(state.diagnosticReason ?? state.selectionReason) ??
            (state.startupLifecycle === "starting"
              ? "Checking local conversational models…"
              : "A local conversational model is needed for replies. Text controls remain available."));
    limitations.push(modelNotice);
  }
  if (state.sttStatus && unavailable(state.sttStatus))
    limitations.push("Voice input is unavailable; text input remains available.");
  if (state.ttsBackend && unavailable(state.ttsBackend))
    limitations.push("Spoken output is unavailable; responses remain readable.");
  return {
    notice: limitations[0],
    limitations,
  };
}
