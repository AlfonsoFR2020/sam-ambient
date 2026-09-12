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
import { QuitDialog, ShutdownStatus } from "./QuitDialog";
import { RuntimeStatus } from "./RuntimeStatus";
import { ProtocolClient } from "./state/client";
import { statusPresentation } from "./status";
import { BrowserEventTransport } from "./transport/browser";
import { type NativeEventSource, TauriLocalTransport } from "./transport/tauri";
import { browserScheduler, type ProtocolTransport } from "./transport/transport";
import { WebSocketTransport } from "./transport/websocket";
import { settingsFromCurrentControls } from "./visual-engine/settings";

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
  const mode = queryMode ?? import.meta.env.VITE_SAM_TRANSPORT ?? "core";
  if (mode === "core") return new WebSocketTransport();
  if (mode === "browser") return new BrowserEventTransport();
  return new DemoTransport(browserScheduler);
};

function Transcript({ state }: { state: UiState }) {
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    if (region.current) region.current.scrollTop = region.current.scrollHeight;
  });
  if (!state.transcript.length && !state.provisionalTranscript) return null;
  return (
    <section ref={region} className="transcript" aria-label="Transcript" aria-live="polite">
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

const TOOL_STATUS_LABELS: Readonly<Record<string, string>> = {
  "tool.requested": "requested",
  "tool.authorizing": "checking access",
  "tool.approval_requested": "needs approval",
  "tool.started": "running",
  "tool.completed": "completed",
  "tool.failed": "failed",
  "tool.cancelled": "cancelled",
  "tool.denied": "denied",
};

function ToolActivity({
  state,
  applyAction,
}: {
  state: UiState;
  applyAction: (action: ControlAction) => void;
}) {
  const activity = state.latestToolActivity;
  const approval = state.pendingToolApproval;
  if (!activity && !approval) return null;
  const pending = state.pendingCommandIds.length > 0;
  return (
    <aside className="tool-activity" aria-live="polite">
      {activity && (
        <p>
          <span>Capability</span>
          <strong>{activity.toolId}</strong>
          <small>{TOOL_STATUS_LABELS[activity.eventType] ?? activity.eventType}</small>
          {activity.detail && <em>{activity.detail}</em>}
        </p>
      )}
      {approval && (
        <div className="tool-approval">
          <p>{approval.description}</p>
          {approval.riskClass && <small>{approval.riskClass}</small>}
          {approval.details && (
            <details>
              <summary>Review request</summary>
              <code>{approval.details}</code>
            </details>
          )}
          <div>
            <button
              type="button"
              disabled={pending || state.connection !== "connected"}
              onClick={() => applyAction({ type: "tool.approve", toolCallId: approval.toolCallId })}
            >
              Allow
            </button>
            <button
              type="button"
              disabled={pending || state.connection !== "connected"}
              onClick={() => applyAction({ type: "tool.deny", toolCallId: approval.toolCallId })}
            >
              Deny
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export default function App() {
  const controlsId = useId();
  const controlsButton = useRef<HTMLButtonElement>(null);
  const transport = useMemo(chooseTransport, []);
  const client = useMemo(() => new ProtocolClient(transport, browserScheduler), [transport]);
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const stateRef = useRef(state);
  const [preferences, setPreferences] = useState(() => ({
    ...DEFAULT_VISUAL_PREFERENCES,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  }));
  const [controlsOpen, setControlsOpen] = useState(false);
  const [quitConfirmation, setQuitConfirmation] = useState(false);
  const [quitRequested, setQuitRequested] = useState(false);
  const [commandError, setCommandError] = useState<string>();
  const [textRequest, setTextRequest] = useState("");
  const visual = toAmbientVisualModel(state, preferences.brightness / 100);
  const visualSettings = useMemo(
    () => settingsFromCurrentControls(preferences.brightness, preferences.reducedMotion),
    [preferences.brightness, preferences.reducedMotion],
  );
  const runtimeStatus = statusPresentation(state);
  stateRef.current = state;

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () =>
      setPreferences((current) => ({ ...current, reducedMotion: preference.matches }));
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);

  const applyAction = useCallback(
    (action: ControlAction) => {
      const command = commandForAction(action, stateRef.current);
      if (command) {
        setCommandError(undefined);
        void client.sendControl(command).catch((error: unknown) => {
          if (action.type === "application.quit") setQuitRequested(false);
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

  const quitSam = useCallback(() => {
    if (stateRef.current.connection !== "connected") return;
    setQuitConfirmation(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (controlsOpen) controlsButton.current?.focus();
        setControlsOpen(false);
        setQuitConfirmation(false);
        if (document.fullscreenElement) void document.exitFullscreen();
      } else if (event.ctrlKey && event.key.toLowerCase() === "q") {
        event.preventDefault();
        quitSam();
      } else if (
        event.key.toLowerCase() === "m" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        applyAction({ type: "microphone.set", enabled: !stateRef.current.microphoneEnabled });
      } else if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "x") {
        event.preventDefault();
        applyAction({ type: "emergency_stop" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyAction, quitSam, controlsOpen]);

  const pending = state.pendingCommandIds.length > 0;
  return (
    <main className="sam-shell" data-reduced-motion={preferences.reducedMotion || undefined}>
      {!quitRequested && !state.applicationStopped && (
        <AmbientScene model={visual} state={state} settings={visualSettings} />
      )}
      <header className="status">
        <span className="status__mark" data-connected={visual.connected} />
        <strong>Sam</strong>
        <span>
          {state.applicationStopped
            ? "Stopped · you can close this window"
            : (runtimeStatus.label ?? visual.label)}
        </span>
        {!state.capabilityAuthorityActive && (
          <small className="status__authority" title={state.capabilityAuthorityReason}>
            capabilities disabled
          </small>
        )}
        {state.updateActivity && (
          <small className="status__update" title={state.updateActivity.error}>
            {state.updateActivity.componentId} · {state.updateActivity.state.toLowerCase()}
          </small>
        )}
      </header>
      {runtimeStatus.notice && !quitRequested && !state.applicationStopped && (
        <output className="status-notice">{runtimeStatus.notice}</output>
      )}
      <QuitDialog
        open={quitConfirmation && !state.applicationStopped && !quitRequested}
        onCancel={() => setQuitConfirmation(false)}
        onConfirm={() => {
          setQuitConfirmation(false);
          setQuitRequested(true);
          setControlsOpen(false);
          applyAction({ type: "application.quit" });
        }}
      />
      {(quitRequested || state.applicationStopped) && (
        <ShutdownStatus stopped={state.applicationStopped === true} />
      )}
      {preferences.transcriptVisible && <Transcript state={state} />}
      <ToolActivity state={state} applyAction={applyAction} />
      <button
        className="controls-reveal"
        ref={controlsButton}
        type="button"
        aria-expanded={controlsOpen}
        aria-controls={controlsId}
        onClick={() => setControlsOpen((open) => !open)}
      >
        {controlsOpen ? "Close" : "Controls"}
      </button>
      {controlsOpen && (
        <section className="controls" id={controlsId} aria-label="Sam controls">
          <RuntimeStatus state={state} />
          <form
            className="controls__request"
            onSubmit={(event) => {
              event.preventDefault();
              const text = textRequest.trim();
              if (!text || state.connection !== "connected") return;
              applyAction({ type: "user_message.submit", text });
              setTextRequest("");
            }}
          >
            <label htmlFor={`${controlsId}-request`}>Text request</label>
            <div>
              <input
                id={`${controlsId}-request`}
                type="text"
                value={textRequest}
                maxLength={4000}
                placeholder="Ask Sam…"
                onChange={(event) => setTextRequest(event.currentTarget.value)}
              />
              <button
                type="submit"
                disabled={!textRequest.trim() || pending || state.connection !== "connected"}
              >
                Send
              </button>
            </div>
          </form>
          <button
            type="button"
            disabled={pending || state.connection !== "connected"}
            onClick={() =>
              applyAction({ type: "microphone.set", enabled: !state.microphoneEnabled })
            }
            title="Turn listening on or off. Text requests remain available."
          >
            Microphone {state.microphoneEnabled ? "on" : "muted"}
          </button>
          <button
            type="button"
            disabled={pending || state.connection !== "connected"}
            onClick={() =>
              applyAction({ type: "tts_output.set", enabled: !state.ttsOutputEnabled })
            }
            title="Turn future spoken replies on or off. Text responses remain visible."
          >
            Voice {state.ttsOutputEnabled ? "on" : "muted"}
          </button>
          <button
            type="button"
            disabled={state.connection !== "connected"}
            onClick={() => applyAction({ type: "stop_speaking" })}
            title="Stop only the current spoken reply. Sam remains active."
          >
            Stop speaking
          </button>
          <button
            className="controls__emergency"
            type="button"
            disabled={state.connection !== "connected"}
            onClick={() => applyAction({ type: "emergency_stop" })}
            title="Cancel the active model response, tools, queued speech and playback."
          >
            Emergency stop
          </button>
          <button
            className="controls__capability-revoke"
            type="button"
            disabled={
              pending || state.connection !== "connected" || !state.capabilityAuthorityActive
            }
            onClick={() => applyAction({ type: "capabilities.revoke_all" })}
            title="Revoke computer-action authority and pending approvals until trusted restoration."
          >
            {state.capabilityAuthorityActive ? "Disable all capabilities" : "Capabilities disabled"}
          </button>
          <button
            type="button"
            onClick={() =>
              applyAction({ type: "transcript.set", visible: !preferences.transcriptVisible })
            }
            title="Show or hide the conversation transcript on this device."
          >
            Transcript {preferences.transcriptVisible ? "shown" : "hidden"}
          </button>
          <button
            type="button"
            onClick={() =>
              applyAction({ type: "reduced_motion.set", enabled: !preferences.reducedMotion })
            }
            title="Reduce continuous ambient animation on this device."
          >
            Reduced motion {preferences.reducedMotion ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            title="Enter or leave fullscreen presentation. Escape also exits."
          >
            Toggle fullscreen
          </button>
          <button
            type="button"
            disabled={state.connection !== "connected" || quitRequested}
            onClick={quitSam}
            title="Stop Sam and close its window where supported (Ctrl+Q)"
          >
            Quit Sam
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
          <p className="controls__hint">M mute · Ctrl Shift X stop · Ctrl Q quit · Esc close</p>
        </section>
      )}
      {(state.protocolError || commandError) && (
        <p className="protocol-error">{commandError ?? `Protocol: ${state.protocolError}`}</p>
      )}
    </main>
  );
}
