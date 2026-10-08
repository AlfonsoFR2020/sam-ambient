import { expect, test } from "@playwright/test";
import speech from "../fixtures/installed-speech-levels.json" with { type: "json" };

test("mounted everyday UI reports bounded scheduling samples without an FPS gate", async ({
  page,
}) => {
  await page.goto("/?transport=browser");
  const samples = await page.evaluate(async (speech) => {
    let sequence = 1;
    const emit = (type: string, payload: Record<string, unknown>) => {
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type,
            monotonic_ms: sequence++,
            session_id: "timing",
            generation_id: "timing-generation",
            payload,
          },
        }),
      );
    };
    emit("system.ready", {
      state: "SPEAKING",
      provider: "fixture",
      model: "fixture",
      generation_id: "timing-generation",
      microphone_enabled: true,
      tts_output_enabled: true,
    });
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const quantile = (values: number[], fraction: number) => {
      const ordered = [...values].sort((a, b) => a - b);
      return ordered[Math.floor((ordered.length - 1) * fraction)] ?? null;
    };
    const results = [];
    for (const mode of ["low", "medium", "high", "en", "es", "zero", "reduced"]) {
      emit("system.ready", {
        state: "SPEAKING",
        provider: "fixture",
        model: "fixture",
        generation_id: "timing-generation",
        visual_settings: {
          quality: ["low", "medium", "high"].includes(mode) ? mode : "high",
          device_profile: "desktop",
          intensity: 0.82,
          motion_intensity: 0.6,
          surface_flow: 0.6,
          audio_reactivity: mode === "zero" ? 0 : 0.7,
          particle_density: 0.6,
          reduced_motion: mode === "reduced" ? "on" : "off",
        },
      });
      await pause(600);
      const frames: { at: number; calls: number; drawCallCpu: number }[] = [];
      const sent: number[] = [];
      const proto = WebGL2RenderingContext.prototype;
      const original = proto.drawElements;
      proto.drawElements = function (...args) {
        const at = performance.now();
        original.apply(this, args);
        let frame = frames.at(-1);
        if (!frame || at - frame.at > 5) {
          frame = { at, calls: 0, drawCallCpu: 0 };
          frames.push(frame);
        }
        frame.calls++;
        frame.drawCallCpu += performance.now() - at;
      };
      try {
        if (["en", "es", "zero", "reduced"].includes(mode)) {
          const rows = speech.output[mode === "es" ? "es" : "en"];
          for (const [, rms, peak] of rows.slice(0, 30)) {
            sent.push(performance.now());
            emit("tts.level", { envelope: rms, peak });
            await pause(20);
          }
        } else {
          await pause(1200);
        }
        await pause(150);
      } finally {
        proto.drawElements = original;
      }
      const intervals = frames.slice(1).map((frame, i) => frame.at - frames[i].at);
      const nextDraw = sent.flatMap((at) => {
        const frame = frames.find((candidate) => candidate.at >= at);
        return frame ? [frame.at - at] : [];
      });
      results.push({
        mode,
        frames: frames.length,
        intervalMedianMs: quantile(intervals, 0.5),
        intervalP95Ms: quantile(intervals, 0.95),
        drawCallCpuMedianMs: quantile(
          frames.map((frame) => frame.drawCallCpu),
          0.5,
        ),
        eventToNextDrawMedianMs: quantile(nextDraw, 0.5),
        eventToNextDrawP95Ms: quantile(nextDraw, 0.95),
        longGaps: intervals.filter((ms) => ms > 100).length,
        renderer: document.querySelector("[data-sam-renderer]")?.getAttribute("data-sam-renderer"),
        canvas: [...document.querySelectorAll<HTMLCanvasElement>(".ambient-scene canvas")].map(
          (canvas) => [canvas.width, canvas.height],
        ),
      });
    }
    return results;
  }, speech);
  console.info("MOUNTED_EVERYDAY_TIMING", JSON.stringify(samples));
  for (const sample of samples) {
    expect(sample.renderer).toBe("webgl2");
    expect(sample.frames).toBeGreaterThan(0);
    expect(sample.drawCallCpuMedianMs).not.toBeNull();
  }
});
