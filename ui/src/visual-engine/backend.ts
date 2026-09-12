import type { RenderBudget } from "./quality";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

export type RendererKind = "webgl2" | "canvas2d" | "static";

export interface RendererBackend {
  readonly kind: RendererKind;
  update(input: VisualInputV1): void;
  configure(settings: VisualEngineSettings): void;
  resize(width: number, height: number, dpr: number): void;
  render(now: number): void;
  dispose(): void;
}

export type BackendFactory = (
  canvas: HTMLCanvasElement,
  kind: Exclude<RendererKind, "static">,
  budget: RenderBudget,
  settings: VisualEngineSettings,
  seed: number,
) => RendererBackend | null;

export function chooseRendererKind(
  preference: VisualEngineSettings["renderer"],
  webglAvailable: boolean,
  canvasAvailable: boolean,
): RendererKind {
  if (preference !== "canvas2d" && webglAvailable) return "webgl2";
  if (canvasAvailable) return "canvas2d";
  return "static";
}
