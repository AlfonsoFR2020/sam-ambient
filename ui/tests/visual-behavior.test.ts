import { describe, expect, it } from "vitest";
import { type ConversationalState, INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const source = (state: ConversationalState, time: number, rms: number, sessionId = "owner") => ({
  ...INITIAL_UI_STATE,
  connection: "connected" as const,
  sessionId,
  generationId: "generation",
  provider: "fixture",
  model: "fixture",
  microphoneEnabled: true,
  ttsOutputEnabled: true,
  conversationalState: state,
  priorConversationalState: "IDLE" as const,
  lastMonotonicByType: { "voice.level": time + 1, "tts.level": time + 1 },
  metrics: {
    ...INITIAL_UI_STATE.metrics,
    rms,
    peak: rms * 1.4,
    speechProbability: rms ? 0.9 : 0,
    playbackEnvelope: rms,
  },
});

const settled = (state: ConversationalState, rms = 0, strength = 0.7) => {
  const adapter = new VisualInputAdapter(),
    motion = new MotionEvaluator(0x5a17);
  for (let t = 0; t <= 600; t += 20)
    motion.evaluate(
      adapter.ingest(source(state, t, rms), t),
      t,
      { ...DEFAULT_VISUAL_ENGINE_SETTINGS, audioReactivity: strength },
      RENDER_BUDGETS.high,
    );
  return { ...motion.currentFrame, reactivity: { ...motion.currentFrame.reactivity } };
};

describe("whole-body behavior from authoritative visual input", () => {
  it("distinguishes listening tension, working circulation and expressive speech", () => {
    const idle = settled("IDLE"),
      receptive = settled("LISTENING"),
      input = settled("USER_SPEAKING", 0.12);
    const work = settled("THINKING"),
      quiet = settled("SPEAKING"),
      normal = settled("SPEAKING", 0.12),
      emphasis = settled("SPEAKING", 0.45);
    expect(input.radius).toBeLessThan(receptive.radius - 0.007);
    expect(input.peelLift).toBeGreaterThan(receptive.peelLift + 0.004);
    expect(input.rim).toBeGreaterThan(receptive.rim + 0.04);
    expect(work.reasoningCue).toBeGreaterThan(0.9);
    expect(work.surfaceFlowRate).toBeGreaterThan(idle.surfaceFlowRate * 1.25);
    expect(work.glow).toBeGreaterThan(idle.glow + 0.1);
    expect(normal.radius).toBeGreaterThan(quiet.radius + 0.035);
    expect(emphasis.radius).toBeGreaterThan(normal.radius + 0.02);
    expect(emphasis.highlight).toBeGreaterThan(normal.highlight);
    expect(emphasis.peelLift).toBeGreaterThan(normal.peelLift);
    expect(emphasis.reactivity.particleSpread).toBeGreaterThan(normal.reactivity.particleSpread);
  });
  it("keeps zero reactivity exact and prevents processing noise from becoming receptive speech", () => {
    for (const state of ["LISTENING", "SPEAKING"] as const) {
      const quiet = settled(state, 0, 0),
        loud = settled(state, 0.8, 0);
      for (const key of ["radius", "peelLift", "highlight", "glow", "fieldPhase1"] as const)
        expect(loud[key]).toBe(quiet[key]);
      expect(loud.reactivity.outputPulse).toBe(0);
      expect(loud.reactivity.inputPresence).toBe(0);
    }
    const work = settled("THINKING", 0.8);
    expect(work.inputEnvelope).toBe(0);
    expect(work.outputEnvelope).toBe(0);
  });
  it("retires cancellation, rejects a stale generation sample and clears a new owner stream", () => {
    const adapter = new VisualInputAdapter(),
      motion = new MotionEvaluator();
    for (let t = 0; t <= 400; t += 20)
      motion.evaluate(
        adapter.ingest(source("SPEAKING", t, 0.35), t),
        t,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        RENDER_BUDGETS.high,
      );
    const before = motion.currentFrame.reactivity.outputPulse;
    for (let t = 420; t <= 900; t += 20) {
      const state = {
        ...source("INTERRUPTED", t, 0),
        lastMonotonicByType: { "tts.cancelled": t + 1 },
      };
      motion.evaluate(
        adapter.ingest(state, t),
        t,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        RENDER_BUDGETS.high,
      );
    }
    expect(motion.currentFrame.reactivity.outputPulse).toBeLessThan(before * 0.01);
    const newer = { ...source("THINKING", 920, 0), generationId: "new" };
    adapter.ingest(newer, 920);
    const rejected = adapter.ingest(
      { ...newer, metrics: { ...newer.metrics, playbackEnvelope: 1 } },
      940,
      { generationId: "old" },
    );
    expect(rejected.audio.output).toBeUndefined();
    motion.evaluate(
      adapter.ingest(source("THINKING", 960, 0), 960),
      960,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.high,
    );
    const next = motion.evaluate(
      adapter.ingest(source("IDLE", 980, 0, "new-owner"), 980),
      980,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.high,
    );
    expect(next.reasoningCue).toBe(0);
    expect(next.reactivity.outputPulse).toBe(0);
  });
  it("keeps behavior independent of tier and freezes spatial/audio changes under Reduced Motion", () => {
    const motion = new MotionEvaluator(),
      adapter = new VisualInputAdapter();
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" as const };
    const first = {
      ...motion.evaluate(
        adapter.ingest(source("SPEAKING", 0, 0.8), 0),
        0,
        settings,
        RENDER_BUDGETS.low,
      ),
    };
    for (let t = 20; t <= 1000; t += 20)
      motion.evaluate(
        adapter.ingest(source("SPEAKING", t, 0.8), t),
        t,
        settings,
        RENDER_BUDGETS.high,
      );
    expect(motion.currentFrame.radius).toBe(first.radius);
    expect(motion.currentFrame.peelTravel).toBe(first.peelTravel);
    expect(motion.currentFrame.reactivity.outputPulse).toBe(0);
  });
});
