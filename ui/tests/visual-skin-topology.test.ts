import { describe, expect, it } from "vitest";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import {
  createSkinOpenings,
  packSkinOpenings,
  SKIN_VERTEX_STRIDE,
  type SkinVector,
  skinCross,
  skinDot,
} from "../src/visual-engine/skin-domain";
import { createSkinGeometry } from "../src/visual-engine/skin-geometry";

describe("connected parent skin topology (experimental)", () => {
  for (const budget of Object.values(RENDER_BUDGETS)) {
    it(`${budget.quality}: one orientable component with exactly three opening boundaries`, () => {
      const mesh = createSkinGeometry(budget);
      const count = mesh.vertices.length / SKIN_VERTEX_STRIDE;
      const edges = new Map<string, { count: number; orientation: number }>();
      const neighbors = Array.from({ length: count }, () => new Set<number>());
      const point = (v: number): SkinVector => [
        mesh.vertices[v * 3],
        mesh.vertices[v * 3 + 1],
        mesh.vertices[v * 3 + 2],
      ];
      const minus = (a: SkinVector, b: SkinVector): SkinVector => [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2],
      ];
      expect(Array.from(mesh.vertices).every(Number.isFinite)).toBe(true);
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const triangle = Array.from(mesh.indices.slice(i, i + 3));
        expect(new Set(triangle).size).toBe(3);
        for (const v of triangle) expect(v).toBeLessThan(count);
        const [a, b, c] = triangle.map(point);
        const normal = skinCross(minus(b, a), minus(c, a));
        expect(Math.hypot(...normal)).toBeGreaterThan(1e-7);
        expect(skinDot(normal, a)).toBeGreaterThan(0);
        for (let j = 0; j < 3; j++) {
          const a = triangle[j],
            b = triangle[(j + 1) % 3];
          const key = [Math.min(a, b), Math.max(a, b)].join(",");
          const edge = edges.get(key) ?? { count: 0, orientation: 0 };
          edge.count++;
          edge.orientation += a < b ? 1 : -1;
          edges.set(key, edge);
          neighbors[a].add(b);
          neighbors[b].add(a);
        }
      }
      const visited = new Set<number>([0]),
        pending = [0];
      while (pending.length)
        for (const v of neighbors[pending.pop() as number])
          if (!visited.has(v)) {
            visited.add(v);
            pending.push(v);
          }
      expect(visited.size).toBe(count);
      const boundaryKeys = new Set<string>();
      expect(mesh.boundaries).toHaveLength(3);
      for (const loop of mesh.boundaries) {
        expect(new Set(loop).size).toBe(loop.length);
        for (let i = 0; i < loop.length; i++)
          boundaryKeys.add([loop[i], loop[(i + 1) % loop.length]].sort((a, b) => a - b).join(","));
      }
      for (const [key, edge] of edges) {
        expect(edge.count).toBe(boundaryKeys.has(key) ? 1 : 2);
        if (edge.count === 2) expect(edge.orientation).toBe(0);
      }
      expect([...edges.values()].filter((e) => e.count === 1)).toHaveLength(boundaryKeys.size);
      expect(count - edges.size + mesh.indices.length / 3).toBe(-1);
      expect(count).toBe(24 * budget.skinSegments * budget.skinRows - 1);
      expect(mesh.indices.length / 3).toBe(4 * budget.skinSegments * (12 * budget.skinRows - 3));
      expect(mesh.ranges.reduce((sum, r) => sum + r.count, 0)).toBe(mesh.indices.length);
      expect(mesh.ranges[0].offset).toBe(0);
      for (let i = 1; i < mesh.ranges.length; i++)
        expect(mesh.ranges[i].offset).toBe(
          mesh.ranges[i - 1].offset + mesh.ranges[i - 1].count * 2,
        );
    });
  }
  it("keeps seed and opening topology identical across tiers", () => {
    const p = createSkinOpenings();
    for (const budget of Object.values(RENDER_BUDGETS)) {
      expect(createSkinOpenings()).toEqual(p);
      expect(createSkinGeometry(budget)).toEqual(createSkinGeometry(budget));
    }
    expect(createSkinOpenings(42)).not.toEqual(p);
    const packed = packSkinOpenings(p);
    expect(Object.values(packed).reduce((sum, a) => sum + a.byteLength, 0)).toBe(192);
    expect(packed.centers[3]).toBeCloseTo(p[0].radius);
    expect(packed.tangents[3]).toBeCloseTo(p[0].x);
    expect(packed.sides[3]).toBeCloseTo(p[0].y);
    expect(Array.from(packed.shapes.slice(0, 4))).toEqual(
      [p[0].collar, p[0].height, p[0].curl, p[0].phase].map(Math.fround),
    );
    for (const seed of [0, 1, 42, 0xffff_ffff])
      expect(createSkinGeometry(RENDER_BUDGETS.low, seed).vertices.length / 3).toBe(575);
    expect(createSkinGeometry({ ...RENDER_BUDGETS.low, peels: 0 }).indices.length).toBe(0);
    expect(() => createSkinGeometry({ ...RENDER_BUDGETS.high, skinRows: 100 })).toThrow(RangeError);
    expect(() =>
      createSkinGeometry({ ...RENDER_BUDGETS.high, skinRows: 24, skinSegments: 32 }),
    ).toThrow(/vertex envelope/);
  });
});
