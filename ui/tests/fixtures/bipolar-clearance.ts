import * as candidate from "../../src/visual-engine/bipolar-peel";
import type { SkinPose } from "../../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../../src/visual-engine/membrane-optics";
import { RENDER_BUDGETS, type ResolvedQuality } from "../../src/visual-engine/quality";
import type { SkinVector } from "../../src/visual-engine/skin-domain";
import * as baseline from "./bipolar-vf4-baseline";
import { vf4SequenceFrames } from "./orb-vf4";
import { meshDirection } from "./skin-analysis";
import { type SurfaceTriangle, surfaceClearance } from "./triangle-clearance";
import { frameAt } from "./visual-identity-II";

type GeometryAPI = Pick<
  typeof candidate,
  "createBipolarPeels" | "createBipolarGeometry" | "bipolarPeelPoint" | "bipolarCoordinates"
>;
export function bipolarTriangles(
  api: GeometryAPI,
  pose: SkinPose,
  quality: ResolvedQuality = "high",
) {
  const budget = RENDER_BUDGETS[quality],
    mesh = api.createBipolarGeometry(budget),
    peels = api.createBipolarPeels();
  const radius = pose.bodyRadius ?? 1.18;
  // Same independently specified controlled deformed body as transform feedback.
  // This is not a CPU reimplementation of the full procedural living-body field.
  const body = (n: SkinVector): SkinVector => {
    const r =
      radius +
      0.006 * Math.sin(0.7) +
      0.007 * 0.08 * n[2] +
      0.003 * 0.04 * Math.sin(1.2 + 3 * n[0]);
    return [r * n[0], 1.06 * r * n[1], r * n[2]];
  };
  const directions = Array.from({ length: mesh.vertices.length / 3 }, (_, i) =>
    meshDirection(mesh, i),
  );
  const points = directions.map((n) =>
    api.bipolarPeelPoint(n, peels, pose, body, budget.skinClearance),
  );
  const perSurface = mesh.indices.length / 9,
    triangles: SurfaceTriangle[] = [];
  for (let k = 0; k < mesh.indices.length; k += 3) {
    const surface = Math.floor(k / 3 / perSurface),
      ids = Array.from(mesh.indices.slice(k, k + 3));
    triangles.push({
      id: k / 3,
      surface,
      ids,
      points: ids.map((i) => points[i]),
      uv: ids.map((i) => api.bipolarCoordinates(directions[i], peels[surface])),
    });
  }
  return triangles;
}
export function clearancePoses() {
  const base = skinPoseFromFrame(frameAt(0));
  return [
    ...[0, 1.7, 3.4, 6.2831852].map((travel) => ({
      name: `idle-${travel}`,
      pose: { ...base, travel },
    })),
    ...vf4SequenceFrames()
      .filter((s) =>
        [
          "loading",
          "thinking",
          "speech-late",
          "speech-quiet",
          "speech-silence",
          "speech-return",
          "interrupt-onset",
          "departure",
        ].includes(s.name),
      )
      .map((s) => ({ name: s.name, pose: skinPoseFromFrame(s.frame) })),
    {
      name: "extreme-compact",
      pose: { ...base, bodyRadius: 0.46, travel: 2.1, speech: 1, work: 1, preparation: 1 },
    },
    {
      name: "extreme-settling",
      pose: { ...base, travel: 4.8, speech: 1, work: 1, settling: 1, rephase: 1 },
    },
  ];
}
export function bipolarClearanceReport(
  version: "vf4" | "candidate",
  quality: ResolvedQuality = "medium",
  names?: readonly string[],
) {
  const api = version === "vf4" ? baseline : candidate;
  return clearancePoses()
    .filter((p) => !names || names.includes(p.name))
    .map(({ name, pose }) => ({
      name,
      pose,
      quality,
      ...surfaceClearance(
        bipolarTriangles(api, pose, quality),
        (0.025 * (pose.bodyRadius ?? 1.18)) / 1.18,
      ),
    }));
}
