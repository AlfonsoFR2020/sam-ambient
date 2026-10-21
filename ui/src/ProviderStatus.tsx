import { useEffect, useState } from "react";
import { type PresencePresentation, presencePresentation } from "./presence";
import type { UiState } from "./protocol/types";
import { type ProviderPresentation, providerPresentation } from "./provider-lifecycle";

export function waitingLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}
function Activity({ presentation }: { presentation: ProviderPresentation | PresencePresentation }) {
  const [started] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!presentation.busy) return;
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, (performance.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [presentation.busy, started]);
  return (
    <div className="provider-status" data-provider-phase={presentation.phase}>
      <output aria-live="polite">{presentation.label}</output>
      <small>{presentation.detail}</small>
      {presentation.busy && elapsed >= 2 && (
        <span
          className="provider-status__elapsed"
          title="Time this window has observed the current operation"
          aria-live="off"
        >
          Waiting {waitingLabel(elapsed)}
        </span>
      )}
    </div>
  );
}
export function ProviderStatus({ state }: { state: UiState }) {
  const presence = presencePresentation(state);
  const presentation = [
    "submitting",
    "submitted",
    "thinking",
    "responding",
    "preparing_speech",
    "speaking",
    "departing",
    "retiring",
    "recovering",
  ].includes(presence.phase)
    ? presence
    : providerPresentation(state);
  return <Activity key={presentation.key} presentation={presentation} />;
}
