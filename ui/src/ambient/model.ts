import type { ConversationalState, UiState } from "../protocol/types";

export interface AmbientVisualModel {
  state: ConversationalState;
  label: string;
  hue: number;
  intensity: number;
  radius: number;
  turbulence: number;
  pulse: number;
  connected: boolean;
}

const STYLE: Record<ConversationalState, { label: string; hue: number; base: number }> = {
  IDLE: { label: "Ready", hue: 220, base: 0.16 },
  LISTENING: { label: "Listening", hue: 190, base: 0.26 },
  USER_SPEAKING: { label: "Hearing you", hue: 175, base: 0.38 },
  ENDPOINT_CANDIDATE: { label: "Listening", hue: 184, base: 0.3 },
  COMMITTING: { label: "Transcribing", hue: 184, base: 0.3 },
  THINKING: { label: "Thinking", hue: 252, base: 0.28 },
  SPEAKING: { label: "Speaking", hue: 32, base: 0.36 },
  INTERRUPTION_CANDIDATE: { label: "Listening closely", hue: 12, base: 0.48 },
  INTERRUPTED: { label: "Interrupted", hue: 350, base: 0.3 },
  RECOVERING: { label: "Recovering", hue: 42, base: 0.24 },
  ERROR: { label: "Needs attention", hue: 2, base: 0.28 },
  OFFLINE: { label: "Offline", hue: 220, base: 0.08 },
};

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

export function toAmbientVisualModel(state: UiState, brightness = 0.82): AmbientVisualModel {
  const style = STYLE[state.conversationalState];
  const inputEnergy = state.metrics.rms * 0.44 + state.metrics.peak * 0.18;
  const speechEnergy = state.metrics.speechProbability * 0.22;
  const outputEnergy = state.metrics.playbackEnvelope * 0.58;
  const reactiveEnergy =
    state.conversationalState === "SPEAKING" ? outputEnergy : inputEnergy + speechEnergy;
  const intensity = clamp((style.base + reactiveEnergy) * clamp(brightness));
  return {
    state: state.conversationalState,
    label:
      !state.microphoneEnabled &&
      ["IDLE", "LISTENING", "USER_SPEAKING", "ENDPOINT_CANDIDATE"].includes(
        state.conversationalState,
      )
        ? "Microphone muted"
        : style.label,
    hue: style.hue,
    intensity,
    radius: 0.72 + clamp(state.metrics.peak + state.metrics.playbackEnvelope) * 0.34,
    turbulence: clamp(state.metrics.speechProbability * 0.7 + state.metrics.rms * 0.3),
    pulse: clamp(
      state.conversationalState === "SPEAKING"
        ? state.metrics.playbackEnvelope
        : Math.max(state.metrics.rms, state.metrics.speechProbability * 0.65),
    ),
    connected: state.connection === "connected",
  };
}
