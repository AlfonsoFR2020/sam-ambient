import type { BackendFactory, RendererBackend, RendererKind } from "./backend";
import { CanvasBackend } from "./canvas";
import { AdaptiveQualityGovernor } from "./governor";
import { OrbInteraction } from "./interaction";
import { MotionEvaluator, motionRateScale } from "./motion";
import { effectivePixelRatio, type RenderBudget, resolveRenderBudget } from "./quality";
import { resolveVisualEngineSettings } from "./settings";
import type { VisualEngineSettings, VisualInputV1 } from "./types";
import { createWebGLBackend } from "./webgl";

const MIN_CONTINUOUS_QUATERNION_DOT = Math.cos(0.25);
const circularDistance = (a: number, b: number): number => {
  const difference = Math.abs(a - b);
  return Math.min(difference, Math.PI * 2 - difference);
};

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

export interface VisualDiagnosticEvent {
  readonly at: string;
  readonly message: string;
}

export interface VisualDiagnosticSnapshot {
  readonly renderer: RendererKind;
  readonly fallbackReason?: string;
  readonly quality: RenderBudget["quality"];
  readonly qualityPolicy: VisualEngineSettings["quality"];
  readonly profile: VisualEngineSettings["deviceProfile"];
  readonly approximateFps: number;
  readonly renderSubmissionMs: number;
  readonly foreground: string;
  readonly centre: readonly [number, number, number];
  readonly quaternion: readonly number[];
  readonly dragging: boolean;
  readonly inertia: number;
  readonly spin: number;
  readonly precession: number;
  readonly fieldPhases: readonly [number, number];
  readonly fieldTwists: readonly [number, number];
  readonly peelTravel: number;
  readonly flowRate: number;
  readonly seed: number;
  readonly inputEnvelope: number;
  readonly outputEnvelope: number;
  readonly events: readonly VisualDiagnosticEvent[];
}

const defaultFactory: BackendFactory = (canvas, kind, budget, settings, seed, motion) => {
  if (kind === "webgl2") return createWebGLBackend(canvas, budget, settings, seed, motion);
  const context = canvas.getContext("2d", { alpha: true });
  return context ? new CanvasBackend(canvas, context, budget, settings, seed, motion) : null;
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
  private forcedFallbackReason?: string;
  private approximateFps = 0;
  private renderSubmissionMs = 0;
  private lastPeelTravel?: number;
  private lastFieldPhase1?: number;
  private lastFieldPhase2?: number;
  private readonly lastQuaternion = new Float32Array(4);
  private hasLastQuaternion = false;
  private diagnosticsEnabled = false;
  private readonly diagnosticEvents: VisualDiagnosticEvent[] = [];
  private readonly interaction = new OrbInteraction();
  private readonly motion: MotionEvaluator;
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
    this.motion = new MotionEvaluator(this.seed);
    this.clock = options.clock ?? (() => performance.now());
    this.requestFrame = options.requestFrame ?? ((callback) => requestAnimationFrame(callback));
    this.cancelFrame = options.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
    this.createCanvas = options.createCanvas ?? (() => document.createElement("canvas"));
    this.backendFactory = options.backendFactory ?? defaultFactory;
    this.reducedMotionMedia =
      typeof matchMedia === "undefined"
        ? undefined
        : matchMedia("(prefers-reduced-motion: reduce)");
    this.recordEvent(`engine created; seed ${this.seed}; orientation and phase initialized`);
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
    this.createBackend("mount");
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
    if (stateChanged)
      this.recordEvent(
        `visual state ${this.input?.interaction.foreground ?? "initial"} → ${input.interaction.foreground}; availability ${input.interaction.availability}`,
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
    const changed = (Object.keys(next) as (keyof VisualEngineSettings)[]).filter(
      (key) => next[key] !== this.settings[key],
    );
    if (changed.length)
      this.recordEvent(`controls ${changed.map((key) => `${key}=${next[key]}`).join(", ")}`);
    const qualityPolicyChanged =
      next.quality !== this.settings.quality || next.deviceProfile !== this.settings.deviceProfile;
    const nextBudget = resolveRenderBudget(
      next,
      next.quality === "auto" && this.settings.quality === "auto"
        ? { measuredQuality: this.budget.quality }
        : {},
    );
    const wasEnabled = this.settings.enabled;
    const rendererChanged = next.renderer !== this.settings.renderer;
    const rebuild = nextBudget.quality !== this.budget.quality || rendererChanged;
    this.settings = next;
    if (!wasReduced && this.reducedMotion()) this.staticTransitionUntil = this.clock() + 200;
    if (this.reducedMotion() || next.motionIntensity === 0) this.interaction.stopInertia();
    this.budget = nextBudget;
    if (qualityPolicyChanged || rendererChanged) this.governor.reset(nextBudget.quality);
    if (rendererChanged) {
      this.forceCanvas = false;
      this.forcedFallbackReason = undefined;
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
    if ((!wasEnabled || rebuild || !this.backend) && this.host)
      this.createBackend(rendererChanged ? "renderer setting" : "quality/profile setting");
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
    if (this.visible !== visible) this.recordEvent(visible ? "visible/resume" : "hidden/pause");
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
    this.lastQuaternion.set(this.interaction.orientationQuaternion());
    this.hasLastQuaternion = true;
    this.renderBackend(now);
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

  setDiagnosticsEnabled(enabled: boolean): void {
    if (this.diagnosticsEnabled === enabled) return;
    this.diagnosticsEnabled = enabled;
    this.recordEvent(enabled ? "diagnostics enabled" : "diagnostics disabled");
  }

  recordExternalEvent(message: string): void {
    this.recordEvent(message);
  }

  diagnosticSnapshot(): VisualDiagnosticSnapshot {
    const frame = this.motion.currentFrame;
    const orientation = this.interaction.snapshot();
    return {
      renderer: this.rendererKind,
      fallbackReason: this.host?.dataset.samFallbackReason,
      quality: this.budget.quality,
      qualityPolicy: this.settings.quality,
      profile: this.settings.deviceProfile,
      approximateFps: this.canDraw() ? this.approximateFps : 0,
      renderSubmissionMs: this.renderSubmissionMs,
      foreground: frame.foreground,
      centre: [0, 0, 0], // Translation is not implemented; do not imply measured wandering.
      quaternion: [...orientation.quaternion],
      dragging: orientation.dragging,
      inertia: Math.hypot(orientation.velocityX, orientation.velocityY),
      spin: frame.spin,
      precession: frame.precession,
      fieldPhases: [frame.fieldPhase1, frame.fieldPhase2],
      fieldTwists: [frame.fieldTwist1, frame.fieldTwist2],
      peelTravel: frame.peelTravel,
      flowRate:
        this.reducedMotion() || !this.hasLiveAvailability(this.input)
          ? 0
          : motionRateScale(this.settings.motionIntensity) * 0.14,
      seed: this.seed,
      inputEnvelope: frame.inputEnvelope,
      outputEnvelope: frame.outputEnvelope,
      events: [...this.diagnosticEvents],
    };
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
    const dataset = this.host?.dataset;
    if (dataset) {
      delete dataset.samRenderer;
      delete dataset.samFallbackReason;
    }
    this.host?.classList.remove("visual-engine--static");
    this.host = undefined;
    this.lastDraw = 0;
    this.lastStaticDraw = -Infinity;
    this.staticRenderPending = false;
    this.staticTransitionUntil = 0;
    this.contextLosses = 0;
    this.forceCanvas = false;
  }

  private readonly onVisibility = () => {
    this.recordEvent(document.hidden ? "document hidden/pause" : "document visible/resume");
    this.syncLoop();
  };

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
        if (!this.renderBackend(now)) {
          this.syncLoop();
          return;
        }
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
      if (this.lastDraw) {
        const measured = Math.min(120, 1000 / Math.max(1, now - this.lastDraw));
        this.approximateFps = this.approximateFps
          ? this.approximateFps * 0.85 + measured * 0.15
          : measured;
      }
      this.interaction.step(
        this.lastDraw ? (now - this.lastDraw) / 1000 : 0,
        this.reducedMotion(),
        this.settings.motionIntensity,
      );
      this.pushOrientation();
      this.checkOrientationContinuity();
      const frameInterval = this.lastDraw ? now - this.lastDraw : 1000 / fps;
      const renderStarted = this.clock();
      if (!this.renderBackend(now)) {
        this.syncLoop();
        return;
      }
      const peelTravel = this.motion.currentFrame.peelTravel;
      const fieldPhase1 = this.motion.currentFrame.fieldPhase1;
      const fieldPhase2 = this.motion.currentFrame.fieldPhase2;
      if (
        (this.lastFieldPhase1 !== undefined &&
          circularDistance(fieldPhase1, this.lastFieldPhase1) > 0.25) ||
        (this.lastFieldPhase2 !== undefined &&
          circularDistance(fieldPhase2, this.lastFieldPhase2) > 0.25)
      )
        this.recordEvent("unexpected field-phase discontinuity");
      this.lastFieldPhase1 = fieldPhase1;
      this.lastFieldPhase2 = fieldPhase2;
      if (this.lastPeelTravel !== undefined && peelTravel < this.lastPeelTravel - 3)
        this.recordEvent("peel phase wrapped continuously");
      this.lastPeelTravel = peelTravel;
      const renderDuration = Math.max(0, this.clock() - renderStarted);
      this.renderSubmissionMs = this.renderSubmissionMs
        ? this.renderSubmissionMs * 0.85 + renderDuration * 0.15
        : renderDuration;
      const adapted = this.governor.observe(
        frameInterval,
        now,
        this.settings,
        this.budget,
        this.backend?.kind === "webgl2" &&
          !this.forceCanvas &&
          active &&
          this.hasLiveAvailability(this.input),
        renderDuration,
      );
      if (adapted === "canvas2d") {
        this.forceCanvas = true;
        this.forcedFallbackReason = "governor-overload";
        this.recordEvent("AUTO fallback after measured frame overload");
        this.createBackend("AUTO overload");
      } else if (adapted) {
        const adaptedBudget = resolveRenderBudget(this.settings, { measuredQuality: adapted });
        if (adaptedBudget.quality !== this.budget.quality) {
          this.budget = adaptedBudget;
          this.recordEvent(`AUTO quality ${adaptedBudget.quality}`);
          this.createBackend("AUTO quality transition");
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
      if (!this.canDraw()) {
        this.motion.pauseClock();
        this.lastDraw = 0;
        this.approximateFps = 0;
      }
      return;
    }
    if (!this.frame) this.frame = this.requestFrame(this.tick);
  }

  private resizeFromHost(): void {
    if (!this.host) return;
    const rect = this.host.getBoundingClientRect();
    this.resize(rect.width, rect.height, globalThis.devicePixelRatio || 1);
  }

  private createBackend(reason = "recreation"): void {
    if (!this.host) return;
    this.releaseBackend();
    this.host.classList.remove("visual-engine--static");
    if (!this.settings.enabled) return;

    const order: readonly ("webgl2" | "canvas2d")[] =
      this.forceCanvas || this.settings.renderer === "canvas2d"
        ? ["canvas2d"]
        : ["webgl2", "canvas2d"];
    let fallbackReason = this.forceCanvas
      ? (this.forcedFallbackReason ?? "governor-overload")
      : this.settings.renderer === "canvas2d"
        ? "requested-canvas2d"
        : undefined;
    for (const kind of order) {
      const canvas = this.createCanvas();
      canvas.className = "ambient-scene__field";
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.pointerEvents = "none";
      const backend = this.backendFactory(
        canvas,
        kind,
        this.budget,
        this.settings,
        this.seed,
        this.motion,
      );
      if (!backend) {
        if (kind === "webgl2")
          fallbackReason = canvas.dataset?.samWebglFailure ?? "webgl2-unavailable";
        continue;
      }
      this.canvas = canvas;
      this.backend = backend;
      this.setBackendDiagnostic(
        backend.kind,
        backend.kind === "webgl2" ? undefined : fallbackReason,
      );
      this.recordEvent(
        `backend ${backend.kind} (${reason})${backend.kind !== "webgl2" ? `; fallback ${fallbackReason ?? "unknown"}` : ""}`,
      );
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
    this.setBackendDiagnostic("static", fallbackReason ?? "no-renderer");
    this.recordEvent(`backend static (${reason}); fallback ${fallbackReason ?? "no-renderer"}`);
  }

  private setBackendDiagnostic(kind: RendererKind, reason?: string): void {
    const dataset = this.host?.dataset;
    if (!dataset) return;
    dataset.samRenderer = kind;
    if (reason) dataset.samFallbackReason = reason;
    else delete dataset.samFallbackReason;
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    if (this.backend?.kind !== "webgl2") return;
    this.contextLosses += 1;
    this.forceCanvas = true;
    this.forcedFallbackReason = "context-lost";
    this.recordEvent("WebGL context lost");
    this.createBackend("context lost");
    this.requestStaticRender();
    if (this.contextLosses <= 2) {
      if (this.restorationFrame) this.cancelFrame(this.restorationFrame);
      this.restorationFrame = this.requestFrame(() => {
        this.restorationFrame = 0;
        if (!this.host || !this.settings.enabled) return;
        this.forceCanvas = false;
        this.forcedFallbackReason = undefined;
        this.createBackend("context restore attempt");
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
    this.setBackendDiagnostic("static");
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
    if (!this.renderBackend(now)) {
      this.syncLoop();
      return;
    }
    this.lastStaticDraw = now;
    this.staticRenderPending = this.reducedMotion() && now < this.staticTransitionUntil;
    this.syncLoop();
  }

  private pushOrientation(): void {
    this.backend?.setObjectOrientation(this.interaction.orientationMatrix());
  }

  private renderBackend(now: number): boolean {
    if (!this.backend) return false;
    try {
      this.backend.render(now);
      return true;
    } catch (error) {
      const kind = this.backend.kind;
      console.error(`[Sam visual] ${kind} render failed`, error);
      this.recordEvent(
        `${kind} runtime render failure: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (kind === "webgl2") {
        this.forceCanvas = true;
        this.forcedFallbackReason = "render-failure";
        try {
          this.createBackend("render failure");
          this.staticRenderPending = true;
          this.syncLoop();
          return false;
        } catch (fallbackError) {
          console.error("[Sam visual] Canvas fallback failed", fallbackError);
        }
      }
      this.releaseBackend();
      this.host?.classList.add("visual-engine--static");
      this.setBackendDiagnostic("static", "render-failure");
      this.recordEvent("backend static (render failure)");
      return false;
    }
  }

  private checkOrientationContinuity(): void {
    const quaternion = this.interaction.orientationQuaternion();
    if (this.hasLastQuaternion && !this.interaction.isDragging) {
      const dot = Math.abs(
        quaternion[0] * this.lastQuaternion[0] +
          quaternion[1] * this.lastQuaternion[1] +
          quaternion[2] * this.lastQuaternion[2] +
          quaternion[3] * this.lastQuaternion[3],
      );
      if (dot < MIN_CONTINUOUS_QUATERNION_DOT)
        this.recordEvent("unexpected orientation discontinuity");
    }
    this.lastQuaternion.set(quaternion);
    this.hasLastQuaternion = true;
  }

  private recordEvent(message: string): void {
    const event = { at: new Date().toISOString(), message };
    this.diagnosticEvents.push(event);
    if (this.diagnosticEvents.length > 64) this.diagnosticEvents.shift();
    if (this.diagnosticsEnabled) console.info(`[Sam visual ${event.at}] ${message}`);
  }
}
