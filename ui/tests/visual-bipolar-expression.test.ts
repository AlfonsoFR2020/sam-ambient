import { describe, expect, it } from "vitest";
import contract from "../../tests/fixtures/playback_visual_contract.json";
import { presencePresentation } from "../src/presence";
import { INITIAL_UI_STATE, type ProtocolEvent } from "../src/protocol/types";
import { reduceProtocolEvent } from "../src/state/reducer";
import {
  bipolarBasis,
  bipolarParameter,
  bipolarPeelPoint,
  createBipolarPeels,
} from "../src/visual-engine/bipolar-peel";
import { VisualInputAdapter } from "../src/visual-engine/input";
import type { SkinPose } from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { MotionEvaluator, type MotionFrame } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import type { SkinVector } from "../src/visual-engine/skin-domain";
import {
  DEFAULT_VISUAL_ENGINE_SETTINGS,
  type VisualForeground,
  type VisualInputV1,
} from "../src/visual-engine/types";

const peels = createBipolarPeels(0x5a17);
const distance = (a: SkinVector, b: SkinVector) => Math.hypot(...a.map((x, k) => x - b[k]));
// A controlled spheroid body foundation isolates actual skin displacement from
// the independent pigment and body-deformation tests. It is not a GPU proof.
const body =
  (radius: number) =>
  (n: SkinVector): SkinVector => [radius * n[0], radius * 1.06 * n[1], radius * n[2]];
const point = (pose: SkinPose, i = 0, t = 0.85, v = 0.3): SkinVector =>
  bipolarPeelPoint(
    bipolarParameter(peels[i], t, v),
    peels,
    pose,
    body(pose.bodyRadius ?? 1.18),
    RENDER_BUDGETS.high.skinClearance,
  );
const speechDisplacement = (frame: MotionFrame, i = 0) => {
  const pose = skinPoseFromFrame(frame);
  return distance(point(pose, i), point({ ...pose, speech: 0 }, i));
};
const input = (now: number, foreground: VisualForeground): VisualInputV1 => ({
  version: 1,
  streamKey: "bipolar-expression",
  sequence: now + 1,
  receivedMs: now,
  audio: {},
  interaction: {
    foreground,
    listening: foreground === "listening",
    speaking: foreground === "speaking",
    floor: "none",
    acknowledgement: false,
    userPause: false,
    reasoning: foreground === "thinking",
    delegatedWork: false,
    responseReady: false,
    interruptSerial: 0,
    availability: "ready",
  },
});

describe("bipolar geometry consumes trusted presentation evidence", () => {
  for (const mode of ["ordinary", "zero", "reduced"] as const) {
    it(`${mode}: remains expressive through 24 seconds of measured delivery, quiet intervals and stale retirement`, () => {
      const initial = {
        ...INITIAL_UI_STATE,
        connection: "connected" as const,
        sessionId: "bipolar-contract",
        provider: "local",
        model: "fake",
        generationId: "delivery",
        turnId: "turn",
        conversationalState: "SPEAKING" as const,
        providerDiscovery: { status: "available" as const },
        startupLifecycle: "ready_transition" as const,
      };
      const event = (type: string, now: number, envelope?: number): ProtocolEvent => ({
        protocol: 1,
        type,
        monotonic_ms: now + 10,
        session_id: "bipolar-contract",
        turn_id: "turn",
        generation_id: "delivery",
        payload: envelope === undefined ? {} : { envelope },
      });
      let ui = reduceProtocolEvent(initial, event("model.completed", -10));
      ui = reduceProtocolEvent(ui, event("tts.started", -5));
      const adapter = new VisualInputAdapter();
      const motion = new MotionEvaluator(0x5a17);
      const settings = {
        ...DEFAULT_VISUAL_ENGINE_SETTINGS,
        audioReactivity: mode === "zero" ? 0 : 0.7,
        reducedMotion: mode === "reduced" ? ("on" as const) : ("off" as const),
      };
      const step = (now: number) =>
        motion.evaluate(adapter.ingest(ui, now), now, settings, RENDER_BUDGETS.high);
      const startingPhase = motion.currentFrame.peelTravel;
      for (let now = 0; now < contract.acceptanceDelayMs; now += 20) {
        expect(presencePresentation(ui).phase).toBe("preparing_speech");
        expect(speechDisplacement(step(now))).toBe(0);
      }

      // Repeat the approved synthetic PCM-level contract, not a fabricated
      // periodic speech oscillator. This establishes control/geometry response,
      // not natural-speech quality or acoustic output timestamps.
      const cycle = contract.segments.flatMap((segment) =>
        Array<number>(segment.frames).fill(segment.sample),
      );
      const samples = [...cycle, ...cycle];
      const responses: number[] = [];
      const perPeelLate: number[] = [];
      let now = contract.acceptanceDelayMs;
      for (let sequence = 0; sequence < samples.length; sequence++) {
        if (sequence === contract.pauseBeforeFrame) {
          for (let elapsed = 0; elapsed < contract.pauseMs; elapsed += 20) step(now + elapsed);
          now += contract.pauseMs;
          expect(adapter.snapshot(now).audio.output).toBeUndefined();
          expect(speechDisplacement(motion.currentFrame)).toBeLessThan(0.0005);
        }
        ui = reduceProtocolEvent(ui, event("tts.level", now, samples[sequence] / 32768));
        if (sequence > 100)
          ui = {
            ...ui,
            conversationalState: "RECOVERING",
            priorConversationalState: "INTERRUPTION_CANDIDATE",
          };
        expect(presencePresentation(ui).phase).toBe("speaking");
        const frame = step(now);
        responses.push(speechDisplacement(frame));
        if (sequence === cycle.length + 490)
          for (let i = 0; i < peels.length; i++) perPeelLate.push(speechDisplacement(frame, i));
        now += 20;
      }
      expect(samples.length * 20).toBeGreaterThanOrEqual(24_000);
      if (mode === "ordinary") {
        expect(responses[120]).toBeGreaterThan(0.001);
        expect(responses[245]).toBeLessThan(0.0005);
        // Quiet syllables remain geometrically effective late in delivery;
        // the response is not merely an initial speaking-state impulse.
        expect(responses[cycle.length + 490]).toBeGreaterThan(0.001);
        expect(perPeelLate.every((value) => value > 0.001)).toBe(true);
        expect(Math.max(...perPeelLate) - Math.min(...perPeelLate)).toBeGreaterThan(0.0001);
      } else {
        expect(responses.every((value) => value === 0)).toBe(true);
      }
      expect(motion.currentFrame.peelTravel === startingPhase).toBe(mode === "reduced");

      ui = reduceProtocolEvent(ui, event("tts.cancelled", now));
      const retired = ui;
      ui = reduceProtocolEvent(ui, event("tts.level", now + 20, 1));
      expect(ui).toBe(retired);
      for (let elapsed = 20; elapsed <= 1400; elapsed += 20) step(now + elapsed);
      expect(adapter.snapshot(now + 1400).audio.output).toBeUndefined();
      expect(speechDisplacement(motion.currentFrame)).toBeLessThan(0.00001);
    });
  }

  it("maps actual work, preparation and unloading to lifted geometry while preserving attached roots", () => {
    const motion = new MotionEvaluator(0x5a17);
    const evaluate = (
      now: number,
      foreground: VisualForeground,
      phase?: "loading" | "unloading",
    ) => {
      const state = input(now, foreground);
      return motion.evaluate(
        phase
          ? {
              ...state,
              interaction: {
                ...state.interaction,
                providerLifecycle: { phase, key: phase },
                presence: { phase, key: phase },
              },
            }
          : state,
        now,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        RENDER_BUDGETS.high,
      );
    };
    for (let now = 0; now <= 600; now += 20) evaluate(now, "idle");
    const idle = skinPoseFromFrame(motion.currentFrame);
    for (const [i, peel] of peels.entries()) {
      const material = bipolarBasis(peel, 0.85, 0.3).material;
      const resting = body(idle.bodyRadius ?? 1.18)(material).map(
        (x, k) => x + material[k] * RENDER_BUDGETS.high.skinClearance * (k === 1 ? 1.06 : 1),
      ) as unknown as SkinVector;
      expect(distance(point(idle, i), resting)).toBeGreaterThan(0.05);
    }
    for (let now = 620; now <= 2600; now += 20) evaluate(now, "thinking");
    const working = skinPoseFromFrame(motion.currentFrame);
    expect(working.work).toBeGreaterThan(0.95);
    expect(distance(point(working), point({ ...working, work: 0 }))).toBeGreaterThan(0.01);
    for (let now = 2620; now <= 4600; now += 20) evaluate(now, "idle", "loading");
    const preparing = skinPoseFromFrame(motion.currentFrame);
    expect(preparing.preparation).toBeGreaterThan(0.95);
    expect(distance(point(preparing), point({ ...preparing, preparation: 0 }))).toBeGreaterThan(
      0.01,
    );
    for (let now = 4620; now <= 6600; now += 20) evaluate(now, "idle", "unloading");
    const settling = skinPoseFromFrame(motion.currentFrame);
    expect(settling.settling).toBeGreaterThan(0.95);
    expect(distance(point(settling), point({ ...settling, settling: 0 }))).toBeGreaterThan(0.01);
    for (let i = 0; i < peels.length; i++) {
      const baseline = point(settling, i, 0.04);
      expect(
        distance(baseline, point({ ...settling, speech: 1, work: 1, preparation: 1 }, i, 0.04)),
      ).toBeLessThan(1e-12);
    }
  });

  it("retains autonomous idle movement, resets hidden speech evidence and does not catch up hidden phase", () => {
    const motion = new MotionEvaluator(0x5a17);
    const evaluate = (now: number, speaking: boolean) => {
      const state = input(now, speaking ? "speaking" : "idle");
      return motion.evaluate(
        speaking ? { ...state, audio: { output: { receivedMs: now, envelope: 0.12 } } } : state,
        now,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        RENDER_BUDGETS.high,
      );
    };
    for (let now = 0; now <= 1000; now += 20) evaluate(now, false);
    const first = point(skinPoseFromFrame(motion.currentFrame));
    for (let now = 1020; now <= 2200; now += 20) evaluate(now, false);
    expect(distance(first, point(skinPoseFromFrame(motion.currentFrame)))).toBeGreaterThan(0.001);
    for (let now = 2220; now <= 3000; now += 20) evaluate(now, true);
    expect(speechDisplacement(motion.currentFrame)).toBeGreaterThan(0.001);
    const phase = motion.currentFrame.peelTravel;
    motion.pauseClock();
    const oldInput = input(3000, "speaking");
    const resumed = motion.evaluate(
      { ...oldInput, audio: { output: { receivedMs: 3000, envelope: 1 } } },
      60_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.high,
    );
    expect(resumed.peelTravel).toBe(phase);
    expect(resumed.reactivity.outputPulse).toBe(0);
    expect(speechDisplacement(resumed)).toBe(0);
  });

  it("keeps attachment and free-edge expression continuous at membrane phase wraps", () => {
    const motion = new MotionEvaluator(0x5a17);
    const pose = skinPoseFromFrame(motion.currentFrame);
    for (let i = 0; i < peels.length; i++)
      for (const t of [0.04, 0.08, 0.5, 1])
        for (const v of [-1, 0, 1]) {
          const before = point(
            { ...pose, travel: 2 * Math.PI - 1e-7, speech: 0.8, work: 1 },
            i,
            t,
            v,
          );
          const after = point({ ...pose, travel: 1e-7, speech: 0.8, work: 1 }, i, t, v);
          expect(distance(before, after)).toBeLessThan(0.00001);
        }
  });
});
