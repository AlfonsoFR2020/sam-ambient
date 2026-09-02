import type { CSSProperties } from "react";
import type { AmbientVisualModel } from "./model";

interface AmbientSceneProps {
  model: AmbientVisualModel;
}

export function AmbientScene({ model }: AmbientSceneProps) {
  const style = {
    "--sam-hue": model.hue,
    "--sam-intensity": model.intensity,
    "--sam-radius": model.radius,
    "--sam-turbulence": model.turbulence,
    "--sam-pulse": model.pulse,
  } as CSSProperties;

  return (
    <div
      className="ambient-scene"
      data-state={model.state.toLowerCase()}
      style={style}
      aria-hidden="true"
    >
      <div className="ambient-scene__aura" />
      <div className="ambient-scene__core" />
      <div className="ambient-scene__grain" />
    </div>
  );
}
