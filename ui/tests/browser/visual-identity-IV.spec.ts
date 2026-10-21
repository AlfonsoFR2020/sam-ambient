import { expect, test } from "@playwright/test";

async function save(info: { outputDir: string; outputPath(name: string): string },
  data: { shots: { name: string; image: string }[]; metadata: unknown }, name: string) {
  const modulePath = "node:fs";
  const fs = (await import(modulePath)) as { mkdirSync(path: string, options: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void };
  fs.mkdirSync(info.outputDir, { recursive: true });
  for (const shot of data.shots) fs.writeFileSync(info.outputPath(`${shot.name}.png`),
    Uint8Array.from(atob(shot.image.split(",")[1]), (c) => c.charCodeAt(0)));
  fs.writeFileSync(info.outputPath(`${name}.json`), JSON.stringify(data.metadata, null, 2));
}

for (const variant of ["released", "candidate"] as const) {
  test(`${variant}: matched connected-skin comparison inputs`, async ({ page }, info) => {
    await page.goto("/tests/fixtures/visual-identity.html");
    const baselineResponse = await page.request.get("/tests/fixtures/.baseline-0.2.5/baseline.json");
    expect(baselineResponse.ok(), "Prepare the pinned local baseline snapshot before comparing").toBe(true);
    const baseline = await baselineResponse.json();
    expect(baseline.sourceCommit).toBe("dc64c5d180fb44cf7a29bf4d0d1ae2f853347709");
    expect(baseline.preparing).not.toBe(true);
    const fsPath = "node:fs", cryptoPath = "node:crypto";
    const fs = (await import(fsPath)) as { readFileSync(path: URL, encoding: "utf8"): string };
    const crypto = (await import(cryptoPath)) as { createHash(name: string): {
      update(text: string): { digest(format: "hex"): string } } };
    for (const name of ["visual-identity-II.ts", "palette-before.ts"]) {
      const text = fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
      expect(crypto.createHash("sha256").update(text).digest("hex"), "Reprepare baseline when the shared harness changes")
        .toBe(baseline.currentHarnessSha256Lf[name]);
    }
    const result = await page.evaluate(async (variant) => {
      const path = "/tests/fixtures/visual-identity-IV.ts";
      const api = (await import(path)) as typeof import("../fixtures/visual-identity-IV");
      return api.captureIV(variant);
    }, variant);
    const modulePath = "node:child_process";
    const { execFileSync } = (await import(modulePath)) as {
      execFileSync(file: string, args: string[], options: { encoding: "utf8" }): string };
    const candidateHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    await save(info, { ...result, metadata: { ...result.metadata, candidateHead, baseline } }, `${variant}-comparison`);
    expect(result.shots.length).toBe(92);
    expect(result.metadata.curlPhases).toHaveLength(3);
  });
}

test("matched isolated GPU and CPU submission costs", async ({ page }, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const results = await page.evaluate(async () => {
    const path = "/tests/fixtures/visual-identity-IV.ts";
    const api = (await import(path)) as typeof import("../fixtures/visual-identity-IV");
    return [...await api.measureIV("released"), ...await api.measureIV("candidate")];
  });
  await save(info, { shots: [], metadata: results }, "performance");
  expect(results).toHaveLength(6);
  for (const row of results) expect(row.error).toBe(0);
});

test("production skin equations agree with CPU points and normals", async ({ page }, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const path = "/tests/fixtures/skin-gpu-proof.ts";
    const { proveSkinGPU } = (await import(path)) as typeof import("../fixtures/skin-gpu-proof");
    return proveSkinGPU();
  });
  await save(info, { shots: [], metadata: result }, "cpu-gpu-proof");
  expect(result.maxPositionError).toBeLessThan(0.0001);
  expect(result.maxNormalError).toBeLessThan(0.005);
  expect(result.samples).toBeGreaterThan(100);
  expect(result.error).toBe(0);
});
