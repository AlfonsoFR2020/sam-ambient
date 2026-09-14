import type { RenderBudget, ResolvedQuality } from "./quality";
import type { VisualEngineSettings } from "./types";

const ranks: readonly ResolvedQuality[] = ["low", "medium", "high"];

export interface GovernorOptions {
  readonly sampleWindow?: number;
  readonly cooldownMs?: number;
  readonly promotionWindows?: number;
  readonly demotionWindows?: number;
}

/** Small render-cost governor. It never observes hidden frames or persists its decisions. */
export class AdaptiveQualityGovernor {
  private readonly samples: Float32Array;
  private count = 0;
  private headroomWindows = 0;
  private overloadWindows = 0;
  private lastChangeMs = -Infinity;
  private current: ResolvedQuality;
  private readonly cooldownMs: number;
  private readonly promotionWindows: number;
  private readonly demotionWindows: number;

  constructor(initial: ResolvedQuality, options: GovernorOptions = {}) {
    this.current = initial;
    this.samples = new Float32Array(options.sampleWindow ?? 90);
    this.cooldownMs = options.cooldownMs ?? 5000;
    this.promotionWindows = options.promotionWindows ?? 3;
    this.demotionWindows = options.demotionWindows ?? 2;
  }

  reset(quality: ResolvedQuality): void {
    this.current = quality;
    this.count = 0;
    this.headroomWindows = 0;
    this.overloadWindows = 0;
  }

  observe(
    renderMs: number,
    nowMs: number,
    settings: VisualEngineSettings,
    budget: RenderBudget,
    visible = true,
  ): ResolvedQuality | undefined {
    if (!visible || settings.quality !== "auto" || !Number.isFinite(renderMs) || renderMs < 0)
      return undefined;
    this.samples[this.count++] = renderMs;
    if (this.count < this.samples.length) return undefined;
    const ordered = Array.from(this.samples).sort((left, right) => left - right);
    this.count = 0;
    const p90 = ordered[Math.floor((ordered.length - 1) * 0.9)];
    const frameBudget = 1000 / budget.activeFps;
    this.headroomWindows = p90 < frameBudget * 0.45 ? this.headroomWindows + 1 : 0;
    this.overloadWindows = p90 > frameBudget * 0.9 ? this.overloadWindows + 1 : 0;
    if (nowMs - this.lastChangeMs < this.cooldownMs) return undefined;
    const rank = ranks.indexOf(this.current);
    if (this.overloadWindows >= this.demotionWindows && rank > 0) {
      this.current = ranks[rank - 1];
      this.changed(nowMs);
      return this.current;
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
