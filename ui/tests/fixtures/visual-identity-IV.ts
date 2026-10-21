import { MotionEvaluator } from "../../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../../src/visual-engine/types";
import { behaviorFrameAt, type fixture, frameAt, visualInput } from "./visual-identity-II";

export const IV_PLAN = {
  seed: "0x5a17",
  releasedCommit: "dc64c5d180fb44cf7a29bf4d0d1ae2f853347709",
  yaw: [0, 0.75, 1.6],
  curlSeconds: [0, 6, 12],
  paletteSeconds: [0, 15, 45, 120, 300],
  curlRate: 0.3,
  size: 720,
  dpr: 1,
  attachmentCrop: [210, 110, 300, 300],
  held: "camera, exposure, pose, body/light/transport/palette clocks; vary only membrane phase",
} as const;
export type IVVariant = "released" | "candidate";

export async function loadIVFixture(
  variant: IVVariant,
): Promise<typeof import("./visual-identity-II")> {
  if (variant === "candidate") return import("./visual-identity-II");
  const response = await fetch("/tests/fixtures/.baseline-0.2.5/baseline.json");
  if (!response.ok) throw new Error("Prepare the pinned baseline before graphical verification");
  const baseline = await response.json();
  if (baseline.sourceCommit !== IV_PLAN.releasedCommit || baseline.preparing)
    throw new Error("Baseline is incomplete or does not match published v0.2.5");
  const path = "/tests/fixtures/.baseline-0.2.5/tests/fixtures/visual-identity-II.ts";
  try {
    return await import(/* @vite-ignore */ path);
  } catch (error) {
    throw new Error(
      `Prepare the local v0.2.5 fixture snapshot before this authorized comparison: ${String(error)}`,
    );
  }
}

export async function captureIV(variant: IVVariant) {
  const api = await loadIVFixture(variant),
    base = frameAt(0);
  const shots: { name: string; image: string }[] = [];
  const modes: readonly [string, Parameters<typeof fixture>[1]][] = [
    ["full", {}],
    ["body", { bodyOnly: true }],
    ["skin", { membraneOnly: true }],
    ["neutral", { neutralMaterial: true }],
    ["normals", { diagnostic: "normals" }],
    ["depth", { diagnostic: "depth" }],
    ["attachment", { diagnostic: "attachment" }],
  ];
  for (const [mode, options] of modes) {
    const f = api.fixture("high", options);
    try {
      for (const yaw of IV_PLAN.yaw)
        for (const seconds of IV_PLAN.curlSeconds)
          shots.push({
            name: `${variant}-${mode}-yaw${yaw}-curl${seconds}`,
            image: f.draw(
              { ...base, peelTravel: base.peelTravel + seconds * IV_PLAN.curlRate },
              yaw,
            ),
          });
    } finally {
      f.close();
    }
  }
  const attachment = api.fixture("high");
  try {
    attachment.render(base, 0.75);
    const crop = document.createElement("canvas");
    crop.width = 300;
    crop.height = 300;
    const context = crop.getContext("2d");
    if (!context) throw new Error("Attachment crop context unavailable");
    context.drawImage(attachment.canvas, ...IV_PLAN.attachmentCrop, 0, 0, 300, 300);
    shots.push({ name: `${variant}-attachment-crop`, image: crop.toDataURL("image/png") });
  } finally {
    attachment.close();
  }
  const f = api.fixture("high");
  try {
    for (const seconds of IV_PLAN.paletteSeconds) {
      const later = frameAt(seconds * 1000);
      for (const row of ["palette", "transport"] as const) {
        const frame =
          row === "palette"
            ? {
                ...base,
                palettePhase: later.palettePhase,
                paletteContrastPhase: later.paletteContrastPhase,
                paletteBalance: later.paletteBalance,
                paletteContrast: later.paletteContrast,
              }
            : {
                ...base,
                fieldPhase1: later.fieldPhase1,
                fieldPhase2: later.fieldPhase2,
                fieldTwist1: later.fieldTwist1,
                fieldTwist2: later.fieldTwist2,
              };
        shots.push({ name: `${variant}-${row}-${seconds}`, image: f.draw(frame, 0.75) });
      }
    }
    for (const state of [
      "idle",
      "listening",
      "thinking",
      "speaking",
      "interrupted",
      "resuming",
    ] as const)
      shots.push({
        name: `${variant}-state-${state}`,
        image: f.draw(behaviorFrameAt(760, state), 0.75),
      });
    for (const [name, rms, strength] of [
      ["ordinary", 0.05, 0.7],
      ["emphasis", 0.5, 0.7],
      ["zero", 0.5, 0],
    ] as const)
      shots.push({
        name: `${variant}-speech-${name}`,
        image: f.draw(frameAt(800, "speaking", rms, strength), 0.75),
      });
    for (const seconds of [0, 0.02, 6, 6.02])
      shots.push({
        name: `${variant}-adjacent-${seconds}`,
        image: f.draw({ ...base, peelTravel: base.peelTravel + seconds * IV_PLAN.curlRate }, 0.75),
      });
    // Both renderers receive candidate-owned, identical frames. Never let a
    // historical evaluator silently change comparison clocks or speech gains.
    const motion = new MotionEvaluator(0x5a17);
    for (let t = 0; t <= 800; t += 20)
      motion.evaluate(
        visualInput(t, "speaking", 0.3),
        t,
        { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" },
        RENDER_BUDGETS.high,
      );
    shots.push({
      name: `${variant}-reduced-motion`,
      image: f.draw({ ...motion.currentFrame }, 0.75),
    });
    motion.pauseClock();
    const resumed = motion.evaluate(
      visualInput(60_000, "idle"),
      60_000,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.high,
    );
    shots.push({ name: `${variant}-hidden-resume`, image: f.draw({ ...resumed }, 0.75) });
  } finally {
    f.close();
  }
  for (const quality of ["low", "medium", "high"] as const) {
    const tier = api.fixture(quality);
    try {
      shots.push({ name: `${variant}-tier-${quality}`, image: tier.draw(base, 0.75) });
    } finally {
      tier.close();
    }
  }
  return {
    shots,
    metadata: {
      ...IV_PLAN,
      variant,
      curlPhases: IV_PLAN.curlSeconds.map((s) => base.peelTravel + s * IV_PLAN.curlRate),
      diagnosticNote:
        "Normals/depth encode actual transformed geometry; attachment colors are diagnostic only. No artistic acceptance from metrics.",
    },
  };
}

/** Matching isolated submissions; GPU timing is never equated with presented FPS. */
export async function measureIV(variant: IVVariant) {
  const api = await loadIVFixture(variant),
    measurements = [];
  const frames = [frameAt(0), behaviorFrameAt(760, "speaking"), behaviorFrameAt(760, "thinking")];
  for (const [size, dpr] of [
    [720, 1],
    [720, 2],
    [960, 1],
  ]) {
    const f = api.fixture("high", { size, dpr }),
      gl = f.gl;
    const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    const queries: WebGLQuery[] = [],
      cpu: number[] = [];
    try {
      for (let i = 0; i < 18; i++) f.render(frames[i % 3], IV_PLAN.yaw[i % 3]);
      gl.finish();
      for (let i = 0; i < 24; i++) {
        const query = ext ? gl.createQuery() : null;
        if (query && ext) gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        const start = performance.now();
        f.render(frames[i % 3], IV_PLAN.yaw[Math.floor(i / 3) % 3]);
        cpu.push(performance.now() - start);
        if (query && ext) {
          gl.endQuery(ext.TIME_ELAPSED_EXT);
          queries.push(query);
        }
      }
      gl.finish();
      const deadline = performance.now() + 2000;
      while (
        queries.some((q) => !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) &&
        performance.now() < deadline
      )
        await new Promise((resolve) => setTimeout(resolve, 20));
      const disjoint = ext ? Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT)) : false;
      const gpu = !disjoint
        ? queries
            .filter((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))
            .map((q) => Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6)
        : [];
      const stats = (xs: number[]) => {
        const sorted = [...xs].sort((a, b) => a - b);
        return {
          median: sorted[Math.floor(sorted.length / 2)] ?? null,
          p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
        };
      };
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      measurements.push({
        variant,
        size,
        requestedDpr: dpr,
        backing: [f.canvas.width, f.canvas.height],
        effectiveDpr: f.canvas.width / size,
        warmupSubmissions: 18,
        samples: 24,
        disjoint,
        gpuTimerAvailable: Boolean(ext),
        gpuSamples: gpu.length,
        gpuMs: stats(gpu),
        cpuSubmissionMs: stats(cpu),
        renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "unavailable",
        error: gl.getError(),
        limitation:
          "Isolated GPU/CPU submissions only; no presentation, thermal, audio or inference coexistence evidence",
      });
    } finally {
      for (const q of queries) gl.deleteQuery(q);
      f.close();
    }
  }
  return measurements;
}

// Referenced by the standalone module so its type-only links remain inspectable.
export type IVFrame = ReturnType<typeof frameAt>;
