import type { BackendFactory, RendererBackend, RendererKind } from "./backend";
import { CanvasBackend } from "./canvas";
import { effectivePixelRatio, type RenderBudget, resolveRenderBudget } from "./quality";
import { resolveVisualEngineSettings } from "./settings";
import type { VisualEngineSettings, VisualInputV1 } from "./types";
import { createWebGLBackend } from "./webgl";

export interface VisualEngineOptions {
  readonly settings?: Partial<VisualEngineSettings>;
  readonly seed?: number;
  readonly clock?: () => number;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly createCanvas?: () => HTMLCanvasElement;
  /** Test seam. Production uses the built-in WebGL2/Canvas implementations. */
  readonly backendFactory?: BackendFactory;
}

const defaultFactory: BackendFactory = (canvas, kind, budget, settings, seed) => {
  if (kind === "webgl2") return createWebGLBackend(canvas, budget, settings, seed);
  const context = canvas.getContext("2d", { alpha: true });
  return context ? new CanvasBackend(canvas, context, budget, settings, seed) : null;
};

export class VisualEngine {
  private host?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private backend?: RendererBackend;
  private settings: VisualEngineSettings;
  private budget: RenderBudget;
  private input?: VisualInputV1;
  private width = 1;
  private height = 1;
  private visible = true;
  private intersecting = true;
  private frame = 0;
  private lastDraw = 0;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private readonly seed: number;
  private readonly clock: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly createCanvas: () => HTMLCanvasElement;
  private readonly backendFactory: BackendFactory;

  constructor(options: VisualEngineOptions = {}) {
    this.settings = resolveVisualEngineSettings(options.settings);
    this.budget = resolveRenderBudget(this.settings);
    this.seed = options.seed ?? 0x5a17;
    this.clock = options.clock ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.createCanvas = options.createCanvas ?? (() => document.createElement("canvas"));
    this.backendFactory = options.backendFactory ?? defaultFactory;
  }

  mount(host: HTMLElement): void {
    if (this.host === host) return;
    this.dispose();
    this.host = host;
    this.host.classList.remove("visual-engine--static");
    this.createBackend();
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resizeFromHost());
      this.resizeObserver.observe(host);
    }
    if (typeof IntersectionObserver !== "undefined") {
      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.intersecting = entry?.isIntersecting ?? true;
        this.syncLoop();
      });
      this.intersectionObserver.observe(host);
    }
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", this.onVisibility);
    this.resizeFromHost();
    this.syncLoop();
  }

  update(input: VisualInputV1): void {
    if (
      this.input &&
      input.streamKey === this.input.streamKey &&
      input.sequence <= this.input.sequence
    )
      return;
    this.input = input;
    this.backend?.update(input);
    if (this.reducedMotion() || input.interaction.availability === "stopped")
      this.backend?.render(this.clock());
    this.syncLoop();
  }

  configure(value: Partial<VisualEngineSettings>): void {
    const next = resolveVisualEngineSettings({ ...this.settings, ...value });
    const nextBudget = resolveRenderBudget(next);
    const rebuild =
      nextBudget.quality !== this.budget.quality || next.renderer !== this.settings.renderer;
    this.settings = next;
    this.budget = nextBudget;
    if (rebuild && this.host) this.createBackend();
    else this.backend?.configure(next);
    this.resize(this.width, this.height, globalThis.devicePixelRatio || 1);
    this.backend?.render(this.clock());
    this.syncLoop();
  }

  resize(width: number, height: number, devicePixelRatio = 1): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    const ratio = effectivePixelRatio(this.width, this.height, devicePixelRatio, this.budget);
    this.backend?.resize(this.width, this.height, ratio);
    this.backend?.render(this.clock());
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.syncLoop();
  }

  get rendererKind(): RendererKind {
    return this.backend?.kind ?? "static";
  }

  dispose(): void {
    if (this.frame) this.cancelFrame(this.frame);
    this.frame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.onVisibility);
    this.backend?.dispose();
    this.backend = undefined;
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.remove();
    this.canvas = undefined;
    this.host?.classList.remove("visual-engine--static");
    this.host = undefined;
    this.lastDraw = 0;
  }

  private readonly onVisibility = () => this.syncLoop();

  private readonly tick: FrameRequestCallback = (now) => {
    this.frame = 0;
    if (!this.shouldAnimate()) return;
    const active = this.input?.interaction.foreground !== "idle";
    const fps = active ? this.budget.activeFps : this.budget.idleFps;
    if (!this.lastDraw || now - this.lastDraw >= 1000 / fps) {
      this.backend?.render(now);
      this.lastDraw = now;
    }
    this.frame = this.requestFrame(this.tick);
  };

  private shouldAnimate(): boolean {
    return Boolean(
      this.host &&
        this.backend &&
        this.settings.enabled &&
        this.visible &&
        this.intersecting &&
        !this.reducedMotion() &&
        this.input?.interaction.availability !== "stopped" &&
        (typeof document === "undefined" || !document.hidden),
    );
  }

  private reducedMotion(): boolean {
    if (this.settings.reducedMotion === "on") return true;
    if (this.settings.reducedMotion === "off") return false;
    return (
      typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  private syncLoop(): void {
    if (!this.shouldAnimate()) {
      if (this.frame) this.cancelFrame(this.frame);
      this.frame = 0;
      return;
    }
    if (!this.frame) this.frame = this.requestFrame(this.tick);
  }

  private resizeFromHost(): void {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.resize(rect.width, rect.height, globalThis.devicePixelRatio || 1);
  }

  private createBackend(): void {
    if (!this.host) return;
    this.backend?.dispose();
    this.backend = undefined;
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas?.remove();
    this.canvas = undefined;
    this.host.classList.remove("visual-engine--static");

    const order: readonly ("webgl2" | "canvas2d")[] =
      this.settings.renderer === "canvas2d" ? ["canvas2d"] : ["webgl2", "canvas2d"];
    for (const kind of order) {
      const canvas = this.createCanvas();
      canvas.className = "ambient-scene__field";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.pointerEvents = "none";
      const backend = this.backendFactory(canvas, kind, this.budget, this.settings, this.seed);
      if (!backend) continue;
      this.canvas = canvas;
      this.backend = backend;
      canvas.addEventListener("webglcontextlost", this.onContextLost);
      this.host.appendChild(canvas);
      if (this.input) backend.update(this.input);
      backend.resize(
        this.width,
        this.height,
        effectivePixelRatio(this.width, this.height, globalThis.devicePixelRatio || 1, this.budget),
      );
      return;
    }
    this.host.classList.add("visual-engine--static");
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.settings.renderer !== "canvas2d") {
      this.settings = resolveVisualEngineSettings({ ...this.settings, renderer: "canvas2d" });
      this.createBackend();
      this.syncLoop();
    }
  };
}
