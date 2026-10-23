import type { OrbAppearanceId } from "../../src/visual-engine/appearance";
import { VF2_SMOKE, type VF2Case } from "./orb-vf2";

export { renderVF2, vf2Frame } from "./orb-vf2";
export const VF3_APPEARANCES: readonly OrbAppearanceId[] = [
  "living-connected",
  "radial-shell-experimental",
  "organic-peel-experimental",
];
export const VF3_PLAN = Object.freeze({
  seed: "0x5a17",
  size: 720,
  dpr: 1,
  curlRate: 0.3,
  baseline: "653ca9261a79bc7308c93fc0fa262e87b1133733",
  held: "same frame, seed, camera, light, exposure, material and released 64 particles; only geometry strategy differs",
});
export const VF3_SMOKE = VF2_SMOKE;
export const VF3_CASES: readonly VF2Case[] = [
  { ...VF2_SMOKE, name: "phase0", curlSeconds: 0 },
  { ...VF2_SMOKE, name: "colour-yaw0-curl0", yaw: 0, curlSeconds: 0 },
  { ...VF2_SMOKE, name: "colour-yaw1.6-curl12", yaw: 1.6, curlSeconds: 12 },
  { ...VF2_SMOKE, name: "neutral", options: { neutralMaterial: true } },
  { ...VF2_SMOKE, name: "silhouette", yaw: 2.7, options: { neutralMaterial: true } },
  { ...VF2_SMOKE, name: "normals", options: { diagnostic: "normals" } },
  { ...VF2_SMOKE, name: "attachment", options: { diagnostic: "attachment" } },
  { ...VF2_SMOKE, name: "depth", options: { diagnostic: "depth" } },
  { ...VF2_SMOKE, name: "compact-low", radius: 0.46, quality: "low" },
];
export const VF3_PARTICLES: readonly VF2Case[] = [
  { ...VF2_SMOKE, name: "particles-released64", options: { particleCount: 64 } },
  ...([64, 128, 256] as const).map((particleCount) => ({
    ...VF2_SMOKE,
    name: `particles-near${particleCount}`,
    options: { particleCount, particlePresentation: "near-field" as const },
  })),
];
/** Remote contact sheet from real captured pixels. No locally generated Orb image. */
export async function vf2Sheet(shots: { name: string; image: string }[]) {
  const rows = ["smoke-colour", "neutral", "silhouette", "compact-low"];
  const canvas = document.createElement("canvas");
  canvas.width = 1140;
  canvas.height = 80 + rows.length * 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sheet context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#f4eee5";
  ["Parent default", "Radial sectors", "Positive organic peels"].forEach((label, i) => {
    ctx.fillText(label, 20 + i * 380, 32);
  });
  ctx.font = "14px sans-serif";
  ctx.fillText("V-F3 · matched hosted WebGL2 · provisional engineering evidence", 20, 60);
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < 3; c++) {
      const shot = shots.find((s) => s.name === `${rows[r]}-${VF3_APPEARANCES[c]}`);
      if (!shot) throw new Error("Missing sheet view");
      const image = new Image();
      image.src = shot.image;
      await image.decode();
      ctx.fillStyle = "#e2b27f";
      ctx.fillText(rows[r], 20 + c * 380, 102 + r * 400);
      ctx.drawImage(image, 20 + c * 380, 112 + r * 400, 360, 360);
    }
  return canvas.toDataURL("image/png");
}
