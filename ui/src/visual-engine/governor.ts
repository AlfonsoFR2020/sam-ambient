import type { RenderBudget, ResolvedQuality } from "./quality";
import type { VisualEngineSettings } from "./types";

const ranks: readonly ResolvedQuality[] = ["low", "medium", "high"];

export interface GovernorOptions {
  readonly sampleWindow?: number;
  readonly windowMs?: number;
  readonly cooldownMs?: number;
  readonly promotionWindows?: number;
  readonly demotionWindows?: number;
  readonly fallbackWindows?: number;
}

export type QualityDecision = ResolvedQuality | "canvas2d";

/** Small frame-pacing governor. It never observes hidden frames or persists its decisions. */
export class AdaptiveQualityGovernor {
  private readonly samples: Float32Array;
  private count = 0;
  private windowStartedMs: number | undefined;
  private headroomWindows = 0;
  private overloadWindows = 0;
  private lastChangeMs = -Infinity;
  private current: ResolvedQuality;
  private readonly cooldownMs: number;
  private readonly sampleWindow: number | undefined;
  private readonly windowMs: number;
  private readonly promotionWindows: number;
  private readonly demotionWindows: number;
  private readonly fallbackWindows: number;

  constructor(initial: ResolvedQuality, options: GovernorOptions = {}) {
    this.current = initial;
    this.sampleWindow = options.sampleWindow;
    this.samples = new Float32Array(options.sampleWindow ?? 360);
    this.windowMs = options.windowMs ?? 5000;
    this.cooldownMs = options.cooldownMs ?? 5000;
    this.promotionWindows = options.promotionWindows ?? 6;
    this.demotionWindows = options.demotionWindows ?? 1;
    this.fallbackWindows = options.fallbackWindows ?? 2;
  }

  reset(quality: ResolvedQuality): void {
    this.current = quality;
    this.count = 0;
    this.windowStartedMs = undefined;
    this.headroomWindows = 0;
    this.overloadWindows = 0;
  }

  observe(
    frameIntervalMs: number,
    nowMs: number,
    settings: VisualEngineSettings,
    budget: RenderBudget,
    visible = true,
  ): QualityDecision | undefined {
    if (
      !visible ||
      settings.quality !== "auto" ||
      !Number.isFinite(frameIntervalMs) ||
      frameIntervalMs < 0
    )
      return undefined;
    if (this.windowStartedMs === undefined) this.windowStartedMs = nowMs;
    this.samples[this.count++] = frameIntervalMs;
    const complete = this.sampleWindow
      ? this.count >= this.sampleWindow
      : nowMs - this.windowStartedMs >= this.windowMs || this.count >= this.samples.length;
    if (!complete) return undefined;
    const ordered = Array.from(this.samples.subarray(0, this.count)).sort(
      (left, right) => left - right,
    );
    const overloads = ordered.filter((value) => value > (1000 / budget.activeFps) * 1.5).length;
    this.count = 0;
    this.windowStartedMs = undefined;
    const p90 = ordered[Math.floor((ordered.length - 1) * 0.9)];
    const frameBudget = 1000 / budget.activeFps;
    this.headroomWindows = p90 < frameBudget * 0.45 ? this.headroomWindows + 1 : 0;
    this.overloadWindows = overloads / ordered.length > 0.1 ? this.overloadWindows + 1 : 0;
    if (nowMs - this.lastChangeMs < this.cooldownMs) return undefined;
    const rank = ranks.indexOf(this.current);
    if (this.overloadWindows >= this.demotionWindows) {
      if (rank > 0) {
        this.current = ranks[rank - 1];
        this.changed(nowMs);
        return this.current;
      }
      if (this.overloadWindows >= this.fallbackWindows) {
        this.changed(nowMs);
        return "canvas2d";
      }
    }
    if (this.headroomWindows >= this.promotionWindows && rank < ranks.length - 1) {
      this.current = ranks[rank + 1];
      this.changed(nowMs);
      return this.current;
    }
    return undefined;
  }

  private changed(nowMs: number): void {
    this.lastChangeMs = nowMs;
    this.headroomWindows = 0;
    this.overloadWindows = 0;
  }
}
