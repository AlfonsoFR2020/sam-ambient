import { describe, expect, it } from "vitest";
import { resolveOrbAppearance } from "../src/visual-engine/appearance";
import { createParticleGeometry, createSphereGeometry } from "../src/visual-engine/geometry";
import { skinNormal } from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import {
  createOrganicPeelGeometry,
  createOrganicPeels,
  organicPeelDirection,
  organicPeelPoint,
  organicPeelRegion,
} from "../src/visual-engine/organic-peel";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { type SkinVector, skinCross, skinDot } from "../src/visual-engine/skin-domain";
import { VF3_APPEARANCES, VF3_CASES, VF3_PARTICLES, VF3_SMOKE, vf2Frame } from "./fixtures/orb-vf3";
import { analyzeSkin, meshDirection, subtract } from "./fixtures/skin-analysis";
import { frameAt } from "./fixtures/visual-identity-II";

const pose = skinPoseFromFrame(frameAt(0));
describe("V-F3 positive organic peel geometry (CPU)", () => {
  it("holds comparison clocks and bounds the actual hosted matrix", () => {
    expect(VF3_APPEARANCES).toHaveLength(3);
    expect(VF3_CASES).toHaveLength(8);
    expect(VF3_PARTICLES).toHaveLength(4);
    const first = vf2Frame(VF3_SMOKE),
      later = vf2Frame({ ...VF3_SMOKE, curlSeconds: 12 });
    expect(first.peelTravel).not.toBe(later.peelTravel);
    expect({ ...later, peelTravel: first.peelTravel }).toEqual(first);
    expect(VF3_CASES.filter((c) => c.options.neutralMaterial)).toHaveLength(2);
  });
  it("calculates source resource counts without GPU cost claims", () => {
    const counts = Object.values(RENDER_BUDGETS).map((budget) => {
      const skin = createOrganicPeelGeometry(budget),
        body = createSphereGeometry(budget.sphereLongitude, budget.sphereLatitude),
        particles = createParticleGeometry(budget.particles);
      return [
        budget.quality,
        body.vertices.length / 6 + skin.vertices.length / 3,
        (body.indices.length + skin.indices.length) / 3,
        skin.vertices.byteLength +
          skin.indices.byteLength +
          body.vertices.byteLength +
          body.indices.byteLength +
          particles.vertices.byteLength,
      ];
    });
    expect(counts).toEqual([
      ["low", 852, 1464, 26124],
      ["medium", 3856, 7200, 122652],
      ["high", 12996, 25056, 408956],
    ]);
  });
  for (const budget of Object.values(RENDER_BUDGETS)) {
    it(`${budget.quality}: three oriented disks, six ranges, deterministic bounded setup`, () => {
      const mesh = createOrganicPeelGeometry(budget);
      const proof = analyzeSkin(mesh);
      expect(proof).toMatchObject({ components: 3, boundaries: 3, euler: 3, ranges: 6 });
      expect(proof.minOutwardWinding).toBeGreaterThan(0);
      expect(proof.minDoubleArea).toBeGreaterThan(1e-7);
      expect(proof.vertices).toBe(3 * (1 + 4 * budget.skinSegments * budget.skinRows));
      expect(
        proof.vertices + (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1),
      ).toBeLessThan(20_000);
      expect(createOrganicPeelGeometry(budget)).toEqual(mesh);
    });
    it(`${budget.quality}: actual deformed triangles and differential normals stay finite and consistently oriented`, () => {
      const mesh = createOrganicPeelGeometry(budget),
        peels = createOrganicPeels();
      for (const radius of [0.46, 1.18])
        for (const travel of [0, 1.8, Math.PI * 2 - 1e-5, Math.PI * 2 + 1e-5]) {
          const body = (n: SkinVector): SkinVector => [
            n[0] * radius,
            n[1] * radius * 1.06,
            n[2] * radius,
          ];
          const point = (n: SkinVector) =>
            organicPeelPoint(
              n,
              peels,
              { ...pose, travel, lift: 0.075, coherence: 1 },
              body,
              budget.skinClearance,
            );
          const points = Array.from({ length: mesh.vertices.length / 3 }, (_, i) =>
            point(meshDirection(mesh, i)),
          );
          expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
          expect(Math.max(...points.map((p) => Math.hypot(...p)))).toBeLessThan(1.56);
          let area = Infinity,
            agreement = Infinity;
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const [a, b, c] = [0, 1, 2].map((k) => points[mesh.indices[i + k]]);
            const normal = skinCross(subtract(b, a), subtract(c, a));
            area = Math.min(area, Math.hypot(...normal));
            if (i % 189 === 0)
              agreement = Math.min(
                agreement,
                skinDot(normal, skinNormal(meshDirection(mesh, mesh.indices[i]), point)) /
                  Math.hypot(...normal),
              );
          }
          expect(area).toBeGreaterThan(1e-8);
          expect(agreement).toBeGreaterThan(0.65);
        }
    });
  }
  it("has a broad C1 hinge, elongated curved boundary and genuine moving lift", () => {
    for (const p of createOrganicPeels()) {
      expect(p.length / p.width).toBeGreaterThan(1.9);
      for (const v of [-0.5, 0, 0.5]) {
        const at = (u: number, travel = 0) => {
          const n = organicPeelDirection(p, u, v);
          return subtract(
            organicPeelPoint(n, [p], { ...pose, travel }, (n) => n, 0),
            n,
          );
        };
        expect(Math.hypot(...at(-0.3))).toBeLessThan(1e-12);
        expect(Math.hypot(...at(-0.3 + 1e-5))).toBeLessThan(1e-9);
        expect(Math.hypot(...at(0.8))).toBeGreaterThan(0.1);
        expect(Math.hypot(...subtract(at(0.8), at(0.8, 1.8)))).toBeGreaterThan(0.001);
      }
    }
  });
  it("preserves material coordinates, phase wrap, seed identity and default/fallback authority", () => {
    const peels = createOrganicPeels();
    expect(createOrganicPeels(123)).not.toEqual(peels);
    for (const p of peels)
      for (const u of [-0.9, -0.3, 0.4, 0.9]) {
        const n = organicPeelDirection(p, u, 0.15);
        expect(organicPeelRegion(n, p)[0]).toBeCloseTo(Math.max(0, (u + 0.3) / 1.3), 10);
        const point = (travel: number) =>
          organicPeelPoint(n, peels, { ...pose, travel }, (n) => n, 0.004);
        expect(Math.hypot(...subtract(point(0), point(2 * Math.PI)))).toBeLessThan(1e-12);
      }
    expect(resolveOrbAppearance().id).toBe("living-connected");
    expect(resolveOrbAppearance("organic-peel-experimental").material).toBe(
      resolveOrbAppearance().material,
    );
    expect(resolveOrbAppearance("organic-peel-experimental").fallback).toBe("shared-recovery");
    expect(createOrganicPeelGeometry({ ...RENDER_BUDGETS.low, peels: 0 }).indices.length).toBe(0);
    expect(() => createOrganicPeelGeometry({ ...RENDER_BUDGETS.high, skinRows: 99 })).toThrow();
  });
  it("bounds near-field particle alternatives without changing released arrays", () => {
    for (const count of [64, 128, 256]) {
      const near = createParticleGeometry(count, 0x5a17, "near-field");
      expect(near.vertices.byteLength).toBe(count * 32);
      expect(Array.from(near.vertices).every(Number.isFinite)).toBe(true);
      const radii = Array.from({ length: count }, (_, i) => near.vertices[i * 8 + 1]);
      expect(Math.min(...radii)).toBeGreaterThanOrEqual(1.12);
      expect(Math.max(...radii)).toBeLessThan(1.75);
      expect(new Set(radii).size).toBe(count);
    }
    expect(createParticleGeometry(64)).toEqual(createParticleGeometry(64, 0x5a17, "released"));
    expect(() => createParticleGeometry(257)).toThrow();
  });
});
