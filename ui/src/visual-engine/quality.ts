import type { DeviceProfile, VisualEngineSettings, VisualQuality } from "./types";

export type ResolvedQuality = Exclude<VisualQuality, "auto">;

export interface RenderBudget {
  readonly quality: ResolvedQuality;
  readonly sphereLongitude: number;
  readonly sphereLatitude: number;
  readonly peels: number;
  readonly peelSamples: number;
  readonly lights: number;
  readonly idleFps: number;
  readonly activeFps: number;
  readonly dpr: number;
  readonly pixels: number;
  readonly antialias: boolean;
}

export const RENDER_BUDGETS: Readonly<Record<ResolvedQuality, RenderBudget>> = Object.freeze({
  low: Object.freeze({
    quality: "low",
    sphereLongitude: 32,
    sphereLatitude: 16,
    peels: 6,
    peelSamples: 16,
    lights: 1,
    idleFps: 24,
    activeFps: 30,
    dpr: 1,
    pixels: 1_000_000,
    antialias: false,
  }),
  medium: Object.freeze({
    quality: "medium",
    sphereLongitude: 48,
    sphereLatitude: 24,
    peels: 9,
    peelSamples: 20,
    lights: 2,
    idleFps: 30,
    activeFps: 60,
    dpr: 1.5,
    pixels: 2_000_000,
    antialias: true,
  }),
  high: Object.freeze({
    quality: "high",
    sphereLongitude: 64,
    sphereLatitude: 32,
    peels: 14,
    peelSamples: 24,
    lights: 3,
    idleFps: 30,
    activeFps: 60,
    dpr: 2,
    pixels: 3_000_000,
    antialias: true,
  }),
});

const rank: Readonly<Record<ResolvedQuality, number>> = { low: 0, medium: 1, high: 2 };
const fromRank = (value: number): ResolvedQuality => (["low", "medium", "high"] as const)[value];

const profileCap = (profile: DeviceProfile): ResolvedQuality => {
  if (profile === "mobile_2020" || profile === "low_power") return "low";
  return profile === "desktop" ? "medium" : "high";
};

export interface QualityResolutionHint {
  /** Later measured adaptation may request a promotion; profile and user caps still win. */
  readonly measuredQuality?: ResolvedQuality;
}

export function resolveRenderBudget(
  settings: Pick<VisualEngineSettings, "quality" | "deviceProfile">,
  hint: QualityResolutionHint = {},
): RenderBudget {
  const cap = profileCap(settings.deviceProfile);
  const automaticStart =
    settings.deviceProfile === "desktop" || settings.deviceProfile === "high_end"
      ? "medium"
      : "low";
  const desired =
    settings.quality === "auto" ? (hint.measuredQuality ?? automaticStart) : settings.quality;
  return RENDER_BUDGETS[fromRank(Math.min(rank[desired], rank[cap]))];
}

export function effectivePixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
  budget: RenderBudget,
): number {
  const pixelBound = Math.sqrt(budget.pixels / Math.max(1, width * height));
  return Math.max(0.5, Math.min(devicePixelRatio || 1, budget.dpr, pixelBound));
}
