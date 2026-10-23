import { type SkinVector, skinCross, skinDot } from "../../src/visual-engine/skin-domain";
import type { SkinGeometry } from "../../src/visual-engine/skin-geometry";

export const meshDirection = (mesh: SkinGeometry, index: number): SkinVector => [
  mesh.vertices[index * 3],
  mesh.vertices[index * 3 + 1],
  mesh.vertices[index * 3 + 2],
];
export const subtract = (a: SkinVector, b: SkinVector): SkinVector => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const key = (a: number, b: number) => `${Math.min(a, b)},${Math.max(a, b)}`;

/** Exhaustive indexed topology proof, shared by CPU tests and the evidence report. */
export function analyzeSkin(mesh: SkinGeometry) {
  const vertices = mesh.vertices.length / 3,
    triangles = mesh.indices.length / 3;
  if (!Number.isInteger(vertices) || !Number.isInteger(triangles) || !vertices)
    throw new Error("Invalid nonempty skin layout");
  if (!Array.from(mesh.vertices).every(Number.isFinite)) throw new Error("Nonfinite vertex");
  const edges = new Map<string, { count: number; orientation: number }>();
  const neighbors = Array.from({ length: vertices }, () => new Set<number>());
  let minDoubleArea = Infinity,
    minOutwardWinding = Infinity;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const ids = [mesh.indices[i], mesh.indices[i + 1], mesh.indices[i + 2]];
    if (new Set(ids).size !== 3 || ids.some((id) => id >= vertices))
      throw new Error("Invalid triangle index");
    const [a, b, c] = ids.map((id) => meshDirection(mesh, id));
    const normal = skinCross(subtract(b, a), subtract(c, a));
    minDoubleArea = Math.min(minDoubleArea, Math.hypot(...normal));
    minOutwardWinding = Math.min(minOutwardWinding, skinDot(normal, a));
    for (let j = 0; j < 3; j++) {
      const a = ids[j],
        b = ids[(j + 1) % 3],
        edgeKey = key(a, b);
      const edge = edges.get(edgeKey) ?? { count: 0, orientation: 0 };
      edge.count++;
      edge.orientation += a < b ? 1 : -1;
      edges.set(edgeKey, edge);
      neighbors[a].add(b);
      neighbors[b].add(a);
    }
  }
  const visited = new Set<number>();
  let components = 0;
  for (let i = 0; i < vertices; i++) {
    if (visited.has(i)) continue;
    components++;
    const pending = [i];
    visited.add(i);
    while (pending.length)
      for (const next of neighbors[pending.pop() as number])
        if (!visited.has(next)) {
          visited.add(next);
          pending.push(next);
        }
  }
  const boundaryEdges = new Set<string>();
  const boundaryVertices = new Set<number>();
  for (const loop of mesh.boundaries) {
    if (new Set(loop).size !== loop.length || loop.length < 3)
      throw new Error("Invalid boundary loop");
    for (let i = 0; i < loop.length; i++) {
      if (boundaryVertices.has(loop[i])) throw new Error("Boundary loops intersect");
      boundaryVertices.add(loop[i]);
      boundaryEdges.add(key(loop[i], loop[(i + 1) % loop.length]));
    }
  }
  for (const [edgeKey, edge] of edges)
    if (
      edge.count !== (boundaryEdges.has(edgeKey) ? 1 : 2) ||
      (edge.count === 2 && edge.orientation !== 0)
    )
      throw new Error("Unexpected seam, nonmanifold edge or inverted adjacency");
  if (Array.from(edges.values()).filter((e) => e.count === 1).length !== boundaryEdges.size)
    throw new Error("Boundary descriptor mismatch");
  let offset = 0;
  for (const range of mesh.ranges) {
    if (range.offset !== offset * 2 || range.count <= 0 || range.count % 3)
      throw new Error("Invalid draw partition");
    offset += range.count;
  }
  if (offset !== mesh.indices.length) throw new Error("Missing draw partition");
  return {
    vertices,
    triangles,
    components,
    boundaries: mesh.boundaries.length,
    boundaryEdges: boundaryEdges.size,
    euler: vertices - edges.size + triangles,
    minDoubleArea,
    minOutwardWinding,
    geometryBytes: mesh.vertices.byteLength + mesh.indices.byteLength,
    ranges: mesh.ranges.length,
  };
}
