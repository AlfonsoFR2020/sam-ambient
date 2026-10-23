import { SKIN_SURFACE_GLSL, type SkinPose } from "./membrane";
import type { RenderBudget } from "./quality";
import { type SkinVector, skinCross, skinDot, skinNormalize } from "./skin-domain";
import type { SkinDrawRange, SkinGeometry } from "./skin-geometry";
import type { BodyPoint, SkinDescriptors, SkinStrategy } from "./skin-strategy";

export interface OrganicPeel {
  readonly center: SkinVector;
  readonly tangent: SkinVector;
  readonly side: SkinVector;
  readonly length: number;
  readonly width: number;
  readonly bend: number;
  readonly height: number;
  readonly phase: number;
}

/** Three unequal positive lobes, each broadly attached over its first third.
 * These are disks on the same living body, not holes in a second spherical coat.
 * Their topological separation is deliberate; the body provides material continuity.
 */
export function createOrganicPeels(seed = 0x5a17): readonly OrganicPeel[] {
  const axis = skinNormalize([0.12, 0.97, 0.2]);
  const east = skinNormalize(skinCross(axis, [0, 0, 1]));
  const north = skinCross(axis, east);
  const seedAngle = ((seed >>> 0) / 0x1_0000_0000) * Math.PI * 2;
  return [0, 1, 2].map((i) => {
    const angle = [0.25, 2.37, 4.55][i] + seedAngle;
    const center = skinNormalize(
      east.map(
        (v, k) =>
          v * Math.cos(angle) + north[k] * Math.sin(angle) + axis[k] * [0.06, -0.12, 0.16][i],
      ) as unknown as SkinVector,
    );
    const meridian = skinNormalize(skinCross(skinCross(center, axis), center));
    const cross = skinCross(center, meridian);
    // Unequal sweeping directions avoid an upright crown of identical leaf tips.
    const tilt = [-0.75, 0.62 + Math.PI, -0.6][i];
    const tangent = meridian.map(
      (v, k) => v * Math.cos(tilt) + cross[k] * Math.sin(tilt),
    ) as unknown as SkinVector;
    return {
      center,
      tangent,
      side: skinCross(center, tangent),
      length: [1.4, 1.24, 1.33][i],
      width: [0.46, 0.42, 0.48][i],
      bend: [0.32, -0.28, 0.25][i],
      height: [0.235, 0.205, 0.25][i],
      phase: angle + i * 0.7,
    };
  });
}

/** Forward/inverse gnomonic chart; original directions remain the pigment domain. */
export function organicPeelDirection(p: OrganicPeel, u: number, v: number): SkinVector {
  const x = p.length * u;
  const y = p.bend * (1 - u * u) + p.width * v * (1 + 0.18 * u);
  return skinNormalize(
    p.center.map((n, k) => n + p.tangent[k] * x + p.side[k] * y) as unknown as SkinVector,
  );
}
export function organicPeelRegion(n: SkinVector, p: OrganicPeel): readonly [number, number] {
  const projection = skinDot(n, p.center);
  if (projection <= 0.35) return [0, 0];
  const u = skinDot(n, p.tangent) / (projection * p.length);
  const v = (skinDot(n, p.side) / projection - p.bend * (1 - u * u)) / (p.width * (1 + 0.18 * u));
  // Outside a lobe, never project its fold onto another lobe or the far hemisphere.
  // .08 is a derivative guard band beyond the real disk boundary, not geometry.
  if (u * u + v * v > 1.08 || Math.abs(u) > 1.04) return [0, 0];
  return [Math.max(0, Math.min(1.04, (u + 0.3) / 1.3)), v];
}
export function organicPeelOffsets(
  q: number,
  v: number,
  p: OrganicPeel,
  f: SkinPose,
): readonly [number, number] {
  const wave = Math.sin(f.travel + p.phase + 1.2 * v);
  const height = (p.height + 0.3 * f.lift) * (1 + 0.16 * wave * (0.6 + 0.4 * f.coherence));
  const shoulder = 1 - 0.18 * v * v;
  // Outward growing bend, no circular rolled lip. Both derivatives vanish at hinge.
  return [height * q * q * shoulder, -0.065 * q * q * q * (1 + 0.12 * wave)];
}
export function organicPeelPoint(
  n: SkinVector,
  peels: readonly OrganicPeel[],
  pose: SkinPose,
  body: BodyPoint,
  clearance: number,
): SkinVector {
  const offset = n.map((v) => v * clearance);
  for (const p of peels) {
    const [q, v] = organicPeelRegion(n, p);
    if (q <= 0) continue;
    const [lift, bend] = organicPeelOffsets(q, v, p, pose);
    const tangent = skinNormalize(
      p.tangent.map((x, k) => x - n[k] * skinDot(n, p.tangent)) as unknown as SkinVector,
    );
    for (let k = 0; k < 3; k++) offset[k] += n[k] * lift + tangent[k] * bend;
  }
  return body(n).map((v, k) => v + offset[k] * (k === 1 ? 1.06 : 1)) as unknown as SkinVector;
}

export function createOrganicPeelGeometry(budget: RenderBudget, seed = 0x5a17): SkinGeometry {
  if (!budget.peels)
    return { vertices: new Float32Array(), indices: new Uint16Array(), ranges: [], boundaries: [] };
  const n = budget.skinSegments * 4,
    rows = Math.max(6, budget.skinRows);
  if (
    budget.peels !== 6 ||
    !Number.isInteger(n) ||
    n < 24 ||
    n > 128 ||
    !Number.isInteger(rows) ||
    rows < 4 ||
    rows > 24
  )
    throw new RangeError("organic peel sampling outside setup bounds");
  const total = 3 * (1 + n * rows);
  if (total + (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1) > 20_000)
    throw new RangeError("organic peels exceed shared vertex envelope");
  const vertices: number[] = [],
    indices: number[] = [],
    boundaries: number[][] = [],
    ranges: SkinDrawRange[] = [];
  for (const p of createOrganicPeels(seed)) {
    const start = vertices.length / 3;
    vertices.push(...organicPeelDirection(p, 0, 0));
    for (let row = 1; row <= rows; row++)
      for (let k = 0; k < n; k++) {
        const theta = (k * Math.PI * 2) / n,
          r = row / rows;
        vertices.push(...organicPeelDirection(p, r * Math.cos(theta), r * Math.sin(theta)));
      }
    const at = (row: number, k: number) => start + 1 + (row - 1) * n + (k % n);
    boundaries.push(Array.from({ length: n }, (_, k) => at(rows, k)));
    for (let half = 0; half < 2; half++) {
      const offset = indices.length;
      for (let k = (half * n) / 2; k < ((half + 1) * n) / 2; k++) {
        indices.push(start, at(1, k), at(1, k + 1));
        for (let row = 1; row < rows; row++) {
          const a = at(row, k),
            b = at(row + 1, k),
            c = at(row, k + 1),
            d = at(row + 1, k + 1);
          indices.push(a, b, c, c, b, d);
        }
      }
      // Two range centers per lobe improve shared back-to-front sorting.
      ranges.push({
        center: organicPeelDirection(p, 0, half === 0 ? 0.45 : -0.45),
        offset: offset * 2,
        count: indices.length - offset,
      });
    }
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    ranges,
    boundaries,
  };
}
export function packOrganicPeels(peels: readonly OrganicPeel[]): SkinDescriptors {
  return {
    centers: new Float32Array(peels.flatMap((p) => [...p.center, p.length])),
    tangents: new Float32Array(peels.flatMap((p) => [...p.tangent, p.width])),
    sides: new Float32Array(peels.flatMap((p) => [...p.side, p.bend])),
    shapes: new Float32Array(peels.flatMap((p) => [p.height, 0, 0, p.phase])),
  };
}
export const ORGANIC_PEEL_SHAPE_GLSL = `
uniform int u_contact_count;
uniform vec4 u_contact_centers[3],u_contact_tangents[3],u_contact_sides[3],u_contact_shapes[3];
uniform vec4 u_contact_pose;
uniform vec2 u_contact_phase;
uniform float u_skin_clearance;
vec2 skinRegion(vec3 n,int i) {
  float projection=dot(n,u_contact_centers[i].xyz);
  if(projection<=.35)return vec2(0.);
  float u=dot(n,u_contact_tangents[i].xyz)/(projection*u_contact_centers[i].w);
  float v=(dot(n,u_contact_sides[i].xyz)/projection-u_contact_sides[i].w*(1.-u*u))/(u_contact_tangents[i].w*(1.+.18*u));
  if(u*u+v*v>1.08 || abs(u)>1.04)return vec2(0.);
  return vec2(clamp((u+.3)/1.3,0.,1.04),v);
}
vec3 skinInward(vec3 n,int i,float v) {
  vec3 t=u_contact_tangents[i].xyz;
  return normalize(t-n*dot(n,t));
}
vec2 skinOffsets(vec2 region,int i) {
  float q=region.x,v=region.y;
  float wave=sin(u_contact_phase.x+u_contact_shapes[i].w+1.2*v);
  float height=(u_contact_shapes[i].x+.3*u_contact_pose.y)*(1.+.16*wave*(.6+.4*u_contact_pose.w));
  return vec2(height*q*q*(1.-.18*v*v),-.065*q*q*q*(1.+.12*wave));
}
`;
export const ORGANIC_PEEL_CONTACT_GLSL = `
#if SAM_FINE_OCTAVES >= 2
${ORGANIC_PEEL_SHAPE_GLSL}
#endif
float livingContactOcclusion(vec3 n) {
  float contact=0.;
#if SAM_FINE_OCTAVES >= 2
  for(int i=0;i<3;i++) {
    if(i>=u_contact_count)break;
    vec2 region=skinRegion(n,i);
    float gap=u_skin_clearance+skinOffsets(region,i).x;
    contact=max(contact,.32*smoothstep(0.,.12,region.x)*exp(-14.*gap));
  }
#endif
  return contact;
}
`;
export const ORGANIC_PEEL_SKIN: SkinStrategy = Object.freeze({
  id: "organic-peels",
  materialSpace: "unit-object-direction",
  shapeGLSL: ORGANIC_PEEL_SHAPE_GLSL,
  surfaceGLSL: SKIN_SURFACE_GLSL,
  contactGLSL: ORGANIC_PEEL_CONTACT_GLSL,
  create(budget: RenderBudget, seed: number) {
    const peels = budget.peels ? createOrganicPeels(seed) : [];
    return {
      geometry: createOrganicPeelGeometry(budget, seed),
      descriptors: packOrganicPeels(peels),
      count: peels.length,
    };
  },
  reference(seed: number) {
    const peels = createOrganicPeels(seed);
    return {
      point: (n: SkinVector, pose: SkinPose, body: BodyPoint, clearance: number) =>
        organicPeelPoint(n, peels, pose, body, clearance),
    };
  },
});
