import type { OrbAppearanceId } from "../../src/visual-engine/appearance";
import type { MotionFrame } from "../../src/visual-engine/motion";
import { renderVF2, type VF2Case } from "./orb-vf2";
import { VF4_CASES } from "./orb-vf4";
import { vf5SequenceFrames } from "./orb-vf5";

export { renderVF2, vf2Frame } from "./orb-vf2";
export { hostedRunURL } from "./orb-vf3";

export const VF6_ID: OrbAppearanceId = "bipolar-film-experimental";
export const VF6_CASES = VF4_CASES;
export const VF6_PLAN = Object.freeze({
  seed: "0x5a17",
  size: 720,
  dpr: 1,
  baselineCommit: "3c35fe9dc1abf4c534f6c231e5820fc6be333753",
  baselineRenderedHead: "33b0d89ff7b2a5ab37823f9942b191bd7ee3d4e8",
  baselineRun: "https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40226839968",
  held: "Identical frames, camera, material clocks, lights, seed, exposure and particle caps; V-F5 images are archived actual WebGL pixels with frame equality, never a synthetic recreation",
});
export { vf5SequenceFrames as vf6SequenceFrames };

type Shot = { name: string; image: string };
async function pixels(data: string) {
  const img = new Image();
  img.src = data;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Decoded-pixel proof context");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}
/** Actual decoded RGBA, not descriptors, PNG size or a visual similarity score. */
export async function vf6PixelDifference(a: string, b: string) {
  const p = await pixels(a),
    q = await pixels(b);
  if (p.length !== q.length) throw new Error("Pixel bounds differ");
  let differentPixels = 0,
    maxChannelError = 0;
  for (let k = 0; k < p.length; k += 4) {
    let changed = false;
    for (let j = 0; j < 4; j++) {
      const error = Math.abs(p[k + j] - q[k + j]);
      changed ||= error > 0;
      maxChannelError = Math.max(maxChannelError, error);
    }
    if (changed) differentPixels++;
  }
  return { differentPixels, maxChannelError };
}

/** Causal transmission probe: intersect visible film and body masks, then vary
 * ONLY the body's shaded color. Opaque and glass use the same new geometry/depth.
 * Masking excludes exposed body, background and antialiased silhouette pixels.
 */
export async function vf6Transmission(sample: VF2Case, frame: MotionFrame) {
  const shots: Shot[] = [];
  const render = (label: string, options: VF2Case["options"]) => {
    const shot = renderVF2(
      { ...sample, name: `transmission-${label}`, options: { ...sample.options, ...options } },
      VF6_ID,
      frame,
    );
    shots.push(shot);
    return shot.image;
  };
  const film = await pixels(render("film-mask", { filmMask: true, bodyProbe: "black" }));
  const body = await pixels(render("body-mask", { bodyOnly: true, bodyProbe: "white" }));
  const mask = new Uint8Array(film.length / 4);
  for (let i = 0; i < mask.length; i++)
    mask[i] = Number([0, 1, 2].every((k) => film[i * 4 + k] >= 250 && body[i * 4 + k] >= 250));
  const comparisons = [];
  for (const opaque of [false, true]) {
    const black = await pixels(
      render(opaque ? "opaque-black" : "glass-black", {
        bodyProbe: "black",
        filmMaterial: opaque ? "vf5-opaque" : undefined,
      }),
    );
    const white = await pixels(
      render(opaque ? "opaque-white" : "glass-white", {
        bodyProbe: "white",
        filmMaterial: opaque ? "vf5-opaque" : undefined,
      }),
    );
    let covered = 0,
      total = 0,
      maximum = 0;
    for (let i = 0; i < mask.length; i++)
      if (mask[i]) {
        covered++;
        for (let k = 0; k < 3; k++) {
          const delta = Math.abs(white[i * 4 + k] - black[i * 4 + k]);
          total += delta;
          maximum = Math.max(maximum, delta);
        }
      }
    comparisons.push({
      opaque,
      coveredPixels: covered,
      meanChannelResponse: total / Math.max(1, covered * 3),
      maxChannelResponse: maximum,
    });
  }
  return {
    shots,
    comparisons,
    limitation:
      "Framebuffer transmission response in masked pixels, not physical refraction, multilayer optics or a measured transmission spectrum",
  };
}

export async function vf6Sheet(
  shots: Shot[],
  kind: "static" | "motion" | "material" | "detail" = "static",
) {
  const rows =
    kind === "motion"
      ? [
          "sequence-thinking",
          "sequence-speech-late",
          "sequence-speech-quiet",
          "sequence-speech-silence",
          "sequence-speech-return",
          "sequence-interrupted",
        ]
      : kind === "material"
        ? ["smoke-colour", "polar-south"]
        : kind === "detail"
          ? ["colour-yaw0-phase0", "polar-south"]
          : ["smoke-colour", "neutral", "silhouette", "polar-south", "compact-low"];
  const ids =
    kind === "material" ? ["vf6-opaque", VF6_ID] : ["living-connected", "bipolar-vf5", VF6_ID];
  const labels =
    kind === "material"
      ? ["Rounded geometry / V-F5 opaque material", "Same geometry / nearest translucent film"]
      : ["Parent default", "V-F5 opaque bipolar (archived)", "V-F6 rounded translucent film"];
  const canvas = document.createElement("canvas");
  canvas.width = ids.length * 400;
  canvas.height = 80 + rows.length * 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Comparison sheet context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#f4eee5";
  labels.forEach((s, i) => {
    ctx.fillText(s, 14 + i * 400, 32);
  });
  ctx.font = "13px sans-serif";
  ctx.fillText(
    "Matched hosted WebGL2 · synthetic inputs · approximate single-layer transmission · no owner acceptance",
    14,
    58,
  );
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < ids.length; c++) {
      const shot = shots.find((s) => s.name === `${rows[r]}-${ids[c]}`);
      if (!shot) throw new Error(`Missing ${rows[r]}-${ids[c]}`);
      const img = new Image();
      img.src = shot.image;
      await img.decode();
      ctx.fillStyle = "#e2b27f";
      ctx.fillText(rows[r], 14 + c * 400, 100 + r * 420);
      if (kind === "detail")
        ctx.drawImage(img, 130, 110, 470, 480, 14 + c * 400, 112 + r * 420, 376, 384);
      else ctx.drawImage(img, 14 + c * 400, 112 + r * 420, 376, 376);
    }
  return canvas.toDataURL("image/png");
}
