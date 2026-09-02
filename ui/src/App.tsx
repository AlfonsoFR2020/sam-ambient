import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AmbientScene } from "./ambient/AmbientScene";
import { toAmbientVisualModel } from "./ambient/model";
import {
  applyLocalPreference,
  type ControlAction,
  commandForAction,
  DEFAULT_VISUAL_PREFERENCES,
} from "./controls/model";
import { DemoTransport } from "./demo/scenarios";
import type { UiState } from "./protocol/types";
import { ProtocolClient } from "./state/client";
import { BrowserEventTransport } from "./transport/browser";
import { type NativeEventSource, TauriLocalTransport } from "./transport/tauri";
import { browserScheduler, type ProtocolTransport } from "./transport/transport";
import { WebSocketTransport } from "./transport/websocket";

declare global {
  interface Window {
    __SAM_NATIVE_EVENT_SOURCE__?: NativeEventSource;
  }
}

const chooseTransport = (): ProtocolTransport => {
  if (window.__SAM_NATIVE_EVENT_SOURCE__) {
    return new TauriLocalTransport(window.__SAM_NATIVE_EVENT_SOURCE__);
  }
  const queryMode = new URLSearchParams(window.location.search).get("transport");
  const mode = queryMode ?? import.meta.env.VITE_SAM_TRANSPORT ?? "demo";
  if (mode === "core") return new WebSocketTransport();
  if (mode === "browser") return new BrowserEventTransport();
  return new DemoTransport(browserScheduler);
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
  const controlsId = useId();
  const transport = useMemo(chooseTransport, []);
  const client = useMemo(() => new ProtocolClient(transport, browserScheduler), [transport]);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const stateRef = useRef(state);
  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULT_VISUAL_PREFERENCES,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  const [controlsOpen, setControlsOpen] = useState(false);
  const [commandError, setCommandError] = useState<string>();
  const visual = toAmbientVisualModel(state, preferences.brightness / 100);
  stateRef.current = state;

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  const applyAction = useCallback(
    (action: ControlAction) => {
      const command = commandForAction(action, stateRef.current);
      if (command) {
        setCommandError(undefined);
        void client.sendControl(command).catch((error: unknown) => {
          setCommandError(error instanceof Error ? error.message : "Control command failed");
        });
      } else {
        setPreferences((current) => applyLocalPreference(current, action));
      }
    },
    [client],
  );

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setControlsOpen(false);
        if (document.fullscreenElement) void document.exitFullscreen();
      } else if (event.key.toLowerCase() === "m" && !event.ctrlKey && !event.metaKey) {
        applyAction({ type: "microphone.set", enabled: !stateRef.current.microphoneEnabled });
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        applyAction({ type: "emergency_stop" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyAction]);

  const pending = state.pendingCommandIds.length > 0;
  return (
    <main className="sam-shell" data-reduced-motion={preferences.reducedMotion || undefined}>
      <AmbientScene model={visual} reducedMotion={preferences.reducedMotion} />
      <header className="status">
        <span className="status__mark" data-connected={visual.connected} />
        <strong>Sam</strong>
        <span>{visual.label}</span>
        <small>{transport.name}</small>
      </header>
      {preferences.transcriptVisible && <Transcript state={state} />}
      <button
        className="controls-reveal"
        type="button"
        aria-expanded={controlsOpen}
        aria-controls={controlsId}
        onClick={() => setControlsOpen((open) => !open)}
      >
        {controlsOpen ? "Close" : "Controls"}
      </button>
      {controlsOpen && (
        <section className="controls" id={controlsId} aria-label="Sam controls">
          <button
            type="button"
            disabled={pending || state.connection !== "connected"}
            onClick={() =>
              applyAction({ type: "microphone.set", enabled: !state.microphoneEnabled })
            }
          >
            Microphone {state.microphoneEnabled ? "on" : "muted"}
          </button>
          <button
            type="button"
            disabled={pending || state.connection !== "connected"}
            onClick={() =>
              applyAction({ type: "tts_output.set", enabled: !state.ttsOutputEnabled })
            }
          >
            Voice {state.ttsOutputEnabled ? "on" : "muted"}
          </button>
          <button
            type="button"
            disabled={state.connection !== "connected"}
            onClick={() => applyAction({ type: "stop_speaking" })}
          >
            Stop speaking
          </button>
          <button
            className="controls__emergency"
            type="button"
            disabled={state.connection !== "connected"}
            onClick={() => applyAction({ type: "emergency_stop" })}
          >
            Emergency stop
          </button>
          <button
            type="button"
            onClick={() =>
              applyAction({ type: "transcript.set", visible: !preferences.transcriptVisible })
            }
          >
            Transcript {preferences.transcriptVisible ? "shown" : "hidden"}
          </button>
          <button
            type="button"
            onClick={() =>
              applyAction({ type: "reduced_motion.set", enabled: !preferences.reducedMotion })
            }
          >
            Reduced motion {preferences.reducedMotion ? "on" : "off"}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            Toggle fullscreen
          </button>
          <label className="brightness">
            <span>Intensity</span>
            <input
              aria-label="Visual intensity"
              type="range"
              min="25"
              max="100"
              value={preferences.brightness}
              onChange={(event) =>
                applyAction({ type: "brightness.set", value: Number(event.currentTarget.value) })
              }
            />
          </label>
          <p className="controls__hint">M mute · Ctrl Shift X stop · Esc close</p>
        </section>
      )}
      {(state.protocolError || commandError) && (
        <p className="protocol-error">{commandError ?? `Protocol: ${state.protocolError}`}</p>
      )}
    </main>
  );
}
