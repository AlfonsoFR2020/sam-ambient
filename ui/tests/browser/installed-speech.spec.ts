import { expect, test } from "@playwright/test";
import waveforms from "../fixtures/installed-speech-levels.json" with { type: "json" };

test("installed bilingual PCM meters reach bounded form/light and distinct listening response", async ({
  page,
}) => {
  await page.goto("/?transport=demo");
  const results = await page.evaluate(async (waveforms) => {
    const [
      { INITIAL_UI_STATE },
      { reduceProtocolEvent },
      { VisualInputAdapter },
      { MotionEvaluator },
      { DEFAULT_VISUAL_ENGINE_SETTINGS },
      { RENDER_BUDGETS },
      { WebGLBackend },
    ] = await Promise.all([
      import("../../src/protocol/types"),
      import("../../src/state/reducer"),
      import("../../src/visual-engine/input"),
      import("../../src/visual-engine/motion"),
      import("../../src/visual-engine/types"),
      import("../../src/visual-engine/quality"),
      import("../../src/visual-engine/webgl"),
    ]);
    const seed = 1234;
    const run = (rows: number[][], output: boolean, amount = 0.7, gain = 1) => {
      const adapter = new VisualInputAdapter();
      const motion = new MotionEvaluator(seed);
      const autonomous = new MotionEvaluator(seed);
      let state: typeof INITIAL_UI_STATE = {
        ...INITIAL_UI_STATE,
        connection: "connected" as const,
        provider: "fixture",
        model: "fixture",
        sessionId: "session",
        generationId: "generation",
        microphoneEnabled: true,
        ttsOutputEnabled: true,
        conversationalState: output ? ("SPEAKING" as const) : ("LISTENING" as const),
      };
      const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, audioReactivity: amount };
      let strongest = 0;
      let receptive = 0;
      let chosen = motion.currentFrame;
      let baseline = autonomous.currentFrame;
      for (const [time, rms, peak, probability] of rows) {
        state = reduceProtocolEvent(state, {
          protocol: 1,
          type: output ? "tts.level" : "voice.level",
          monotonic_ms: time + 500,
          session_id: "session",
          generation_id: output ? "generation" : undefined,
          payload: output
            ? { envelope: rms * gain, peak: peak * gain }
            : { rms, peak, speech_probability: probability },
        });
        const input = adapter.ingest(state, time + 500);
        const frame = motion.evaluate(input, time + 500, settings, RENDER_BUDGETS.high);
        const quiet = autonomous.evaluate(
          input,
          time + 500,
          { ...settings, audioReactivity: 0 },
          RENDER_BUDGETS.high,
        );
        receptive = Math.max(receptive, frame.reactivity.inputPresence);
        if (frame.reactivity.outputPulse > strongest) {
          strongest = frame.reactivity.outputPulse;
          chosen = { ...frame, reactivity: { ...frame.reactivity } };
          baseline = { ...quiet, reactivity: { ...quiet.reactivity } };
        }
      }
      const finalTime = rows[rows.length - 1][0] + 500;
      for (let time = finalTime + 20; time <= finalTime + 2500; time += 20)
        motion.evaluate(adapter.snapshot(time), time, settings, RENDER_BUDGETS.high);
      return {
        strongest,
        receptive,
        chosen,
        baseline,
        settled: motion.currentFrame.reactivity.outputPulse,
      };
    };
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 required");
    const results = [];
    for (const language of ["en", "es"] as const) {
      const response = run(waveforms.output[language], true);
      const quieter = run(waveforms.output[language], true, 0.7, 0.25);
      const zero = run(waveforms.output[language], true, 0);
      const listening = run(waveforms.input[language], false);
      let current = response.baseline;
      const fixedMotion = { evaluate: () => current } as unknown as InstanceType<
        typeof MotionEvaluator
      >;
      const backend = new WebGLBackend(
        canvas,
        gl,
        { ...RENDER_BUDGETS.high, peels: 0 },
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        seed,
        fixedMotion,
      );
      backend.update(new VisualInputAdapter().ingest(INITIAL_UI_STATE, 0));
      backend.resize(480, 480, 1);
      const read = () => {
        backend.render(0);
        const pixels = new Uint8Array(480 * 480 * 4);
        gl.readPixels(0, 0, 480, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
      };
      const before = read();
      // Freeze autonomous orientation/material/lighting clocks; vary only audio channels.
      current = {
        ...response.baseline,
        radius: response.chosen.radius,
        glow: response.chosen.glow,
        highlight: response.chosen.highlight,
        reactivity: response.chosen.reactivity,
      };
      const after = read();
      let areaGain = 0,
        lightGain = 0,
        count = 0;
      for (let y = 80; y < 400; y++)
        for (let x = 80; x < 400; x++) {
          const at = (y * 480 + x) * 4;
          areaGain += Number(after[at + 3] > 250) - Number(before[at + 3] > 250);
          if (x >= 190 && x <= 290 && y >= 190 && y <= 290) {
            lightGain +=
              (after[at] -
                before[at] +
                after[at + 1] -
                before[at + 1] +
                after[at + 2] -
                before[at + 2]) /
              3;
            count++;
          }
        }
      const error = gl.getError();
      backend.dispose();
      results.push({
        language,
        pulse: response.strongest,
        quieter: quieter.strongest,
        listening: listening.receptive,
        listeningOutput: listening.strongest,
        zero: zero.strongest,
        settled: response.settled,
        areaGain,
        lightGain: lightGain / count,
        error,
      });
    }
    return results;
  }, waveforms);
  console.info("Installed speech scalar replay:", results);
  for (const result of results) {
    expect(result.error).toBe(0);
    expect(result.pulse).toBeGreaterThan(0.1);
    expect(result.pulse).toBeLessThanOrEqual(1);
    expect(result.pulse).toBeGreaterThan(result.quieter);
    expect(result.listening).toBeGreaterThan(0.05);
    expect(result.listeningOutput).toBe(0);
    expect(result.zero).toBe(0);
    expect(result.settled).toBeLessThan(0.001);
    expect(result.areaGain).toBeGreaterThan(150);
    expect(result.lightGain).toBeGreaterThan(0.5);
  }
});
