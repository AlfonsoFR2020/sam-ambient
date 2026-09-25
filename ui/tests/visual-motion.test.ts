import { describe, expect, it } from "vitest";
import {
  MAX_FRAME_DELTA_SECONDS,
  MotionEvaluator,
  motionRateScale,
  STATE_TARGETS,
} from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  DEFAULT_VISUAL_ENGINE_SETTINGS,
  type VisualForeground,
  type VisualInputV1,
} from "../src/visual-engine/types";

const visualInput = (
  foreground: VisualForeground,
  overrides: Partial<VisualInputV1> = {},
): VisualInputV1 => ({
  version: 1,
  streamKey: "runtime",
  sequence: 1,
  receivedMs: 0,
  audio: {},
  interaction: {
    foreground,
    listening: foreground === "listening",
    speaking: foreground === "speaking" || foreground === "resuming",
    floor: foreground === "speaking" ? "sam" : foreground === "listening" ? "user" : "none",
    acknowledgement: false,
    userPause: false,
    reasoning: foreground === "thinking",
    delegatedWork: false,
    responseReady: false,
    interruptSerial: foreground === "interrupted" ? 1 : 0,
    availability: "ready",
  },
  ...overrides,
});

const evaluateTwice = (input: VisualInputV1, seed = 12) => {
  const evaluator = new MotionEvaluator(seed);
  evaluator.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
  return evaluator.evaluate(input, 80, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
};

describe("continuous Visual Engine motion", () => {
  it("defines distinct state targets without separate clips", () => {
    expect(STATE_TARGETS.listening.opening).toBeGreaterThan(STATE_TARGETS.idle.opening);
    expect(STATE_TARGETS.thinking.opening).toBeLessThan(STATE_TARGETS.idle.opening);
    expect(STATE_TARGETS.speaking.glow).toBeGreaterThan(STATE_TARGETS.listening.glow);
    expect(STATE_TARGETS.interrupted.radius).toBeLessThan(STATE_TARGETS.thinking.radius);
    expect(STATE_TARGETS.thinking.drift).toBeLessThan(0);
  });

  it("smooths target changes while oscillator phases continue", () => {
    const evaluator = new MotionEvaluator(30);
    const idle = visualInput("idle");
    evaluator.evaluate(idle, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const initialSpin = evaluator.evaluate(
      idle,
      80,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    ).spin;
    const frame = evaluator.evaluate(
      visualInput("listening"),
      160,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(frame.opening).toBeGreaterThan(STATE_TARGETS.idle.opening);
    expect(frame.opening).toBeLessThan(STATE_TARGETS.listening.opening);
    expect(frame.spin).toBeGreaterThan(initialSpin);
  });

  it("keeps zero-audio idle alive and deterministic", () => {
    const first = new MotionEvaluator(42);
    const second = new MotionEvaluator(42);
    const input = visualInput("idle");
    first.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    second.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const a = first.evaluate(input, 80, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const b = second.evaluate(input, 80, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    expect(a.spin).toBe(b.spin);
    expect(a.breathPhase).toBe(b.breathPhase);
    expect(a.envelope).toBe(0);
    expect(a.spin).not.toBe(0);
    expect(a.surfaceDeformation).toBeGreaterThan(0);
  });

  it("wires motion intensity to autonomous rotation speed", () => {
    const stopped = new MotionEvaluator(42);
    const moving = new MotionEvaluator(42);
    const input = visualInput("idle");
    const stoppedSettings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, motionIntensity: 0 };
    const movingSettings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, motionIntensity: 1 };
    const initialSpin = stopped.evaluate(input, 0, stoppedSettings, RENDER_BUDGETS.low).spin;
    moving.evaluate(input, 0, movingSettings, RENDER_BUDGETS.low);
    const stoppedFrame = stopped.evaluate(input, 80, stoppedSettings, RENDER_BUDGETS.low);
    const movingFrame = moving.evaluate(input, 80, movingSettings, RENDER_BUDGETS.low);
    expect(stoppedFrame.spin).toBe(initialSpin);
    expect(movingFrame.spin).toBeGreaterThan(initialSpin);
  });

  it("keeps the established default speed and expands the upper range smoothly", () => {
    expect(motionRateScale(0)).toBe(0);
    expect(motionRateScale(0.6)).toBeCloseTo(0.6);
    expect(motionRateScale(0.8)).toBeGreaterThan(0.8);
    expect(motionRateScale(1)).toBeCloseTo(1.8);
    expect(motionRateScale(0.59)).toBeLessThan(motionRateScale(0.61));
  });

  it("audio reactivity changes live response but not silent idle motion", () => {
    const quiet = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, audioReactivity: 0 };
    const reactive = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, audioReactivity: 1 };
    const input = {
      ...visualInput("speaking"),
      audio: { output: { receivedMs: 0, envelope: 0.9 } },
    };
    const a = new MotionEvaluator(42);
    const b = new MotionEvaluator(42);
    a.evaluate(input, 0, quiet, RENDER_BUDGETS.low);
    b.evaluate(input, 0, reactive, RENDER_BUDGETS.low);
    expect(a.evaluate(input, 50, quiet, RENDER_BUDGETS.low).envelope).toBe(0);
    expect(b.evaluate(input, 50, reactive, RENDER_BUDGETS.low).envelope).toBeGreaterThan(0);
  });

  it("advects broad field phases visibly over ten seconds without requiring audio", () => {
    const evaluator = new MotionEvaluator(42);
    const input = visualInput("idle");
    const initial = evaluator.evaluate(
      input,
      0,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const start = initial.fieldPhase1;
    const start2 = initial.fieldPhase2;
    let frame = initial;
    for (let time = 50; time <= 10_000; time += 50)
      frame = evaluator.evaluate(input, time, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    expect(frame.fieldPhase1 - start).toBeGreaterThan(0.7);
    expect(frame.fieldPhase1 - start).toBeLessThan(1);
    expect(frame.fieldPhase2).not.toBe(start2);
  });

  it("caps integration at 50 ms after a stall", () => {
    const input = visualInput("idle");
    const capped = new MotionEvaluator(42);
    const stalled = new MotionEvaluator(42);
    capped.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    stalled.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const expected = capped.evaluate(
      input,
      MAX_FRAME_DELTA_SECONDS * 1000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const actual = stalled.evaluate(
      input,
      5_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(actual.spin).toBeCloseTo(expected.spin, 8);
    expect(actual.peelTravel).toBeCloseTo(expected.peelTravel, 8);
    expect(actual.fieldPhase1).toBeCloseTo(expected.fieldPhase1, 8);
    expect(actual.fieldTwist2).toBeCloseTo(expected.fieldTwist2, 8);
  });

  it("keeps seeded field phases bounded and deterministic across long running wraps", () => {
    const input = visualInput("idle");
    const moving = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, motionIntensity: 1 };
    const first = new MotionEvaluator(42);
    const second = new MotionEvaluator(42);
    let wrapped = false;
    let previous = first.evaluate(input, 0, moving, RENDER_BUDGETS.low).fieldPhase1;
    second.evaluate(input, 0, moving, RENDER_BUDGETS.low);
    for (let step = 1; step <= 5_000; step++) {
      const now = step * 50;
      const a = first.evaluate(input, now, moving, RENDER_BUDGETS.low);
      const b = second.evaluate(input, now, moving, RENDER_BUDGETS.low);
      wrapped ||= a.fieldPhase1 < previous;
      previous = a.fieldPhase1;
      expect(a.fieldPhase1).toBe(b.fieldPhase1);
      expect(a.fieldPhase2).toBe(b.fieldPhase2);
      expect(a.fieldTwist1).toBe(b.fieldTwist1);
      expect(a.fieldTwist2).toBe(b.fieldTwist2);
    }
    const frame = first.evaluate(input, 250_050, moving, RENDER_BUDGETS.low);
    expect(wrapped).toBe(true);
    expect(frame.fieldPhase1).toBeGreaterThanOrEqual(0);
    expect(frame.fieldPhase1).toBeLessThan(2 * Math.PI);
    expect(frame.fieldPhase2).toBeGreaterThanOrEqual(0);
    expect(frame.fieldPhase2).toBeLessThan(2 * Math.PI);
    expect(Math.abs(frame.fieldTwist1)).toBeLessThanOrEqual(0.32);
    expect(Math.abs(frame.fieldTwist2)).toBeLessThanOrEqual(0.24);
  });

  it("freezes field phase during hidden and reduced-motion intervals", () => {
    const input = visualInput("idle");
    const evaluator = new MotionEvaluator(17);
    evaluator.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const before = evaluator.evaluate(
      input,
      50,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const phase = [before.fieldPhase1, before.fieldPhase2, before.fieldTwist1, before.fieldTwist2];
    evaluator.pauseClock();
    const resumed = evaluator.evaluate(
      input,
      50_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect([
      resumed.fieldPhase1,
      resumed.fieldPhase2,
      resumed.fieldTwist1,
      resumed.fieldTwist2,
    ]).toEqual(phase);
    const reduced = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" as const };
    const still = evaluator.evaluate(input, 100_000, reduced, RENDER_BUDGETS.low);
    expect([still.fieldPhase1, still.fieldPhase2, still.fieldTwist1, still.fieldTwist2]).toEqual(
      phase,
    );
  });

  it("holds startup, reconnecting, and stopped inputs as dim stationary idle forms", () => {
    const evaluator = new MotionEvaluator(42);
    const unavailable = (availability: "starting" | "reconnecting" | "stopped") => {
      const speaking = visualInput("speaking");
      return {
        ...speaking,
        audio: { output: { receivedMs: 0, envelope: 1 } },
        interaction: { ...speaking.interaction, availability },
      };
    };
    const starting = evaluator.evaluate(
      unavailable("starting"),
      0,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const spin = starting.spin;
    expect(starting.opening).toBe(STATE_TARGETS.idle.opening);
    expect(starting.outputEnvelope).toBe(0);
    expect(starting.glow).toBeLessThan(STATE_TARGETS.idle.glow);
    const reconnecting = evaluator.evaluate(
      unavailable("reconnecting"),
      1_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const reconnectingGlow = reconnecting.glow;
    expect(reconnecting.spin).toBe(spin);
    const stopped = evaluator.evaluate(
      unavailable("stopped"),
      2_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(stopped.spin).toBe(spin);
    expect(stopped.glow).toBeLessThan(reconnectingGlow);
    expect(stopped.particleExcitation).toBe(0);
  });

  it("bounds maximum audio response and uses output as the strongest channel", () => {
    const frame = evaluateTwice({
      ...visualInput("speaking"),
      audio: { output: { receivedMs: 0, envelope: 1 } },
    });
    expect(frame.radius).toBeGreaterThan(STATE_TARGETS.speaking.radius);
    expect(frame.radius).toBeLessThanOrEqual(1.1);
    expect(frame.glow).toBeLessThanOrEqual(0.85);
    expect(frame.surfaceDeformation).toBeLessThanOrEqual(0.026);
    expect(frame.surfaceRipple).toBeLessThanOrEqual(0.022);
    expect(frame.highlight).toBeLessThanOrEqual(0.12);
    expect(frame.peelLift).toBeLessThanOrEqual(0.018);
    expect(frame.peelWidth).toBeLessThanOrEqual(1.35);
  });

  it("combines simultaneous input/output by maximum rather than summing", () => {
    const outputOnly = evaluateTwice({
      ...visualInput("speaking"),
      audio: { output: { receivedMs: 0, envelope: 0.6 } },
    }).envelope;
    const duplex = evaluateTwice({
      ...visualInput("speaking"),
      audio: {
        input: { receivedMs: 0, envelope: 1, activity: 1 },
        output: { receivedMs: 0, envelope: 0.6 },
      },
      interaction: {
        ...visualInput("speaking").interaction,
        listening: true,
        speaking: true,
        floor: "shared",
      },
    });
    expect(duplex.envelope).toBeCloseTo(outputOnly, 8);
    expect(duplex.opening).toBeGreaterThan(STATE_TARGETS.speaking.opening);
  });

  it("keeps orthogonal cognition cues secondary to the foreground", () => {
    const base = visualInput("speaking");
    const frame = evaluateTwice({
      ...base,
      interaction: { ...base.interaction, reasoning: true, delegatedWork: true },
      audio: { output: { receivedMs: 0, envelope: 0.4 } },
    });
    expect(frame.foreground).toBe("speaking");
    expect(frame.reasoningCue).toBeGreaterThan(0);
    expect(frame.delegatedCue).toBeGreaterThan(frame.reasoningCue);
  });

  it("fires interruption once and decays without replay", () => {
    const evaluator = new MotionEvaluator(4);
    evaluator.evaluate(
      visualInput("speaking"),
      0,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const interrupted = evaluator.evaluate(
      visualInput("interrupted"),
      80,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    const firstImpulse = interrupted.interruption;
    const repeated = evaluator.evaluate(
      visualInput("interrupted"),
      160,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(firstImpulse).toBe(1);
    expect(repeated.interruption).toBeLessThan(firstImpulse);
    expect(repeated.peelRephase).toBeLessThanOrEqual(0.12);
  });

  it("baselines a historical interrupt serial when a renderer attaches", () => {
    const evaluator = new MotionEvaluator(8);
    const idle = visualInput("idle");
    const frame = evaluator.evaluate(
      {
        ...idle,
        interaction: { ...idle.interaction, interruptSerial: 7 },
      },
      100,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(frame.interruption).toBe(0);
    expect(frame.peelRephase).toBe(0);
  });

  it("expires stale output and cannot retain its excitation", () => {
    const evaluator = new MotionEvaluator(9);
    const input = {
      ...visualInput("speaking"),
      audio: { output: { receivedMs: 0, envelope: 1 } },
    };
    evaluator.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    evaluator.evaluate(input, 80, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const stale = evaluator.evaluate(
      input,
      1200,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(stale.outputEnvelope).toBe(0);
    expect(stale.envelope).toBeLessThan(0.5);
  });

  it("freezes continuous motion in reduced mode while retaining state identity", () => {
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" as const };
    const evaluator = new MotionEvaluator(17);
    const idle = evaluator.evaluate(visualInput("idle"), 0, settings, RENDER_BUDGETS.low);
    const phase = idle.spin;
    const transitionStart = evaluator.evaluate(
      visualInput("listening"),
      1000,
      settings,
      RENDER_BUDGETS.low,
    );
    expect(transitionStart.spin).toBe(phase);
    expect(transitionStart.opening).toBe(STATE_TARGETS.idle.opening);
    const midpointOpening = evaluator.evaluate(
      visualInput("listening"),
      1100,
      settings,
      RENDER_BUDGETS.low,
    ).opening;
    expect(midpointOpening).toBeGreaterThan(STATE_TARGETS.idle.opening);
    expect(midpointOpening).toBeLessThan(STATE_TARGETS.listening.opening);
    const listening = evaluator.evaluate(
      visualInput("listening"),
      1200,
      settings,
      RENDER_BUDGETS.low,
    );
    expect(listening.spin).toBe(phase);
    expect(listening.opening).toBe(STATE_TARGETS.listening.opening);
    expect(listening.surfaceDeformation).toBe(0);
    expect(listening.particleExcitation).toBe(0);
    expect(listening.reducedMotion).toBe(true);
  });

  it("reuses one bounded frame without per-frame allocation", () => {
    const evaluator = new MotionEvaluator(5);
    const input = visualInput("idle");
    const first = evaluator.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const second = evaluator.evaluate(
      input,
      80,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(first).toBe(second);
    expect(second.radius).toBeGreaterThanOrEqual(0.92);
    expect(second.radius).toBeLessThanOrEqual(1.1);
  });
});
