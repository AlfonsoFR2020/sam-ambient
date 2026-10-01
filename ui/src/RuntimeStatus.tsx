import type { UiState } from "./protocol/types";
import { friendlyStartupReason, statusPresentation } from "./status";

export function SpeechStatusFields({ state }: { state: UiState }) {
  const lastKnown = state.connection === "connected" ? "" : " (last known)";
  return (
    <>
      <dt>Speech input</dt>
      <dd>
        {state.sttHealth?.status === "degraded"
          ? state.sttHealth.reason
          : (state.sttStatus ?? "Waiting for readiness")}
        {lastKnown}
      </dd>
      <dt>Microphone</dt>
      <dd>
        {state.voiceInputHealth?.status === "degraded"
          ? state.voiceInputHealth.reason
          : state.microphoneEnabled
            ? "Capture preference enabled"
            : "Muted"}
        {lastKnown}
      </dd>
      <dt>Spoken output</dt>
      <dd>
        {state.synthesisHealth?.status === "degraded"
          ? state.synthesisHealth.reason
          : state.playbackHealth?.status === "degraded"
            ? state.playbackHealth.reason
            : (state.ttsBackend ?? "Waiting for readiness")}
        {lastKnown}
      </dd>
      <dt>Effective voice</dt>
      <dd>
        {state.ttsSelection ?? "Not selected yet"}
        {lastKnown}
      </dd>
    </>
  );
}

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
        <dt>Discovery</dt>
        <dd>
          {state.providerDiscovery.reason
            ? friendlyStartupReason(state.providerDiscovery.reason)
            : state.providerDiscovery.status}
          {state.connection === "connected" ? "" : " (last known)"}
        </dd>
        {state.selectionReason && (
          <>
            <dt>Selection detail</dt>
            <dd>{state.selectionReason}</dd>
          </>
        )}
        <SpeechStatusFields state={state} />
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
