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
