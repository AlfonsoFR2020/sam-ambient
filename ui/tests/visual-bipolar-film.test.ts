import { describe, expect, it } from "vitest";
import { resolveOrbAppearance } from "../src/visual-engine/appearance";
import {
  BIPOLAR_CAP_START,
  bipolarCapUV,
  bipolarFilmBasis,
  bipolarFilmPoint,
  bipolarFilmWidth,
  createBipolarFilmGeometry,
} from "../src/visual-engine/bipolar-film";
import {
  bipolarCoordinates,
  bipolarParameter,
  createBipolarPeels,
} from "../src/visual-engine/bipolar-peel";
import { createParticleGeometry, createSphereGeometry } from "../src/visual-engine/geometry";
import { skinNormal } from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  type SkinVector,
  skinCross,
  skinDot,
  skinNormalize,
} from "../src/visual-engine/skin-domain";
import { analyzeSkin, meshDirection, subtract } from "./fixtures/skin-analysis";
import {
  bipolarFilmGPUProofDirections,
  bipolarGPUProofDirections,
} from "./fixtures/skin-gpu-proof";
import { frameAt } from "./fixtures/visual-identity-II";

const peels = createBipolarPeels(),
  pose = skinPoseFromFrame(frameAt(0));
describe("V-F6 finite rounded bipolar boundaries", () => {
  it("adds actual free-boundary/shoulder proof samples without deleting old difficult coordinates", () => {
    const samples = bipolarFilmGPUProofDirections();
    expect(samples).toHaveLength(117);
    expect(samples.slice(0, 60)).toEqual(bipolarGPUProofDirections());
  });
  it("preserves previous strategies and explicitly selects one bounded transmission variant", () => {
    expect(resolveOrbAppearance().id).toBe("living-connected");
    expect(resolveOrbAppearance("bipolar-peel-experimental").skin.layering).toBe("opaque-depth");
    const a = resolveOrbAppearance("bipolar-film-experimental");
    expect(a.skin.layering).toBe("nearest-transmission");
    expect(a.material).toBe(resolveOrbAppearance().material);
    expect(a.skin.materialDirection).toBe("roundedMaterialDirection");
  });
  it("has nonzero broad distal width, C1 width shoulders and a tangent rounded cap", () => {
    for (const p of peels) {
      expect(bipolarFilmWidth(p, 1)).toBeGreaterThan(0.11);
      for (const u of [0, 0.35, 0.65, 1]) {
        const e = 1e-6,
          left = (bipolarFilmWidth(p, u) - bipolarFilmWidth(p, u - e)) / e,
          right = (bipolarFilmWidth(p, u + e) - bipolarFilmWidth(p, u)) / e;
        expect(Math.abs(left - right)).toBeLessThan(0.0001);
      }
      for (const sign of [-1, 1]) {
        const theta = (sign * Math.PI) / 2,
          [u, v] = bipolarCapUV(theta);
        expect(u).toBeCloseTo(BIPOLAR_CAP_START, 12);
        expect(v).toBe(sign);
        const map = (uv: readonly [number, number]) =>
          bipolarFilmPoint(bipolarParameter(p, ...uv), peels, pose, (n) => n, 0.004);
        const e = 1e-5,
          curve = skinNormalize(
            subtract(map(bipolarCapUV(theta + e)), map(bipolarCapUV(theta - e))),
          );
        const side = skinNormalize(subtract(map([u + e, v]), map([u - e, v])));
        expect(Math.abs(skinDot(curve, side))).toBeGreaterThan(0.999999);
      }
    }
  });
  for (const budget of Object.values(RENDER_BUDGETS)) {
    it(`${budget.quality}: three oriented disks with finite smooth cap boundaries and six complete ranges`, () => {
      const mesh = createBipolarFilmGeometry(budget),
        p = analyzeSkin(mesh);
      expect(p).toMatchObject({ components: 3, boundaries: 3, euler: 3, ranges: 6 });
      expect(p.minDoubleArea).toBeGreaterThan(1e-7);
      expect(p.minOutwardWinding).toBeGreaterThan(0);
      expect(createBipolarFilmGeometry(budget)).toEqual(mesh);
      for (let i = 0; i < 3; i++) {
        const cap = mesh.boundaries[i]
          .map((k) => bipolarCoordinates(meshDirection(mesh, k), peels[i]))
          .filter(([u]) => u > BIPOLAR_CAP_START + 1e-6);
        expect(cap.length).toBeGreaterThanOrEqual(5);
        for (const [u, v] of cap)
          expect(((u - BIPOLAR_CAP_START) / (1 - BIPOLAR_CAP_START)) ** 2 + v * v).toBeCloseTo(
            1,
            5,
          );
      }
      expect(p.vertices).toBe({ low: 444, medium: 1083, high: 4083 }[budget.quality]);
      expect(p.triangles).toBe({ low: 738, medium: 1896, high: 7632 }[budget.quality]);
    });
    it(`${budget.quality}: all triangles retain the existing area/normal guards at compact, speech and wraps`, () => {
      const mesh = createBipolarFilmGeometry(budget);
      for (const radius of [0.46, 1.18])
        for (const travel of [0, 1.7, 2 * Math.PI - 1e-5, 2 * Math.PI + 1e-5]) {
          const body = (n: SkinVector): SkinVector => [
            n[0] * radius,
            n[1] * radius * 1.06,
            n[2] * radius,
          ];
          const point = (n: SkinVector) =>
            bipolarFilmPoint(
              n,
              peels,
              { ...pose, bodyRadius: radius, travel, speech: 1, work: 1 },
              body,
              budget.skinClearance,
            );
          const points = Array.from({ length: mesh.vertices.length / 3 }, (_, k) =>
            point(meshDirection(mesh, k)),
          );
          expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
          expect(Math.max(...points.map((p) => Math.hypot(...p)))).toBeLessThan(
            radius * 1.65 + 0.03,
          );
          let area = Infinity,
            agreement = Infinity;
          for (let k = 0; k < mesh.indices.length; k += 3) {
            const ids = Array.from(mesh.indices.slice(k, k + 3)),
              [a, b, c] = ids.map((i) => points[i]),
              normal = skinCross(subtract(b, a), subtract(c, a));
            const n = skinNormalize(
              ids
                .map((i) => meshDirection(mesh, i))
                .reduce((a, b) => a.map((x, j) => x + b[j]) as unknown as SkinVector, [
                  0, 0, 0,
                ] as SkinVector),
            );
            area = Math.min(area, Math.hypot(...normal));
            const alignment = skinDot(normal, skinNormal(n, point)) / Math.hypot(...normal);
            if (alignment < 0.8)
              throw new Error(
                JSON.stringify({
                  quality: budget.quality,
                  radius,
                  travel,
                  triangle: k / 3,
                  alignment,
                }),
              );
            agreement = Math.min(agreement, alignment);
          }
          expect(area).toBeGreaterThan(1e-8);
          expect(agreement).toBeGreaterThan(0.8);
        }
    });
  }
  it("retains C1 body attachment and the same material direction before lift", () => {
    for (const p of peels)
      for (const u of [0, 0.04, 0.08])
        for (const v of [-1, 0, 1]) {
          const n = bipolarParameter(p, u, v),
            m = bipolarFilmBasis(p, u, v).material;
          const point = bipolarFilmPoint(n, peels, pose, (n) => n, 0);
          expect(Math.hypot(...subtract(point, m))).toBeLessThan(1e-12);
        }
  });
  it("records bounded setup cost and rejects unsupported sampling before allocation", () => {
    const resources = Object.values(RENDER_BUDGETS).map((b) => {
      const skin = createBipolarFilmGeometry(b),
        body = createSphereGeometry(b.sphereLongitude, b.sphereLatitude),
        particles = createParticleGeometry(b.particles);
      return [
        b.quality,
        skin.vertices.length / 3 + body.vertices.length / 6,
        skin.vertices.byteLength +
          skin.indices.byteLength +
          body.vertices.byteLength +
          body.indices.byteLength +
          particles.vertices.byteLength,
      ];
    });
    expect(resources).toEqual([
      ["low", 1005, 29364],
      ["medium", 3784, 120204],
      ["high", 12468, 394844],
    ]);
    expect(createBipolarFilmGeometry({ ...RENDER_BUDGETS.high, peels: 0 }).vertices.length).toBe(0);
    for (const skinSegments of [NaN, 7, 20 / 3, 100])
      expect(() => createBipolarFilmGeometry({ ...RENDER_BUDGETS.high, skinSegments })).toThrow();
    expect(() => createBipolarFilmGeometry({ ...RENDER_BUDGETS.high, skinRows: 9 })).toThrow();
  });
});
