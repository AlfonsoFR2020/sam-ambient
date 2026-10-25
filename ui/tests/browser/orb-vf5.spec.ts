import { expect, test } from "@playwright/test";
import type { MotionFrame } from "../../src/visual-engine/motion";
import { hostedRunURL, VF5_CASES, VF5_PLAN } from "../fixtures/orb-vf5";

test("hosted V-F5 separation, solid layering and sustained expression", async ({
  page,
  browser,
}, info) => {
  const fsPath = "node:fs",
    cpPath = "node:child_process";
  const fs = (await import(fsPath)) as {
    mkdirSync: (p: string, o: { recursive: boolean }) => void;
    writeFileSync: (p: string, d: string | Uint8Array) => void;
    readFileSync: (p: string | URL, encoding: "utf8" | "base64") => string;
  };
  const cp = (await import(cpPath)) as {
    execFileSync: (p: string, a: string[], o: { encoding: "utf8" }) => string;
  };
  const environment = (globalThis as unknown as { process: { env: Record<string, string> } })
    .process.env;
  fs.mkdirSync(info.outputDir, { recursive: true });
  const archive = JSON.parse(
    fs.readFileSync(
      new URL("../../../docs/evidence/orb-vf4/40076807654/evidence.json", import.meta.url),
      "utf8",
    ),
  );
  const metadata = {
    ...VF5_PLAN,
    head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: hostedRunURL(environment),
    browserVersion: browser.version(),
    source: JSON.parse(
      fs.readFileSync(new URL("../../../vf2-evidence/source-assets.json", import.meta.url), "utf8"),
    ),
    views: [] as unknown[],
    archivedComparisons: [] as unknown[],
    proofs: [] as unknown[],
    baselineSurfaces: [] as unknown[],
    opticalOrder: [] as unknown[],
    errors: [] as string[],
    failures: [] as string[],
    limitation:
      "Software WebGL2, finite triangle/pose sampling and synthetic telemetry. No physical GPU timing, acoustic timestamps, natural-motion or owner acceptance.",
  };
  const shots: { name: string; image: string }[] = [];
  const save = () =>
    fs.writeFileSync(info.outputPath("evidence.json"), JSON.stringify(metadata, null, 2));
  const image = (name: string, data: string) =>
    fs.writeFileSync(
      info.outputPath(`${name}.png`),
      Uint8Array.from(atob(data.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  page.on("pageerror", (e) => metadata.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") metadata.errors.push(m.text());
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
      sample: (typeof VF5_CASES)[number],
      frame?: MotionFrame,
      matched = true,
    ) => {
      for (const appearance of (matched
        ? ["living-connected", "bipolar-peel-experimental"]
        : ["bipolar-peel-experimental"]) as ("living-connected" | "bipolar-peel-experimental")[]) {
        const shot = await page.evaluate(
          async ({ sample, appearance, frame }) => {
            const path = "/tests/fixtures/orb-vf5.ts",
              api = (await import(path)) as typeof import("../fixtures/orb-vf5");
            return api.renderVF2(
              {
                ...sample,
                options: {
                  ...sample.options,
                  captureSkinVertices: appearance === "bipolar-peel-experimental",
                },
              },
              appearance,
              frame ?? api.vf2Frame(sample),
            );
          },
          { sample, appearance, frame },
        );
        shots.push(shot);
        image(shot.name, shot.image);
        metadata.views.push(shot.metadata);
        save();
        expect(shot.metadata.backend).toBe("webgl2");
        expect(shot.metadata.error).toBe(0);
        expect(shot.metadata.version).toContain("WebGL 2");
        expect(shot.metadata.coveredPixels).toBeGreaterThan(sample.radius ? 3000 : 10000);
        if (appearance === "bipolar-peel-experimental") {
          const bad = shot.metadata.surface?.pairs.filter(
            (p) => p.intersections || (p.surfaces[0] !== p.surfaces[1] && p.near),
          );
          if (bad?.length) metadata.failures.push(`Production surface clearance: ${shot.name}`);
          expect.soft(shot.metadata.surface?.triangles).toBe(sample.quality === "low" ? 648 : 6912);
          expect.soft(bad).toEqual([]);
          if (matched) {
            const old = archive.views.find(
              (v: { appearance: string; sample: { name: string } }) =>
                v.appearance === "bipolar-peel-experimental" && v.sample.name === sample.name,
            );
            expect(old, `Archived frame ${sample.name}`).toBeDefined();
            expect(shot.metadata.frame).toEqual(old.frame);
            expect(sample.yaw).toBe(old.sample.yaw);
            expect(sample.quality).toBe(old.sample.quality);
            expect(sample.options).toEqual(old.sample.options);
            const base64 = fs.readFileSync(
              new URL(
                `../../../docs/evidence/orb-vf4/40076807654/${sample.name}-bipolar-peel-experimental.png`,
                import.meta.url,
              ),
              "base64",
            );
            shots.push({
              name: `${sample.name}-bipolar-vf4`,
              image: `data:image/png;base64,${base64}`,
            });
            metadata.archivedComparisons.push({
              sample: sample.name,
              head: archive.head,
              run: archive.run,
              frameEquality: true,
            });
            save();
          }
        }
      }
    };
    await capture(VF5_CASES[0]);
    for (const { appearance, options } of [
      { appearance: "living-connected" as const, options: {} },
      { appearance: "bipolar-peel-experimental" as const, options: {} },
      {
        appearance: "bipolar-peel-experimental" as const,
        options: { radius: 0.46, speech: 0, preparation: 1 },
      },
      { appearance: "bipolar-peel-experimental" as const, options: { speech: 1, settling: 1 } },
    ]) {
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
      metadata.proofs.push({ options, ...proof });
      save();
      expect.soft(proof.finite).toBe(true);
      expect.soft(proof.error).toBe(0);
      expect.soft(proof.samples).toBe(appearance === "living-connected" ? 192 : 240);
      expect.soft(proof.maxPositionError).toBeLessThan(0.0001);
      expect.soft(proof.maxNormalError).toBeLessThan(0.005);
    }
    for (const sample of VF5_CASES.slice(1)) await capture(sample);
    const sequence = await page.evaluate(async () => {
      const path = "/tests/fixtures/orb-vf5.ts";
      return ((await import(path)) as typeof import("../fixtures/orb-vf5")).vf5SequenceFrames();
    });
    for (const s of [
      { sample: VF5_CASES[1], frame: undefined as MotionFrame | undefined },
      {
        sample: { ...VF5_CASES[0], name: "sequence-speech-silence" },
        frame: sequence.find((s) => s.name === "speech-silence")?.frame,
      },
    ]) {
      const old = await page.evaluate(async ({ sample, frame }) => {
        const path = "/tests/fixtures/orb-vf5.ts",
          api = (await import(path)) as typeof import("../fixtures/orb-vf5");
        return api.renderVF2(
          {
            ...sample,
            options: { ...sample.options, captureSkinVertices: true, vf4Surface: true },
          },
          "bipolar-peel-experimental",
          frame ?? api.vf2Frame(sample),
        ).metadata;
      }, s);
      metadata.baselineSurfaces.push({
        ...old,
        usage:
          "Frozen V-F4 equations/descriptors with actual production body, geometry diagnostic only; current optical image discarded",
      });
      save();
      expect(old.surface?.pairs.some((p) => p.intersections > 0)).toBe(true);
    }
    for (const s of sequence)
      await capture(
        { ...VF5_CASES[0], name: `sequence-${s.name}` },
        s.frame,
        !s.name.startsWith("time-"),
      );
    let orderSensitiveLegacyViews = 0;
    for (const yaw of [0, 1.6]) {
      const captures = [];
      for (const legacy of [false, true])
        for (const reverse of [false, true]) {
          const shot = await page.evaluate(
            async ({ yaw, legacy, reverse }) => {
              const path = "/tests/fixtures/orb-vf5.ts",
                api = (await import(path)) as typeof import("../fixtures/orb-vf5");
              const sample = {
                ...api.VF5_CASES[0],
                name: `optical-yaw${yaw}-${legacy ? "film" : "solid"}-${reverse ? "reverse" : "forward"}`,
                yaw,
                options: { depthPass: false, reverseSkinOrder: reverse, legacyBipolarFilm: legacy },
              };
              return api.renderVF2(sample, "bipolar-peel-experimental", api.vf2Frame(sample));
            },
            { yaw, legacy, reverse },
          );
          captures.push(shot);
          image(shot.name, shot.image);
        }
      const solidEqual = captures[0].image === captures[1].image,
        legacyEqual = captures[2].image === captures[3].image;
      metadata.opticalOrder.push({
        yaw,
        solidPixelIdentical: solidEqual,
        legacyFilmPixelIdentical: legacyEqual,
        conditions: captures.map((s) => s.metadata),
        limitation:
          "Legacy-film ablation uses corrected geometry and deliberately disables the High prepass; it is not a recreated V-F4 image",
      });
      save();
      expect(solidEqual).toBe(true);
      if (!legacyEqual) orderSensitiveLegacyViews++;
    }
    expect(orderSensitiveLegacyViews).toBeGreaterThan(0);
    for (const motion of [false, true]) {
      const sheet = await page.evaluate(
        async ({ shots, motion }) => {
          const path = "/tests/fixtures/orb-vf5.ts";
          return ((await import(path)) as typeof import("../fixtures/orb-vf5")).vf5Sheet(
            shots,
            motion,
          );
        },
        { shots, motion },
      );
      image(motion ? "expression-comparison" : "comparison", sheet);
    }
    image(
      "ordered-motion",
      await page.evaluate(async (shots) => {
        const path = "/tests/fixtures/orb-vf5.ts";
        return ((await import(path)) as typeof import("../fixtures/orb-vf5")).vf5MotionStrip(shots);
      }, shots),
    );
    image(
      "crossing-details",
      await page.evaluate(async (shots) => {
        const path = "/tests/fixtures/orb-vf5.ts";
        return ((await import(path)) as typeof import("../fixtures/orb-vf5")).vf5CrossingDetails(
          shots,
        );
      }, shots),
    );
    expect(metadata.errors).toEqual([]);
  } catch (error) {
    metadata.failures.push(String(error));
    throw error;
  } finally {
    save();
  }
});
