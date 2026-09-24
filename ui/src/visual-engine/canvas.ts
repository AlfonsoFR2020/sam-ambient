import type { RendererBackend } from "./backend";
import type { MotionEvaluator } from "./motion";
import type { RenderBudget } from "./quality";
import { haloOpacity } from "./tuning";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

export class CanvasBackend implements RendererBackend {
  readonly kind = "canvas2d" as const;
  private width = 0;
  private height = 0;
  private dpr = 0;
  private gradient?: CanvasGradient;
  private input?: VisualInputV1;
  private readonly orientation = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  private readonly reducedMotionMedia: MediaQueryList | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private readonly budget: RenderBudget,
    private settings: VisualEngineSettings,
    private readonly seed: number,
    private readonly motion: MotionEvaluator,
  ) {
    this.reducedMotionMedia =
      typeof matchMedia === "undefined"
        ? undefined
        : matchMedia("(prefers-reduced-motion: reduce)");
  }

  update(input: VisualInputV1): void {
    if (
      !this.input ||
      input.streamKey !== this.input.streamKey ||
      input.sequence > this.input.sequence
    )
      this.input = input;
  }

  configure(settings: VisualEngineSettings): void {
    this.settings = settings;
  }

  setObjectOrientation(matrix: Float32Array): void {
    this.orientation.set(matrix);
  }

  resize(width: number, height: number, dpr: number): void {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const nextDpr = Math.max(0.5, Math.min(1, dpr));
    if (nextWidth === this.width && nextHeight === this.height && nextDpr === this.dpr) return;
    this.width = nextWidth;
    this.height = nextHeight;
    this.dpr = nextDpr;
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr));
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const radius = Math.min(this.width, this.height) * 0.31;
    this.gradient = this.context.createRadialGradient(
      this.width / 2 - radius * 0.2,
      this.height / 2 - radius * 0.25,
      radius * 0.04,
      this.width / 2,
      this.height / 2,
      radius,
    );
    this.gradient.addColorStop(0, "#ffd19a");
    this.gradient.addColorStop(0.24, "#ef873f");
    this.gradient.addColorStop(0.7, "#a83c1d");
    this.gradient.addColorStop(1, "rgba(74,18,8,0.2)");
  }

  render(now: number): void {
    const context = this.context;
    const input = this.input;
    context.clearRect(0, 0, this.width, this.height);
    if (!input || !this.settings.enabled) return;
    const reduced = this.reducedMotion();
    const frame = this.motion.evaluate(input, now, this.settings, this.budget, reduced);
    const radius = Math.min(this.width, this.height) * 0.28 * frame.radius;
    const cx = this.width / 2;
    const cy = this.height * 0.48;
    context.save();
    context.globalAlpha = haloOpacity(frame.glow, this.settings.glowIntensity);
    context.fillStyle = "#d65324";
    context.beginPath();
    context.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = this.settings.intensity;
    context.fillStyle = this.gradient ?? "#d7632d";
    context.beginPath();
    context.ellipse(cx, cy, radius, radius * 1.06, 0, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    for (let peel = 0; peel < Math.min(3, this.budget.peels); peel++) {
      const phase = frame.peelTravel * 0.12 * (peel % 2 ? -1 : 1) + this.seed * 1e-5;
      context.globalAlpha = (0.28 + peel * 0.1) * frame.peelEmission;
      context.strokeStyle = peel === 1 ? "#ffd29e" : "#f08a42";
      context.lineWidth = radius * (0.04 + peel * 0.009) * frame.peelWidth;
      context.beginPath();
      let drawing = false;
      for (let sample = 0; sample < 48; sample++) {
        const q = sample / 47 - 0.5;
        const angle = phase + peel * 2.05 + q * (1.4 + peel * 0.15);
        const opening = 1 + frame.opening * 0.05;
        const lift = 1.05 + frame.peelLift;
        const latitude = Math.cos(q * 1.3);
        const localX = Math.cos(angle) * latitude * opening * lift;
        const localY = Math.sin(angle) * 0.45 * opening * lift + q * 1.1;
        const localZ = Math.sin(angle) * latitude * opening * lift;
        const x =
          cx +
          (this.orientation[0] * localX +
            this.orientation[3] * localY +
            this.orientation[6] * localZ) *
            radius;
        const y =
          cy +
          (this.orientation[1] * localX +
            this.orientation[4] * localY +
            this.orientation[7] * localZ) *
            radius;
        const z =
          this.orientation[2] * localX +
          this.orientation[5] * localY +
          this.orientation[8] * localZ;
        if (z <= 0) {
          drawing = false;
          continue;
        }
        if (!drawing) context.moveTo(x, y);
        else context.lineTo(x, y);
        drawing = true;
      }
      context.stroke();
    }
    context.restore();
  }

  dispose(): void {
    this.input = undefined;
    this.gradient = undefined;
  }

  private reducedMotion(): boolean {
    if (this.settings.reducedMotion === "on") return true;
    if (this.settings.reducedMotion === "off") return false;
    return this.reducedMotionMedia?.matches ?? false;
  }
}
