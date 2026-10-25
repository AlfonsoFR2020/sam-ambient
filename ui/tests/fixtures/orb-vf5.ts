import { VF4_CASES, vf4SequenceFrames } from "./orb-vf4";

export { renderVF2, vf2Frame } from "./orb-vf2";
export { hostedRunURL } from "./orb-vf3";

export const VF5_PLAN = Object.freeze({
  seed: "0x5a17",
  size: 720,
  dpr: 1,
  baselineCommit: "d9502927c4f01f27d3b889c4d37eea580dd4bde5",
  baselineRenderedHead: "1acedb073c73d3400a0503e4f8db0907ba52b285",
  baselineRun: "https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/40076807654",
  baselineEvidence: "docs/evidence/orb-vf4/40076807654",
  held: "Identical frame, 720px/DPR1, seed, yaw/pitch, lighting, material, exposure and particles; V-F4 pixels are archived actual WebGL captures with exact frame equality, not a new rendering",
});
export const VF5_CASES = VF4_CASES;
export function vf5SequenceFrames() {
  // Actual continuous evaluator history, with an ordered 320ms cadence through
  // quiet syllables, silence, resumption and interruption. No new speech signal.
  return vf4SequenceFrames(Array.from({ length: 21 }, (_, i) => 20000 + 320 * i));
}
export async function vf5Sheet(shots: { name: string; image: string }[], motion = false) {
  const rows = motion
    ? [
        "sequence-thinking",
        "sequence-speech-late",
        "sequence-speech-quiet",
        "sequence-speech-silence",
        "sequence-speech-return",
        "sequence-interrupted",
      ]
    : [
        "smoke-colour",
        "colour-yaw0-phase0",
        "colour-yaw1.6-phase12",
        "polar-north",
        "polar-south",
        "silhouette",
        "compact-low",
      ];
  const ids = ["living-connected", "bipolar-vf4", "bipolar-peel-experimental"];
  const canvas = document.createElement("canvas");
  canvas.width = 1140;
  canvas.height = 80 + rows.length * 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sheet context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4eee5";
  ctx.font = "18px sans-serif";
  [
    "Parent default (current)",
    "V-F4 bipolar (archived WebGL)",
    "V-F5 separated solid peels",
  ].forEach((label, i) => {
    ctx.fillText(label, 20 + i * 380, 32);
  });
  ctx.font = "14px sans-serif";
  ctx.fillText(
    "Matched inputs · hosted software WebGL2 · no physical GPU or owner acceptance",
    20,
    60,
  );
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < ids.length; c++) {
      const shot = shots.find((s) => s.name === `${rows[r]}-${ids[c]}`);
      if (!shot) throw new Error("Missing matched view");
      const img = new Image();
      img.src = shot.image;
      await img.decode();
      ctx.fillStyle = "#e2b27f";
      ctx.fillText(rows[r], 20 + c * 380, 102 + r * 400);
      ctx.drawImage(img, 20 + c * 380, 112 + r * 400, 360, 360);
    }
  return canvas.toDataURL("image/png");
}
export async function vf5MotionStrip(shots: { name: string; image: string }[]) {
  const ordered = shots.filter(
    (s) => s.name.startsWith("sequence-time-") && s.name.endsWith("-bipolar-peel-experimental"),
  );
  const canvas = document.createElement("canvas");
  canvas.width = 1440;
  canvas.height = 60 + Math.ceil(ordered.length / 6) * 260;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Motion strip context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4eee5";
  ctx.font = "16px sans-serif";
  ctx.fillText(
    "Ordered continuous synthetic delivery · quiet / silence / resumption / interruption · 320ms spacing",
    12,
    30,
  );
  for (let i = 0; i < ordered.length; i++) {
    const img = new Image();
    img.src = ordered[i].image;
    await img.decode();
    const x = (i % 6) * 240,
      y = 60 + Math.floor(i / 6) * 260;
    ctx.drawImage(img, x, y, 240, 240);
    ctx.fillStyle = "#e2b27f";
    ctx.fillText(ordered[i].name.match(/time-(\d+)/)?.[1] ?? "", x + 8, y + 253);
  }
  return canvas.toDataURL("image/png");
}
