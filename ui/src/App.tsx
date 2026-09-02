import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AmbientScene } from "./ambient/AmbientScene";
import { toAmbientVisualModel } from "./ambient/model";
import { DemoTransport } from "./demo/scenarios";
import type { UiState } from "./protocol/types";
import { ProtocolClient } from "./state/client";
import { BrowserEventTransport } from "./transport/browser";
import { type NativeEventSource, TauriLocalTransport } from "./transport/tauri";
import { browserScheduler, type ProtocolTransport } from "./transport/transport";

declare global {
  interface Window {
    __SAM_NATIVE_EVENT_SOURCE__?: NativeEventSource;
  }
}

const chooseTransport = (): ProtocolTransport => {
  if (window.__SAM_NATIVE_EVENT_SOURCE__) {
    return new TauriLocalTransport(window.__SAM_NATIVE_EVENT_SOURCE__);
  }
  return new URLSearchParams(window.location.search).get("transport") === "browser"
    ? new BrowserEventTransport()
    : new DemoTransport(browserScheduler);
};

function Transcript({ state }: { state: UiState }) {
  return (
    <section className="transcript" aria-label="Transcript" aria-live="polite">
      {state.transcript.slice(-3).map((entry) => (
        <p
          className={`transcript__line transcript__line--${entry.role}`}
          data-interrupted={entry.interrupted || undefined}
          key={entry.id}
        >
          <span>{entry.role === "assistant" ? "Sam" : "You"}</span>
          {entry.text}
          {entry.interrupted && <em> interrupted</em>}
        </p>
      ))}
      {state.provisionalTranscript && (
        <p className="transcript__line transcript__line--provisional">
          <span>{state.provisionalTranscript.role === "assistant" ? "Sam" : "You"}</span>
          {state.provisionalTranscript.text}
        </p>
      )}
    </section>
  );
}

export default function App() {
  const client = useMemo(() => new ProtocolClient(chooseTransport(), browserScheduler), []);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [brightness, setBrightness] = useState(82);
  const visual = toAmbientVisualModel(state, brightness / 100);

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  return (
    <main className="sam-shell">
      <AmbientScene model={visual} />
      <header className="status">
        <span className="status__mark" data-connected={visual.connected} />
        <strong>Sam</strong>
        <span>{visual.label}</span>
      </header>
      <Transcript state={state} />
      <label className="brightness">
        <span>Intensity</span>
        <input
          aria-label="Visual intensity"
          type="range"
          min="25"
          max="100"
          value={brightness}
          onChange={(event) => setBrightness(Number(event.currentTarget.value))}
        />
      </label>
      {state.protocolError && <p className="protocol-error">Protocol: {state.protocolError}</p>}
    </main>
  );
}
