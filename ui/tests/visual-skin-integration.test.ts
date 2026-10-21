import { describe, expect, it } from "vitest";
import {
  MEMBRANE_SHAPE_GLSL,
  SKIN_SURFACE_GLSL,
  type SkinPose,
  skinNormal,
  skinPoint,
} from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  createSkinOpenings,
  packSkinOpenings,
  type SkinVector,
  skinCross,
  skinDot,
  skinNormalize,
} from "../src/visual-engine/skin-domain";
import { createSkinGeometry } from "../src/visual-engine/skin-geometry";
import { ORB_FRAGMENT, PEEL_VERTEX } from "../src/visual-engine/webgl";
import { frameAt } from "./fixtures/visual-identity-II";

const subtract = (a: SkinVector, b: SkinVector): SkinVector => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const openings = createSkinOpenings(0x5a17);
const poses: SkinPose[] = [
  skinPoseFromFrame(frameAt(0)),
  skinPoseFromFrame(frameAt(1200, "listening", 0.12)),
  skinPoseFromFrame(frameAt(1200, "thinking")),
  { ...skinPoseFromFrame(frameAt(1200, "speaking", 0.65)), lift: 0.075, rephase: 0.12 },
];

describe("integrated skin source and CPU geometry proof (no GPU)", () => {
  it("keeps sampled triangle orientation consistent with the surface differential in compact and active poses", () => {
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const mesh = createSkinGeometry(budget, 0x5a17);
      const directions: SkinVector[] = [];
      for (let i = 0; i < mesh.vertices.length; i += 3)
        directions.push(
          skinNormalize([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]),
        );
      for (const radius of [0.46, 0.83, 1.18])
        for (const pose of poses) {
          // Controlled displaced spheroid, not a claim about the executed production body shader.
          const body = (n: SkinVector): SkinVector => {
            const r = radius + 0.006 * Math.sin(3 * n[0] + pose.travel) + 0.007 * n[2];
            return [n[0] * r, n[1] * r * 1.06, n[2] * r];
          };
          const point = (n: SkinVector) => skinPoint(n, openings, pose, body, budget.skinClearance);
          const points = directions.map(point);
          // Bounded sampling spans all chart partitions and rings, in addition to the exhaustive rest-topology gate.
          for (let index = 0; index < mesh.indices.length; index += 3 * 11) {
            const ids = Array.from(mesh.indices.slice(index, index + 3));
            const [a, b, c] = ids.map((id) => points[id]);
            const triangleNormal = skinNormalize(skinCross(subtract(b, a), subtract(c, a)));
            const center = skinNormalize(
              [0, 1, 2].map((axis) =>
                ids.reduce((sum, id) => sum + directions[id][axis], 0),
              ) as unknown as SkinVector,
            );
            expect(
              skinDot(triangleNormal, skinNormal(center, point)),
              `${budget.quality} radius ${radius} triangle ${index / 3}`,
            ).toBeGreaterThan(0);
          }
        }
    }
  });
  it("bounds descriptor float32 quantization for points and full-surface normals", () => {
    const packed = packSkinOpenings(openings);
    const quantized = openings.map((p, i) => ({
      ...p,
      center: Array.from(packed.centers.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      tangent: Array.from(packed.tangents.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      side: Array.from(packed.sides.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      radius: packed.centers[i * 4 + 3],
      x: packed.tangents[i * 4 + 3],
      y: packed.sides[i * 4 + 3],
      collar: packed.shapes[i * 4],
      height: packed.shapes[i * 4 + 1],
      curl: packed.shapes[i * 4 + 2],
      phase: packed.shapes[i * 4 + 3],
    }));
    const mesh = createSkinGeometry(RENDER_BUDGETS.low);
    for (const pose of poses)
      for (let i = 0; i < mesh.vertices.length; i += 3 * 7) {
        const n: SkinVector = [mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]];
        const body = (d: SkinVector): SkinVector => [d[0] * 0.46, d[1] * 0.46 * 1.06, d[2] * 0.46];
        const exact = (d: SkinVector) => skinPoint(d, openings, pose, body, 0.016);
        const rounded = (d: SkinVector) => skinPoint(d, quantized, pose, body, 0.016);
        expect(Math.hypot(...subtract(exact(n), rounded(n)))).toBeLessThan(1e-4);
        expect(Math.hypot(...subtract(skinNormal(n, exact), skinNormal(n, rounded)))).toBeLessThan(
          0.005,
        );
      }
  });
  it("shares the same coat equations and descriptor interface in vertex and High contact sources", () => {
    for (const source of [PEEL_VERTEX, ORB_FRAGMENT]) {
      expect(source).toContain(MEMBRANE_SHAPE_GLSL);
      expect(source.match(/uniform vec4 u_contact_shapes\[3\]/g)).toHaveLength(1);
    }
    expect(PEEL_VERTEX).toContain(SKIN_SURFACE_GLSL);
    expect(PEEL_VERTEX).toContain("invariant gl_Position;");
    // GLSL compilation and transform feedback remain separate, unauthorized gates.
  });
});
