import type { UiState } from "./protocol/types";

export function RuntimeStatus({ state }: { state: UiState }) {
  return (
    <details className="runtime-status">
      <summary>
        {state.model
          ? `${state.provider} · ${state.model}`
          : (state.selectionReason ?? "Connecting to Sam…")}
      </summary>
      {state.model && <p>{state.selectionReason}</p>}
      <p>Speech recognition: {state.sttStatus ?? "Status not reported"}</p>
      <p>Spoken output: {state.ttsBackend ?? "Status not reported"}</p>
    </details>
  );
}
