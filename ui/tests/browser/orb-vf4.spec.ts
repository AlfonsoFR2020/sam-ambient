import { expect, test } from "@playwright/test";
import { hostedRunURL, VF4_APPEARANCES, VF4_CASES, VF4_PLAN } from "../fixtures/orb-vf4";

test("hosted bipolar morphology, strict equations and sustained expression", async ({
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
    consoleErrors: string[] = [],
    shots: { name: string; image: string }[] = [];
  fs.mkdirSync(info.outputDir, { recursive: true });
  const metadata = {
    ...VF4_PLAN,
    head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: hostedRunURL(environment),
    browserVersion: browser.version(),
    source: JSON.parse(
      fs.readFileSync(new URL("../../../vf2-evidence/source-assets.json", import.meta.url), "utf8"),
    ),
    views: [] as unknown[],
    equationProofs: [] as unknown[],
    failures,
    consoleErrors,
    limitation:
      "Software WebGL2 and sampled synthetic motion, not physical GPU performance, natural speech, acoustic timestamps or owner acceptance",
  };
  const save = () =>
    fs.writeFileSync(info.outputPath("evidence.json"), JSON.stringify(metadata, null, 2));
  const image = (name: string, data: string) =>
    fs.writeFileSync(
      info.outputPath(`${name}.png`),
      Uint8Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:1436"
      ? route.continue()
      : route.abort(),
  );
  try {
    save();
    await page.goto("/tests/fixtures/visual-identity.html");
    const capture = async (
      sample: (typeof VF4_CASES)[number],
      frame?: import("../../src/visual-engine/motion").MotionFrame,
    ) => {
      const result = [];
      for (const appearance of VF4_APPEARANCES) {
        const shot = await page.evaluate(
          async ({ sample, appearance, frame }) => {
            const path = "/tests/fixtures/orb-vf4.ts";
            const api = (await import(path)) as typeof import("../fixtures/orb-vf4");
            return api.renderVF2(sample, appearance, frame ?? api.vf2Frame(sample));
          },
          { sample, appearance, frame },
        );
        result.push(shot);
        shots.push(shot);
        image(shot.name, shot.image);
        metadata.views.push(shot.metadata);
        save();
      }
      for (const shot of result) {
        expect(shot.metadata.frame).toEqual(result[0].metadata.frame);
        expect(shot.metadata.backend).toBe("webgl2");
        expect(shot.metadata.error).toBe(0);
        expect(shot.metadata.version).toContain("WebGL 2");
        expect(shot.metadata.coveredPixels).toBeGreaterThan(sample.radius ? 3000 : 10000);
        expect(shot.metadata.colourRange[1] - shot.metadata.colourRange[0]).toBeGreaterThan(10);
      }
    };
    await capture(VF4_CASES[0]);
    const proofCases = [
      ...VF4_APPEARANCES.map((appearance) => ({ appearance, options: {} })),
      {
        appearance: "bipolar-peel-experimental" as const,
        options: { radius: 0.46, speech: 0, preparation: 1 },
      },
      { appearance: "bipolar-peel-experimental" as const, options: { speech: 1, settling: 1 } },
    ];
    for (const { appearance, options } of proofCases) {
      const proof = await page.evaluate(
        async ({ appearance, options }) => {
          const path = "/tests/fixtures/skin-gpu-proof.ts";
          return ((await import(path)) as typeof import("../fixtures/skin-gpu-proof")).proveSkinGPU(
            appearance,
            "production",
            options,
          );
        },
        { appearance, options },
      );
      metadata.equationProofs.push({ options, ...proof });
      save();
      if (
        !proof.finite ||
        proof.error !== 0 ||
        proof.samples !== 192 ||
        proof.maxPositionError >= 0.0001 ||
        proof.maxNormalError >= 0.005
      )
        failures.push(`Strict equation proof failed: ${appearance} ${JSON.stringify(options)}`);
      expect.soft(proof.finite).toBe(true);
      expect.soft(proof.error).toBe(0);
      expect.soft(proof.samples).toBe(192);
      expect.soft(proof.maxPositionError).toBeLessThan(0.0001);
      expect.soft(proof.maxNormalError).toBeLessThan(0.005);
    }
    for (const sample of VF4_CASES.slice(1)) await capture(sample);
    const sequence = await page.evaluate(async () => {
      const path = "/tests/fixtures/orb-vf4.ts";
      return ((await import(path)) as typeof import("../fixtures/orb-vf4")).vf4SequenceFrames();
    });
    for (const sample of sequence)
      await capture({ ...VF4_CASES[0], name: `sequence-${sample.name}` }, sample.frame);
    for (const motion of [false, true]) {
      const sheet = await page.evaluate(
        async ({ shots, motion }) => {
          const path = "/tests/fixtures/orb-vf4.ts";
          return ((await import(path)) as typeof import("../fixtures/orb-vf4")).vf4Sheet(
            shots,
            motion,
          );
        },
        { shots, motion },
      );
      image(motion ? "expression-sequence" : "comparison", sheet);
    }
    expect(metadata.views).toHaveLength(3 * (VF4_CASES.length + sequence.length));
    expect(consoleErrors).toEqual([]);
  } catch (error) {
    failures.push(String(error));
    throw error;
  } finally {
    save();
  }
});
