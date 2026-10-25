import { type SkinVector, skinCross, skinDot } from "../../src/visual-engine/skin-domain";
import { subtract } from "./skin-analysis";

export interface SurfaceTriangle {
  readonly id: number;
  readonly surface: number;
  readonly ids: readonly number[];
  readonly points: readonly SkinVector[];
  readonly uv: readonly (readonly [number, number])[];
}
const add = (a: SkinVector, b: SkinVector, t: number): SkinVector =>
  a.map((x, k) => x + t * b[k]) as unknown as SkinVector;
const length2 = (v: SkinVector) => skinDot(v, v);

/** Exact segment/segment minimum, including parallel and zero-length segments. */
function segmentDistance(a: SkinVector, b: SkinVector, c: SkinVector, d: SkinVector) {
  const u = subtract(b, a),
    v = subtract(d, c),
    w = subtract(a, c);
  const A = length2(u),
    B = skinDot(u, v),
    C = length2(v),
    D = skinDot(u, w),
    E = skinDot(v, w);
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let s = A > 1e-25 ? clamp((B * E - C * D) / Math.max(1e-25, A * C - B * B)) : 0;
  let t = C > 1e-25 ? (B * s + E) / C : 0;
  if (t < 0) {
    t = 0;
    s = A > 1e-25 ? clamp(-D / A) : 0;
  } else if (t > 1) {
    t = 1;
    s = A > 1e-25 ? clamp((B - D) / A) : 0;
  }
  return Math.hypot(...subtract(add(a, u, s), add(c, v, t)));
}
function inside(p: SkinVector, a: SkinVector, b: SkinVector, c: SkinVector) {
  const u = subtract(b, a),
    v = subtract(c, a),
    w = subtract(p, a);
  const A = length2(u),
    B = skinDot(u, v),
    C = length2(v),
    D = skinDot(w, u),
    E = skinDot(w, v);
  const det = A * C - B * B;
  if (det < 1e-25) return false;
  const s = (C * D - B * E) / det,
    t = (A * E - B * D) / det;
  return s >= -1e-9 && t >= -1e-9 && s + t <= 1 + 1e-9;
}
function pointTriangle(p: SkinVector, tri: readonly SkinVector[]) {
  const [a, b, c] = tri,
    normal = skinCross(subtract(b, a), subtract(c, a));
  const n2 = length2(normal);
  if (n2 > 1e-25) {
    const h = skinDot(subtract(p, a), normal) / n2;
    if (inside(add(p, normal, -h), a, b, c)) return Math.abs(h) * Math.sqrt(n2);
  }
  return Math.min(...tri.map((a, i) => segmentDistance(p, p, a, tri[(i + 1) % 3])));
}
function pierces(a: SkinVector, b: SkinVector, tri: readonly SkinVector[]) {
  const [p, q, r] = tri,
    normal = skinCross(subtract(q, p), subtract(r, p));
  const da = skinDot(subtract(a, p), normal),
    db = skinDot(subtract(b, p), normal);
  if (da * db > 0 || Math.abs(da - db) < 1e-22) return false;
  const t = da / (da - db);
  return t >= 0 && t <= 1 && inside(add(a, subtract(b, a), t), p, q, r);
}
/** Full triangle distance: edge/face piercing, projected vertex/face and all
 * edge/edge minima. Coplanar overlaps are caught by zero point/edge distance.
 */
export function triangleDistance(a: readonly SkinVector[], b: readonly SkinVector[]) {
  for (let i = 0; i < 3; i++)
    if (pierces(a[i], a[(i + 1) % 3], b) || pierces(b[i], b[(i + 1) % 3], a)) return 0;
  let distance = Math.min(
    ...a.map((p) => pointTriangle(p, b)),
    ...b.map((p) => pointTriangle(p, a)),
  );
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      distance = Math.min(distance, segmentDistance(a[i], a[(i + 1) % 3], b[j], b[(j + 1) % 3]));
  return distance;
}

/** Offline sweep broad phase, never imported by the renderer. Includes every
 * triangle, not a centerline sample. AABB distance culls exact narrow-phase work.
 * Shared tessellation vertices are legitimate contact, not self intersections.
 * Self near-contact excludes only local UV neighbors; all nonadjacent self
 * intersections are still tested. Stores bounded witnesses, not an unbounded log.
 */
export function surfaceClearance(triangles: readonly SurfaceTriangle[], threshold: number) {
  const bounds = triangles
    .map((t) => ({
      t,
      lo: [0, 1, 2].map((k) => Math.min(...t.points.map((p) => p[k]))),
      hi: [0, 1, 2].map((k) => Math.max(...t.points.map((p) => p[k]))),
    }))
    .sort((a, b) => a.lo[0] - b.lo[0]);
  const pairs = new Map<
    string,
    { surfaces: number[]; intersections: number; near: number; minimum: number; witness: unknown }
  >();
  let tested = 0;
  for (let i = 0; i < bounds.length; i++) {
    const a = bounds[i];
    for (let j = i + 1; j < bounds.length && bounds[j].lo[0] <= a.hi[0] + threshold; j++) {
      const b = bounds[j],
        same = a.t.surface === b.t.surface;
      if (same && a.t.ids.some((id) => b.t.ids.includes(id))) continue;
      const local =
        same &&
        a.t.uv.some(([t, v]) =>
          b.t.uv.some(([u, w]) => Math.abs(t - u) < 0.09 && Math.abs(v - w) < 0.3),
        );
      const limit = local ? 1e-8 : threshold;
      const gap2 = [0, 1, 2].reduce(
        (s, k) => s + Math.max(0, a.lo[k] - b.hi[k], b.lo[k] - a.hi[k]) ** 2,
        0,
      );
      if (gap2 > limit * limit) continue;
      tested++;
      const d = triangleDistance(a.t.points, b.t.points);
      if (local && d > 1e-8) continue;
      const surfaces = [a.t.surface, b.t.surface].sort(),
        key = surfaces.join(":");
      const entry = pairs.get(key) ?? {
        surfaces,
        intersections: 0,
        near: 0,
        minimum: threshold,
        witness: null,
      };
      if (d <= 1e-8) entry.intersections++;
      else if (d < threshold) entry.near++;
      if (d < entry.minimum) {
        entry.minimum = d;
        entry.witness = [a.t, b.t].map((t) => ({
          surface: t.surface,
          triangle: t.id,
          uv: t.uv,
          points: t.points,
        }));
      }
      pairs.set(key, entry);
    }
  }
  return { threshold, tested, triangles: triangles.length, pairs: [...pairs.values()] };
}
