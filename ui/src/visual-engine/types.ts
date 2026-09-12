export type VisualForeground =
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "resuming";

export interface AudioFeatures {
  readonly receivedMs: number;
  readonly envelope: number;
  readonly peak?: number;
  readonly transient?: number;
  readonly bands?: readonly [number, number, number];
  readonly shape?: readonly [number, number, number, number];
  readonly activity?: number;
  readonly confidence?: number;
}

export interface VisualInteraction {
  readonly foreground: VisualForeground;
  readonly listening: boolean;
  readonly speaking: boolean;
  readonly floor: "none" | "user" | "sam" | "shared" | "holding" | "yielding";
  readonly acknowledgement: boolean;
  readonly userPause: boolean;
  readonly reasoning: boolean;
  readonly delegatedWork: boolean;
  readonly responseReady: boolean;
  readonly interruptSerial: number;
  readonly availability: "starting" | "ready" | "degraded" | "reconnecting" | "stopped";
}

export interface ExpressionHint {
  readonly source: "synthesis" | "interaction" | "semantic" | "prosody";
  readonly confidence: number;
  readonly warmth?: number;
  readonly energy?: number;
  readonly coherence?: number;
  readonly receivedMs: number;
  readonly ttlMs: number;
}

export interface VisualInputV1 {
  readonly version: 1;
  readonly streamKey: string;
  readonly sequence: number;
  readonly receivedMs: number;
  readonly audio: { readonly input?: AudioFeatures; readonly output?: AudioFeatures };
  readonly interaction: VisualInteraction;
  readonly expression?: ExpressionHint;
}

export type VisualQuality = "auto" | "low" | "medium" | "high";
export type DeviceProfile = "auto" | "mobile_2020" | "low_power" | "desktop" | "high_end";
export type VisualRendererPreference = "auto" | "webgl2" | "canvas2d";
export type ReducedMotionPreference = "system" | "on" | "off";

export interface VisualEngineSettings {
  readonly enabled: boolean;
  readonly renderer: VisualRendererPreference;
  readonly quality: VisualQuality;
  readonly deviceProfile: DeviceProfile;
  readonly intensity: number;
  readonly motionIntensity: number;
  readonly audioReactivity: number;
  readonly glowIntensity: number;
  readonly reducedMotion: ReducedMotionPreference;
}

export const DEFAULT_VISUAL_ENGINE_SETTINGS: VisualEngineSettings = Object.freeze({
  enabled: true,
  renderer: "auto",
  quality: "auto",
  deviceProfile: "auto",
  intensity: 0.82,
  motionIntensity: 0.6,
  audioReactivity: 0.7,
  glowIntensity: 0.5,
  reducedMotion: "system",
});
