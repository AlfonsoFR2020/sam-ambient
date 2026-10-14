import { expect, test } from "@playwright/test";

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
    return { shots, phase: [base.peelTravel, later.peelTravel], changedSilhouettePixels };
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
});
