import {
  BIPOLAR_CONTACT_GLSL,
  BIPOLAR_SHAPE_GLSL,
  type BipolarPeel,
  bipolarBasis,
  bipolarCoordinates,
  bipolarIndex,
  bipolarLift,
  bipolarParameter,
  bipolarSinCos,
  createBipolarPeels,
} from "./bipolar-peel";
import { SKIN_NORMAL_STEP, type SkinPose } from "./membrane";
import type { RenderBudget } from "./quality";
import { type SkinVector, skinNormalize } from "./skin-domain";
import type { SkinDrawRange, SkinGeometry } from "./skin-geometry";
import type { BodyPoint, SkinStrategy } from "./skin-strategy";

export const BIPOLAR_CAP_START = 0.9;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** C1 width retains a substantial distal cross-section. The cap is a rounded
 * setup-domain boundary, not a v-dependent deformation of the longitudinal map. */
export function bipolarFilmWidth(p: BipolarPeel, u: number) {
  return (p.width / 0.31) * (0.055 + 0.23 * smooth(0, 0.35, u) - 0.16 * smooth(0.65, 1, u));
}
export function bipolarCapUV(theta: number): readonly [number, number] {
  return [BIPOLAR_CAP_START + (1 - BIPOLAR_CAP_START) * Math.cos(theta), Math.sin(theta)];
}
export function bipolarFilmBasis(p: BipolarPeel, u: number, v: number) {
  const { center, tangent, side } = bipolarBasis(p, u, 0),
    width = bipolarFilmWidth(p, u);
  const [s, c] = bipolarSinCos(v * width);
  const material = skinNormalize(
    center.map((x, k) => x * c + side[k] * s) as unknown as SkinVector,
  );
  return { center, tangent, side, material, width };
}
export function bipolarFilmPoint(
  n: SkinVector,
  peels: readonly BipolarPeel[],
  f: SkinPose,
  body: BodyPoint,
  clearance: number,
): SkinVector {
  const i = bipolarIndex(n, peels),
    p = peels[i],
    [u, v] = bipolarCoordinates(n, p);
  const { material, tangent, side, center, width } = bipolarFilmBasis(p, u, v);
  const [height, bend, roll] = bipolarLift(u, v, i, p, f),
    r = f.bodyRadius ?? 1.18;
  const [s, c] = bipolarSinCos(roll),
    transverse = bipolarSinCos(v * width)[0];
  // Shallow outward cupping follows the same C1 lift and trusted motion signals.
  const cup = 0.08 * height * v * v;
  return body(material).map(
    (x, k) =>
      x +
      (k === 1 ? 1.06 : 1) *
        (material[k] * (clearance + r * (height + cup)) +
          r * (tangent[k] * bend + transverse * (side[k] * (c - 1) + center[k] * s))),
  ) as unknown as SkinVector;
}

export function createBipolarFilmGeometry(budget: RenderBudget, seed = 0x5a17): SkinGeometry {
  if (!budget.peels)
    return { vertices: new Float32Array(), indices: new Uint16Array(), ranges: [], boundaries: [] };
  const rows = budget.skinSegments * 3,
    columns = Math.max(6, budget.skinRows),
    capRows = columns / 2;
  const bodyVertices = (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1);
  if (
    budget.peels !== 6 ||
    !Number.isInteger(budget.skinSegments) ||
    rows % 2 ||
    rows < 18 ||
    rows > 96 ||
    !Number.isInteger(budget.skinRows) ||
    budget.skinRows < 4 ||
    budget.skinRows > 24 ||
    columns % 2 ||
    !Number.isFinite(bodyVertices)
  )
    throw new RangeError("rounded bipolar sampling outside setup bounds");
  if (3 * ((rows + 1) * (columns + 1) + capRows * (columns - 1)) + bodyVertices > 20000)
    throw new RangeError("rounded bipolar body/skin exceeds vertex envelope");
  const vertices: number[] = [],
    indices: number[] = [],
    ranges: SkinDrawRange[] = [],
    boundaries: number[][] = [];
  for (const p of createBipolarPeels(seed)) {
    const start = vertices.length / 3,
      at = (r: number, c: number) => start + r * (columns + 1) + c;
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c <= columns; c++)
        vertices.push(
          ...bipolarParameter(
            p,
            BIPOLAR_CAP_START * (1 - Math.cos((Math.PI * r) / rows)) * 0.5,
            (2 * c) / columns - 1,
          ),
        );
    // A polar half-disk shares its complete diameter with the last strip row.
    // Reusing a single endpoint for every ring creates thin fans whose chord
    // normals diverge near curved corners. Radial levels instead share distinct
    // diameter vertices, with only one genuine interior center-fan.
    const caps: number[][] = [Array<number>(columns + 1).fill(at(rows, columns / 2))];
    for (let k = 1; k <= capRows; k++) {
      const radius = k / capRows,
        ring = [at(rows, columns / 2 - k)];
      for (let c = 1; c < columns; c++) {
        const theta = Math.PI * 0.5 * ((2 * c) / columns - 1);
        ring.push(vertices.length / 3);
        vertices.push(
          ...bipolarParameter(
            p,
            BIPOLAR_CAP_START + (1 - BIPOLAR_CAP_START) * radius * Math.cos(theta),
            radius * Math.sin(theta),
          ),
        );
      }
      ring.push(at(rows, columns / 2 + k));
      caps.push(ring);
    }
    boundaries.push([
      ...Array.from({ length: columns }, (_, c) => at(0, c)),
      ...Array.from({ length: rows }, (_, r) => at(r, columns)),
      ...Array.from({ length: columns }, (_, c) => caps[capRows][columns - c]),
      ...Array.from({ length: rows }, (_, r) => at(rows - r, 0)),
    ]);
    for (let half = 0; half < 2; half++) {
      const offset = indices.length;
      for (let r = (half * rows) / 2; r < ((half + 1) * rows) / 2; r++)
        for (let c = 0; c < columns; c++)
          indices.push(
            at(r, c),
            at(r + 1, c),
            at(r, c + 1),
            at(r, c + 1),
            at(r + 1, c),
            at(r + 1, c + 1),
          );
      if (half)
        for (let k = 1; k <= capRows; k++)
          for (let c = 0; c < columns; c++) {
            const a = caps[k - 1][c],
              b = caps[k][c],
              e = caps[k - 1][c + 1],
              d = caps[k][c + 1];
            if (a !== b && a !== e && b !== e) indices.push(a, b, e);
            if (e !== b && e !== d && b !== d) indices.push(e, b, d);
          }
      ranges.push({
        center: bipolarFilmBasis(p, half ? 0.75 : 0.25, 0).material,
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

export const BIPOLAR_FILM_SHAPE_GLSL = `${BIPOLAR_SHAPE_GLSL}
float bipolarFilmWidth(int i,float u) {
  return u_contact_shapes[i].z/.31*(.055+.23*smoothstep(0.,.35,u)-.16*smoothstep(.65,1.,u));
}
void bipolarFilmBasis(int i,vec2 uv,out vec3 material,out vec3 tangent,out vec3 side,out vec3 center) {
  vec3 unused;bipolarBasis(i,vec2(uv.x,0.),unused,tangent,side,center);
  vec2 w=bipolarSC(uv.y*bipolarFilmWidth(i,uv.x));material=normalize(center*w.y+side*w.x);
}
vec3 roundedMaterialDirection(vec3 n) {int i=bipolarIndex(n);vec3 m,t,s,c;bipolarFilmBasis(i,bipolarUV(n,i),m,t,s,c);return m;}
`;
export const BIPOLAR_FILM_SURFACE_GLSL = `
vec3 livingSkinPoint(vec3 n) {
  int i=bipolarIndex(n);vec2 uv=bipolarUV(n,i);vec3 m,t,s,c;bipolarFilmBasis(i,uv,m,t,s,c);
  vec3 delta=bipolarLift(uv,i);vec2 roll=bipolarSC(delta.z);
  float transverse=bipolarSC(uv.y*bipolarFilmWidth(i,uv.x)).x,cup=.08*delta.x*uv.y*uv.y;
  return livingBodyPoint(m,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple)
    +vec3(1.,1.06,1.)*(m*(u_skin_clearance+u_radius*(delta.x+cup))+u_radius*(t*delta.y+transverse*(s*(roll.y-1.)+c*roll.x)));
}
vec3 livingSkinNormal(vec3 n) {
  vec3 a=normalize(cross(abs(n.y)<.9 ? vec3(0.,1.,0.) : vec3(1.,0.,0.),n)),b=cross(n,a);
  vec3 da=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*a))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*a));
  vec3 db=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*b))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*b));
  vec3 normal=cross(da,db);return dot(normal,normal)>1.e-16 ? normalize(normal) : roundedMaterialDirection(n);
}
`;

/** Same bipolar family/descriptors/motion; only the finite chart boundary,
 * cross-section and closed optical contract differ. V-F5 remains selectable. */
export const BIPOLAR_FILM_SKIN: SkinStrategy = Object.freeze({
  id: "bipolar-peels",
  materialSpace: "unit-object-direction",
  materialDirection: "roundedMaterialDirection",
  layering: "nearest-transmission",
  shapeGLSL: BIPOLAR_FILM_SHAPE_GLSL,
  surfaceGLSL: BIPOLAR_FILM_SURFACE_GLSL,
  // The sampled root is u=.18,v=0, unchanged by the width/cap/cup refinement.
  contactGLSL: BIPOLAR_CONTACT_GLSL,
  create(budget: RenderBudget, seed: number) {
    const peels = budget.peels ? createBipolarPeels(seed) : [];
    return {
      geometry: createBipolarFilmGeometry(budget, seed),
      count: peels.length,
      descriptors: {
        centers: new Float32Array(peels.flatMap((p) => [...p.chart, p.pole])),
        tangents: new Float32Array(peels.flatMap((p) => [...p.along, p.length])),
        sides: new Float32Array(peels.flatMap((p) => [...p.across, p.azimuth])),
        shapes: new Float32Array(peels.flatMap((p) => [p.sweep, p.curve, p.width, p.phase])),
      },
    };
  },
  reference(seed: number) {
    const peels = createBipolarPeels(seed);
    return {
      point: (n: SkinVector, f: SkinPose, b: BodyPoint, c: number) =>
        bipolarFilmPoint(n, peels, f, b, c),
    };
  },
});
