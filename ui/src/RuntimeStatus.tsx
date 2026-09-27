import type { UiState } from "./protocol/types";
import { friendlyStartupReason, statusPresentation } from "./status";

export function RuntimeStatus({ state }: { state: UiState }) {
  const presentation = statusPresentation(state);
  return (
    <details className="runtime-status">
      <summary>
        {state.model
          ? `${state.provider} · ${state.model}${state.connection === "connected" ? "" : " (last known)"}`
          : (friendlyStartupReason(state.selectionReason) ?? "Local model not ready")}
      </summary>
      <dl>
        <dt>Local model</dt>
        <dd>
          {state.model
            ? `${state.provider} · ${state.model}${state.connection === "connected" ? "" : " (last known)"}`
            : "Not ready"}
        </dd>
        <dt>Provider</dt>
        <dd>{state.provider ?? "Waiting for local provider discovery"}</dd>
        {state.selectionReason && (
          <>
            <dt>Selection detail</dt>
            <dd>{state.selectionReason}</dd>
          </>
        )}
        <dt>Speech input</dt>
        <dd>
          {state.sttHealth?.status === "degraded"
            ? state.sttHealth.reason
            : (state.sttStatus ?? "Waiting for readiness")}
        </dd>
        <dt>Microphone</dt>
        <dd>
          {state.voiceInputHealth?.status === "degraded"
            ? state.voiceInputHealth.reason
            : state.microphoneEnabled
              ? "Enabled"
              : "Muted"}
        </dd>
        <dt>Spoken output</dt>
        <dd>
          {state.synthesisHealth?.status === "degraded"
            ? state.synthesisHealth.reason
            : state.playbackHealth?.status === "degraded"
              ? state.playbackHealth.reason
              : (state.ttsBackend ?? "Waiting for readiness")}
        </dd>
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
