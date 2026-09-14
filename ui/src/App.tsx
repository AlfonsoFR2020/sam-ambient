import {
  type ButtonHTMLAttributes,
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
import { resolveVisualEngineSettings } from "./visual-engine/settings";
import { DEFAULT_VISUAL_ENGINE_SETTINGS, type VisualEngineSettings } from "./visual-engine/types";

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
  const followNewest = useRef(true);
  useEffect(() => {
    if (region.current && followNewest.current)
      region.current.scrollTop = region.current.scrollHeight;
  });
  if (!state.transcript.length && !state.provisionalTranscript) return null;
  return (
    <section
      ref={region}
      className="transcript"
      aria-label="Transcript"
      aria-live="polite"
      onScroll={(event) => {
        const node = event.currentTarget;
        followNewest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 28;
      }}
    >
      {state.transcript.map((entry) => (
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

const editableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && target.isContentEditable);

interface ShortcutInput {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type ShortcutIntent =
  | "close_surface"
  | "quit"
  | "reload_interface"
  | "microphone"
  | "emergency_stop";

export function shortcutIntent(input: ShortcutInput, editing: boolean): ShortcutIntent | null {
  const key = input.key.toLowerCase();
  if (key === "escape") return "close_surface";
  if (input.ctrlKey && input.shiftKey && key === "x") return "emergency_stop";
  if (input.ctrlKey && !input.shiftKey && !input.metaKey && key === "q") return "quit";
  if (input.ctrlKey && !input.shiftKey && !input.metaKey && key === "r") return "reload_interface";
  if (editing) return null;
  if (input.ctrlKey && !input.shiftKey && !input.metaKey && key === "m") return "microphone";
  return null;
}

function ControlButton({
  help,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { help: string }) {
  const helpId = useId();
  return (
    <div className="control-with-help">
      <button
        {...props}
        className={className}
        type={props.type ?? "button"}
        title={help}
        aria-describedby={helpId}
      />
      <span className="control-tooltip" id={helpId} role="tooltip">
        {help}
      </span>
    </div>
  );
}

const friendlyStartupReason = (reason: string | undefined): string | undefined => {
  if (!reason) return undefined;
  if (/several local conversational models/i.test(reason))
    return "Several local models are available. Choose one to continue.";
  if (/no usable local chat model/i.test(reason))
    return "No conversational model is ready. Rescan after starting or loading a local model.";
  if (/startup\/load failed/i.test(reason))
    return "A local model was found, but it could not be loaded. Retry or choose another model.";
  return reason;
};

export function StartupCard({
  state,
  dismissed = false,
  onDismiss = () => undefined,
  onRestart = () => undefined,
  applyAction = () => undefined,
}: {
  state: UiState;
  dismissed?: boolean;
  onDismiss?: () => void;
  onRestart?: () => void;
  applyAction?: (action: ControlAction) => void;
}) {
  const providerSelectId = useId();
  const modelSelectId = useId();
  const presentation = statusPresentation(state);
  const providers = state.providerCatalog;
  const allChoices = providers.flatMap((provider) =>
    [...new Set([...provider.models, ...provider.installedModels])].map((model) => ({
      provider: provider.id,
      model,
      loaded: provider.models.includes(model),
      current: provider.id === state.provider && model === state.model,
      recommended:
        provider.id === state.pendingProvider && model === state.pendingModel && !state.model,
    })),
  );
  const [providerChoice, setProviderChoice] = useState("auto");
  const choices = allChoices.filter(
    (item) => providerChoice === "auto" || item.provider === providerChoice,
  );
  const [choice, setChoice] = useState("");
  const [remember, setRemember] = useState(true);
  const visible = !dismissed && state.startupLifecycle !== "dismissed";
  if (!visible || state.applicationStopped) return null;
  const technicalReason = state.diagnosticReason ?? presentation.notice;
  const displayedReason = friendlyStartupReason(technicalReason);
  const steps = [
    { label: "Starting core", ready: Boolean(state.sessionId) },
    { label: "Detecting local AI providers", ready: Boolean(state.provider) },
    {
      label:
        state.startupLifecycle === "loading_model"
          ? `Loading ${state.pendingModel ?? "local model"}…`
          : state.model
            ? `Local model ready · ${state.model}`
            : "Selecting a conversational model",
      ready: Boolean(state.model),
    },
    {
      label: state.sttStatus?.toLowerCase().includes("ready")
        ? "Speech recognition ready"
        : "Checking speech recognition",
      ready: Boolean(state.sttStatus),
    },
    { label: "Ready", ready: Boolean(state.model && state.sessionId) },
  ];
  return (
    <aside className="startup-card" aria-label="Sam startup" aria-live="polite">
      <button
        className="startup-card__close"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss startup information"
        title="Hide this startup panel. Sam's readiness does not change."
      >
        ×
      </button>
      <div className="startup-card__identity" aria-hidden="true">
        S
      </div>
      <div>
        <h1>{state.samName ?? "Sam"}</h1>
        {state.samVersion && <small>Version {state.samVersion}</small>}
        {state.samAuthor && <small>{state.samAuthor}</small>}
      </div>
      <ol>
        {steps.map((step) => (
          <li data-ready={step.ready || undefined} key={step.label}>
            {step.label}
          </li>
        ))}
      </ol>
      {displayedReason && <p>{displayedReason}</p>}
      {technicalReason && displayedReason !== technicalReason && (
        <details className="startup-card__details">
          <summary>Technical details</summary>
          <small>{technicalReason}</small>
        </details>
      )}
      {(allChoices.length > 1 || state.startupLifecycle === "waiting_for_model_choice") && (
        <div className="startup-card__choice">
          <label htmlFor={providerSelectId}>Provider</label>
          <select
            id={providerSelectId}
            value={providerChoice}
            onChange={(event) => {
              setProviderChoice(event.target.value);
              setChoice("");
            }}
          >
            <option value="auto">Automatic / recommended</option>
            {providers.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
                disabled={!provider.models.length && !provider.installedModels.length}
              >
                {provider.id} ·{" "}
                {provider.running
                  ? "Available"
                  : provider.installedModels.length
                    ? "Installed"
                    : "Unavailable"}
              </option>
            ))}
          </select>
          <small>
            Automatic uses an explicit or last-used valid model, or the sole local model.
          </small>
          <label htmlFor={modelSelectId}>Conversational model</label>
          <select
            id={modelSelectId}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="">Choose a conversational model…</option>
            {choices.map((item) => (
              <option
                key={`${item.provider}:${item.model}`}
                value={`${item.provider}\t${item.model}`}
              >
                {item.provider} · {item.model} ·{" "}
                {item.current
                  ? "Current"
                  : item.recommended
                    ? "Last used / recommended"
                    : item.loaded
                      ? "Loaded"
                      : "Installed"}
              </option>
            ))}
          </select>
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
            Remember this choice
          </label>
        </div>
      )}
      <div className="startup-card__actions">
        <button type="button" onClick={() => applyAction({ type: "providers.rescan" })}>
          {state.startupLifecycle === "blocked" ? "Retry / Rescan" : "Rescan"}
        </button>
        {choice && (
          <button
            type="button"
            onClick={() => {
              const [provider, model] = choice.split("\t");
              if (provider && model)
                applyAction({ type: "model.select", provider, model, remember });
            }}
          >
            Load selected model
          </button>
        )}
        <button type="button" onClick={onDismiss}>
          {state.model ? "Continue" : "Continue in available mode"}
        </button>
        {state.startupLifecycle === "blocked" && (
          <button type="button" onClick={onRestart}>
            Restart Sam
          </button>
        )}
      </div>
      {!state.model && (
        <small className="startup-card__dismiss-note">
          Hiding this panel does not make a conversational model ready.
        </small>
      )}
    </aside>
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
  }));
  const [visualSettings, setVisualSettings] = useState<VisualEngineSettings>(
    DEFAULT_VISUAL_ENGINE_SETTINGS,
  );
  const [audioSettings, setAudioSettings] = useState({ inputGain: 1, outputGain: 1 });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [quitConfirmation, setQuitConfirmation] = useState(false);
  const [restartConfirmation, setRestartConfirmation] = useState(false);
  const [startupDismissed, setStartupDismissed] = useState(false);
  const [quitRequested, setQuitRequested] = useState(false);
  const [commandError, setCommandError] = useState<string>();
  const [textRequest, setTextRequest] = useState("");
  const [presentedLabel, setPresentedLabel] = useState("Starting Sam");
  const visual = toAmbientVisualModel(state, visualSettings.intensity);
  const runtimeStatus = statusPresentation(state);
  stateRef.current = state;

  useEffect(() => {
    client.start();
    return () => client.stop();
  }, [client]);

  useEffect(() => {
    if (state.visualSettings) setVisualSettings(resolveVisualEngineSettings(state.visualSettings));
  }, [state.visualSettings]);

  useEffect(() => {
    if (state.audioSettings) setAudioSettings(state.audioSettings);
  }, [state.audioSettings]);

  useEffect(() => {
    const next = runtimeStatus.label ?? visual.label;
    if (next === presentedLabel) return;
    const urgent = next === "Needs attention" || next === "Offline" || next === "Stopped";
    const timeout = window.setTimeout(() => setPresentedLabel(next), urgent ? 0 : 180);
    return () => window.clearTimeout(timeout);
  }, [presentedLabel, runtimeStatus.label, visual.label]);

  useEffect(() => {
    if (state.startupLifecycle !== "ready_transition") return;
    const timeout = window.setTimeout(() => setStartupDismissed(true), 900);
    return () => window.clearTimeout(timeout);
  }, [state.startupLifecycle]);

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

  const persistVisual = useCallback(
    (patch: Partial<VisualEngineSettings>) => {
      const next = resolveVisualEngineSettings({ ...visualSettings, ...patch });
      setVisualSettings(next);
      applyAction({ type: "visual_settings.set", settings: next });
    },
    [applyAction, visualSettings],
  );
  const persistAudio = useCallback(() => {
    applyAction({ type: "audio_settings.set", ...audioSettings });
  }, [applyAction, audioSettings]);

  const quitSam = useCallback(() => {
    if (stateRef.current.connection !== "connected") return;
    setQuitConfirmation(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const editing = editableTarget(event.target);
      const intent = shortcutIntent(event, editing);
      if (intent === "close_surface") {
        if (quitConfirmation) setQuitConfirmation(false);
        else if (restartConfirmation) setRestartConfirmation(false);
        else if (controlsOpen) {
          setControlsOpen(false);
          controlsButton.current?.focus();
        } else if (!startupDismissed) setStartupDismissed(true);
        if (document.fullscreenElement) void document.exitFullscreen();
      } else if (intent === "quit") {
        event.preventDefault();
        quitSam();
      } else if (intent === "microphone") {
        event.preventDefault();
        applyAction({ type: "microphone.set", enabled: !stateRef.current.microphoneEnabled });
      } else if (intent === "emergency_stop") {
        event.preventDefault();
        applyAction({ type: "emergency_stop" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyAction, controlsOpen, quitConfirmation, quitSam, restartConfirmation, startupDismissed]);

  const pending = state.pendingCommandIds.length > 0;
  return (
    <main
      className="sam-shell"
      data-reduced-motion={visualSettings.reducedMotion === "on" || undefined}
    >
      {!quitRequested && !state.applicationStopped && (
        <AmbientScene model={visual} state={state} settings={visualSettings} />
      )}
      <StartupCard
        state={state}
        dismissed={startupDismissed}
        onDismiss={() => setStartupDismissed(true)}
        onRestart={() => setRestartConfirmation(true)}
        applyAction={(action) => {
          setStartupDismissed(false);
          applyAction(action);
        }}
      />
      <header className="status">
        <span className="status__mark" data-connected={visual.connected} />
        <strong>Sam</strong>
        <span>
          {state.applicationStopped ? "Stopped · you can close this window" : presentedLabel}
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
      <QuitDialog
        mode="restart"
        open={restartConfirmation && !state.applicationStopped}
        onCancel={() => setRestartConfirmation(false)}
        onConfirm={() => {
          setRestartConfirmation(false);
          setStartupDismissed(false);
          setControlsOpen(false);
          applyAction({ type: "application.restart" });
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
          <section className="controls__group" aria-labelledby={`${controlsId}-conversation`}>
            <h2 id={`${controlsId}-conversation`}>Conversation &amp; voice</h2>
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
            <ControlButton
              help="Enable or pause microphone capture. Ctrl+M."
              disabled={pending || state.connection !== "connected"}
              onClick={() =>
                applyAction({ type: "microphone.set", enabled: !state.microphoneEnabled })
              }
              aria-keyshortcuts="Control+M"
            >
              Microphone {state.microphoneEnabled ? "on" : "muted"}
            </ControlButton>
            {/(speech|microphone)/i.test(state.diagnosticReason ?? "") && (
              <ControlButton
                help="Retry the system-default microphone and local speech-recognition stream."
                disabled={pending || state.connection !== "connected"}
                onClick={() => applyAction({ type: "microphone.set", enabled: true })}
              >
                Retry speech input
              </ControlButton>
            )}
            <ControlButton
              help="Enable or mute future spoken replies. Text responses remain visible."
              disabled={pending || state.connection !== "connected"}
              onClick={() =>
                applyAction({ type: "tts_output.set", enabled: !state.ttsOutputEnabled })
              }
            >
              Voice {state.ttsOutputEnabled ? "on" : "muted"}
            </ControlButton>
            <ControlButton
              help="Stop the current spoken response without shutting down Sam."
              disabled={state.connection !== "connected"}
              onClick={() => applyAction({ type: "stop_speaking" })}
            >
              Stop speaking
            </ControlButton>
            <label
              className="visual-setting"
              title="Adjust Sam's captured microphone signal, not the operating-system microphone level."
            >
              <span>Microphone sensitivity</span>
              <input
                aria-label="Microphone sensitivity"
                type="range"
                min="0"
                max="200"
                value={Math.round(audioSettings.inputGain * 100)}
                onChange={(event) =>
                  setAudioSettings((current) => ({
                    ...current,
                    inputGain: Number(event.currentTarget.value) / 100,
                  }))
                }
                onPointerUp={persistAudio}
                onKeyUp={persistAudio}
              />
            </label>
            <label
              className="visual-setting"
              title="Adjust Sam's playback signal, not the operating-system master volume."
            >
              <span>Output volume</span>
              <input
                aria-label="Output volume"
                type="range"
                min="0"
                max="200"
                value={Math.round(audioSettings.outputGain * 100)}
                onChange={(event) =>
                  setAudioSettings((current) => ({
                    ...current,
                    outputGain: Number(event.currentTarget.value) / 100,
                  }))
                }
                onPointerUp={persistAudio}
                onKeyUp={persistAudio}
              />
            </label>
          </section>
          <section className="controls__group" aria-labelledby={`${controlsId}-system`}>
            <h2 id={`${controlsId}-system`}>System &amp; model</h2>
            <ControlButton
              help="Check again for available local AI services and models."
              disabled={pending || state.connection !== "connected"}
              onClick={() => {
                setStartupDismissed(false);
                applyAction({ type: "providers.rescan" });
              }}
            >
              Rescan providers/models
            </ControlButton>
            <ControlButton
              help="Restart Sam's managed components. External model services are left alone."
              disabled={state.connection !== "connected"}
              onClick={() => setRestartConfirmation(true)}
            >
              Restart Sam
            </ControlButton>
          </section>
          <section className="controls__group" aria-labelledby={`${controlsId}-safety`}>
            <h2 id={`${controlsId}-safety`}>Safety</h2>
            <ControlButton
              className="controls__emergency"
              help="Immediately cancel the active response, tools, queued speech and playback. Ctrl+Shift+X."
              disabled={state.connection !== "connected"}
              onClick={() => applyAction({ type: "emergency_stop" })}
              aria-keyshortcuts="Control+Shift+X"
            >
              Emergency stop
            </ControlButton>
            <ControlButton
              className="controls__capability-revoke"
              help="Prevent Sam from using computer-control capabilities until trusted restoration."
              disabled={
                pending || state.connection !== "connected" || !state.capabilityAuthorityActive
              }
              onClick={() => applyAction({ type: "capabilities.revoke_all" })}
            >
              {state.capabilityAuthorityActive
                ? "Disable all capabilities"
                : "Capabilities disabled"}
            </ControlButton>
          </section>
          <section className="controls__group" aria-labelledby={`${controlsId}-display`}>
            <h2 id={`${controlsId}-display`}>Display</h2>
            <ControlButton
              help="Show or hide the conversation transcript on this device."
              onClick={() =>
                applyAction({ type: "transcript.set", visible: !preferences.transcriptVisible })
              }
            >
              Transcript {preferences.transcriptVisible ? "shown" : "hidden"}
            </ControlButton>
            <ControlButton
              help="Enter or leave fullscreen. Escape exits fullscreen."
              onClick={() => void toggleFullscreen()}
            >
              Toggle fullscreen
            </ControlButton>
            <label className="visual-setting">
              <span>Quality</span>
              <select
                value={visualSettings.quality}
                onChange={(event) =>
                  persistVisual({
                    quality: event.currentTarget.value as VisualEngineSettings["quality"],
                  })
                }
                title="Controls visual detail. Auto adapts to performance."
              >
                <option value="auto">Auto</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="visual-setting">
              <span>Performance profile</span>
              <select
                value={visualSettings.deviceProfile}
                onChange={(event) =>
                  persistVisual({
                    deviceProfile: event.currentTarget
                      .value as VisualEngineSettings["deviceProfile"],
                  })
                }
                title="Limits rendering for a target device or power level."
              >
                <option value="auto">Auto</option>
                <option value="mobile_2020">2020 smartphone</option>
                <option value="low_power">Low power</option>
                <option value="desktop">Desktop</option>
                <option value="high_end">High-end desktop</option>
              </select>
            </label>
            <label className="visual-setting">
              <span>Visual intensity</span>
              <input
                aria-label="Visual intensity"
                type="range"
                min="0"
                max="100"
                value={Math.round(visualSettings.intensity * 100)}
                onChange={(event) =>
                  persistVisual({ intensity: Number(event.currentTarget.value) / 100 })
                }
              />
            </label>
            <label className="visual-setting">
              <span>Motion</span>
              <input
                aria-label="Motion intensity"
                type="range"
                min="0"
                max="100"
                value={Math.round(visualSettings.motionIntensity * 100)}
                onChange={(event) =>
                  persistVisual({ motionIntensity: Number(event.currentTarget.value) / 100 })
                }
              />
            </label>
            <label className="visual-setting">
              <span>Audio reactivity</span>
              <input
                aria-label="Audio reactivity"
                type="range"
                min="0"
                max="100"
                value={Math.round(visualSettings.audioReactivity * 100)}
                onChange={(event) =>
                  persistVisual({ audioReactivity: Number(event.currentTarget.value) / 100 })
                }
              />
            </label>
            <label className="visual-setting">
              <span>Particles</span>
              <input
                aria-label="Particle amount"
                type="range"
                min="0"
                max="100"
                value={Math.round(visualSettings.particleDensity * 100)}
                onChange={(event) =>
                  persistVisual({ particleDensity: Number(event.currentTarget.value) / 100 })
                }
              />
            </label>
            <label className="visual-setting">
              <span>Reduced motion</span>
              <select
                value={visualSettings.reducedMotion}
                onChange={(event) =>
                  persistVisual({
                    reducedMotion: event.currentTarget
                      .value as VisualEngineSettings["reducedMotion"],
                  })
                }
              >
                <option value="system">Follow system</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
          </section>
          <section className="controls__group" aria-labelledby={`${controlsId}-application`}>
            <h2 id={`${controlsId}-application`}>Application</h2>
            <ControlButton
              help="Reload only the Sam interface and reconnect to the running core. Models and managed components are not restarted. Ctrl+R."
              onClick={() => window.location.reload()}
              aria-keyshortcuts="Control+R"
            >
              Reload interface
            </ControlButton>
            <ControlButton
              help="Stop Sam and close its owned window where supported. Ctrl+Q."
              disabled={state.connection !== "connected" || quitRequested}
              onClick={quitSam}
              aria-keyshortcuts="Control+Q"
            >
              Quit Sam
            </ControlButton>
          </section>
          <p className="controls__hint">
            Ctrl+M microphone · Ctrl+Shift+X emergency stop · Ctrl+R reload interface · Ctrl+Q Quit
            Sam · Esc closes the current Controls or dialog surface, never Sam
          </p>
        </section>
      )}
      {(state.protocolError || commandError) && (
        <p className="protocol-error">{commandError ?? `Protocol: ${state.protocolError}`}</p>
      )}
    </main>
  );
}
