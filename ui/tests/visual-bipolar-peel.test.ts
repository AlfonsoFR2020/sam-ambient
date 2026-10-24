import { describe, expect, it } from "vitest";
import { resolveOrbAppearance } from "../src/visual-engine/appearance";
import {
  bipolarBasis,
  bipolarCoordinates,
  bipolarIndex,
  bipolarLift,
  bipolarParameter,
  bipolarPeelPoint,
  bipolarSinCos,
  createBipolarGeometry,
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
import { appearanceShaderSources } from "../src/visual-engine/webgl";
import { VF4_APPEARANCES, VF4_CASES, vf4SequenceFrames } from "./fixtures/orb-vf4";
import { analyzeSkin, meshDirection, subtract } from "./fixtures/skin-analysis";
import { bipolarGPUProofDirections } from "./fixtures/skin-gpu-proof";
import { frameAt } from "./fixtures/visual-identity-II";

const pose = skinPoseFromFrame(frameAt(0));
const peels = createBipolarPeels();
describe("V-F4 bipolar trajectory geometry", () => {
  it("covers actual roots and free boundaries and matched long-sequence conditions", () => {
    const directions = bipolarGPUProofDirections();
    expect(directions).toHaveLength(60);
    for (let i = 0; i < 3; i++)
      for (const k of [0, 3, 16, 19]) {
        const [t, v] = bipolarCoordinates(directions[i * 20 + k], peels[i]);
        expect(t).toBeCloseTo(k < 16 ? 0 : 1, 10);
        expect(Math.abs(v)).toBeCloseTo(1, 10);
      }
    expect(VF4_APPEARANCES).toEqual([
      "living-connected",
      "organic-peel-experimental",
      "bipolar-peel-experimental",
    ]);
    expect(VF4_CASES.filter((c) => c.options.pitch)).toHaveLength(2);
    const sequence = vf4SequenceFrames();
    expect(sequence.find((s) => s.name === "loading")?.frame.providerLoading).toBeGreaterThan(0.9);
    expect(
      sequence.find((s) => s.name === "speech-late")?.frame.reactivity.outputPulse,
    ).toBeGreaterThan(0.05);
    expect(
      sequence.find((s) => s.name === "speech-silence")?.frame.reactivity.outputPulse,
    ).toBeLessThan(0.001);
    expect(sequence.find((s) => s.name === "unloading")?.frame.providerSettling).toBeGreaterThan(
      0.9,
    );
    expect(sequence.at(-1)?.timeMs).toBe(33000);
  });
  it("has unequal opposing polar paths and unambiguous atlas coordinates", () => {
    expect(peels.map((p) => p.pole)).toEqual([1, -1, 1]);
    expect(createBipolarPeels(123)).not.toEqual(peels);
    for (const [i, p] of peels.entries())
      for (const t of [0, 0.08, 0.5, 1])
        for (const v of [-1, 0, 1]) {
          const n = bipolarParameter(p, t, v),
            uv = bipolarCoordinates(n, p);
          expect(bipolarIndex(n, peels)).toBe(i);
          expect(uv[0]).toBeCloseTo(t, 12);
          expect(uv[1]).toBeCloseTo(v, 12);
          const material = bipolarBasis(p, t, v).material;
          expect(Math.hypot(...material)).toBeCloseTo(1, 12);
          if (t === 0) expect(material[1] * p.pole).toBeGreaterThan(0.97);
        }
    expect(peels[0].sweep * peels[2].sweep).toBeLessThan(0);
  });
  it("retains the existing default and maps only the new atlas into shared pigment", () => {
    const a = resolveOrbAppearance("bipolar-peel-experimental");
    expect(a.material).toBe(resolveOrbAppearance().material);
    expect(resolveOrbAppearance().id).toBe("living-connected");
    expect(a.skin.materialDirection).toBe("bipolarMaterialDirection");
    expect(appearanceShaderSources(a.id).skinVertex).toContain(
      "v_object_direction=bipolarMaterialDirection(direction)",
    );
    expect(a.fallback).toBe("shared-recovery");
  });
  it("has projected crossings between opposing polar paths rather than three parallel strips", () => {
    const points = peels.map((p) =>
      Array.from({ length: 121 }, (_, j) => {
        const t = 0.2 + (0.8 * j) / 120;
        return { t, n: bipolarBasis(p, t, 0).material };
      }),
    );
    for (const i of [1, 2]) {
      let closest = { dot: -1, t: 0, u: 0 };
      for (const a of points[0])
        for (const b of points[i]) {
          const dot = skinDot(a.n, b.n);
          if (dot > closest.dot) closest = { dot, t: a.t, u: b.t };
        }
      expect(closest.dot).toBeGreaterThan(0.9998);
      const a = bipolarPeelPoint(
        bipolarParameter(peels[0], closest.t, 0),
        peels,
        pose,
        (n) => n,
        0,
      );
      const b = bipolarPeelPoint(
        bipolarParameter(peels[i], closest.u, 0),
        peels,
        pose,
        (n) => n,
        0,
      );
      expect(Math.hypot(...subtract(a, b))).toBeGreaterThan(0.001);
    }
    // This proves local projected crossings with distinct lifted positions at
    // this pose, not collision-free surfaces or correct translucent sorting.
  });
  it("bounds the independent trigonometric series without replacing the strict GPU guard", () => {
    let error = 0;
    for (let i = 0; i <= 1000; i++) {
      const angle = -40 + i * 0.08,
        [s, c] = bipolarSinCos(angle);
      error = Math.max(
        error,
        Math.abs(s - Math.sin(angle)),
        Math.abs(c - Math.cos(angle)),
        Math.abs(s * s + c * c - 1),
      );
    }
    expect(error).toBeLessThan(3e-7);
  });
  it("has a C1 root, positive idle lift, bounded twist and seamless phase wrap", () => {
    for (const [i, p] of peels.entries())
      for (const v of [-1, 0, 1]) {
        const at = (t: number, travel = 0) => bipolarLift(t, v, i, p, { ...pose, travel });
        expect(Math.hypot(...at(0.08))).toBe(0);
        expect(Math.hypot(...at(0.08001))).toBeLessThan(1e-9);
        for (const t of [0.2, 0.5, 1])
          for (const travel of [0, 1.7, 3.4, 6.28]) {
            expect(at(t, travel)[0]).toBeGreaterThan(0);
            const before = at(t, 2 * Math.PI - 1e-6),
              after = at(t, 2 * Math.PI + 1e-6);
            expect(Math.hypot(...subtract(before, after))).toBeLessThan(1e-6);
          }
        const n = bipolarParameter(p, 0.04, v),
          material = bipolarBasis(p, 0.04, v).material;
        expect(
          Math.hypot(
            ...subtract(
              bipolarPeelPoint(n, peels, pose, (n) => n, 0),
              material,
            ),
          ),
        ).toBeLessThan(1e-12);
      }
  });
  for (const budget of Object.values(RENDER_BUDGETS)) {
    it(`${budget.quality}: oriented manifold disks, complete ranges, stable setup and resource envelope`, () => {
      const mesh = createBipolarGeometry(budget),
        proof = analyzeSkin(mesh);
      expect(proof).toMatchObject({ components: 3, boundaries: 3, euler: 3, ranges: 6 });
      expect(proof.minOutwardWinding).toBeGreaterThan(0);
      expect(proof.minDoubleArea).toBeGreaterThan(1e-7);
      expect(createBipolarGeometry(budget)).toEqual(mesh);
      expect(
        proof.vertices + (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1),
      ).toBeLessThan(20000);
      const setup = resolveOrbAppearance("bipolar-peel-experimental").skin.create(budget, 0x5a17);
      expect(Object.values(setup.descriptors).map((a) => a.length)).toEqual([12, 12, 12, 12]);
      expect(setup.count).toBe(3);
    });
    it(`${budget.quality}: all deformed triangles remain finite, nondegenerate and agree with sampled normals`, () => {
      const mesh = createBipolarGeometry(budget);
      for (const radius of [0.46, 1.18])
        for (const travel of [0, 1.7, 2 * Math.PI - 1e-5, 2 * Math.PI + 1e-5]) {
          const body = (n: SkinVector): SkinVector => [
            n[0] * radius,
            n[1] * radius * 1.06,
            n[2] * radius,
          ];
          const point = (n: SkinVector) =>
            bipolarPeelPoint(
              n,
              peels,
              { ...pose, bodyRadius: radius, travel, speech: 1, work: 1 },
              body,
              budget.skinClearance,
            );
          const points = Array.from({ length: mesh.vertices.length / 3 }, (_, i) =>
            point(meshDirection(mesh, i)),
          );
          expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
          expect(Math.max(...points.map((p) => Math.hypot(...p)))).toBeLessThan(
            radius * 1.65 + 0.03,
          );
          let area = Infinity,
            agreement = Infinity;
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]],
              [a, b, c] = ids.map((k) => points[k]);
            const normal = skinCross(subtract(b, a), subtract(c, a));
            area = Math.min(area, Math.hypot(...normal));
            {
              const n = skinNormalize(
                ids
                  .map((k) => meshDirection(mesh, k))
                  .reduce((a, b) => a.map((v, k) => v + b[k]) as unknown as SkinVector, [
                    0, 0, 0,
                  ] as SkinVector),
              );
              const alignment = skinDot(normal, skinNormal(n, point)) / Math.hypot(...normal);
              if (alignment < 0.8)
                throw new Error(
                  JSON.stringify({
                    radius,
                    travel,
                    triangle: i / 3,
                    alignment,
                    uv: ids.map((id) => {
                      const p = peels[bipolarIndex(meshDirection(mesh, id), peels)];
                      return bipolarCoordinates(meshDirection(mesh, id), p);
                    }),
                  }),
                );
              agreement = Math.min(agreement, alignment);
            }
          }
          expect(area).toBeGreaterThan(1e-8);
          expect(agreement).toBeGreaterThan(0.8);
        }
    });
  }
  it("rejects malformed sampling before allocation and retains zero-peel recovery", () => {
    expect(createBipolarGeometry({ ...RENDER_BUDGETS.high, peels: 0 }).vertices.length).toBe(0);
    for (const skinSegments of [NaN, 7, 20 / 3, 100])
      expect(() => createBipolarGeometry({ ...RENDER_BUDGETS.high, skinSegments })).toThrow();
    expect(() => createBipolarGeometry({ ...RENDER_BUDGETS.high, skinRows: 2.5 })).toThrow();
  });
  it("records exact geometry resources independently of GPU performance", () => {
    const counts = Object.values(RENDER_BUDGETS).map((b) => {
      const skin = createBipolarGeometry(b),
        body = createSphereGeometry(b.sphereLongitude, b.sphereLatitude),
        particles = createParticleGeometry(b.particles);
      return [
        b.quality,
        skin.vertices.length / 3,
        skin.indices.length / 3,
        body.vertices.length / 6 + skin.vertices.length / 3,
        skin.vertices.byteLength +
          skin.indices.byteLength +
          body.vertices.byteLength +
          body.indices.byteLength +
          particles.vertices.byteLength,
      ];
    });
    expect(counts).toEqual([
      ["low", 399, 648, 960, 28284],
      ["medium", 999, 1728, 3700, 118188],
      ["high", 3723, 6912, 12108, 386204],
    ]);
  });
});
