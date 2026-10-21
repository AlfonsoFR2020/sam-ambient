import type { IndexedGeometry } from "./geometry";
import type { RenderBudget } from "./quality";
import { createSkinFaces, createSkinOpenings, skinNormalize, skinRimRadius,
  type SkinVector, SKIN_VERTEX_STRIDE } from "./skin-domain";

export interface SkinDrawRange {
  readonly center: SkinVector;
  readonly offset: number; // bytes, not index elements
  readonly count: number;
}
export interface SkinGeometry extends IndexedGeometry {
  readonly ranges: readonly SkinDrawRange[];
  readonly boundaries: readonly (readonly number[])[];
}

/** A sphere with three disks removed. All chart boundaries share actual indices.
 * Closed charts end in a nondegenerate center fan; open charts end at the rim.
 * No clipping, discarded whole cells, per-frame rebuild or transparent fake holes.
 */
export function createSkinGeometry(budget: RenderBudget, seed = 0x5a17): SkinGeometry {
  if (!budget.peels) return { vertices: new Float32Array(), indices: new Uint16Array(), ranges: [], boundaries: [] };
  const n = budget.skinSegments, rows = budget.skinRows, perimeter = 4 * n;
  if (!Number.isInteger(n) || n < 4 || n > 32 || !Number.isInteger(rows) || rows < 3 || rows > 24)
    throw new RangeError("connected skin sampling exceeds setup bounds");
  const faces = createSkinFaces(seed), openings = createSkinOpenings(seed);
  const vertices: number[] = [], indices: number[] = [], ranges: SkinDrawRange[] = [];
  const boundaries: number[][] = [];
  const welded = new Map<string, number>();
  const vertex = (cube: SkinVector): number => {
    // Same edge samples on neighboring charts; quantization only welds roundoff.
    const key = cube.map((v) => Math.round(v * 1e9)).join(",");
    const previous = welded.get(key);
    if (previous !== undefined) return previous;
    const index = vertices.length / SKIN_VERTEX_STRIDE;
    welded.set(key, index);
    vertices.push(...skinNormalize(cube));
    return index;
  };
  for (let face = 0; face < faces.length; face++) {
    const chart = faces[face], opening = openings.find((p) => p.face === face);
    const point = (x: number, y: number) => vertex(chart.center.map((v, i) =>
      v + chart.tangent[i] * x + chart.side[i] * y) as unknown as SkinVector);
    const rings: number[][] = [];
    const start = indices.length;
    for (let row = opening ? 0 : 1; row <= rows; row++) {
      const ring: number[] = [];
      for (let k = 0; k < perimeter; k++) {
        const side = Math.floor(k / n), t = Math.tan(((k % n) / n - 0.5) * Math.PI / 2);
        const [sx, sy] = [[1, t], [-t, 1], [-1, -t], [t, -1]][side];
        if (row === rows) { ring.push(point(sx, sy)); continue; }
        const cx = opening?.x ?? 0, cy = opening?.y ?? 0;
        const theta = Math.atan2(sy - cy, sx - cx), outer = Math.hypot(sx - cx, sy - cy);
        const inner = opening ? skinRimRadius(opening, theta) : 0;
        const radius = inner + (outer - inner) * row / rows;
        ring.push(point(cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius));
      }
      rings.push(ring);
    }
    if (opening) boundaries.push(rings[0]);
    else {
      const center = point(0, 0);
      for (let k = 0; k < perimeter; k++) indices.push(center, rings[0][k], rings[0][(k + 1) % perimeter]);
    }
    for (let r = 0; r < rings.length - 1; r++)
      for (let k = 0; k < perimeter; k++) {
        const next = (k + 1) % perimeter;
        const a = rings[r][k], b = rings[r + 1][k], c = rings[r][next], d = rings[r + 1][next];
        indices.push(a, b, c, c, b, d);
      }
    ranges.push({ center: chart.center, offset: start * 2, count: indices.length - start });
  }
  if (vertices.length / SKIN_VERTEX_STRIDE >= 65536) throw new RangeError("skin index overflow");
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices), ranges, boundaries };
}
