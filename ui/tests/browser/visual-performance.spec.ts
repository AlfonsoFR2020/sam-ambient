import { expect, test } from "@playwright/test";

const performanceRun =
  (globalThis as { process?: { env?: { SAM_VISUAL_PERF?: string } } }).process?.env
    ?.SAM_VISUAL_PERF === "1";
test.skip(!performanceRun, "Manual cost sample; not a portable CI FPS gate");

test("isolated visual tier and synthetic audio cost sample", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/?transport=demo");
  const results = await page.evaluate(async () => {
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
    const root = document.getElementById("root");
    if (root) root.style.display = "none";
    type Budget = typeof RENDER_BUDGETS.high;
    type Mode = { name: string; budget: Budget; audio?: "input" | "output" };
    const modes: Mode[] = [
      { name: "low", budget: RENDER_BUDGETS.low },
      { name: "medium", budget: RENDER_BUDGETS.medium },
      { name: "high", budget: RENDER_BUDGETS.high },
      { name: "high-old-edge-count", budget: { ...RENDER_BUDGETS.high, peelSamples: 24 } },
      { name: "high-no-membrane", budget: { ...RENDER_BUDGETS.high, peels: 0 } },
      { name: "high-output", budget: RENDER_BUDGETS.high, audio: "output" },
      { name: "high-input", budget: RENDER_BUDGETS.high, audio: "input" },
    ];
    const median = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    };
    const results = [];
    for (const mode of modes) {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2", { antialias: mode.budget.antialias });
      if (!gl) throw new Error("WebGL2 unavailable");
      const motion = new MotionEvaluator(0x5a17);
      const backend = new WebGLBackend(
        canvas,
        gl,
        mode.budget,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        0x5a17,
        motion,
      );
      backend.resize(720, 720, mode.budget.dpr);
      const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      const gpuQueries: WebGLQuery[] = [];
      const submissions: number[] = [];
      const intervals: number[] = [];
      let prior = 0;
      for (let index = 0; index < 90; index++) {
        const now = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
        if (prior && index >= 20) intervals.push(now - prior);
        prior = now;
        const envelope = 0.12 + 0.35 * Math.max(0, Math.sin(index * 0.47));
        const audio =
          mode.audio === "output"
            ? { output: { receivedMs: now, envelope } }
            : mode.audio === "input"
              ? { input: { receivedMs: now, envelope, peak: envelope * 1.4 } }
              : {};
        backend.update({
          version: 1,
          streamKey: "performance",
          sequence: index + 1,
          receivedMs: now,
          audio,
          interaction: {
            foreground: mode.audio === "input" ? "listening" : "speaking",
            listening: mode.audio === "input",
            speaking: mode.audio !== "input",
            floor: mode.audio === "input" ? "user" : "sam",
            acknowledgement: false,
            userPause: false,
            reasoning: false,
            delegatedWork: false,
            responseReady: false,
            interruptSerial: 0,
            availability: "ready",
          },
        });
        let query: WebGLQuery | null = null;
        if (ext && index >= 20 && index % 6 === 0) {
          query = gl.createQuery();
          if (query) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
        const started = performance.now();
        backend.render(now);
        if (index >= 20) submissions.push(performance.now() - started);
        if (query) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          gpuQueries.push(query);
        }
      }
      gl.finish();
      const disjoint = ext ? Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT)) : false;
      const gpuMs =
        ext && !disjoint
          ? gpuQueries
              .filter((query) => gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE))
              .map((query) => gl.getQueryParameter(query, gl.QUERY_RESULT) / 1_000_000)
          : [];
      for (const query of gpuQueries) gl.deleteQuery(query);
      results.push({
        name: mode.name,
        submissionMedianMs: median(submissions),
        submissionP90Ms: [...submissions].sort((a, b) => a - b)[
          Math.floor(submissions.length * 0.9)
        ],
        frameIntervalMedianMs: median(intervals),
        gpuMedianMs: gpuMs.length ? median(gpuMs) : null,
        gpuTimerAvailable: Boolean(ext),
        disjoint,
        error: gl.getError(),
      });
      backend.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    return results;
  });
  console.info("VISUAL_PERFORMANCE_SAMPLE", JSON.stringify(results));
  for (const result of results) {
    expect(result.error).toBe(0);
    expect(Number.isFinite(result.submissionMedianMs)).toBe(true);
    expect(Number.isFinite(result.frameIntervalMedianMs)).toBe(true);
  }
});
