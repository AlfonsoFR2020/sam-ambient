import { expect, test } from "@playwright/test";
import type { OrbAppearanceId } from "../../src/visual-engine/appearance";
import type { MotionFrame } from "../../src/visual-engine/motion";
import { hostedRunURL, VF6_CASES, VF6_ID, VF6_PLAN } from "../fixtures/orb-vf6";

test("hosted rounded bipolar boundaries, nearest translucency and actual-pixel proof", async ({
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
      new URL("../../../docs/evidence/orb-vf5/40226839968/evidence.json", import.meta.url),
      "utf8",
    ),
  );
  const metadata = {
    ...VF6_PLAN,
    head: cp.execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    run: hostedRunURL(environment),
    browserVersion: browser.version(),
    source: JSON.parse(
      fs.readFileSync(new URL("../../../vf2-evidence/source-assets.json", import.meta.url), "utf8"),
    ),
    views: [] as unknown[],
    proofs: [] as unknown[],
    archiveChecks: [] as unknown[],
    order: [] as unknown[],
    transmission: null as unknown,
    errors: [] as string[],
    failures: [] as string[],
    limitation:
      "Software WebGL2, finite mesh/pose sampling and approximate nearest-layer transmission; no physical GPU performance, refraction, multilayer transport, acoustic timing or owner acceptance",
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
      sample: (typeof VF6_CASES)[number],
      frame?: MotionFrame,
      parent = false,
    ) => {
      const appearances: readonly OrbAppearanceId[] = parent
        ? ["living-connected", VF6_ID]
        : [VF6_ID];
      for (const appearance of appearances) {
        const shot = await page.evaluate(
          async ({ sample, appearance, frame }) => {
            const path = "/tests/fixtures/orb-vf6.ts",
              api = (await import(path)) as typeof import("../fixtures/orb-vf6");
            return api.renderVF2(
              {
                ...sample,
                options: { ...sample.options, captureSkinVertices: appearance === api.VF6_ID },
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
        expect(shot.metadata.version).toContain("WebGL 2");
        expect(shot.metadata.error).toBe(0);
        expect(shot.metadata.coveredPixels).toBeGreaterThan(sample.radius ? 3000 : 10000);
        if (appearance === VF6_ID) {
          const bad = shot.metadata.surface?.pairs.filter(
            (p) => p.intersections || (p.surfaces[0] !== p.surfaces[1] && p.near),
          );
          if (bad?.length) metadata.failures.push(`Production clearance ${shot.name}`);
          expect.soft(shot.metadata.surface?.triangles).toBe(sample.quality === "low" ? 738 : 7632);
          expect.soft(bad).toEqual([]);
          const old = archive.views.find(
            (v: { appearance: string; sample: { name: string } }) =>
              v.appearance === "bipolar-peel-experimental" && v.sample.name === sample.name,
          );
          expect(old, `archived ${sample.name}`).toBeDefined();
          expect(shot.metadata.frame).toEqual(old.frame);
          expect(sample.yaw).toBe(old.sample.yaw);
          expect(sample.quality).toBe(old.sample.quality);
          const { captureSkinVertices: _, ...oldOptions } = old.sample.options;
          expect(sample.options).toEqual(oldOptions);
          const data = fs.readFileSync(
            new URL(
              `../../../docs/evidence/orb-vf5/40226839968/${sample.name}-bipolar-peel-experimental.png`,
              import.meta.url,
            ),
            "base64",
          );
          shots.push({
            name: `${sample.name}-bipolar-vf5`,
            image: `data:image/png;base64,${data}`,
          });
          metadata.archiveChecks.push({
            name: sample.name,
            frameEquality: true,
            archivedHead: archive.head,
          });
          save();
        } else if (!sample.name.startsWith("sequence-")) {
          const data = fs.readFileSync(
            new URL(
              `../../../docs/evidence/orb-vf4/40076807654/${sample.name}-living-connected.png`,
              import.meta.url,
            ),
            "base64",
          );
          expect(shot.image).toBe(`data:image/png;base64,${data}`);
        }
      }
    };
    await capture(VF6_CASES[0], undefined, true);
    for (const { appearance, options } of [
      { appearance: "living-connected" as const, options: {} },
      { appearance: "bipolar-peel-experimental" as const, options: {} },
      { appearance: VF6_ID, options: {} },
      { appearance: VF6_ID, options: { radius: 0.46, speech: 0, preparation: 1 } },
      { appearance: VF6_ID, options: { speech: 1, settling: 1 } },
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
      expect
        .soft(proof.samples)
        .toBe(appearance === VF6_ID ? 468 : appearance === "living-connected" ? 192 : 240);
      expect.soft(proof.maxPositionError).toBeLessThan(0.0001);
      expect.soft(proof.maxNormalError).toBeLessThan(0.005);
    }
    for (const sample of VF6_CASES.slice(1)) await capture(sample, undefined, true);
    const sequence = await page.evaluate(async () => {
      const path = "/tests/fixtures/orb-vf6.ts";
      return ((await import(path)) as typeof import("../fixtures/orb-vf6")).vf6SequenceFrames();
    });
    const parentNames = [
      "thinking",
      "speech-late",
      "speech-quiet",
      "speech-silence",
      "speech-return",
      "interrupted",
    ];
    for (const s of sequence)
      await capture(
        { ...VF6_CASES[0], name: `sequence-${s.name}` },
        s.frame,
        parentNames.includes(s.name),
      );
    // V-F5 remains a real selectable strategy, not just historical images.
    for (const sample of [VF6_CASES[0], VF6_CASES[5], VF6_CASES[10]]) {
      const old = await page.evaluate(async (sample) => {
        const path = "/tests/fixtures/orb-vf6.ts",
          api = (await import(path)) as typeof import("../fixtures/orb-vf6");
        return api.renderVF2(sample, "bipolar-peel-experimental", api.vf2Frame(sample));
      }, sample);
      const expected = fs.readFileSync(
        new URL(
          `../../../docs/evidence/orb-vf5/40226839968/${sample.name}-bipolar-peel-experimental.png`,
          import.meta.url,
        ),
        "base64",
      );
      expect(old.image).toBe(`data:image/png;base64,${expected}`);
      metadata.archiveChecks.push({ name: sample.name, previousStrategyPixelIdentical: true });
      save();
    }
    for (const sample of [VF6_CASES[1], VF6_CASES[2], VF6_CASES[10]]) {
      const reversed = await page.evaluate(async (sample) => {
        const path = "/tests/fixtures/orb-vf6.ts",
          api = (await import(path)) as typeof import("../fixtures/orb-vf6");
        return api.renderVF2(
          {
            ...sample,
            options: {
              ...sample.options,
              depthPass: false,
              reverseSkinOrder: true,
              captureSkinVertices: true,
            },
          },
          api.VF6_ID,
          api.vf2Frame(sample),
        );
      }, sample);
      image(`reversed-${reversed.name}`, reversed.image);
      const forward = shots.find((s) => s.name === `${sample.name}-${VF6_ID}`);
      if (!forward) throw new Error("Missing forward draw-order pixels");
      const diff = await page.evaluate(
        async ({ a, b }) => {
          const path = "/tests/fixtures/orb-vf6.ts";
          return ((await import(path)) as typeof import("../fixtures/orb-vf6")).vf6PixelDifference(
            a,
            b,
          );
        },
        { a: forward.image, b: reversed.image },
      );
      metadata.order.push({ name: sample.name, ...diff, indicesAndColorRangesReversed: true });
      save();
      expect(diff.differentPixels).toBe(0);
      expect(diff.maxChannelError).toBe(0);
    }
    for (const sample of [VF6_CASES[0], VF6_CASES[5]]) {
      const ablation = await page.evaluate(async (sample) => {
        const path = "/tests/fixtures/orb-vf6.ts",
          api = (await import(path)) as typeof import("../fixtures/orb-vf6");
        return api.renderVF2(
          { ...sample, options: { ...sample.options, filmMaterial: "vf5-opaque" } },
          api.VF6_ID,
          api.vf2Frame(sample),
        );
      }, sample);
      shots.push({ name: `${sample.name}-vf6-opaque`, image: ablation.image });
      image(`${sample.name}-vf6-opaque`, ablation.image);
    }
    const transmission = await page.evaluate(async (sample) => {
      const path = "/tests/fixtures/orb-vf6.ts",
        api = (await import(path)) as typeof import("../fixtures/orb-vf6");
      return api.vf6Transmission(sample, api.vf2Frame(sample));
    }, VF6_CASES[1]);
    for (const shot of transmission.shots) image(shot.name, shot.image);
    metadata.transmission = { ...transmission, shots: transmission.shots.map((s) => s.name) };
    save();
    expect(transmission.comparisons[0].coveredPixels).toBeGreaterThan(1000);
    expect(transmission.comparisons[0].meanChannelResponse).toBeGreaterThan(25);
    expect(transmission.comparisons[1].meanChannelResponse).toBeLessThan(1);
    for (const kind of ["static", "motion", "material", "detail"] as const) {
      const sheet = await page.evaluate(
        async ({ shots, kind }) => {
          const path = "/tests/fixtures/orb-vf6.ts";
          return ((await import(path)) as typeof import("../fixtures/orb-vf6")).vf6Sheet(
            shots,
            kind,
          );
        },
        { shots, kind },
      );
      image(`comparison-${kind}`, sheet);
    }
    const strip = await page.evaluate(
      async (shots) => {
        const path = "/tests/fixtures/orb-vf5.ts";
        return ((await import(path)) as typeof import("../fixtures/orb-vf5")).vf5MotionStrip(
          shots.map((s) => ({
            ...s,
            name: s.name.replace("bipolar-film-experimental", "bipolar-peel-experimental"),
          })),
        );
      },
      shots.filter((s) => s.name.endsWith(VF6_ID)),
    );
    image("ordered-motion", strip);
    expect(metadata.errors).toEqual([]);
  } catch (error) {
    metadata.failures.push(String(error));
    throw error;
  } finally {
    save();
  }
});
