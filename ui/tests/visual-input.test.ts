import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE, type UiState } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";

const speaking = (overrides: Partial<UiState> = {}): UiState => ({
  ...INITIAL_UI_STATE,
  connection: "connected",
  conversationalState: "SPEAKING",
  priorConversationalState: "THINKING",
  provider: "local",
  model: "chat",
  sessionId: "session",
  generationId: "generation-1",
  lastMonotonicByType: { "voice.level": 10, "tts.level": 20 },
  metrics: { rms: 0.4, peak: 1.2, speechProbability: 0.7, playbackEnvelope: 0.8 },
  ...overrides,
});

describe("VisualInputV1 adapter", () => {
  it("maps only existing envelope features and keeps interaction separate", () => {
    const input = new VisualInputAdapter().ingest(speaking(), 100, { sourceSequence: 1 });
    expect(input.audio.input).toMatchObject({ envelope: 0.4, peak: 1, activity: 0.7 });
    expect(input.audio.output).toMatchObject({ envelope: 0.8 });
    expect(input.audio.input?.bands).toBeUndefined();
    expect(input.audio.input?.shape).toBeUndefined();
    expect(input.expression).toBeUndefined();
    expect(input.interaction).toMatchObject({ foreground: "speaking", speaking: true });
  });

  it("clamps finite features and rejects nonfinite channels", () => {
    const adapter = new VisualInputAdapter();
    const invalid = adapter.ingest(
      speaking({
        metrics: { rms: Number.NaN, peak: Infinity, speechProbability: -2, playbackEnvelope: 3 },
      }),
      100,
    );
    expect(invalid.audio.input).toBeUndefined();
    expect(invalid.audio.output?.envelope).toBe(1);
  });

  it("ages input and output independently without using source timestamps as a clock", () => {
    const adapter = new VisualInputAdapter();
    adapter.ingest(speaking(), 0);
    adapter.ingest(speaking({ lastMonotonicByType: { "voice.level": 11, "tts.level": 20 } }), 500);
    const snapshot = adapter.snapshot(600);
    expect(snapshot.audio.input?.envelope).toBe(0.4);
    expect(snapshot.audio.output?.envelope).toBeGreaterThan(0);
    expect(snapshot.audio.output?.envelope).toBeLessThan(0.8);
    expect(adapter.snapshot(1100).audio.output).toBeUndefined();
  });

  it("rejects stale source sequence and generation updates", () => {
    const adapter = new VisualInputAdapter();
    const accepted = adapter.ingest(speaking(), 100, { sourceSequence: 3 });
    const staleSequence = adapter.ingest(
      speaking({ metrics: { ...speaking().metrics, playbackEnvelope: 0.1 } }),
      110,
      { sourceSequence: 2 },
    );
    const staleGeneration = adapter.ingest(speaking(), 120, {
      sourceSequence: 4,
      generationId: "old-generation",
    });
    expect(staleSequence.sequence).toBe(accepted.sequence);
    expect(staleSequence.audio.output?.envelope).toBe(0.8);
    expect(staleGeneration.sequence).toBe(accepted.sequence);
  });

  it("clears confirmed cancellation and cannot relight from the consumed sample", () => {
    const adapter = new VisualInputAdapter();
    expect(adapter.ingest(speaking(), 10).audio.output?.envelope).toBe(0.8);
    const cancelled = adapter.ingest(
      speaking({ conversationalState: "INTERRUPTED", priorConversationalState: "SPEAKING" }),
      20,
    );
    expect(cancelled.audio.output).toBeUndefined();
    expect(cancelled.interaction.interruptSerial).toBe(1);
    expect(adapter.ingest(speaking(), 30).audio.output).toBeUndefined();
    expect(
      adapter.ingest(
        speaking({
          lastMonotonicByType: { "voice.level": 10, "tts.level": 21 },
          metrics: { ...speaking().metrics, playbackEnvelope: 0.35 },
        }),
        40,
      ).audio.output?.envelope,
    ).toBe(0.35);
  });

  it("represents tentative duplex listening and speaking", () => {
    const input = new VisualInputAdapter().ingest(
      speaking({
        conversationalState: "INTERRUPTION_CANDIDATE",
        priorConversationalState: "SPEAKING",
      }),
      100,
    );
    expect(input.interaction).toMatchObject({ listening: true, speaking: true, floor: "shared" });
  });
});
