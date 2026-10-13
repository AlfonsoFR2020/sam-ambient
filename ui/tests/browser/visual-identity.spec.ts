import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("fixed-camera material, membrane and synthetic speech evidence", async ({ page }, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const [
      { MotionEvaluator },
      { WebGLBackend },
      { RENDER_BUDGETS },
      { DEFAULT_VISUAL_ENGINE_SETTINGS },
    ] = await Promise.all([
      import("../../src/visual-engine/motion"),
      import("../../src/visual-engine/webgl"),
      import("../../src/visual-engine/quality"),
      import("../../src/visual-engine/types"),
    ]);
    type Frame = ReturnType<InstanceType<typeof MotionEvaluator>["evaluate"]>;
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" as const };
    const input = (time: number, mode = "idle", envelope = 0) => ({
      version: 1 as const,
      streamKey: "isolated",
      sequence: time + 1,
      receivedMs: time,
      audio:
        mode === "output"
          ? { output: { receivedMs: time, envelope } }
          : mode === "input"
            ? { input: { receivedMs: time, envelope, peak: envelope * 1.3 } }
            : {},
      interaction: {
        foreground:
          mode === "output"
            ? ("speaking" as const)
            : mode === "input"
              ? ("listening" as const)
              : ("idle" as const),
        listening: mode === "input",
        speaking: mode === "output",
        floor: "none" as const,
        acknowledgement: false,
        userPause: false,
        reasoning: false,
        delegatedWork: false,
        responseReady: false,
        interruptSerial: 0,
        availability: "ready" as const,
      },
    });
    const frameAt = (time: number, mode = "idle", envelope = 0, audioReactivity = 0.7) => {
      const evaluator = new MotionEvaluator(0x5a17);
      for (let t = 0; t <= time; t += 20)
        evaluator.evaluate(
          input(t, mode, envelope),
          t,
          { ...settings, audioReactivity },
          RENDER_BUDGETS.high,
        );
      return { ...evaluator.currentFrame };
    };
    const fixed = frameAt(0);
    const shots: { name: string; image: string }[] = [];
    const samples: { name: string; pixels: number[]; frame: Frame }[] = [];
    const costs = [];
    const draw = async (
      name: string,
      frame: Frame,
      quality: keyof typeof RENDER_BUDGETS = "high",
      peels = true,
      angle = 0,
    ) => {
      const budget = {
        ...RENDER_BUDGETS[quality],
        peels: peels ? RENDER_BUDGETS[quality].peels : 0,
      };
      const canvas = document.createElement("canvas");
      document.body.append(canvas);
      const gl = canvas.getContext("webgl2", {
        antialias: budget.antialias,
        preserveDrawingBuffer: true,
      });
      if (!gl) throw new Error("Offscreen WebGL2 unavailable");
      const evaluator = new MotionEvaluator(0x5a17);
      // Freeze camera and motion for comparisons, retaining the actual evaluated field/audio state.
      evaluator.evaluate = () => frame;
      const backend = new WebGLBackend(canvas, gl, budget, settings, 0x5a17, evaluator);
      backend.resize(720, 720, 1);
      backend.setObjectOrientation(
        new Float32Array([
          Math.cos(angle),
          0,
          -Math.sin(angle),
          0,
          1,
          0,
          Math.sin(angle),
          0,
          Math.cos(angle),
        ]),
      );
      backend.update(input(0));
      backend.render(0);
      const pixels = new Uint8Array(720 * 720 * 4);
      gl.readPixels(0, 0, 720, 720, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      shots.push({ name, image: canvas.toDataURL("image/png") });
      samples.push({ name, pixels: Array.from(pixels), frame });
      const error = gl.getError();
      if (error) throw new Error(`GL error ${error} for ${name}`);
      if (["low", "medium", "high"].includes(name)) {
        for (let i = 0; i < 12; i++) backend.render(i * 20);
        gl.finish();
        const submission = [],
          completion = [],
          queries: WebGLQuery[] = [];
        const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
        for (let i = 0; i < 12; i++) {
          const query = timer ? gl.createQuery() : null;
          if (query && timer) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          const start = performance.now();
          for (let j = 0; j < 8; j++) backend.render(i * 20 + j);
          submission.push((performance.now() - start) / 8);
          if (query) {
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            queries.push(query);
          }
          gl.finish();
          completion.push((performance.now() - start) / 8);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        const disjoint = timer ? Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT)) : false;
        const gpu = disjoint
          ? []
          : queries
              .filter((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
              .map((query) => gl.getQueryParameter(query, gl.QUERY_RESULT) / 8_000_000);
        for (const query of queries) gl.deleteQuery(query);
        const quantile = (v: number[], p: number) =>
          v.sort((a, b) => a - b)[Math.floor(v.length * p)];
        const debug = gl.getExtension("WEBGL_debug_renderer_info");
        costs.push({
          quality,
          submissionMedianMs: quantile(submission, 0.5),
          completionMedianMs: quantile(completion, 0.5),
          completionP95Ms: quantile(completion, 0.95),
          gpuMedianMs: gpu.length ? quantile(gpu, 0.5) : null,
          gpuP95Ms: gpu.length ? quantile(gpu, 0.95) : null,
          gpuSamples: gpu.length,
          disjoint,
          renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
        });
      }
      backend.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
    for (const quality of ["low", "medium", "high"] as const) await draw(quality, fixed, quality);
    await draw("body", fixed, "high", false);
    await draw("quarter", fixed, "high", true, 0.75);
    await draw("quarter-body", fixed, "high", false, 0.75);
    for (const time of [8_000, 24_000, 24_040, 60_000]) {
      const material = frameAt(time);
      await draw(`surface-${time}`, {
        ...fixed,
        fieldPhase1: material.fieldPhase1,
        fieldPhase2: material.fieldPhase2,
        fieldTwist1: material.fieldTwist1,
        fieldTwist2: material.fieldTwist2,
        paletteBalance: material.paletteBalance,
        paletteContrast: material.paletteContrast,
      });
    }
    for (const [mode, envelope] of [
      ["output", 0],
      ["output", 0.12],
      ["output", 0.45],
      ["input", 0.12],
    ] as const) {
      await draw(`${mode}-${envelope}`, frameAt(600, mode, envelope));
    }
    await draw("audio-zero", frameAt(600, "output", 0.45, 0));
    await draw("audio-zero-quiet", frameAt(600, "output", 0, 0));
    const diff = (a: string, b: string) => {
      const first = samples.find((s) => s.name === a)?.pixels ?? [];
      const second = samples.find((s) => s.name === b)?.pixels ?? [];
      let changed = 0,
        sum = 0,
        count = 0;
      for (let y = 180; y < 540; y++)
        for (let x = 180; x < 540; x++) {
          const at = (y * 720 + x) * 4;
          const d =
            (Math.abs(first[at] - second[at]) +
              Math.abs(first[at + 1] - second[at + 1]) +
              Math.abs(first[at + 2] - second[at + 2])) /
            3;
          sum += d;
          count++;
          if (d >= 3) changed++;
        }
      return { meanChannelDifference: sum / count, changedFraction: changed / count };
    };
    return {
      shots,
      costs,
      metrics: {
        membrane: diff("high", "body"),
        quarterMembrane: diff("quarter", "quarter-body"),
        eightSeconds: diff("high", "surface-8000"),
        sixtySeconds: diff("high", "surface-60000"),
        adjacent: diff("surface-24000", "surface-24040"),
        speech: diff("output-0", "output-0.12"),
        emphasis: diff("output-0.12", "output-0.45"),
        audioZero: diff("audio-zero", "audio-zero-quiet"),
        radius: Object.fromEntries(
          samples
            .filter((s) => s.name.startsWith("output-") || s.name.startsWith("input-"))
            .map((s) => [s.name, s.frame.radius]),
        ),
      },
    };
  });
  mkdirSync(info.outputDir, { recursive: true });
  for (const shot of result.shots)
    writeFileSync(
      info.outputPath(`${shot.name}.png`),
      Buffer.from(shot.image.split(",")[1], "base64"),
    );
  writeFileSync(
    info.outputPath("measurements.json"),
    JSON.stringify({ costs: result.costs, metrics: result.metrics }, null, 2),
  );
  console.info("VISUAL_IDENTITY", JSON.stringify({ costs: result.costs, metrics: result.metrics }));
  expect(result.metrics.membrane.changedFraction).toBeGreaterThan(0.02);
  expect(result.metrics.eightSeconds.meanChannelDifference).toBeGreaterThan(3);
  expect(result.metrics.adjacent.meanChannelDifference).toBeLessThan(2);
  expect(result.metrics.speech.meanChannelDifference).toBeGreaterThan(2);
  expect(result.metrics.radius["output-0.45"]).toBeGreaterThan(
    result.metrics.radius["output-0.12"],
  );
  // Independent contexts can differ by one quantisation unit at a rare pixel.
  expect(result.metrics.audioZero.meanChannelDifference).toBeLessThan(0.01);
});
