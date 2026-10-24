import type { OrbAppearanceId } from "../../src/visual-engine/appearance";
import { MotionEvaluator, type MotionFrame } from "../../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../../src/visual-engine/types";
import { VF2_SMOKE, type VF2Case } from "./orb-vf2";
import { visualInput } from "./visual-identity-II";

export { renderVF2, vf2Frame } from "./orb-vf2";
export { hostedRunURL } from "./orb-vf3";

export const VF4_APPEARANCES: readonly OrbAppearanceId[] = [
  "living-connected",
  "organic-peel-experimental",
  "bipolar-peel-experimental",
];
export const VF4_PLAN = Object.freeze({
  seed: "0x5a17",
  size: 720,
  dpr: 1,
  baseline: "704b8cd74a2318acd599f59ff8927a3b484e13b2",
  held: "Identical frame, material, lighting, exposure, seed, camera and 64 High / 12 Low particles within each triple; only skin strategy differs",
});
export const VF4_CASES: readonly VF2Case[] = [
  VF2_SMOKE,
  { ...VF2_SMOKE, name: "colour-yaw0-phase0", yaw: 0, curlSeconds: 0 },
  { ...VF2_SMOKE, name: "colour-yaw1.6-phase12", yaw: 1.6, curlSeconds: 12 },
  { ...VF2_SMOKE, name: "neutral", options: { neutralMaterial: true } },
  { ...VF2_SMOKE, name: "polar-north", yaw: 1.6, options: { neutralMaterial: true, pitch: 1.1 } },
  { ...VF2_SMOKE, name: "polar-south", yaw: 0.2, options: { neutralMaterial: true, pitch: -1.1 } },
  { ...VF2_SMOKE, name: "silhouette", yaw: 2.7, options: { neutralMaterial: true } },
  { ...VF2_SMOKE, name: "attachment", options: { diagnostic: "attachment" } },
  { ...VF2_SMOKE, name: "normals", options: { diagnostic: "normals" } },
  { ...VF2_SMOKE, name: "depth", options: { diagnostic: "depth" } },
  { ...VF2_SMOKE, name: "compact-low", radius: 0.46, quality: "low" },
];

/** Synthetic playback observations exercise the real MotionEvaluator. They are
 * labelled test inputs, never presented as recorded owner audio or core progress.
 * One integration pass, not a fresh evaluator replay per capture.
 */
export function vf4SequenceFrames(): {
  name: string;
  timeMs: number;
  level: number;
  frame: MotionFrame;
}[] {
  const evaluator = new MotionEvaluator(0x5a17),
    captures = [];
  const samples = new Map([
    [200, "formation"],
    [2000, "loading"],
    [4500, "listening"],
    [7500, "thinking"],
    [11000, "speech-onset"],
    [15000, "speech-sustained"],
    [19000, "speech-late"],
    [21000, "speech-quiet"],
    [23000, "speech-silence"],
    [25000, "speech-return"],
    [26060, "interrupt-onset"],
    [27000, "interrupted"],
    [29000, "recovered"],
    [31000, "unloading"],
    [33000, "departure"],
  ]);
  for (let time = 0; time <= 33000; time += 20) {
    const speaking = time >= 10000 && time < 26000;
    const level = !speaking
      ? 0
      : time < 20000
        ? [0.025, 0.055, 0.012, 0.09][Math.floor(time / 320) % 4]
        : time < 22000
          ? 0.004
          : time < 24000
            ? 0
            : 0.04;
    const state =
      time < 3000
        ? "idle"
        : time < 6000
          ? "listening"
          : time < 10000
            ? "thinking"
            : speaking
              ? "speaking"
              : time < 27500
                ? "interrupted"
                : "idle";
    const input = visualInput(time, state, level);
    const projected =
      time < 3000
        ? {
            ...input,
            interaction: {
              ...input.interaction,
              providerLifecycle: { phase: "loading" as const, key: "fixture-load" },
              presence: {
                phase: time < 800 ? ("starting" as const) : ("loading" as const),
                key: "fixture-load",
              },
            },
          }
        : time >= 30000
          ? {
              ...input,
              interaction: {
                ...input.interaction,
                providerLifecycle: { phase: "unloading" as const, key: "fixture-retire" },
                presence: {
                  phase: time >= 32000 ? ("departing" as const) : ("unloading" as const),
                  key: "fixture-retire",
                },
              },
            }
          : input;
    evaluator.evaluate(
      projected,
      time,
      { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" },
      RENDER_BUDGETS.high,
    );
    const name = samples.get(time);
    if (name)
      captures.push({
        name,
        timeMs: time,
        level,
        frame: { ...evaluator.currentFrame, reactivity: { ...evaluator.currentFrame.reactivity } },
      });
  }
  return captures;
}

/** Remote only: contact sheet assembled from actual WebGL captures. */
export async function vf4Sheet(shots: { name: string; image: string }[], motion = false) {
  const rows = motion
    ? [
        "sequence-loading",
        "sequence-thinking",
        "sequence-speech-sustained",
        "sequence-speech-late",
        "sequence-speech-quiet",
        "sequence-speech-silence",
        "sequence-speech-return",
      ]
    : ["smoke-colour", "neutral", "polar-north", "polar-south", "silhouette", "compact-low"];
  const canvas = document.createElement("canvas");
  canvas.width = 1140;
  canvas.height = 80 + rows.length * 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sheet context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#f4eee5";
  ["Parent default", "V-F3 positive peels", "V-F4 bipolar trajectories"].forEach((label, i) => {
    ctx.fillText(label, 20 + i * 380, 32);
  });
  ctx.font = "14px sans-serif";
  ctx.fillText("Matched hosted WebGL2 · synthetic inputs · provisional technical evidence", 20, 60);
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < 3; c++) {
      const shot = shots.find((s) => s.name === `${rows[r]}-${VF4_APPEARANCES[c]}`);
      if (!shot) throw new Error("Missing comparison view");
      const image = new Image();
      image.src = shot.image;
      await image.decode();
      ctx.fillStyle = "#e2b27f";
      ctx.fillText(rows[r], 20 + c * 380, 102 + r * 400);
      ctx.drawImage(image, 20 + c * 380, 112 + r * 400, 360, 360);
    }
  return canvas.toDataURL("image/png");
}
