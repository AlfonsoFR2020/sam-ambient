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

export function statusPresentation(state: UiState): StatusPresentation {
  if (state.applicationStopped) return { label: "Stopped", limitations: [] };
  if (!state.sessionId) {
    return {
      label: "Starting Sam",
      notice:
        state.connection === "offline"
          ? "Waiting for the local runtime…"
          : "Checking local models and preparing speech…",
      limitations: [],
    };
  }
  if (state.connection !== "connected") {
    return {
      label: "Reconnecting",
      notice: "The local core is restarting. Your committed conversation is preserved.",
      limitations: [],
    };
  }
  const limitations: string[] = [];
  if (!state.model) {
    limitations.push(
      state.selectionReason
        ? `Local model unavailable: ${state.selectionReason}`
        : "A local conversational model is required for replies.",
    );
  }
  if (unavailable(state.sttStatus))
    limitations.push("Voice input is unavailable; text input remains available.");
  if (unavailable(state.ttsBackend))
    limitations.push("Spoken output is unavailable; responses remain readable.");
  return {
    notice: limitations.length ? limitations.join(" ") : undefined,
    limitations,
  };
}
