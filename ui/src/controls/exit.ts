import type { UiState } from "../protocol/types";

export function exitCleanupSummary(
  state: UiState,
  settings: NonNullable<UiState["lifecycleSettings"]>,
): string | null {
  if (settings.modelOnExit === "keep" && settings.providerOnExit === "keep") return null;
  const service = state.providerCatalog.find((item) => item.id === state.provider);
  if (!state.provider || !service)
    return "No active local AI service is known. Exit cleanup applies only to resources Sam created.";
  const parts: string[] = [];
  if (settings.modelOnExit !== "keep") {
    parts.push(
      state.provider !== "lm-studio"
        ? `${state.provider} does not support Sam's model-unload action.`
        : service.selectedModelLoadedBySam === true
          ? "Sam will request unload of its LM Studio model on Quit."
          : service.selectedModelLoadedBySam === false
            ? "The selected model was already loaded; Sam will leave it loaded."
            : "Sam can unload only an LM Studio model it loaded itself.",
    );
  }
  if (settings.providerOnExit !== "keep") {
    parts.push(
      service.startedBySam === true
        ? "Sam will request a stop of the service it started on Quit."
        : service.startedBySam === false
          ? "This service was already running; Sam will leave it running."
          : "Sam can stop only a service it started itself.",
    );
  }
  return parts.join(" ");
}
