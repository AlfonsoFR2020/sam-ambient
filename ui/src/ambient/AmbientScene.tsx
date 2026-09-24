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
}

export function AmbientScene({
  model,
  state,
  settings,
  diagnosticsOpen = false,
}: AmbientSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<VisualEngine | null>(null);
  const adapter = useRef(new VisualInputAdapter());
  const initialSettings = useRef(settings);
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
      {diagnosticsOpen && <VisualDiagnostics engine={engine} />}
    </>
  );
}
