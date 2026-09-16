import type { BackendFactory, RendererBackend, RendererKind } from "./backend";
import { CanvasBackend } from "./canvas";
import { AdaptiveQualityGovernor } from "./governor";
import { OrbInteraction } from "./interaction";
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
  private width = 0;
  private height = 0;
  private visible = true;
  private intersecting = true;
  private frame = 0;
  private restorationFrame = 0;
  private lastDraw = 0;
  private lastStaticDraw = -Infinity;
  private staticRenderPending = false;
  private staticTransitionUntil = 0;
  private contextLosses = 0;
  private forceCanvas = false;
  private readonly interaction = new OrbInteraction();
  private readonly governor: AdaptiveQualityGovernor;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private readonly seed: number;
  private readonly clock: () => number;
  private readonly requestFrame: (callback: FrameRequestCallback) => number;
  private readonly cancelFrame: (handle: number) => void;
  private readonly createCanvas: () => HTMLCanvasElement;
  private readonly backendFactory: BackendFactory;
  private readonly reducedMotionMedia: MediaQueryList | undefined;

  constructor(options: VisualEngineOptions = {}) {
    this.settings = resolveVisualEngineSettings(options.settings);
    this.budget = resolveRenderBudget(this.settings);
    this.governor = new AdaptiveQualityGovernor(this.budget.quality);
    this.seed = options.seed ?? 0x5a17;
    this.clock = options.clock ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.createCanvas = options.createCanvas ?? (() => document.createElement("canvas"));
    this.backendFactory = options.backendFactory ?? defaultFactory;
    this.reducedMotionMedia =
      typeof matchMedia === "undefined"
        ? undefined
        : matchMedia("(prefers-reduced-motion: reduce)");
  }

  mount(host: HTMLElement): void {
    if (this.host === host) return;
    this.dispose();
    this.host = host;
    this.host.classList.remove("visual-engine--static");
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
    this.reducedMotionMedia?.addEventListener("change", this.onReducedMotionChange);
    this.resizeFromHost();
    this.createBackend();
    this.syncLoop();
  }

  update(input: VisualInputV1): void {
    if (
      this.input &&
      input.streamKey === this.input.streamKey &&
      input.sequence <= this.input.sequence
    )
      return;
    const stateChanged = Boolean(
      this.input &&
        (input.interaction.foreground !== this.input.interaction.foreground ||
          input.interaction.availability !== this.input.interaction.availability),
    );
    this.input = input;
    this.backend?.update(input);
    if (this.reducedMotion() && stateChanged) this.staticTransitionUntil = this.clock() + 200;
    if (this.reducedMotion() || !this.hasLiveAvailability(input)) this.requestStaticRender();
    else this.syncLoop();
  }

  configure(value: Partial<VisualEngineSettings>): void {
    const wasReduced = this.reducedMotion();
    const next = resolveVisualEngineSettings({ ...this.settings, ...value });
    const nextBudget = resolveRenderBudget(next);
    const wasEnabled = this.settings.enabled;
    const rendererChanged = next.renderer !== this.settings.renderer;
    const rebuild = nextBudget.quality !== this.budget.quality || rendererChanged;
    this.settings = next;
    if (!wasReduced && this.reducedMotion()) this.staticTransitionUntil = this.clock() + 200;
    if (this.reducedMotion() || next.motionIntensity === 0) this.interaction.stopInertia();
    this.budget = nextBudget;
    this.governor.reset(nextBudget.quality);
    if (rendererChanged) {
      this.forceCanvas = false;
      this.contextLosses = 0;
    }
    if (!next.enabled) {
      if (this.restorationFrame) this.cancelFrame(this.restorationFrame);
      this.restorationFrame = 0;
      this.releaseBackend();
      this.host?.classList.remove("visual-engine--static");
      this.syncLoop();
      return;
    }
    if ((!wasEnabled || rebuild || !this.backend) && this.host) this.createBackend();
    else this.backend?.configure(next);
    this.resize(this.width, this.height, globalThis.devicePixelRatio || 1);
    this.syncLoop();
  }

  resize(width: number, height: number, devicePixelRatio = 1): void {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    if (this.width === 0 || this.height === 0) {
      this.syncLoop();
      return;
    }
    const ratio = effectivePixelRatio(this.width, this.height, devicePixelRatio, this.budget);
    if (this.backend) {
      this.backend.resize(this.width, this.height, ratio);
      this.requestStaticRender();
    }
    this.syncLoop();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.syncLoop();
  }

  beginInteraction(x: number, y: number, now = this.clock()): void {
    if (this.reducedMotion() || !this.hasLiveAvailability(this.input)) return;
    this.interaction.begin(x, y, now);
  }

  moveInteraction(x: number, y: number, now = this.clock()): void {
    if (this.reducedMotion() || !this.hasLiveAvailability(this.input)) return;
    if (!this.interaction.move(x, y, now)) return;
    this.pushOrientation();
    this.backend?.render(now);
  }

  endInteraction(): void {
    if (this.reducedMotion() || !this.hasLiveAvailability(this.input)) {
      this.interaction.cancel();
      return;
    }
    this.interaction.end(this.reducedMotion(), this.settings.motionIntensity);
  }

  cancelInteraction(): void {
    this.interaction.cancel();
  }

  get rendererKind(): RendererKind {
    return this.backend?.kind ?? "static";
  }

  dispose(): void {
    if (this.frame) this.cancelFrame(this.frame);
    if (this.restorationFrame) this.cancelFrame(this.restorationFrame);
    this.frame = 0;
    this.restorationFrame = 0;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.onVisibility);
    this.reducedMotionMedia?.removeEventListener("change", this.onReducedMotionChange);
    this.releaseBackend();
    this.host?.classList.remove("visual-engine--static");
    this.host = undefined;
    this.lastDraw = 0;
    this.lastStaticDraw = -Infinity;
    this.staticRenderPending = false;
    this.staticTransitionUntil = 0;
    this.contextLosses = 0;
    this.forceCanvas = false;
  }

  private readonly onVisibility = () => this.syncLoop();

  private readonly onReducedMotionChange = () => {
    if (this.reducedMotion()) {
      this.interaction.stopInertia();
      this.staticTransitionUntil = this.clock() + 200;
    }
    this.requestStaticRender();
  };

  private readonly tick: FrameRequestCallback = (now) => {
    this.frame = 0;
    if (!this.shouldAnimate()) return;
    if (this.reducedMotion() || !this.hasLiveAvailability(this.input)) {
      if (now - this.lastStaticDraw >= 1000 / 15) {
        this.backend?.render(now);
        this.lastStaticDraw = now;
        this.staticRenderPending = this.reducedMotion() && now < this.staticTransitionUntil;
      }
      this.syncLoop();
      return;
    }
    const active = this.input?.interaction.foreground !== "idle";
    const fps =
      this.backend?.kind === "canvas2d"
        ? active
          ? 30
          : 24
        : active
          ? this.budget.activeFps
          : this.budget.idleFps;
    if (!this.lastDraw || now - this.lastDraw >= 1000 / fps) {
      this.interaction.step(
        this.lastDraw ? (now - this.lastDraw) / 1000 : 0,
        this.reducedMotion(),
        this.settings.motionIntensity,
      );
      this.pushOrientation();
      const frameInterval = this.lastDraw ? now - this.lastDraw : 1000 / fps;
      this.backend?.render(now);
      const adapted = this.governor.observe(
        frameInterval,
        now,
        this.settings,
        this.budget,
        this.backend?.kind === "webgl2" &&
          !this.forceCanvas &&
          active &&
          this.hasLiveAvailability(this.input),
      );
      if (adapted === "canvas2d") {
        this.forceCanvas = true;
        this.createBackend();
      } else if (adapted) {
        const adaptedBudget = resolveRenderBudget(this.settings, { measuredQuality: adapted });
        if (adaptedBudget.quality !== this.budget.quality) {
          this.budget = adaptedBudget;
          this.createBackend();
        }
      }
      this.lastDraw = now;
    }
    this.frame = this.requestFrame(this.tick);
  };

  private shouldAnimate(): boolean {
    if (!this.canDraw()) return false;
    if (this.reducedMotion() || !this.hasLiveAvailability(this.input))
      return this.staticRenderPending;
    return true;
  }

  private reducedMotion(): boolean {
    if (this.settings.reducedMotion === "on") return true;
    if (this.settings.reducedMotion === "off") return false;
    return this.reducedMotionMedia?.matches ?? false;
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
    this.releaseBackend();
    this.host.classList.remove("visual-engine--static");
    if (!this.settings.enabled) return;

    const order: readonly ("webgl2" | "canvas2d")[] =
      this.forceCanvas || this.settings.renderer === "canvas2d"
        ? ["canvas2d"]
        : ["webgl2", "canvas2d"];
    for (const kind of order) {
      const canvas = this.createCanvas();
      canvas.className = "ambient-scene__field";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.pointerEvents = "none";
      const backend = this.backendFactory(canvas, kind, this.budget, this.settings, this.seed);
      if (!backend) continue;
      this.canvas = canvas;
      this.backend = backend;
      this.pushOrientation();
      canvas.addEventListener("webglcontextlost", this.onContextLost);
      this.host.appendChild(canvas);
      if (this.input) backend.update(this.input);
      if (this.width > 0 && this.height > 0)
        backend.resize(
          this.width,
          this.height,
          effectivePixelRatio(
            this.width,
            this.height,
            globalThis.devicePixelRatio || 1,
            this.budget,
          ),
        );
      return;
    }
    this.host.classList.add("visual-engine--static");
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.backend?.kind !== "webgl2") return;
    this.contextLosses += 1;
    this.forceCanvas = true;
    this.createBackend();
    this.requestStaticRender();
    if (this.contextLosses <= 2) {
      if (this.restorationFrame) this.cancelFrame(this.restorationFrame);
      this.restorationFrame = this.requestFrame(() => {
        this.restorationFrame = 0;
        if (!this.host || !this.settings.enabled) return;
        this.forceCanvas = false;
        this.createBackend();
        if (this.backend?.kind !== "webgl2") this.forceCanvas = true;
        this.requestStaticRender();
      });
    }
    this.syncLoop();
  };

  private releaseBackend(): void {
    this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    this.backend?.dispose();
    this.backend = undefined;
    this.canvas?.remove();
    this.canvas = undefined;
  }

  private hasLiveAvailability(input = this.input): boolean {
    const availability = input?.interaction.availability;
    return availability === "ready" || availability === "degraded";
  }

  private canDraw(): boolean {
    return Boolean(
      this.host &&
        this.backend &&
        this.settings.enabled &&
        this.visible &&
        this.intersecting &&
        this.width > 0 &&
        this.height > 0 &&
        (typeof document === "undefined" || !document.hidden),
    );
  }

  private requestStaticRender(): void {
    this.staticRenderPending = true;
    if (!this.canDraw()) {
      this.syncLoop();
      return;
    }
    const now = this.clock();
    if (this.reducedMotion() && now - this.lastStaticDraw < 1000 / 15) {
      this.syncLoop();
      return;
    }
    this.backend?.render(now);
    this.lastStaticDraw = now;
    this.staticRenderPending = this.reducedMotion() && now < this.staticTransitionUntil;
    this.syncLoop();
  }

  private pushOrientation(): void {
    this.backend?.setObjectOrientation(this.interaction.orientationMatrix());
  }
}
