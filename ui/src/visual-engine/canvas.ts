import type { RendererBackend } from "./backend";
import type { RenderBudget } from "./quality";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

const stateRadius: Readonly<Record<VisualInputV1["interaction"]["foreground"], number>> = {
  idle: 1,
  listening: 1.035,
  transcribing: 0.985,
  thinking: 0.955,
  speaking: 1.015,
  interrupted: 0.94,
  resuming: 1,
};

const liveEnvelope = (receivedMs: number, envelope: number, now: number): number => {
  const age = Math.max(0, now - receivedMs);
  if (age >= 1000) return 0;
  return envelope * (age <= 250 ? 1 : Math.exp(-(age - 250) / 180));
};

export class CanvasBackend implements RendererBackend {
  readonly kind = "canvas2d" as const;
  private width = 1;
  private height = 1;
  private gradient?: CanvasGradient;
  private input?: VisualInputV1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly context: CanvasRenderingContext2D,
    private readonly budget: RenderBudget,
    private settings: VisualEngineSettings,
    private readonly seed: number,
  ) {}

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

  resize(width: number, height: number, dpr: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.canvas.width = Math.max(1, Math.round(this.width * dpr));
    this.canvas.height = Math.max(1, Math.round(this.height * dpr));
    this.context.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const reduced = this.settings.reducedMotion === "on";
    const feature = input.interaction.speaking ? input.audio.output : input.audio.input;
    const audio = feature
      ? liveEnvelope(feature.receivedMs, feature.envelope, now) *
        (input.interaction.speaking ? 1 : 0.55)
      : 0;
    const radius =
      Math.min(this.width, this.height) *
      0.28 *
      (stateRadius[input.interaction.foreground] + this.settings.audioReactivity * audio * 0.055);
    const cx = this.width / 2;
    const cy = this.height * 0.48;
    context.save();
    context.globalAlpha = 0.45 * this.settings.glowIntensity;
    context.fillStyle = "#d65324";
    context.beginPath();
    context.arc(cx, cy, radius * 1.28, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = this.settings.intensity;
    context.fillStyle = this.gradient ?? "#d7632d";
    context.beginPath();
    context.ellipse(cx, cy, radius, radius * 1.06, 0, 0, Math.PI * 2);
    context.fill();
    context.globalCompositeOperation = "lighter";
    context.lineCap = "round";
    for (let peel = 0; peel < Math.min(3, this.budget.peels); peel++) {
      const phase = reduced ? 0 : now * 0.000012 * (peel % 2 ? -1 : 1) + this.seed * 1e-5;
      context.globalAlpha = 0.3 + peel * 0.12;
      context.strokeStyle = peel === 1 ? "#ffd29e" : "#f08a42";
      context.lineWidth = radius * (0.025 + peel * 0.007);
      context.beginPath();
      for (let sample = 0; sample < 32; sample++) {
        const q = sample / 31 - 0.5;
        const angle = phase + peel * 2.05 + q * (1.4 + peel * 0.15);
        const x = cx + Math.cos(angle) * radius * Math.cos(q * 1.3);
        const y = cy + Math.sin(angle) * radius * 0.45 + q * radius * 1.1;
        if (sample === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.restore();
  }

  dispose(): void {
    this.input = undefined;
    this.gradient = undefined;
  }
}
