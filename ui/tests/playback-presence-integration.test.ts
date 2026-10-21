import { describe, expect, it } from "vitest";
import contract from "../../tests/fixtures/playback_visual_contract.json";
import { presencePresentation } from "../src/presence";
import { INITIAL_UI_STATE, type ProtocolEvent } from "../src/protocol/types";
import { reduceProtocolEvent } from "../src/state/reducer";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

describe("shared real-PCM contract through reducer, presence and Orb motion", () => {
  for (const mode of ["ordinary", "zero", "reduced"] as const) {
    it(`${mode}: delayed acceptance, twelve-second delivery, silence, stalled writes, resume and stale retirement`, () => {
      const state = {
        ...INITIAL_UI_STATE,
        connection: "connected" as const,
        sessionId: "contract",
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
        session_id: "contract",
        turn_id: "turn",
        generation_id: "delivery",
        payload: envelope === undefined ? {} : { envelope },
      });
      // Model completion has already occurred; delivery owns the remaining lifetime.
      let ui = reduceProtocolEvent(state, event("model.completed", -10));
      ui = reduceProtocolEvent(ui, event("tts.started", -5));
      const adapter = new VisualInputAdapter(),
        motion = new MotionEvaluator(0x5a17);
      const initialTravel = motion.currentFrame.peelTravel;
      const settings = {
        ...DEFAULT_VISUAL_ENGINE_SETTINGS,
        audioReactivity: mode === "zero" ? 0 : 0.7,
        reducedMotion: mode === "reduced" ? ("on" as const) : ("off" as const),
      };
      const step = (now: number) =>
        motion.evaluate(adapter.ingest(ui, now), now, settings, RENDER_BUDGETS.high);
      for (let now = 0; now < contract.acceptanceDelayMs; now += 20) {
        expect(presencePresentation(ui).phase).toBe("preparing_speech");
        expect(step(now).reactivity.outputPulse).toBe(0);
      }
      let now = contract.acceptanceDelayMs;
      const samples = contract.segments.flatMap((segment) =>
        Array<number>(segment.frames).fill(segment.sample),
      );
      const pulses: number[] = [];
      for (let sequence = 0; sequence < samples.length; sequence++) {
        if (sequence === contract.pauseBeforeFrame) {
          for (let elapsed = 0; elapsed < contract.pauseMs; elapsed += 20) step(now + elapsed);
          now += contract.pauseMs;
          expect(adapter.snapshot(now).audio.output).toBeUndefined();
          expect(motion.currentFrame.reactivity.outputPulse).toBeLessThan(0.01);
        }
        // Python's paired test asserts these exact envelopes from accepted signed-16 PCM.
        const envelope = samples[sequence] / 32768;
        ui = reduceProtocolEvent(ui, event("tts.level", now, envelope));
        if (sequence > 100)
          ui = {
            ...ui,
            conversationalState: "RECOVERING",
            priorConversationalState: "INTERRUPTION_CANDIDATE",
          };
        expect(presencePresentation(ui).phase).toBe("speaking");
        const frame = step(now);
        expect(adapter.snapshot(now).audio.output?.envelope).toBe(envelope);
        expect(frame.radius).toBeLessThanOrEqual(1.18);
        pulses.push(frame.reactivity.outputPulse);
        now += 20;
      }
      // Reduced Motion deliberately suppresses spatial pulses; meters and truthful labels survive.
      if (mode !== "ordinary") expect(pulses.every((value) => value === 0)).toBe(true);
      else {
        expect(pulses[120]).toBeGreaterThan(0.1);
        expect(pulses[245]).toBeLessThan(0.01);
        expect(pulses[490]).toBeGreaterThan(0.02);
        expect(pulses[590]).toBeGreaterThan(pulses[490]);
      }
      const phase = motion.currentFrame.peelTravel;
      expect(mode === "reduced" ? phase === initialTravel : phase !== initialTravel).toBe(true);
      ui = reduceProtocolEvent(ui, event("tts.cancelled", now));
      const retired = ui;
      ui = reduceProtocolEvent(ui, event("tts.level", now + 20, 1));
      expect(ui).toBe(retired);
      for (let elapsed = 20; elapsed < 1400; elapsed += 20) step(now + elapsed);
      expect(adapter.snapshot(now + 1400).audio.output).toBeUndefined();
      expect(motion.currentFrame.reactivity.outputPulse).toBeLessThan(0.01);
    });
  }
});
