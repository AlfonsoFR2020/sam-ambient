import type { OrbAppearanceId } from "../../src/visual-engine/appearance";
import { bipolarCoordinates, createBipolarPeels } from "../../src/visual-engine/bipolar-peel";
import type { MotionFrame } from "../../src/visual-engine/motion";
import type { ResolvedQuality } from "../../src/visual-engine/quality";
import { meshDirection } from "./skin-analysis";
import { type SurfaceTriangle, surfaceClearance } from "./triangle-clearance";
import { fixture, frameAt } from "./visual-identity-II";

export const VF2_APPEARANCES: readonly OrbAppearanceId[] = [
  "living-connected",
  "radial-shell-experimental",
];
export const VF2_PLAN = Object.freeze({
  seed: "0x5a17",
  size: 720,
  dpr: 1,
  curlRate: 0.3,
  baseline: "15db3adaa30e29103d556a7354dd9440af957f72",
  held: "same frame, seed, camera/yaw, light, exposure and material; only skin strategy differs within a pair",
});
type Options = NonNullable<Parameters<typeof fixture>[1]>;
export interface VF2Case {
  readonly name: string;
  readonly yaw: number;
  readonly curlSeconds: number;
  readonly quality: ResolvedQuality;
  readonly options: Options;
  readonly materialSeconds?: number;
  readonly radius?: number;
}
export const VF2_SMOKE: VF2Case = {
  name: "smoke-colour",
  yaw: 0.75,
  curlSeconds: 6,
  quality: "high",
  options: {},
};
export const VF2_CASES: readonly VF2Case[] = [
  { name: "colour-yaw0-curl0", yaw: 0, curlSeconds: 0, quality: "high", options: {} },
  { name: "colour-yaw1.6-curl12", yaw: 1.6, curlSeconds: 12, quality: "high", options: {} },
  { ...VF2_SMOKE, name: "neutral", options: { neutralMaterial: true } },
  { ...VF2_SMOKE, name: "normals", options: { diagnostic: "normals" } },
  { ...VF2_SMOKE, name: "depth", options: { diagnostic: "depth" } },
  { ...VF2_SMOKE, name: "attachment", options: { diagnostic: "attachment" } },
  { ...VF2_SMOKE, name: "skin-only", options: { membraneOnly: true } },
  { ...VF2_SMOKE, name: "body-only", options: { bodyOnly: true } },
  { ...VF2_SMOKE, name: "compact", radius: 0.46 },
  { ...VF2_SMOKE, name: "low", quality: "low" },
  { ...VF2_SMOKE, name: "compact-low", radius: 0.46, quality: "low" },
  { ...VF2_SMOKE, name: "material45", materialSeconds: 45 },
  { ...VF2_SMOKE, name: "material300", materialSeconds: 300 },
];

/** Unrelated body/light clocks stay held; both strategies receive the same object. */
export function vf2Frame(sample: VF2Case): MotionFrame {
  const base = frameAt(0);
  const frame = { ...base, peelTravel: base.peelTravel + sample.curlSeconds * VF2_PLAN.curlRate };
  if (sample.radius !== undefined) frame.radius = sample.radius;
  if (sample.materialSeconds !== undefined) {
    const later = frameAt(sample.materialSeconds * 1000);
    for (const key of [
      "palettePhase",
      "paletteContrastPhase",
      "paletteBalance",
      "paletteContrast",
      "fieldPhase1",
      "fieldPhase2",
      "fieldTwist1",
      "fieldTwist2",
    ] as const)
      frame[key] = later[key];
  }
  return frame;
}

/** Direct WebGLBackend fixture: Canvas/static cannot satisfy this proof. */
export function renderVF2(sample: VF2Case, appearance: OrbAppearanceId, frame: MotionFrame) {
  const scene = fixture(sample.quality, {
    ...sample.options,
    size: VF2_PLAN.size,
    dpr: VF2_PLAN.dpr,
    appearance,
  });
  try {
    if (!(scene.gl instanceof WebGL2RenderingContext) || scene.backend.kind !== "webgl2")
      throw new Error("V-F2 requires actual WebGL2, no fallback");
    scene.render(frame, sample.yaw);
    let surface: ReturnType<typeof surfaceClearance> | undefined;
    if (sample.options.captureSkinVertices) {
      if (appearance !== "bipolar-peel-experimental")
        throw new Error("Surface atlas diagnostic is bipolar-only");
      const { points, geometry } = scene.readSkinVertices(),
        peels = createBipolarPeels();
      const triangles: SurfaceTriangle[] = [];
      for (let k = 0; k < geometry.indices.length; k += 3) {
        const surface = Math.floor((k / geometry.indices.length) * 3),
          ids = Array.from(geometry.indices.slice(k, k + 3));
        triangles.push({
          id: k / 3,
          surface,
          ids,
          points: ids.map((i) => [points[i * 3], points[i * 3 + 1], points[i * 3 + 2]]),
          uv: ids.map((i) => bipolarCoordinates(meshDirection(geometry, i), peels[surface])),
        });
      }
      surface = surfaceClearance(triangles, (0.025 * frame.radius) / 1.18);
    }
    const gl = scene.gl,
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    const pixels = new Uint8Array(scene.canvas.width * scene.canvas.height * 4);
    gl.readPixels(0, 0, scene.canvas.width, scene.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let coveredPixels = 0,
      minimum = 255,
      maximum = 0;
    for (let i = 0; i < pixels.length; i += 4)
      if (pixels[i + 3] > 20) {
        coveredPixels++;
        minimum = Math.min(minimum, pixels[i], pixels[i + 1], pixels[i + 2]);
        maximum = Math.max(maximum, pixels[i], pixels[i + 1], pixels[i + 2]);
      }
    const canvas = document.createElement("canvas");
    canvas.width = scene.canvas.width;
    canvas.height = scene.canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Evidence background context unavailable");
    ctx.fillStyle = "#090b12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(scene.canvas, 0, 0);
    const image = canvas.toDataURL("image/png");
    return {
      name: `${sample.name}-${appearance}`,
      image,
      metadata: {
        sample,
        appearance,
        seed: VF2_PLAN.seed,
        frame,
        backend: scene.backend.kind,
        version: gl.getParameter(gl.VERSION),
        shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        renderer: debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
        vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        backing: [canvas.width, canvas.height],
        coveredPixels,
        colourRange: [minimum, maximum],
        error: gl.getError(),
        gpuTimingMeasured: false,
        surface,
      },
    };
  } finally {
    scene.close();
  }
}

/** A remote-only contact sheet of already captured WebGL pixels, not a new renderer. */
export async function vf2Sheet(shots: { name: string; image: string }[]) {
  const rows = ["smoke-colour", "neutral", "normals", "compact-low"];
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 80 + rows.length * 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Sheet context");
  ctx.fillStyle = "#10161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f4eee5";
  ctx.font = "22px sans-serif";
  ctx.fillText("Connected parent skin", 20, 36);
  ctx.fillText("Radial-sector prototype", 400, 36);
  ctx.fillStyle = "#bbc9d5";
  ctx.font = "15px sans-serif";
  ctx.fillText("Hosted WebGL2 • matched inputs • provisional technical comparison", 20, 63);
  for (let row = 0; row < rows.length; row++)
    for (let column = 0; column < VF2_APPEARANCES.length; column++) {
      const shot = shots.find((s) => s.name === `${rows[row]}-${VF2_APPEARANCES[column]}`);
      if (!shot) throw new Error("Missing contact-sheet source");
      const image = new Image();
      image.src = shot.image;
      await image.decode();
      ctx.fillStyle = "#e2b27f";
      ctx.fillText(rows[row], 20 + column * 380, 102 + row * 400);
      ctx.drawImage(image, 20 + column * 380, 112 + row * 400, 360, 360);
    }
  return canvas.toDataURL("image/png");
}
