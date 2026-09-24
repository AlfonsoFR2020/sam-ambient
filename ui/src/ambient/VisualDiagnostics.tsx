import { type RefObject, useEffect, useState } from "react";
import type { VisualDiagnosticSnapshot, VisualEngine } from "../visual-engine/engine";

const fixed = (value: number, places = 2): string => value.toFixed(places);

/** Developer-only, 4 Hz snapshot reader. It never drives the render loop. */
export function VisualDiagnostics({ engine }: { engine: RefObject<VisualEngine | null> }) {
  const [snapshot, setSnapshot] = useState<VisualDiagnosticSnapshot | null>(null);
  useEffect(() => {
    const update = () => setSnapshot(engine.current?.diagnosticSnapshot() ?? null);
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [engine]);
  if (!snapshot) return null;
  const q = snapshot.quaternion;
  return (
    <aside className="visual-diagnostics" aria-label="Visual diagnostics">
      <strong>Visual diagnostics</strong>
      <div>
        Renderer {snapshot.renderer}
        {snapshot.fallbackReason ? ` · ${snapshot.fallbackReason}` : ""}
      </div>
      <div>
        Quality {snapshot.quality} ({snapshot.qualityPolicy}, {snapshot.profile}) · ~
        {fixed(snapshot.approximateFps, 0)} fps
      </div>
      <div>
        State {snapshot.foreground} · seed {snapshot.seed}
      </div>
      <div>Centre XYZ {snapshot.centre.map((value) => fixed(value, 3)).join(" / ")} (fixed)</div>
      <div>Orientation q {q.map((value) => fixed(value)).join(" / ")}</div>
      <div>
        Spin {fixed(snapshot.spin)} · precession {fixed(snapshot.precession)} ·{" "}
        {snapshot.dragging ? "dragging" : `inertia ${fixed(snapshot.inertia)}`}
      </div>
      <div>
        Field φ {snapshot.fieldPhases.map((value) => fixed(value)).join(" / ")} · twist{" "}
        {snapshot.fieldTwists.map((value) => fixed(value)).join(" / ")}
      </div>
      <div>
        Flow {fixed(snapshot.flowRate, 3)} rad/s · peel {fixed(snapshot.peelTravel)}
      </div>
      <div>
        Audio in/out {fixed(snapshot.inputEnvelope)} / {fixed(snapshot.outputEnvelope)}
      </div>
      <div className="visual-diagnostics__events">
        {snapshot.events.slice(-5).map((event) => (
          <div key={`${event.at}-${event.message}`}>
            {event.at.slice(11, 19)} {event.message}
          </div>
        ))}
      </div>
    </aside>
  );
}
