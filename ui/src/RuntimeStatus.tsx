import type { UiState } from "./protocol/types";
import { statusPresentation } from "./status";

export function RuntimeStatus({ state }: { state: UiState }) {
  const presentation = statusPresentation(state);
  return (
    <details className="runtime-status">
      <summary>
        {state.model
          ? `${state.provider} · ${state.model}`
          : (state.selectionReason ?? "Connecting to Sam…")}
      </summary>
      <dl>
        <dt>Local model</dt>
        <dd>{state.model ? `${state.provider} · ${state.model}` : "Not ready"}</dd>
        <dt>Provider</dt>
        <dd>{state.selectionReason ?? "Waiting for local provider discovery"}</dd>
        <dt>Speech input</dt>
        <dd>{state.sttStatus ?? "Waiting for readiness"}</dd>
        <dt>Spoken output</dt>
        <dd>{state.ttsBackend ?? "Waiting for readiness"}</dd>
        {state.ttsSelection && (
          <>
            <dt>Voice</dt>
            <dd>{state.ttsSelection}</dd>
          </>
        )}
        <dt>Privacy</dt>
        <dd>
          {state.cloudAllowed === true
            ? "Cloud use explicitly allowed"
            : state.cloudAllowed === false
              ? "Local only · no cloud fallback"
              : "Cloud policy not reported"}
        </dd>
      </dl>
      {presentation.limitations.length > 0 && (
        <p className="runtime-status__availability">{presentation.limitations.join(" ")}</p>
      )}
    </details>
  );
}
