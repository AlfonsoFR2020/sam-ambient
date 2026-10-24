import { SKIN_NORMAL_STEP, type SkinPose } from "./membrane";
import type { RenderBudget } from "./quality";
import { type SkinVector, skinCross, skinDot, skinNormalize } from "./skin-domain";
import type { SkinGeometry } from "./skin-geometry";
import type { BodyPoint, SkinStrategy } from "./skin-strategy";

export interface BipolarPeel {
  readonly chart: SkinVector;
  readonly along: SkinVector;
  readonly across: SkinVector;
  readonly pole: number;
  readonly length: number;
  readonly azimuth: number;
  readonly sweep: number;
  readonly curve: number;
  readonly width: number;
  readonly phase: number;
}

/** Three unequal polar trajectories, not three local patches. Two north roots
 * counter-sweep; the south root travels between them. Disjoint parameter charts
 * allow physical overlap without one peel accidentally acquiring another's fold.
 */
export function createBipolarPeels(seed = 0x5a17): readonly BipolarPeel[] {
  const turn = ((seed >>> 0) / 0x1_0000_0000) * Math.PI * 2;
  return [0, 1, 2].map((i) => {
    const a = (i * Math.PI * 2) / 3;
    const chart: SkinVector = [Math.cos(a), 0, Math.sin(a)];
    const along: SkinVector = [0, 1, 0];
    return {
      chart,
      along,
      across: skinCross(chart, along),
      pole: [1, -1, 1][i],
      length: [2.42, 2.65, 2.18][i],
      azimuth: [-0.5, -0.3, 2.4][i] + turn,
      sweep: [1.8, 2.5, -1.35][i],
      curve: [0.3, -0.25, 0.6][i],
      width: [0.31, 0.27, 0.34][i],
      phase: [0.2, 2.6, 4.4][i],
    };
  });
}
/** Packed unit-direction atlas uses the existing vec3/Uint16 buffers. These are
 * parameter directions only; material is explicitly mapped back to the body.
 */
export function bipolarParameter(p: BipolarPeel, t: number, v: number): SkinVector {
  return skinNormalize(
    p.chart.map(
      (c, k) => c + p.along[k] * 0.4 * (2 * t - 1) + p.across[k] * 0.35 * v,
    ) as unknown as SkinVector,
  );
}
export function bipolarCoordinates(n: SkinVector, p: BipolarPeel): readonly [number, number] {
  const d = skinDot(n, p.chart);
  return [(skinDot(n, p.along) / d / 0.4 + 1) * 0.5, skinDot(n, p.across) / d / 0.35];
}
export function bipolarIndex(n: SkinVector, peels: readonly BipolarPeel[]): number {
  let index = 0;
  for (let i = 1; i < peels.length; i++)
    if (skinDot(n, peels[i].chart) > skinDot(n, peels[index].chart)) index = i;
  return index;
}
/** Fixed range-reduced series avoid the measured nonunit hosted sin/cos pair.
 * Degree 17/16 on [-pi,pi]; tested independently against native trig.
 */
export function bipolarSinCos(angle: number): readonly [number, number] {
  const x = angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI)),
    z = x * x;
  return [
    x *
      (1 +
        z *
          (-1 / 6 +
            z *
              (1 / 120 +
                z *
                  (-1 / 5040 +
                    z *
                      (1 / 362880 +
                        z *
                          (-1 / 39916800 +
                            z *
                              (1 / 6227020800 +
                                z * (-1 / 1307674368000 + z / 355687428096000)))))))),
    1 +
      z *
        (-1 / 2 +
          z *
            (1 / 24 +
              z *
                (-1 / 720 +
                  z *
                    (1 / 40320 +
                      z *
                        (-1 / 3628800 +
                          z * (1 / 479001600 + z * (-1 / 87178291200 + z / 20922789888000))))))),
  ];
}
export function bipolarBasis(p: BipolarPeel, t: number, v: number) {
  const path = t;
  const [s, c] = bipolarSinCos(0.17 + p.length * path);
  const [a, b] = bipolarSinCos(p.azimuth + p.sweep * path + p.curve * path * (1 - path));
  const center: SkinVector = [s * b, p.pole * c, s * a];
  const dl = p.sweep + p.curve * (1 - 2 * path);
  const tangent = skinNormalize([
    p.length * c * b - dl * s * a,
    -p.pole * p.length * s,
    p.length * c * a + dl * s * b,
  ]);
  const side = skinCross(center, tangent);
  const width = 0.035 + p.width * 4 * t * (1 - t) * (1 - 0.25 * t);
  const [sw, cw] = bipolarSinCos(v * width);
  const material = skinNormalize(
    center.map((x, k) => x * cw + side[k] * sw) as unknown as SkinVector,
  );
  return { material, tangent, side, center, width };
}
export function bipolarLift(t: number, _v: number, i: number, p: BipolarPeel, f: SkinPose) {
  const q = Math.max(0, (t - 0.08) / 0.92),
    root = ((q * q) / (0.18 + 0.82 * q * q)) * (1 - 0.15 * q);
  const wave = bipolarSinCos(f.travel + p.phase + 2 * t)[0] * (0.6 + 0.4 * f.coherence);
  const emphasis = 0.75 + 0.25 * bipolarSinCos(2 * f.travel + p.phase + 2 * t)[0];
  const activity =
    0.11 * f.speech * emphasis +
    0.045 * f.work +
    0.025 * f.receptive +
    0.04 * (f.preparation ?? 0) -
    0.04 * (f.settling ?? 0) -
    0.1 * f.rephase;
  const height = root * ([0.23, 0.32, 0.27][i] + 0.045 * wave + activity);
  // Rotate the actual transverse section. An absolute lateral v² offset can
  // reverse its derivative where the free end becomes narrower than that offset.
  const roll = root * (0.35 * wave + 0.15 * f.speech * emphasis);
  return [height, -0.12 * root * (1 + 0.2 * wave), roll] as const;
}
export function bipolarPeelPoint(
  n: SkinVector,
  peels: readonly BipolarPeel[],
  f: SkinPose,
  body: BodyPoint,
  clearance: number,
): SkinVector {
  const i = bipolarIndex(n, peels),
    p = peels[i],
    [t, v] = bipolarCoordinates(n, p);
  const { material, tangent, side, center, width } = bipolarBasis(p, t, v);
  const [height, bend, roll] = bipolarLift(t, v, i, p, f),
    radius = f.bodyRadius ?? 1.18;
  const [s, c] = bipolarSinCos(roll),
    transverse = bipolarSinCos(v * width)[0];
  return body(material).map(
    (x, k) =>
      x +
      (k === 1 ? 1.06 : 1) *
        (material[k] * (clearance + radius * height) +
          radius * (tangent[k] * bend + transverse * (side[k] * (c - 1) + center[k] * s))),
  ) as unknown as SkinVector;
}

export function createBipolarGeometry(budget: RenderBudget, seed = 0x5a17): SkinGeometry {
  if (!budget.peels)
    return { vertices: new Float32Array(), indices: new Uint16Array(), ranges: [], boundaries: [] };
  const rows = budget.skinSegments * 3,
    columns = Math.max(6, budget.skinRows);
  if (
    budget.peels !== 6 ||
    !Number.isInteger(budget.skinSegments) ||
    !Number.isInteger(rows) ||
    rows % 2 !== 0 ||
    rows < 18 ||
    rows > 96 ||
    !Number.isInteger(budget.skinRows) ||
    budget.skinRows < 4 ||
    budget.skinRows > 24
  )
    throw new RangeError("bipolar sampling outside setup bounds");
  if (
    3 * (rows + 1) * (columns + 1) + (budget.sphereLongitude + 1) * (budget.sphereLatitude + 1) >
    20_000
  )
    throw new RangeError("bipolar body/skin exceeds vertex envelope");
  const vertices: number[] = [],
    indices: number[] = [],
    boundaries: number[][] = [],
    ranges = [];
  for (const p of createBipolarPeels(seed)) {
    const start = vertices.length / 3;
    const at = (r: number, c: number) => start + r * (columns + 1) + c;
    for (let r = 0; r <= rows; r++)
      for (let c = 0; c <= columns; c++)
        vertices.push(
          ...bipolarParameter(p, (1 - Math.cos((Math.PI * r) / rows)) * 0.5, (2 * c) / columns - 1),
        );
    boundaries.push([
      ...Array.from({ length: columns }, (_, c) => at(0, c)),
      ...Array.from({ length: rows }, (_, r) => at(r, columns)),
      ...Array.from({ length: columns }, (_, c) => at(rows, columns - c)),
      ...Array.from({ length: rows }, (_, r) => at(rows - r, 0)),
    ]);
    for (let half = 0; half < 2; half++) {
      const offset = indices.length;
      for (let r = (half * rows) / 2; r < ((half + 1) * rows) / 2; r++)
        for (let c = 0; c < columns; c++) {
          const a = at(r, c),
            b = at(r + 1, c),
            d = at(r + 1, c + 1),
            e = at(r, c + 1);
          indices.push(a, b, e, e, b, d);
        }
      ranges.push({
        center: bipolarBasis(p, half ? 0.75 : 0.25, 0).material,
        offset: offset * 2,
        count: indices.length - offset,
      });
    }
  }
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
    boundaries,
    ranges,
  };
}

export const BIPOLAR_SHAPE_GLSL = `
uniform int u_contact_count;
uniform vec4 u_contact_centers[3],u_contact_tangents[3],u_contact_sides[3],u_contact_shapes[3];
uniform vec4 u_contact_pose;
uniform vec2 u_contact_phase;
uniform float u_skin_clearance;
vec2 bipolarSC(float angle) {
  float x=angle-6.283185307179586*floor((angle+3.141592653589793)/6.283185307179586),z=x*x;
  return vec2(x*(1.+z*(-1./6.+z*(1./120.+z*(-1./5040.+z*(1./362880.+z*(-1./39916800.+z*(1./6227020800.+z*(-1./1307674368000.+z/355687428096000.)))))))),
    1.+z*(-1./2.+z*(1./24.+z*(-1./720.+z*(1./40320.+z*(-1./3628800.+z*(1./479001600.+z*(-1./87178291200.+z/20922789888000.))))))));
}
int bipolarIndex(vec3 n) {
  int k=0; for(int i=1;i<3;i++)if(dot(n,u_contact_centers[i].xyz)>dot(n,u_contact_centers[k].xyz))k=i; return k;
}
vec2 bipolarUV(vec3 n,int i) {
  float d=dot(n,u_contact_centers[i].xyz);
  return vec2((dot(n,u_contact_tangents[i].xyz)/d/.4+1.)*.5,dot(n,u_contact_sides[i].xyz)/d/.35);
}
void bipolarBasis(int i,vec2 uv,out vec3 material,out vec3 tangent,out vec3 side,out vec3 center) {
  float t=uv.x,v=uv.y,len=u_contact_tangents[i].w;
  float path=t;
  vec4 shape=u_contact_shapes[i];
  vec2 sc=bipolarSC(.17+len*path),ab=bipolarSC(u_contact_sides[i].w+shape.x*path+shape.y*path*(1.-path));
  float s=sc.x,c=sc.y,a=ab.x,b=ab.y,pole=u_contact_centers[i].w,dl=shape.x+shape.y*(1.-2.*path);
  center=vec3(s*b,pole*c,s*a);
  tangent=normalize(vec3(len*c*b-dl*s*a,-pole*len*s,len*c*a+dl*s*b));
  side=cross(center,tangent);
  vec2 w=bipolarSC(v*(.035+shape.z*4.*t*(1.-t)*(1.-.25*t)));
  material=normalize(center*w.y+side*w.x);
}
vec3 bipolarMaterialDirection(vec3 n) {vec3 m,t,s,c;int i=bipolarIndex(n);bipolarBasis(i,bipolarUV(n,i),m,t,s,c);return m;}
vec3 bipolarLift(vec2 uv,int i) {
  float t=uv.x,v=uv.y,q=max(0.,(t-.08)/.92),root=q*q/(.18+.82*q*q)*(1.-.15*q),phase=u_contact_shapes[i].w;
  float wave=bipolarSC(u_contact_phase.x+phase+2.*t).x*(.6+.4*u_contact_pose.w);
  float emphasis=.75+.25*bipolarSC(2.*u_contact_phase.x+phase+2.*t).x;
  float activity=.11*u_behavior.y*emphasis+.045*u_behavior.z+.025*u_behavior.w+.04*u_provider.y-.04*u_provider.z-.1*u_contact_phase.y;
  float base=i==0 ? .23 : (i==1 ? .32 : .27);
  return vec3(root*(base+.045*wave+activity),-.12*root*(1.+.2*wave),root*(.35*wave+.15*u_behavior.y*emphasis));
}
vec2 skinRegion(vec3 n,int i) {return i==bipolarIndex(n) ? bipolarUV(n,i) : vec2(0.);}
vec2 skinOffsets(vec2 uv,int i) {return vec2(u_radius*bipolarLift(uv,i).x,0.);}
`;
export const BIPOLAR_SURFACE_GLSL = `
vec3 livingSkinPoint(vec3 n) {
  int i=bipolarIndex(n);vec2 uv=bipolarUV(n,i);vec3 m,t,s,c;bipolarBasis(i,uv,m,t,s,c);
  vec3 delta=bipolarLift(uv,i);
  vec2 roll=bipolarSC(delta.z);
  float width=.035+u_contact_shapes[i].z*4.*uv.x*(1.-uv.x)*(1.-.25*uv.x);
  float transverse=bipolarSC(uv.y*width).x;
  return livingBodyPoint(m,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple)
    +vec3(1.,1.06,1.)*(m*(u_skin_clearance+u_radius*delta.x)+u_radius*(t*delta.y+transverse*(s*(roll.y-1.)+c*roll.x)));
}
vec3 livingSkinNormal(vec3 n) {
  vec3 a=normalize(cross(abs(n.y)<.9 ? vec3(0.,1.,0.) : vec3(1.,0.,0.),n)),b=cross(n,a);
  vec3 da=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*a))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*a));
  vec3 db=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*b))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*b));
  vec3 normal=cross(da,db);return dot(normal,normal)>1.e-16 ? normalize(normal) : bipolarMaterialDirection(n);
}
`;
/** Contact is restricted to the actual three polar roots, not old opening collars.
 * An economical ambient proxy, not cast shadows or inter-peel collision physics.
 */
export const BIPOLAR_CONTACT_GLSL = `
#if SAM_FINE_OCTAVES >= 2
${BIPOLAR_SHAPE_GLSL}
#endif
float livingContactOcclusion(vec3 n) {
  float contact=0.;
#if SAM_FINE_OCTAVES >= 2
  for(int i=0;i<3;i++) {
    if(i>=u_contact_count)break;
    vec2 uv=vec2(.18,0.);vec3 m,t,s,c;bipolarBasis(i,uv,m,t,s,c);
    float gap=u_skin_clearance+u_radius*bipolarLift(uv,i).x;
    contact=max(contact,.16*exp(-80.*max(0.,1.-dot(n,m)))*exp(-14.*gap));
  }
#endif
  return contact;
}
`;
export const BIPOLAR_PEEL_SKIN: SkinStrategy = Object.freeze({
  id: "bipolar-peels",
  materialSpace: "unit-object-direction",
  materialDirection: "bipolarMaterialDirection",
  shapeGLSL: BIPOLAR_SHAPE_GLSL,
  surfaceGLSL: BIPOLAR_SURFACE_GLSL,
  contactGLSL: BIPOLAR_CONTACT_GLSL,
  create(budget: RenderBudget, seed: number) {
    const peels = budget.peels ? createBipolarPeels(seed) : [];
    return {
      geometry: createBipolarGeometry(budget, seed),
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
      point: (n: SkinVector, f: SkinPose, body: BodyPoint, clearance: number) =>
        bipolarPeelPoint(n, peels, f, body, clearance),
    };
  },
});
