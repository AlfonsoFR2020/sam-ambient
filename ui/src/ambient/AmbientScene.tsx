import { useEffect, useRef } from "react";
import type { UiState } from "../protocol/types";
import { VisualEngine } from "../visual-engine/engine";
import { VisualInputAdapter } from "../visual-engine/input";
import type { VisualEngineSettings } from "../visual-engine/types";
import type { AmbientVisualModel } from "./model";
import { VisualDiagnostics } from "./VisualDiagnostics";

interface AmbientSceneProps {
  model: AmbientVisualModel;
  state: UiState;
  settings: VisualEngineSettings;
  diagnosticsOpen?: boolean;
  commandError?: string;
  onCloseDiagnostics?: () => void;
  controlEvent?: { id: number; message: string };
}

export function AmbientScene({
  model,
  state,
  settings,
  diagnosticsOpen = false,
  commandError,
  onCloseDiagnostics,
  controlEvent,
}: AmbientSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<VisualEngine | null>(null);
  const adapter = useRef(new VisualInputAdapter());
  const initialSettings = useRef(settings);
  const priorSystem = useRef<UiState | null>(null);
  const priorControlId = useRef(0);
  const priorCommandError = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!host.current) return;
    const visualEngine = new VisualEngine({ settings: initialSettings.current });
    engine.current = visualEngine;
    visualEngine.mount(host.current);
    return () => {
      visualEngine.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.update(adapter.current.ingest(state, performance.now()));
  }, [state]);
  useEffect(() => {
    engine.current?.configure(settings);
  }, [settings]);
  useEffect(() => {
    engine.current?.setDiagnosticsEnabled(diagnosticsOpen);
  }, [diagnosticsOpen]);
  useEffect(() => {
    const prior = priorSystem.current;
    priorSystem.current = state;
    if (!prior) return;
    const changes: string[] = [];
    if (prior.connection !== state.connection)
      changes.push(`core connection ${prior.connection} → ${state.connection}`);
    if (prior.startupLifecycle !== state.startupLifecycle)
      changes.push(`startup ${prior.startupLifecycle} → ${state.startupLifecycle}`);
    if (prior.conversationalState !== state.conversationalState)
      changes.push(`semantic state ${prior.conversationalState} → ${state.conversationalState}`);
    if (prior.provider !== state.provider || prior.model !== state.model)
      changes.push(`provider/model ${state.provider ?? "none"} / ${state.model ?? "none"}`);
    if (prior.sttStatus !== state.sttStatus)
      changes.push(`speech input ${state.sttStatus ?? "unknown"}`);
    if (prior.ttsBackend !== state.ttsBackend)
      changes.push(`spoken output ${state.ttsBackend ?? "unknown"}`);
    if (prior.microphoneEnabled !== state.microphoneEnabled)
      changes.push(`microphone ${state.microphoneEnabled ? "on" : "muted"}`);
    if (prior.ttsOutputEnabled !== state.ttsOutputEnabled)
      changes.push(`voice output ${state.ttsOutputEnabled ? "on" : "muted"}`);
    if (prior.audioSettings !== state.audioSettings && state.audioSettings)
      changes.push(
        `audio gain in/out ${state.audioSettings.inputGain} / ${state.audioSettings.outputGain}`,
      );
    if (prior.protocolError !== state.protocolError && state.protocolError)
      changes.push(`protocol error ${state.protocolError}`);
    if (prior.diagnosticReason !== state.diagnosticReason && state.diagnosticReason)
      changes.push(`core detail ${state.diagnosticReason}`);
    for (const change of changes) engine.current?.recordExternalEvent(change);
  }, [state]);
  useEffect(() => {
    if (!controlEvent || controlEvent.id === priorControlId.current) return;
    priorControlId.current = controlEvent.id;
    engine.current?.recordExternalEvent(controlEvent.message);
  }, [controlEvent]);
  useEffect(() => {
    if (commandError && commandError !== priorCommandError.current)
      engine.current?.recordExternalEvent(`control error ${commandError}`);
    priorCommandError.current = commandError;
  }, [commandError]);

  return (
    <>
      <div
        ref={host}
        className="ambient-scene"
        data-state={model.state.toLowerCase()}
        data-reduced-motion={settings.reducedMotion === "on" || undefined}
        aria-hidden="true"
      >
        {settings.enabled && !state.applicationStopped && (
          <div
            className="ambient-scene__interaction"
            onPointerDown={(event) => {
              if (!event.isPrimary || event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              engine.current?.beginInteraction(event.clientX, event.clientY);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              engine.current?.moveInteraction(event.clientX, event.clientY);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
              engine.current?.endInteraction();
            }}
            onPointerCancel={() => engine.current?.cancelInteraction()}
            onLostPointerCapture={() => engine.current?.endInteraction()}
          />
        )}
      </div>
      {diagnosticsOpen && (
        <VisualDiagnostics
          engine={engine}
          state={state}
          commandError={commandError}
          onClose={onCloseDiagnostics}
        />
      )}
    </>
  );
}
