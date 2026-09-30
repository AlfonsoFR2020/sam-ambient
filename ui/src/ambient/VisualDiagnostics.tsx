import { type RefObject, useEffect, useState } from "react";
import type { UiState } from "../protocol/types";
import type { VisualDiagnosticSnapshot, VisualEngine } from "../visual-engine/engine";

const fixed = (value: number, places = 2): string => value.toFixed(places);
const known = (value: string | undefined): string => value || "Not reported";

/** Four snapshots per second; event history is appended only on meaningful changes. */
export function VisualDiagnostics({
  engine,
  state,
  commandError,
  onClose,
}: {
  engine: RefObject<VisualEngine | null>;
  state: UiState;
  commandError?: string;
  onClose?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<VisualDiagnosticSnapshot | null>(null);
  useEffect(() => {
    const update = () => setSnapshot(engine.current?.diagnosticSnapshot() ?? null);
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [engine]);
  if (!snapshot) return null;
  const q = snapshot.quaternion;
  const errors = [...new Set([commandError, state.protocolError, state.diagnosticReason])].filter(
    (value): value is string => Boolean(value),
  );
  const health = [
    ["Microphone", state.voiceInputHealth],
    ["Speech recognition", state.sttHealth],
    ["Speech synthesis", state.synthesisHealth],
    ["Playback", state.playbackHealth],
  ] as const;
  return (
    <aside className="visual-diagnostics" aria-label="Sam status and diagnostics">
      <header className="visual-diagnostics__header">
        <strong>Sam status &amp; diagnostics</strong>
        <button type="button" onClick={onClose} aria-label="Close diagnostics">
          ×
        </button>
      </header>
      <section className="visual-diagnostics__health" aria-label="Current health and state">
        <h2>Current health &amp; state</h2>
        <dl>
          <dt>Core connection</dt>
          <dd data-degraded={state.connection !== "connected" || undefined}>
            {state.connection}
            {state.connection === "connected" && !state.sessionId ? " · awaiting session" : ""}
          </dd>
          <dt>Conversation</dt>
          <dd>{state.conversationalState}</dd>
          <dt>Provider / model</dt>
          <dd>
            {known(state.provider)} / {known(state.model)}
            {state.connection !== "connected" && state.model ? " (last known)" : ""}
          </dd>
          {health.map(([label, item]) => (
            <div className="visual-diagnostics__health-row" key={label}>
              <dt>{label}</dt>
              <dd data-degraded={item?.status === "degraded" || undefined}>
                {item
                  ? `${item.status}${item.retrying ? " (retrying)" : ""}${item.reason ? ` · ${item.reason}` : ""}`
                  : "Not reported"}
              </dd>
            </div>
          ))}
        </dl>
        {errors.length > 0 && (
          <div className="visual-diagnostics__problems" role="alert">
            <strong>Current problem{errors.length > 1 ? "s" : ""}</strong>
            {errors.map((error) => (
              <p className="visual-diagnostics__error" key={error}>
                {error}
              </p>
            ))}
          </div>
        )}
      </section>
      <details open>
        <summary>Conversation &amp; inference</summary>
        <dl>
          <dt>Frontend ↔ core</dt>
          <dd>{state.connection}</dd>
          <dt>Core availability</dt>
          <dd>
            {state.connection !== "connected"
              ? "Connection unavailable"
              : state.sessionId
                ? "Session reported"
                : "Waiting for session"}
          </dd>
          <dt>Semantic state</dt>
          <dd>{state.conversationalState}</dd>
          <dt>Active turn</dt>
          <dd>{known(state.turnId)}</dd>
          <dt>Active generation</dt>
          <dd>{known(state.generationId)}</dd>
          <dt>Pending commands</dt>
          <dd>{state.pendingCommandIds.length}</dd>
          {state.candidateTurnId && (
            <>
              <dt>Candidate turn</dt>
              <dd>{state.candidateTurnId}</dd>
            </>
          )}
          <dt>Provider</dt>
          <dd>
            {known(state.provider)}
            {state.provider && state.connection !== "connected" ? " (last known)" : ""}
          </dd>
          <dt>Provider discovery</dt>
          <dd>{state.providerDiscovery.status}</dd>
          {state.providerDiscovery.reason && (
            <>
              <dt>Discovery detail</dt>
              <dd>{state.providerDiscovery.reason}</dd>
            </>
          )}
          <dt>Local AI services</dt>
          <dd>
            {state.providerCatalog.length
              ? state.providerCatalog
                  .map((item) => `${item.id}: ${item.running ? "running" : "unavailable"}`)
                  .join(" · ") +
                (state.providerDiscovery.status === "stale" ||
                state.providerDiscovery.status === "failed"
                  ? " (last known)"
                  : "")
              : "Not reported"}
          </dd>
          <dt>Active model</dt>
          <dd>
            {known(state.model)}
            {state.model && state.connection !== "connected" ? " (last known)" : ""}
          </dd>
          {state.pendingModel && (
            <>
              <dt>Pending model</dt>
              <dd>{state.pendingModel}</dd>
            </>
          )}
        </dl>
      </details>
      <details open>
        <summary>Voice &amp; audio</summary>
        <dl>
          <dt>Speech recognition</dt>
          <dd>{known(state.sttStatus)}</dd>
          <dt>Speech input health</dt>
          <dd>
            {state.voiceInputHealth
              ? `${state.voiceInputHealth.status}${state.voiceInputHealth.retrying ? " (retrying)" : ""}${state.voiceInputHealth.reason ? ` · ${state.voiceInputHealth.reason}` : ""}`
              : "Not reported"}
          </dd>
          <dt>STT health</dt>
          <dd>
            {state.sttHealth
              ? `${state.sttHealth.status} · ${state.sttHealth.reason ?? "ready"}`
              : "Not reported"}
          </dd>
          <dt>Speech synthesis</dt>
          <dd>{known(state.ttsBackend)}</dd>
          <dt>Synthesis health</dt>
          <dd>
            {state.synthesisHealth
              ? `${state.synthesisHealth.status} · ${state.synthesisHealth.reason ?? "ready"}`
              : "Not reported"}
          </dd>
          <dt>Playback health</dt>
          <dd>
            {state.playbackHealth
              ? `${state.playbackHealth.status} · ${state.playbackHealth.reason ?? "ready"}`
              : "Not reported"}
          </dd>
          <dt>Microphone</dt>
          <dd>{state.microphoneEnabled ? "Enabled" : "Muted"}</dd>
          <dt>Spoken replies</dt>
          <dd>{state.ttsOutputEnabled ? "Enabled" : "Muted"}</dd>
          {state.audioSettings && (
            <>
              <dt>Audio gain in/out</dt>
              <dd>
                {fixed(state.audioSettings.inputGain)} / {fixed(state.audioSettings.outputGain)}
              </dd>
            </>
          )}
          <dt>Input RMS / peak</dt>
          <dd>
            {fixed(state.metrics.rms)} / {fixed(state.metrics.peak)}
          </dd>
          <dt>Speech probability</dt>
          <dd>{fixed(state.metrics.speechProbability)}</dd>
          <dt>Playback envelope</dt>
          <dd>{fixed(state.metrics.playbackEnvelope)}</dd>
          <dt>Visual envelope in/out</dt>
          <dd>
            {fixed(snapshot.inputEnvelope)} / {fixed(snapshot.outputEnvelope)}
          </dd>
        </dl>
      </details>
      <details>
        <summary>Renderer &amp; motion</summary>
        <dl>
          <dt>Backend</dt>
          <dd>{snapshot.renderer}</dd>
          <dt>Fallback reason</dt>
          <dd>{snapshot.fallbackReason ?? "None"}</dd>
          <dt>Quality</dt>
          <dd>
            {snapshot.quality} ({snapshot.qualityPolicy === "auto" ? "Auto" : "Manual"};{" "}
            {snapshot.profile})
          </dd>
          <dt>Frame interval</dt>
          <dd>
            {snapshot.approximateFps
              ? `~${fixed(1000 / snapshot.approximateFps, 1)} ms`
              : "Not measured"}
          </dd>
          <dt>Render submission</dt>
          <dd>~{fixed(snapshot.renderSubmissionMs, 1)} ms</dd>
          <dt>Visual state</dt>
          <dd>{snapshot.foreground}</dd>
          <dt>Seed</dt>
          <dd>{snapshot.seed}</dd>
          <dt>Centre XYZ</dt>
          <dd>{snapshot.centre.map((value) => fixed(value, 3)).join(" / ")} (fixed)</dd>
          <dt>Orientation q</dt>
          <dd data-testid="orientation-q">{q.map((value) => fixed(value)).join(" / ")}</dd>
          <dt>Drag</dt>
          <dd>{snapshot.dragging ? "Pointer held" : `Inertia ${fixed(snapshot.inertia)}`}</dd>
          <dt>Spin / precession</dt>
          <dd>
            {fixed(snapshot.spin)} / {fixed(snapshot.precession)}
          </dd>
          <dt>Field phases</dt>
          <dd>{snapshot.fieldPhases.map((value) => fixed(value)).join(" / ")}</dd>
          <dt>Field twists</dt>
          <dd>{snapshot.fieldTwists.map((value) => fixed(value)).join(" / ")}</dd>
          <dt>Palette balance</dt>
          <dd>{fixed(snapshot.paletteBalance)}</dd>
          <dt>Particle field</dt>
          <dd>
            {snapshot.particleBudget} budget / {fixed(snapshot.particleDensity)} density /{" "}
            {fixed(snapshot.particleSpread, 3)} spread
          </dd>
          <dt>Visual reactivity</dt>
          <dd>
            {fixed(snapshot.reactivitySustained)} sustained / {fixed(snapshot.reactivityOnset)}{" "}
            onset
          </dd>
          <dt>Flow / peel</dt>
          <dd>
            {fixed(snapshot.flowRate, 3)} rad/s / {fixed(snapshot.peelTravel)}
          </dd>
        </dl>
      </details>
      <details>
        <summary>Recent events ({snapshot.events.length})</summary>
        <div className="visual-diagnostics__events" role="log">
          {snapshot.events.map((event, index) => (
            <div key={`${event.at}-${index}`}>
              <time dateTime={event.at}>{event.at.slice(11, 19)}</time> {event.message}
            </div>
          ))}
        </div>
      </details>
    </aside>
  );
}
