import { expect, test } from "@playwright/test";

const writeEvidence = async (
  info: { outputDir: string; outputPath(name: string): string },
  shots: { name: string; image: string }[],
  metadata: unknown,
  name: string,
) => {
  const modulePath = "node:fs";
  const fs = (await import(modulePath)) as {
    mkdirSync(path: string, opts: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
  };
  fs.mkdirSync(info.outputDir, { recursive: true });
  for (const shot of shots)
    fs.writeFileSync(
      info.outputPath(`${shot.name}.png`),
      Uint8Array.from(atob(shot.image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  fs.writeFileSync(info.outputPath(`${name}.json`), JSON.stringify(metadata, null, 2));
};

test("same-identity fidelity comparisons and bounded multi-resolution GPU cost", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const fixturePath = "/tests/fixtures/visual-identity-II.ts";
    const { fixture, frameAt, behaviorFrameAt } = (await import(
      fixturePath
    )) as typeof import("../fixtures/visual-identity-II");
    const qualityPath = "/src/visual-engine/quality.ts";
    const { effectivePixelRatio, RENDER_BUDGETS } = (await import(
      qualityPath
    )) as typeof import("../../src/visual-engine/quality");
    const geometryPath = "/src/visual-engine/geometry.ts";
    const { createSphereGeometry, createParticleGeometry } =
      (await import(geometryPath)) as typeof import("../../src/visual-engine/geometry");
    const skinPath = "/src/visual-engine/skin-geometry.ts", domainPath = "/src/visual-engine/skin-domain.ts";
    const { createSkinGeometry } = (await import(skinPath)) as typeof import("../../src/visual-engine/skin-geometry");
    const { SKIN_VERTEX_STRIDE } = (await import(domainPath)) as typeof import("../../src/visual-engine/skin-domain");
    const shots: { name: string; image: string }[] = [],
      resources = [],
      measurements = [];
    const samples = [
      frameAt(0),
      behaviorFrameAt(760, "speaking"),
      behaviorFrameAt(760, "thinking"),
    ];
    for (const quality of ["low", "medium", "high"] as const) {
      const f = fixture(quality);
      for (const [index, yaw] of [0, 0.75, 1.6].entries()) {
        shots.push({ name: `tier-${quality}-${index}`, image: f.draw(samples[0], yaw) });
        shots.push({ name: `tier-${quality}-speaking-${index}`, image: f.draw(samples[1], yaw) });
      }
      f.close();
      const b = RENDER_BUDGETS[quality],
        body = createSphereGeometry(b.sphereLongitude, b.sphereLatitude),
        skin = createSkinGeometry(b),
        particles = createParticleGeometry(b.particles);
      resources.push({
        quality,
        vertices: body.vertices.length / 6 + skin.vertices.length / SKIN_VERTEX_STRIDE,
        triangles: (body.indices.length + skin.indices.length) / 3,
        particles: particles.count,
        geometryBytes:
          body.vertices.byteLength +
          body.indices.byteLength +
          skin.vertices.byteLength +
          skin.indices.byteLength +
          particles.vertices.byteLength,
        draws: 3 + b.peels + Number(b.membraneDepthPass),
      });
      for (const [size, requestedDpr] of [
        [480, 1],
        [720, 1],
        [720, 2],
        [960, 1],
      ]) {
        const dpr = effectivePixelRatio(size, size, requestedDpr, b);
        const f = fixture(quality, { size, dpr });
        const ext = f.gl.getExtension("EXT_disjoint_timer_query_webgl2"),
          queries: WebGLQuery[] = [],
          cpu: number[] = [];
        for (let i = 0; i < 18; i++) f.render(samples[i % 3], [0, 0.75, 1.6][i % 3]);
        f.gl.finish();
        for (let i = 0; i < 12; i++) {
          const q = ext ? f.gl.createQuery() : null;
          if (q && ext) f.gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
          const start = performance.now();
          f.render(samples[i % 3], [0, 0.75, 1.6][Math.floor(i / 3) % 3]);
          cpu.push(performance.now() - start);
          if (q && ext) {
            f.gl.endQuery(ext.TIME_ELAPSED_EXT);
            queries.push(q);
          }
        }
        f.gl.finish();
        const deadline = performance.now() + 2000;
        while (
          queries.some((q) => !f.gl.getQueryParameter(q, f.gl.QUERY_RESULT_AVAILABLE)) &&
          performance.now() < deadline
        )
          await new Promise((resolve) => setTimeout(resolve, 20));
        const disjoint = ext ? Boolean(f.gl.getParameter(ext.GPU_DISJOINT_EXT)) : false;
        const gpu =
          ext && !disjoint
            ? queries
                .filter((q) => f.gl.getQueryParameter(q, f.gl.QUERY_RESULT_AVAILABLE))
                .map((q) => Number(f.gl.getQueryParameter(q, f.gl.QUERY_RESULT)) / 1e6)
            : [];
        for (const q of queries) f.gl.deleteQuery(q);
        const stats = (xs: number[]) => {
          const s = [...xs].sort((a, b) => a - b);
          return {
            median: s[Math.floor(s.length / 2)] ?? null,
            p95: s[Math.ceil(s.length * 0.95) - 1] ?? null,
          };
        };
        const renderer = f.gl.getExtension("WEBGL_debug_renderer_info");
        measurements.push({
          quality,
          size,
          requestedDpr,
          effectiveDpr: dpr,
          backing: [f.canvas.width, f.canvas.height],
          states: ["idle", "speaking", "thinking"],
          orientations: [0, 0.75, 1.6],
          gpuTimerAvailable: Boolean(ext),
          disjoint,
          gpuSamples: gpu.length,
          gpuMs: stats(gpu),
          cpuSubmissionMs: stats(cpu),
          renderer: renderer ? f.gl.getParameter(renderer.UNMASKED_RENDERER_WEBGL) : "unavailable",
          error: f.gl.getError(),
        });
        f.close();
      }
    }
    const depthComparison = [];
    for (const depthPass of [false, true]) {
      const f = fixture("high", { gray: true, depthPass });
      shots.push({ name: `depth-${depthPass}`, image: f.draw(samples[1], 0.75) });
      depthComparison.push(depthPass);
      f.close();
    }
    let depthHoles = 0;
    const masks: Uint8Array[] = [];
    for (const depthPass of [false, true]) {
      const f = fixture("high", { membraneOnly: true, gray: true, depthPass });
      const pixels = new Uint8Array(720 * 720 * 4);
      f.draw(samples[0], 0.75);
      f.gl.readPixels(0, 0, 720, 720, f.gl.RGBA, f.gl.UNSIGNED_BYTE, pixels);
      masks.push(pixels);
      f.close();
    }
    for (let i = 3; i < masks[0].length; i += 4)
      if (masks[0][i] >= 220 && masks[1][i] < 128) depthHoles++;
    return { shots, resources, measurements, depthComparison, depthHoles };
  });
  await writeEvidence(
    info,
    result.shots,
    {
      resources: result.resources,
      measurements: result.measurements,
      depthComparison: result.depthComparison,
      depthHoles: result.depthHoles,
    },
    "fidelity",
  );
  expect(result.shots).toHaveLength(20);
  expect(result.measurements).toHaveLength(12);
  expect(result.depthHoles).toBe(0);
  for (const sample of result.measurements) {
    expect(sample.error).toBe(0);
    expect(sample.cpuSubmissionMs.median).not.toBeNull();
  }
});

test("coordinated lifecycle and speech changes reach body, skin and particles", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const modulePath = "/tests/fixtures/visual-identity-II.ts";
    const { fixture, behaviorFrameAt } = (await import(
      modulePath
    )) as typeof import("../fixtures/visual-identity-II");
    const shots: { name: string; image: string }[] = [],
      frames = [];
    const f = fixture();
    for (const state of ["idle", "listening", "thinking", "speaking"] as const)
      for (const t of [160, 420, 760, 1200]) {
        const frame = behaviorFrameAt(t, state);
        shots.push({ name: `${state}-${t}`, image: f.draw(frame) });
        frames.push({
          state,
          time: t,
          radius: frame.radius,
          pulse: frame.reactivity.outputPulse,
          input: frame.reactivity.inputPresence,
          work: frame.reasoningCue,
          curlLift: frame.peelLift,
        });
      }
    f.close();
    const parts = [];
    for (const [name, options] of [
      ["body", { bodyOnly: true }],
      ["skin", { membraneOnly: true }],
      ["particles", { particlesOnly: true }],
    ] as const) {
      const f = fixture("high", options),
        before = new Uint8Array(720 * 720 * 4),
        after = new Uint8Array(before.length);
      f.draw(behaviorFrameAt(760, "speaking", 0));
      f.gl.readPixels(0, 0, 720, 720, f.gl.RGBA, f.gl.UNSIGNED_BYTE, before);
      f.draw(behaviorFrameAt(760, "speaking"));
      f.gl.readPixels(0, 0, 720, 720, f.gl.RGBA, f.gl.UNSIGNED_BYTE, after);
      let changed = 0;
      for (let i = 0; i < before.length; i += 4)
        if (
          Math.abs(before[i] - after[i]) +
            Math.abs(before[i + 1] - after[i + 1]) +
            Math.abs(before[i + 2] - after[i + 2]) >
          6
        )
          changed++;
      parts.push({ name, changedPixels: changed });
      f.close();
    }
    return { shots, frames, parts };
  });
  await writeEvidence(
    info,
    result.shots,
    { frames: result.frames, parts: result.parts },
    "behavior",
  );
  for (const part of result.parts)
    expect(part.changedPixels).toBeGreaterThan(part.name === "particles" ? 20 : 500);
  const speaking = result.frames.filter((frame) => frame.state === "speaking");
  expect(speaking[2].radius).toBeGreaterThan(speaking[0].radius + 0.07);
  expect(speaking[3].pulse).toBeLessThan(speaking[2].pulse * 0.25);
});

test("raised membrane and independent geometric motion in fixed color and structure views", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const modulePath = "/tests/fixtures/visual-identity-II.ts";
    const { fixture, frameAt } = (await import(
      modulePath
    )) as typeof import("../fixtures/visual-identity-II");
    const base = frameAt(0),
      later = frameAt(12_000);
    const shots: { name: string; image: string }[] = [];
    const animation: { name: string; image: string }[] = [];
    let changedSilhouettePixels = 0;
    for (const [name, options] of [
      ["body", { bodyOnly: true }],
      ["full", {}],
      ["structure", { gray: true }],
      ["membrane", { membraneOnly: true, gray: true }],
    ] as const) {
      const f = fixture("high", options);
      for (const [index, yaw] of [0, 0.75, 1.6].entries()) {
        shots.push({ name: `${name}-${index}-0`, image: f.draw(base, yaw) });
        const before = new Uint8Array(720 * 720 * 4);
        if (name === "membrane" && index === 0)
          f.gl.readPixels(0, 0, 720, 720, f.gl.RGBA, f.gl.UNSIGNED_BYTE, before);
        if (name !== "body")
          shots.push({
            name: `${name}-${index}-12`,
            image: f.draw({ ...base, peelTravel: later.peelTravel }, yaw),
          });
        if (name === "membrane" && index === 0) {
          const after = new Uint8Array(before.length);
          f.gl.readPixels(0, 0, 720, 720, f.gl.RGBA, f.gl.UNSIGNED_BYTE, after);
          for (let i = 3; i < before.length; i += 4)
            if (before[i] >= 64 !== after[i] >= 64) changedSilhouettePixels++;
        }
      }
      f.close();
    }
    const f = fixture("high", { gray: true });
    for (let index = 0; index < 24; index++)
      animation.push({
        name: `flex-${index.toString().padStart(2, "0")}`,
        image: f.draw({ ...base, peelTravel: base.peelTravel + index * 0.15 }, 0.75),
      });
    f.close();
    return {
      shots,
      animation,
      phase: [base.peelTravel, later.peelTravel],
      changedSilhouettePixels,
    };
  });
  const modulePath = "node:fs";
  const fs = (await import(modulePath)) as {
    mkdirSync(path: string, opts: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
  };
  fs.mkdirSync(info.outputDir, { recursive: true });
  for (const shot of result.shots)
    fs.writeFileSync(
      info.outputPath(`${shot.name}.png`),
      Uint8Array.from(atob(shot.image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  fs.writeFileSync(
    info.outputPath("structure.json"),
    JSON.stringify(
      { phase: result.phase, changedSilhouettePixels: result.changedSilhouettePixels },
      null,
      2,
    ),
  );
  expect(result.shots).toHaveLength(21);
  expect(result.phase[1]).not.toBe(result.phase[0]);
  expect(result.changedSilhouettePixels).toBeGreaterThan(100);
  await writeEvidence(
    info,
    result.animation,
    { frameDurationMs: 500, bodyLightColorHeld: true },
    "flex",
  );
});
