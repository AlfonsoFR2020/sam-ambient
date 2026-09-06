import { describe, expect, it } from "vitest";
import { toAmbientVisualModel } from "../src/ambient/model";
import { INITIAL_UI_STATE, type UiState } from "../src/protocol/types";

const state = (overrides: Partial<UiState>): UiState => ({
  ...INITIAL_UI_STATE,
  connection: "connected",
  ...overrides,
});

describe("ambient visual mapping", () => {
  it("does not claim to listen while the microphone is muted", () => {
    expect(
      toAmbientVisualModel(state({ conversationalState: "LISTENING", microphoneEnabled: false }))
        .label,
    ).toBe("Microphone muted");
  });
  it("distinguishes the four conversation phases", () => {
    for (const [phase, label] of [
      ["LISTENING", "Listening"],
      ["COMMITTING", "Transcribing"],
      ["THINKING", "Thinking"],
      ["SPEAKING", "Speaking"],
    ] as const) {
      expect(toAmbientVisualModel(state({ conversationalState: phase })).label).toBe(label);
    }
  });
  it("uses input metrics while listening", () => {
    const quiet = toAmbientVisualModel(state({ conversationalState: "LISTENING" }));
    const active = toAmbientVisualModel(
      state({
        conversationalState: "LISTENING",
        metrics: { rms: 0.7, peak: 0.8, speechProbability: 0.9, playbackEnvelope: 0 },
      }),
    );
    expect(active.intensity).toBeGreaterThan(quiet.intensity);
    expect(active.turbulence).toBeCloseTo(0.84);
  });

  it("uses playback envelope while speaking and honors brightness", () => {
    const bright = toAmbientVisualModel(
      state({
        conversationalState: "SPEAKING",
        metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0.8 },
      }),
      1,
    );
    const dim = toAmbientVisualModel(
      state({
        conversationalState: "SPEAKING",
        metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0.8 },
      }),
      0.4,
    );
    expect(bright.pulse).toBe(0.8);
    expect(dim.intensity).toBeLessThan(bright.intensity);
  });
});
