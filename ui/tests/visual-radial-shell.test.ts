import { describe, expect, it } from "vitest";
import { DEFAULT_ORB_APPEARANCE, RADIAL_SHELL_APPEARANCE } from "../src/visual-engine/appearance";
import { createParticleGeometry, createSphereGeometry } from "../src/visual-engine/geometry";
import { MEMBRANE_RADIUS_BOUND, type SkinPose, skinNormal } from "../src/visual-engine/membrane";
import { skinPoseFromFrame } from "../src/visual-engine/membrane-optics";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  RADIAL_SHELL_SHAPE_GLSL,
  radialShellContact,
  radialShellOffsets,
  radialShellPoint,
} from "../src/visual-engine/radial-shell";
import {
  createRadialShellFrame,
  createRadialShellWindows,
  packRadialShellWindows,
  RADIAL_ATTACHED_LATITUDE,
  RADIAL_SECTOR_CUTS,
  radialShellDirection,
  radialShellRegion,
  radialShellRim,
} from "../src/visual-engine/radial-shell-domain";
import { createRadialShellGeometry } from "../src/visual-engine/radial-shell-geometry";
import {
  type SkinVector,
  skinCross,
  skinDot,
  skinNormalize,
} from "../src/visual-engine/skin-domain";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { appearanceShaderSources } from "../src/visual-engine/webgl";
import { analyzeSkin, meshDirection, subtract } from "./fixtures/skin-analysis";
import { frameAt, visualInput } from "./fixtures/visual-identity-II";

const windows = createRadialShellWindows();
const rest = skinPoseFromFrame(frameAt(0));
const extreme: SkinPose = {
  ...rest,
  lift: 0.075,
  width: 1.15,
  coherence: 1,
  rephase: 0.12,
  work: 1,
  speech: 1,
};
const poses = [
  rest,
  ...(["listening", "thinking", "speaking", "interrupted"] as const).map((state) =>
    skinPoseFromFrame(frameAt(800, state, 0.5)),
  ),
  extreme,
];
const near = (a: SkinVector, b: SkinVector) => Math.hypot(...subtract(a, b));

describe("experimental connected radial sectors (CPU, no shader execution)", () => {
  for (const budget of Object.values(RENDER_BUDGETS)) {
    it(`${budget.quality}: exhaustively validates connected topology, outward rest winding and welded polar seams`, () => {
      const mesh = createRadialShellGeometry(budget),
        proof = analyzeSkin(mesh);
      expect(proof).toMatchObject({
        components: 1,
        boundaries: 3,
        euler: -1,
        ranges: 6,
        vertices: 20 * budget.skinSegments * budget.skinRows - 1,
        triangles: 4 * budget.skinSegments * (10 * budget.skinRows - 3),
        boundaryEdges: 12 * budget.skinSegments,
      });
      expect(proof.minDoubleArea).toBeGreaterThan(1e-7);
      expect(proof.minOutwardWinding).toBeGreaterThan(0);
      for (let i = 0; i < proof.vertices; i++)
        expect(Math.hypot(...meshDirection(mesh, i))).toBeCloseTo(1, 6);
    });
    it(`${budget.quality}: all deformed triangles stay nondegenerate; sampled differential normals agree through compact/active poses`, () => {
      const mesh = createRadialShellGeometry(budget);
      for (const radius of [0.46, 0.83, 1.18])
        for (const pose of poses) {
          const body = (n: SkinVector): SkinVector => {
            const r = radius + 0.006 * Math.sin(3 * n[0] + pose.travel) + 0.007 * n[2];
            return [n[0] * r, n[1] * r * 1.06, n[2] * r];
          };
          const point = (n: SkinVector) =>
            radialShellPoint(n, windows, pose, body, budget.skinClearance);
          const points = Array.from({ length: mesh.vertices.length / 3 }, (_, i) =>
            point(meshDirection(mesh, i)),
          );
          // Exhaustive data checks, aggregated to avoid hundreds of thousands of
          // assertion allocations (the original High case timed out in hosted CI).
          expect(points.every((p) => p.every(Number.isFinite))).toBe(true);
          expect(
            points.reduce((maximum, p) => Math.max(maximum, Math.hypot(...p)), 0),
          ).toBeLessThan(MEMBRANE_RADIUS_BOUND);
          let area = Infinity,
            agreement = Infinity,
            finiteNormals = true,
            unitError = 0;
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
            const [a, b, c] = ids.map((id) => points[id]);
            const normal = skinCross(subtract(b, a), subtract(c, a));
            area = Math.min(area, Math.hypot(...normal));
            if ((i / 3) % 31 === 0) {
              const n = skinNormalize(
                [0, 1, 2].map((axis) =>
                  ids.reduce((sum, id) => sum + meshDirection(mesh, id)[axis], 0),
                ) as unknown as SkinVector,
              );
              const differential = skinNormal(n, point);
              finiteNormals &&= differential.every(Number.isFinite);
              unitError = Math.max(unitError, Math.abs(Math.hypot(...differential) - 1));
              agreement = Math.min(agreement, skinDot(skinNormalize(normal), differential));
            }
          }
          expect(area, `${budget.quality} radius ${radius}`).toBeGreaterThan(1e-8);
          expect(agreement, `${budget.quality} radius ${radius}`).toBeGreaterThan(0);
          expect(finiteNormals).toBe(true);
          expect(unitError).toBeLessThan(0.5e-6);
        }
    });
    it(`${budget.quality}: exact free rims and broad attached sectors share object-space pigment coordinates`, () => {
      const mesh = createRadialShellGeometry(budget);
      mesh.boundaries.forEach((loop, index) => {
        for (const id of loop)
          expect(radialShellRegion(meshDirection(mesh, id), windows[index]).q).toBeCloseTo(1, 5);
      });
      const p = createRadialShellFrame();
      for (const latitude of [-1.4, 1.4]) {
        const n = radialShellDirection(p, 0.2, latitude);
        expect(windows.every((w) => radialShellRegion(n, w).q === 0)).toBe(true);
      }
      expect(RADIAL_SHELL_APPEARANCE.material).toBe(DEFAULT_ORB_APPEARANCE.material);
      const shader = appearanceShaderSources("radial-shell-experimental");
      expect(shader.skinVertex).toContain("v_object_direction=direction;");
      expect(shader.skinVertex).not.toContain("v_object_direction=position;");
      expect(shader.skinFragment).toBe(appearanceShaderSources().skinFragment);
    });
  }
  it("is deterministic, continuous at longitude seams and bounded before allocation", () => {
    for (const seed of [0, 1, 42, 0x5a17, 0xffff_ffff]) {
      const a = createRadialShellGeometry(RENDER_BUDGETS.low, seed);
      expect(a).toEqual(createRadialShellGeometry(RENDER_BUDGETS.low, seed));
      expect(analyzeSkin(a).components).toBe(1);
    }
    expect(createRadialShellGeometry(RENDER_BUDGETS.low, 42).vertices).not.toEqual(
      createRadialShellGeometry(RENDER_BUDGETS.low).vertices,
    );
    for (const pose of poses) {
      const frame = createRadialShellFrame(),
        body = (n: SkinVector) => n;
      const point = (angle: number) =>
        radialShellPoint(radialShellDirection(frame, angle, 0.3), windows, pose, body, 0.004);
      expect(near(point(-Math.PI), point(Math.PI))).toBeLessThan(1e-12);
    }
    expect(createRadialShellGeometry({ ...RENDER_BUDGETS.low, peels: 0 }).indices).toHaveLength(0);
    for (const change of [
      { skinRows: 3 },
      { skinRows: 5 },
      { skinRows: 26 },
      { skinSegments: 0 },
      { peels: 7 },
      { skinSegments: 32, skinRows: 24 },
    ])
      expect(() => createRadialShellGeometry({ ...RENDER_BUDGETS.high, ...change })).toThrow(
        RangeError,
      );
  });
  it("keeps sector/collar supports disjoint and inside their connected chart backbone", () => {
    for (const p of windows)
      for (let theta = 0; theta < Math.PI * 2; theta += 0.05) {
        const radius = radialShellRim(p, theta)[0] + p.collar;
        const azimuth = p.azimuth + radius * Math.cos(theta),
          latitude = p.latitude + radius * Math.sin(theta);
        expect(azimuth).toBeGreaterThan(RADIAL_SECTOR_CUTS[p.patch]);
        expect(azimuth).toBeLessThan(RADIAL_SECTOR_CUTS[p.patch + 1]);
        expect(Math.abs(latitude)).toBeLessThan(RADIAL_ATTACHED_LATITUDE);
        const n = radialShellDirection(p, azimuth, latitude);
        expect(windows.filter((w) => w !== p).every((w) => radialShellRegion(n, w).q === 0)).toBe(
          true,
        );
      }
  });
  it("has C1 resting hinges, smooth free-edge extensions, correct angular derivatives and outward finite rim normals", () => {
    const h = 1e-5;
    for (const p of windows)
      for (let theta = 0; theta < 2 * Math.PI; theta += 0.23) {
        const [rim, derivative] = radialShellRim(p, theta);
        expect(derivative).toBeCloseTo(
          (radialShellRim(p, theta + h)[0] - radialShellRim(p, theta - h)[0]) / (2 * h),
          6,
        );
        const direction = (q: number) =>
          radialShellDirection(
            p,
            p.azimuth + (rim + (1 - q) * p.collar) * Math.cos(theta),
            p.latitude + (rim + (1 - q) * p.collar) * Math.sin(theta),
          );
        for (const pose of [rest, extreme]) {
          const body = (n: SkinVector): SkinVector => [
            n[0] * 0.46,
            n[1] * 0.46 * 1.06,
            n[2] * 0.46,
          ];
          const point = (n: SkinVector) => radialShellPoint(n, windows, pose, body, 0.004);
          expect(radialShellOffsets(0, theta, p, pose)).toEqual([0, 0]);
          expect(Math.hypot(...radialShellOffsets(h, theta, p, pose)) / h).toBeLessThan(1e-4);
          const hinge = direction(0),
            base = body(hinge).map(
              (v, i) => v + hinge[i] * 0.004 * (i === 1 ? 1.06 : 1),
            ) as unknown as SkinVector;
          expect(near(point(hinge), base)).toBeLessThan(1e-12);
          expect(
            near(skinNormal(direction(-h), point), skinNormal(direction(h), point)),
          ).toBeLessThan(0.002);
          expect(
            near(skinNormal(direction(1 - h), point), skinNormal(direction(1 + h), point)),
          ).toBeLessThan(0.002);
          const rimDirection = direction(1),
            normal = skinNormal(rimDirection, point);
          expect(
            skinDot(normal, rimDirection),
            `window ${p.patch}, theta ${theta}, lift ${pose.lift}`,
          ).toBeGreaterThan(0);
          expect(radialShellOffsets(1, theta, p, pose)[1]).toBeLessThan(0);
        }
      }
  });
  it("preserves periodic position/time derivatives and actual nonuniform flex", () => {
    for (const p of windows) {
      const heights: number[] = [];
      for (const theta of [0, 0.75, 1.6])
        for (const travel of [0, 1.8, 3.6]) {
          const offset = (t: number, a: number) =>
            radialShellOffsets(0.9, a, p, { ...extreme, travel: t });
          const first = offset(travel, theta),
            last = offset(travel + 2 * Math.PI, theta + 2 * Math.PI);
          expect(Math.hypot(first[0] - last[0], first[1] - last[1])).toBeLessThan(1e-12);
          const h = 1e-4;
          const derivative = (t: number) =>
            offset(t + h, theta).map((v, i) => (v - offset(t - h, theta)[i]) / (2 * h));
          const firstDerivative = derivative(travel),
            lastDerivative = derivative(travel + 2 * Math.PI);
          expect(
            Math.hypot(
              firstDerivative[0] - lastDerivative[0],
              firstDerivative[1] - lastDerivative[1],
            ),
          ).toBeLessThan(1e-8);
          heights.push(first[0]);
        }
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.01);
    }
  });
  it("keeps sampled compact free-rim normals outward across seeds and the full wrapped clock", () => {
    for (const seed of [0, 42, 0xffff_ffff]) {
      const layout = createRadialShellWindows(seed);
      for (const travel of [
        0,
        Math.PI / 2,
        Math.PI,
        Math.PI * 1.5,
        Math.PI * 2 - 1e-5,
        Math.PI * 2 + 1e-5,
      ]) {
        const pose = { ...extreme, opening: 0, travel };
        const body = (n: SkinVector): SkinVector => [n[0] * 0.46, n[1] * 0.46 * 1.06, n[2] * 0.46];
        const point = (n: SkinVector) => radialShellPoint(n, layout, pose, body, 0.004);
        let minimum = Infinity;
        for (const p of layout)
          for (let theta = 0; theta < Math.PI * 2; theta += 0.2) {
            const r = radialShellRim(p, theta)[0];
            const n = radialShellDirection(
              p,
              p.azimuth + r * Math.cos(theta),
              p.latitude + r * Math.sin(theta),
            );
            minimum = Math.min(minimum, skinDot(skinNormal(n, point), n));
          }
        expect(minimum, `seed ${seed}, travel ${travel}`).toBeGreaterThan(0);
      }
    }
  });
  it("packs only 192 descriptor bytes and bounds float32 position/normal differences", () => {
    const packed = packRadialShellWindows(windows);
    expect(Object.values(packed).reduce((sum, a) => sum + a.byteLength, 0)).toBe(192);
    const rounded = windows.map((p, i) => ({
      ...p,
      axis: Array.from(packed.centers.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      equator: Array.from(packed.tangents.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      side: Array.from(packed.sides.slice(i * 4, i * 4 + 3)) as unknown as SkinVector,
      halfAzimuth: packed.centers[i * 4 + 3],
      azimuth: packed.tangents[i * 4 + 3],
      latitude: packed.sides[i * 4 + 3],
      halfLatitude: packed.shapes[i * 4],
      collar: packed.shapes[i * 4 + 1],
      height: packed.shapes[i * 4 + 2],
      phase: packed.shapes[i * 4 + 3],
    }));
    const mesh = createRadialShellGeometry(RENDER_BUDGETS.low);
    for (let i = 0; i < mesh.vertices.length / 3; i += 7) {
      const n = meshDirection(mesh, i),
        body = (d: SkinVector): SkinVector => [d[0] * 0.46, d[1] * 0.46 * 1.06, d[2] * 0.46];
      const a = (d: SkinVector) => radialShellPoint(d, windows, extreme, body, 0.016);
      const b = (d: SkinVector) => radialShellPoint(d, rounded, extreme, body, 0.016);
      expect(near(a(n), b(n))).toBeLessThan(1e-4);
      expect(near(skinNormal(n, a), skinNormal(n, b))).toBeLessThan(0.005);
    }
    const source = appearanceShaderSources("radial-shell-experimental");
    for (const code of [source.skinVertex, source.orbFragment]) {
      expect(code).toContain(RADIAL_SHELL_SHAPE_GLSL);
      expect(code.match(/uniform vec4 u_contact_shapes\[3\]/g)).toHaveLength(1);
    }
    expect(source.orbFragment).toContain("u_contact_shapes[i].y*max(.8,u_radius)");
  });
  it("bounds actual geometry arrays, draw counts, particles and contact without expanding tier identities", () => {
    const expected = {
      low: [1040, 1848, 30684],
      medium: [4620, 8736, 141036],
      high: [16064, 31200, 482636],
    };
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const mesh = createRadialShellGeometry(budget),
        body = createSphereGeometry(budget.sphereLongitude, budget.sphereLatitude);
      const particles = createParticleGeometry(budget.particles);
      expect(mesh.vertices.length / 3 + body.vertices.length / 6).toBeLessThan(20_000);
      const bytes =
        mesh.vertices.byteLength +
        mesh.indices.byteLength +
        body.vertices.byteLength +
        body.indices.byteLength +
        particles.vertices.byteLength;
      expect([
        mesh.vertices.length / 3 + body.vertices.length / 6,
        (mesh.indices.length + body.indices.length) / 3,
        bytes,
      ]).toEqual(expected[budget.quality]);
      expect(bytes + 44 + (budget.membraneDepthPass ? 448 : 224)).toBeLessThan(1.5 * 1024 * 1024);
      expect(3 + mesh.ranges.length + Number(budget.membraneDepthPass)).toBe(
        budget.quality === "high" ? 10 : 9,
      );
      for (const loop of mesh.boundaries)
        for (const id of loop) {
          const n = meshDirection(mesh, id);
          for (const p of windows) {
            const contact = radialShellContact(n, p, extreme, 0.46, budget.skinClearance);
            expect(contact).toBeGreaterThanOrEqual(0);
            expect(contact).toBeLessThanOrEqual(0.38);
          }
        }
    }
  });
  it("keeps zero audio reactivity neutral while autonomous membrane motion remains real", () => {
    const mesh = createRadialShellGeometry(RENDER_BUDGETS.low),
      reference = RADIAL_SHELL_APPEARANCE.skin.reference(0x5a17);
    const loud = skinPoseFromFrame(frameAt(800, "speaking", 0.5, 0)),
      silent = skinPoseFromFrame(frameAt(800, "speaking", 0, 0));
    const original = mesh.vertices.slice();
    for (const id of mesh.boundaries[0]) {
      const n = meshDirection(mesh, id);
      expect(reference.point(n, loud, (d) => d, 0.004)).toEqual(
        reference.point(n, silent, (d) => d, 0.004),
      );
    }
    expect(mesh.vertices).toEqual(original);
  });
  it("uses the existing independent membrane clock and freezes it under Reduced Motion", () => {
    const motion = new MotionEvaluator(0x5a17),
      settings = {
        ...DEFAULT_VISUAL_ENGINE_SETTINGS,
        surfaceFlow: 0,
        reducedMotion: "off" as const,
      };
    const initial = { ...motion.evaluate(visualInput(0), 0, settings, RENDER_BUDGETS.high) };
    for (let t = 20; t <= 4000; t += 20)
      motion.evaluate(visualInput(t), t, settings, RENDER_BUDGETS.high);
    const moving = { ...motion.currentFrame };
    expect(moving.fieldPhase1).toBe(initial.fieldPhase1);
    expect(moving.fieldPhase2).toBe(initial.fieldPhase2);
    expect(moving.peelTravel).not.toBe(initial.peelTravel);
    const p = windows[0],
      r = radialShellRim(p, 0.75)[0],
      n = radialShellDirection(p, p.azimuth + r * Math.cos(0.75), p.latitude + r * Math.sin(0.75));
    expect(
      near(
        radialShellPoint(n, windows, skinPoseFromFrame(initial), (d) => d, 0.004),
        radialShellPoint(n, windows, skinPoseFromFrame(moving), (d) => d, 0.004),
      ),
    ).toBeGreaterThan(1e-5);
    for (let t = 4020; t <= 8000; t += 20)
      motion.evaluate(visualInput(t), t, { ...settings, reducedMotion: "on" }, RENDER_BUDGETS.high);
    expect(motion.currentFrame.peelTravel).toBe(moving.peelTravel);
  });
});
