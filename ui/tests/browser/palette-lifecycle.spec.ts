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
