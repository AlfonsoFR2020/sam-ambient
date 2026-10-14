import { expect, test } from "@playwright/test";

test("palette-only temporal compositions, transport separation and continuity", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const path = "/tests/fixtures/visual-identity-II.ts";
    const { fixture, frameAt } = (await import(
      path
    )) as typeof import("../fixtures/visual-identity-II");
    const base = frameAt(0),
      times = [0, 15, 45, 120, 300];
    const shots: { name: string; image: string }[] = [];
    const metrics: { name: string; mean: number }[] = [];
    const frames = times.map((t) => frameAt(t * 1000));
    for (const [name, options] of [
      ["before", { paletteBefore: true }],
      ["palette", {}],
      ["transport", {}],
      ["body", { bodyOnly: true }],
    ] as const) {
      const f = fixture("high", { size: 480, ...options });
      let first: Uint8Array | undefined;
      for (let i = 0; i < times.length; i++) {
        const later = frames[i];
        const frame =
          name === "transport"
            ? {
                ...base,
                fieldPhase1: later.fieldPhase1,
                fieldPhase2: later.fieldPhase2,
                fieldTwist1: later.fieldTwist1,
                fieldTwist2: later.fieldTwist2,
              }
            : {
                ...base,
                palettePhase: later.palettePhase,
                paletteContrastPhase: later.paletteContrastPhase,
                paletteBalance: later.paletteBalance,
                paletteContrast: later.paletteContrast,
              };
        shots.push({ name: `${name}-${times[i]}`, image: f.draw(frame, 0.75) });
        const pixels = new Uint8Array(480 * 480 * 4);
        f.gl.readPixels(0, 0, 480, 480, f.gl.RGBA, f.gl.UNSIGNED_BYTE, pixels);
        first ??= pixels;
        let difference = 0;
        for (let y = 120; y < 360; y++)
          for (let x = 120; x < 360; x++)
            for (let c = 0; c < 3; c++)
              difference += Math.abs(pixels[(y * 480 + x) * 4 + c] - first[(y * 480 + x) * 4 + c]);
        metrics.push({ name: `${name}-${times[i]}`, mean: difference / (240 * 240 * 3) });
      }
      f.close();
    }
    const f = fixture("high", { size: 480 }),
      a = frames[1],
      b = frameAt(15020);
    const pixels = new Uint8Array(480 * 480 * 4),
      later = new Uint8Array(pixels.length);
    f.draw({ ...base, palettePhase: a.palettePhase, paletteContrastPhase: a.paletteContrastPhase });
    f.gl.readPixels(0, 0, 480, 480, f.gl.RGBA, f.gl.UNSIGNED_BYTE, pixels);
    f.draw({ ...base, palettePhase: b.palettePhase, paletteContrastPhase: b.paletteContrastPhase });
    f.gl.readPixels(0, 0, 480, 480, f.gl.RGBA, f.gl.UNSIGNED_BYTE, later);
    let adjacent = 0;
    for (let i = 0; i < pixels.length; i += 4)
      for (let c = 0; c < 3; c++) adjacent += Math.abs(pixels[i + c] - later[i + c]);
    f.close();
    for (const quality of ["low", "medium", "high"] as const) {
      const q = fixture(quality, { size: 480 });
      shots.push({
        name: `tier-${quality}`,
        image: q.draw(
          {
            ...base,
            palettePhase: frames[3].palettePhase,
            paletteContrastPhase: frames[3].paletteContrastPhase,
          },
          0.75,
        ),
      });
      q.close();
    }
    return {
      shots,
      metrics,
      adjacent20ms: adjacent / (480 * 480 * 3),
      times,
      size: 480,
      seed: "0x5a17",
      fixed: "geometry, light, pose, curl; palette-only vs transport-only rows",
      gpuTiming: "not measured in this bounded desktop-safe check",
    };
  });
  const fsPath = "node:fs";
  const { mkdirSync, writeFileSync } = (await import(fsPath)) as {
    mkdirSync(path: string, options: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
  };
  mkdirSync(info.outputDir, { recursive: true });
  for (const { name, image } of result.shots)
    writeFileSync(
      info.outputPath(`${name}.png`),
      Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  const { shots, ...data } = result;
  expect(shots).toHaveLength(23);
  writeFileSync(info.outputPath("palette.json"), JSON.stringify(data, null, 2));
  expect(result.metrics.find((m) => m.name === "palette-120")?.mean).toBeGreaterThan(8);
  expect(result.adjacent20ms).toBeLessThan(0.4);
});

test("provider preparation uses real visual adapter without inference or speech", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const [fixtures, input, motion, types, protocol, quality] = await Promise.all(
      [
        "/tests/fixtures/visual-identity-II.ts",
        "/src/visual-engine/input.ts",
        "/src/visual-engine/motion.ts",
        "/src/visual-engine/types.ts",
        "/src/protocol/types.ts",
        "/src/visual-engine/quality.ts",
      ].map((path) => import(path)),
    );
    const shots: { name: string; image: string }[] = [],
      frames: Record<string, unknown>[] = [];
    const base = fixtures.frameAt(0);
    for (const phase of ["discovering", "loading", "unloading", "ready", "failed", "thinking"]) {
      const adapter = new input.VisualInputAdapter(),
        evaluator = new motion.MotionEvaluator(0x5a17);
      const state = {
        ...protocol.INITIAL_UI_STATE,
        connection: "connected",
        sessionId: "fixture",
        conversationalState: phase === "thinking" ? "THINKING" : "IDLE",
        provider: phase === "ready" || phase === "thinking" ? "lm-studio" : undefined,
        model: phase === "ready" || phase === "thinking" ? "gemma" : undefined,
        pendingProvider: "lm-studio",
        pendingModel: "gemma",
        providerDiscovery: {
          status:
            phase === "failed"
              ? "failed"
              : phase === "ready" || phase === "thinking"
                ? "available"
                : "scanning",
          requestId: "fixture",
        },
        startupLifecycle:
          phase === "loading"
            ? "loading_model"
            : phase === "unloading"
              ? "unloading_model"
              : phase === "ready" || phase === "thinking"
                ? "ready_transition"
                : "scanning",
      };
      let frame = { ...base };
      for (let time = 0; time <= 1600; time += 20)
        frame = {
          ...evaluator.evaluate(
            adapter.ingest(state, time),
            time,
            { ...types.DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" },
            quality.RENDER_BUDGETS.high,
          ),
        };
      frame = {
        ...frame,
        palettePhase: base.palettePhase,
        paletteContrastPhase: base.paletteContrastPhase,
        paletteBalance: base.paletteBalance,
        paletteContrast: base.paletteContrast,
        fieldPhase1: base.fieldPhase1,
        fieldPhase2: base.fieldPhase2,
        fieldTwist1: base.fieldTwist1,
        fieldTwist2: base.fieldTwist2,
      };
      const f = fixtures.fixture("high", { size: 480 });
      shots.push({ name: phase, image: f.draw(frame, 0.75) });
      if (phase === "loading") {
        let nextTime = 1620;
        for (const seconds of [2, 4, 8]) {
          let moving = { ...frame };
          for (; nextTime <= seconds * 1000; nextTime += 20)
            moving = {
              ...evaluator.evaluate(
                adapter.ingest(state, nextTime),
                nextTime,
                { ...types.DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" },
                quality.RENDER_BUDGETS.high,
              ),
            };
          shots.push({
            name: `loading-${seconds}s`,
            image: f.draw({ ...frame, ripplePhase: moving.ripplePhase }, 0.75),
          });
        }
      }
      f.close();
      frames.push({
        phase,
        radius: frame.radius,
        loading: frame.providerLoading,
        explore: frame.providerExplore,
        settling: frame.providerSettling,
        reasoning: frame.reasoningCue,
      });
    }
    return { shots, frames };
  });
  const fsPath = "node:fs";
  const fs = (await import(fsPath)) as {
    mkdirSync(path: string, options: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
  };
  fs.mkdirSync(info.outputDir, { recursive: true });
  for (const { name, image } of result.shots)
    fs.writeFileSync(
      info.outputPath(`${name}.png`),
      Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  fs.writeFileSync(info.outputPath("lifecycle.json"), JSON.stringify(result.frames, null, 2));
  expect(result.frames.find((f) => f.phase === "loading")?.loading).toBeGreaterThan(0.98);
  expect(result.frames.filter((f) => f.phase !== "thinking").every((f) => f.reasoning === 0)).toBe(
    true,
  );
  expect(result.frames.find((f) => f.phase === "thinking")?.reasoning).toBeGreaterThan(0.9);
});

test("persistent provider status stays truthful through slow loading and narrow Controls", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.goto("/?transport=browser");
  const emit = async (type: string, ms: number, payload: Record<string, unknown>) =>
    page.evaluate(
      ({ type, ms, payload }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: { protocol: 1, type, monotonic_ms: ms, session_id: "presentation", payload },
          }),
        ),
      { type, ms, payload },
    );
  await emit("system.ready", 1, {
    state: "IDLE",
    provider_scan_active: true,
    provider_discovery_state: "loading_model",
    pending_provider_request_id: "A",
    pending_provider: "lm-studio",
    pending_model: "google/gemma-4-e2b",
  });
  const panel = page.locator(".provider-status");
  await expect(panel).toHaveAttribute("data-provider-phase", "loading");
  await expect(panel).toContainText("google/gemma-4-e2b");
  await expect(panel).toContainText("minute or more");
  await page.getByRole("button", { name: "Dismiss startup information" }).click();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quit Sam", exact: true })).toBeVisible();
  await expect(panel.locator(".provider-status__elapsed")).toContainText("Waiting", {
    timeout: 5000,
  });
  await page.setViewportSize({ width: 640, height: 720 });
  const box = await panel.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(640);
  await page.screenshot({ path: info.outputPath("loading-controls.png") });
  await emit("provider.discovery", 2, {
    state: "ready",
    request_id: "old",
    provider: "lm-studio",
    model: "wrong",
  });
  await expect(panel).toHaveAttribute("data-provider-phase", "loading");
  await emit("provider.discovery", 3, {
    state: "ready",
    request_id: "A",
    provider: "lm-studio",
    model: "google/gemma-4-e2b",
  });
  await expect(panel).toHaveAttribute("data-provider-phase", "ready");
  await expect(panel.locator(".provider-status__elapsed")).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("sam-protocol-disconnect")));
  await expect(panel).toHaveAttribute("data-provider-phase", "connecting");
  await expect(panel).toContainText("not live");
});
