import { expect, test } from "@playwright/test";
import {
  VF3_APPEARANCES,
  VF3_CASES,
  VF3_PARTICLES,
  VF3_PLAN,
  VF3_SMOKE,
} from "../fixtures/orb-vf3";

test("hosted matched skin smoke, equations and representative views", async ({
  page,
  browser,
}, info) => {
  const fsPath = "node:fs",
    cpPath = "node:child_process";
  const fs = (await import(fsPath)) as {
    mkdirSync(path: string, options: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
    readFileSync(path: URL, encoding: "utf8"): string;
  };
  const cp = (await import(cpPath)) as {
    execFileSync(file: string, args: string[], options: { encoding: "utf8" }): string;
  };
  const environment = (globalThis as unknown as { process: { env: Record<string, string> } })
    .process.env;
  const failures: string[] = [],
    consoleErrors: string[] = [];
  const shots: { name: string; image: string }[] = [];
  fs.mkdirSync(info.outputDir, { recursive: true });
  const source = JSON.parse(
    fs.readFileSync(new URL("../../../vf2-evidence/source-assets.json", import.meta.url), "utf8"),
  );
  const metadata = {
    ...VF3_PLAN,
    head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: environment.SAM_VF3_RUN_URL,
    browserVersion: browser.version(),
    source,
    views: [] as unknown[],
    equationProofs: [] as unknown[],
    hypotheses: [] as unknown[],
    failures,
    consoleErrors,
    limitation:
      "Hosted SwiftShader establishes software WebGL execution, not hardware performance, full-app coexistence or owner acceptance",
  };
  const saveMetadata = () =>
    fs.writeFileSync(info.outputPath("evidence.json"), JSON.stringify(metadata, null, 2));
  const saveImage = (name: string, image: string) =>
    fs.writeFileSync(
      info.outputPath(`${name}.png`),
      Uint8Array.from(atob(image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === "http://127.0.0.1:1436" ? route.continue() : route.abort();
  });
  try {
    saveMetadata();
    await page.goto("/tests/fixtures/visual-identity.html");
    const capturePair = async (sample: typeof VF3_SMOKE) => {
      const result = [];
      for (const appearance of VF3_APPEARANCES) {
        const shot = await page.evaluate(
          async ({ sample, appearance }) => {
            const path = "/tests/fixtures/orb-vf3.ts";
            const api = (await import(path)) as typeof import("../fixtures/orb-vf3");
            return api.renderVF2(sample, appearance, api.vf2Frame(sample));
          },
          { sample, appearance },
        );
        // Persist each view immediately, including the first if its counterpart fails.
        result.push(shot);
        shots.push(shot);
        saveImage(shot.name, shot.image);
        metadata.views.push(shot.metadata);
        saveMetadata();
      }
      for (const shot of result) expect(shot.metadata.frame).toEqual(result[0].metadata.frame);
      for (const shot of result) {
        expect(shot.metadata.backend).toBe("webgl2");
        expect(shot.metadata.error).toBe(0);
        expect(shot.metadata.version).toContain("WebGL 2");
        expect(shot.metadata.coveredPixels).toBeGreaterThan(sample.radius ? 3000 : 10000);
        expect(shot.metadata.colourRange[1] - shot.metadata.colourRange[0]).toBeGreaterThan(10);
      }
    };
    await capturePair(VF3_SMOKE); // No matrix before both actual shaders/contexts succeed.
    for (const appearance of VF3_APPEARANCES) {
      const result = await page.evaluate(async (appearance) => {
        const path = "/tests/fixtures/skin-gpu-proof.ts";
        return ((await import(path)) as typeof import("../fixtures/skin-gpu-proof")).proveSkinGPU(
          appearance,
        );
      }, appearance);
      metadata.equationProofs.push(result);
      if (
        !result.finite ||
        result.error !== 0 ||
        result.samples !== 192 ||
        result.maxPositionError >= 0.0001 ||
        result.maxNormalError >= 0.005
      )
        failures.push(`Equation proof outside contract: ${appearance}`);
      saveMetadata();
      expect.soft(result.error).toBe(0);
      expect.soft(result.samples).toBe(192);
      expect.soft(result.finite).toBe(true);
      expect.soft(result.maxPositionError).toBeLessThan(0.0001);
      expect.soft(result.maxNormalError).toBeLessThan(0.005);
    }
    for (const sample of VF3_CASES) await capturePair(sample);
    for (const sample of VF3_PARTICLES) {
      const shot = await page.evaluate(async (sample) => {
        const path = "/tests/fixtures/orb-vf3.ts";
        const api = (await import(path)) as typeof import("../fixtures/orb-vf3");
        return api.renderVF2(sample, "organic-peel-experimental", api.vf2Frame(sample));
      }, sample);
      saveImage(shot.name, shot.image);
      metadata.hypotheses.push(shot.metadata);
      saveMetadata();
      expect(shot.metadata.error).toBe(0);
    }
    const sheet = await page.evaluate(async (shots) => {
      const path = "/tests/fixtures/orb-vf3.ts";
      return ((await import(path)) as typeof import("../fixtures/orb-vf3")).vf2Sheet(shots);
    }, shots);
    saveImage("comparison", sheet);
    expect(metadata.views).toHaveLength(3 * (VF3_CASES.length + 1));
    expect(consoleErrors).toEqual([]);
  } catch (error) {
    failures.push(String(error));
    throw error;
  } finally {
    saveMetadata();
  }
});
