import type { UiState } from "./protocol/types";

export type ProviderVisualPhase =
  | "discovering"
  | "connecting"
  | "loading"
  | "switching"
  | "unloading"
  | "ready"
  | "unloaded"
  | "failed"
  | "stopped";
export interface ProviderPresentation {
  phase: ProviderVisualPhase;
  key: string;
  label: string;
  detail: string;
  busy: boolean;
}
const providerName = (id?: string) =>
  id === "lm-studio" ? "LM Studio" : id === "ollama" ? "Ollama" : id;

/** Presentation only, after the reducer's correlation/session/terminal gates. */
export function providerPresentation(state: UiState): ProviderPresentation {
  const provider = providerName(
    state.pendingProvider ??
      state.provider ??
      (state.providerCatalog.length === 1 ? state.providerCatalog[0].id : undefined),
  );
  const model = state.pendingModel ?? state.model;
  let phase: ProviderVisualPhase, label: string, detail: string;
  if (state.applicationStopped) {
    phase = "stopped";
    label = "Sam stopped";
    detail = "You can close this window.";
  } else if (
    state.connection !== "connected" ||
    !state.sessionId ||
    state.providerDiscovery.status === "stale"
  ) {
    phase = "connecting";
    label = state.sessionId ? "Reconnecting to Sam" : "Connecting to Sam";
    detail = "Last-known model state is not live.";
  } else if (state.startupLifecycle === "unloading_model") {
    phase = "unloading";
    label = model ? `Unloading ${model}` : "Unloading model";
    detail = "Waiting for the provider to confirm removal.";
  } else if (state.startupLifecycle === "loading_model") {
    phase =
      state.model &&
      (state.pendingModel !== state.model || state.pendingProvider !== state.provider)
        ? "switching"
        : "loading";
    label = `${phase === "switching" ? "Switching to" : "Loading"} ${state.pendingModel ?? "selected model"}`;
    detail = `${provider ? `${provider} · ` : ""}Loading can take a minute or more. Controls and Quit remain available.`;
  } else if (state.providerDiscovery.status === "scanning") {
    phase = state.providerDiscovery.retrying ? "connecting" : "discovering";
    label = state.providerDiscovery.retrying
      ? `${provider ?? "Provider"} inventory not ready`
      : "Discovering providers";
    detail = state.providerDiscovery.retrying
      ? "Waiting for model inventory; Sam will retry shortly."
      : "Checking installed and available models.";
  } else if (state.providerDiscovery.status === "failed") {
    phase = "failed";
    label = state.model ? "Model change failed" : "Provider temporarily unavailable";
    detail = state.model
      ? "The confirmed model remains available. Retry or Rescan in Controls."
      : "Retry or Rescan in Controls. Text controls remain available.";
  } else if (state.provider && state.model) {
    phase = "ready";
    label = "Model ready";
    detail = `${provider} · ${state.model}`;
  } else if (
    state.startupLifecycle === "blocked" ||
    state.startupLifecycle === "waiting_for_model_choice"
  ) {
    const unloaded = state.providerDiscovery.modelUnloaded === true;
    phase = unloaded || state.providerDiscovery.status === "available" ? "unloaded" : "failed";
    label = unloaded
      ? "Model unloaded"
      : phase === "unloaded"
        ? "Choose a model"
        : "Local model unavailable";
    detail =
      phase === "unloaded"
        ? "Load the selected model or choose another in Controls."
        : "Loading failed or no usable model is ready. Retry or Rescan in Controls.";
  } else {
    phase = "discovering";
    label = "Discovering providers";
    detail = "Waiting for confirmed local model readiness.";
  }
  return {
    phase,
    label,
    detail,
    busy: ["connecting", "discovering", "loading", "switching", "unloading"].includes(phase),
    key: JSON.stringify([
      state.sessionId ?? "unbound",
      phase,
      state.providerDiscovery.requestId ?? "startup",
      state.pendingProvider ?? state.provider ?? "",
      model ?? "",
    ]),
  };
}
