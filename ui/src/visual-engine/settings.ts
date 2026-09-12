import {
  DEFAULT_VISUAL_ENGINE_SETTINGS,
  type DeviceProfile,
  type ReducedMotionPreference,
  type VisualEngineSettings,
  type VisualQuality,
  type VisualRendererPreference,
} from "./types";

const rendererValues = new Set<VisualRendererPreference>(["auto", "webgl2", "canvas2d"]);
const qualityValues = new Set<VisualQuality>(["auto", "low", "medium", "high"]);
const profileValues = new Set<DeviceProfile>([
  "auto",
  "mobile_2020",
  "low_power",
  "desktop",
  "high_end",
]);
const motionValues = new Set<ReducedMotionPreference>(["system", "on", "off"]);

const bounded = (name: string, value: unknown, fallback: number): number => {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1)
    throw new TypeError(`${name} must be a finite number from 0 to 1`);
  return value;
};

const choice = <T extends string>(
  name: string,
  value: unknown,
  allowed: Set<T>,
  fallback: T,
): T => {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !allowed.has(value as T))
    throw new TypeError(`${name} has an unsupported value`);
  return value as T;
};

export function resolveVisualEngineSettings(
  value: Partial<VisualEngineSettings> = {},
): VisualEngineSettings {
  if (value.enabled !== undefined && typeof value.enabled !== "boolean")
    throw new TypeError("visual.enabled must be a boolean");
  return Object.freeze({
    enabled: value.enabled ?? DEFAULT_VISUAL_ENGINE_SETTINGS.enabled,
    renderer: choice(
      "visual.renderer",
      value.renderer,
      rendererValues,
      DEFAULT_VISUAL_ENGINE_SETTINGS.renderer,
    ),
    quality: choice(
      "visual.quality",
      value.quality,
      qualityValues,
      DEFAULT_VISUAL_ENGINE_SETTINGS.quality,
    ),
    deviceProfile: choice(
      "visual.device_profile",
      value.deviceProfile,
      profileValues,
      DEFAULT_VISUAL_ENGINE_SETTINGS.deviceProfile,
    ),
    intensity: bounded(
      "visual.intensity",
      value.intensity,
      DEFAULT_VISUAL_ENGINE_SETTINGS.intensity,
    ),
    motionIntensity: bounded(
      "visual.motion_intensity",
      value.motionIntensity,
      DEFAULT_VISUAL_ENGINE_SETTINGS.motionIntensity,
    ),
    audioReactivity: bounded(
      "visual.audio_reactivity",
      value.audioReactivity,
      DEFAULT_VISUAL_ENGINE_SETTINGS.audioReactivity,
    ),
    glowIntensity: bounded(
      "visual.glow_intensity",
      value.glowIntensity,
      DEFAULT_VISUAL_ENGINE_SETTINGS.glowIntensity,
    ),
    reducedMotion: choice(
      "visual.reduced_motion",
      value.reducedMotion,
      motionValues,
      DEFAULT_VISUAL_ENGINE_SETTINGS.reducedMotion,
    ),
  });
}

export function settingsFromCurrentControls(
  brightness: number,
  reducedMotion: boolean,
): VisualEngineSettings {
  return resolveVisualEngineSettings({
    intensity: Math.min(1, Math.max(0, brightness / 100)),
    reducedMotion: reducedMotion ? "on" : "off",
  });
}
