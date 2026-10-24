import {
  SKIN_DOMAIN_GLSL,
  type SkinOpening,
  type SkinVector,
  skinCross,
  skinDot,
  skinNormalize,
  skinRegion,
} from "./skin-domain";

export const MEMBRANE_FLEX_RATE = 0.5;
export const MEMBRANE_RADIUS_BOUND = 1.56;
export const SKIN_NORMAL_STEP = 0.003;

export interface SkinPose {
  preparation?: number;
  settling?: number;
  /** Nominal body scale for curvature-based strategies; existing collars ignore it. */
  readonly bodyRadius?: number;
  readonly travel: number;
  readonly opening: number;
  readonly lift: number;
  readonly width: number;
  readonly coherence: number;
  readonly rephase: number;
  readonly work: number;
  readonly receptive: number;
  readonly speech: number;
}

/** Relative to the resting coat: offsets and first derivatives vanish at q=0.
 * The free rim extends through q=1 for surface derivative samples.
 */
export function skinOffsets(
  q: number,
  theta: number,
  p: SkinOpening,
  f: SkinPose,
): readonly [number, number] {
  const wave = Math.sin(f.travel + p.phase + 2 * theta);
  const flex = 1 + 0.14 * wave * (0.6 + 0.4 * f.coherence);
  const lobe = 0.825 + 0.175 * Math.cos(theta - p.phase);
  const roll =
    (2.45 + 0.16 * wave - 0.7 * f.opening + 0.28 * f.work - 0.32 * f.receptive + 0.12 * f.speech) *
    q ** 3;
  const radius = Math.min(
    0.065,
    p.curl * flex * Math.min(1.15, Math.max(0.85, f.width)) * (1 + 0.4 * f.rephase),
  );
  return [
    (p.height + 0.22 * f.lift) * q * q * flex * lobe + radius * (1 - Math.cos(roll)),
    radius * (Math.sin(roll) - roll),
  ];
}

export function skinPoint(
  n: SkinVector,
  openings: readonly SkinOpening[],
  f: SkinPose,
  bodyPoint: (direction: SkinVector) => SkinVector,
  clearance: number,
): SkinVector {
  let radial = clearance,
    tangent: SkinVector = [0, 0, 0];
  for (const p of openings) {
    const region = skinRegion(n, p);
    if (region.q <= 0) continue;
    const offset = skinOffsets(region.q, region.theta, p, f);
    radial += offset[0];
    tangent = tangent.map((v, i) => v + region.inward[i] * offset[1]) as unknown as SkinVector;
  }
  const base = bodyPoint(n);
  return base.map(
    (v, i) => v + (n[i] * radial + tangent[i]) * (i === 1 ? 1.06 : 1),
  ) as unknown as SkinVector;
}

/** Reference for the complete body-plus-coat map, not ideal sphere normals. */
export function skinNormal(
  n: SkinVector,
  point: (direction: SkinVector) => SkinVector,
): SkinVector {
  const a = skinNormalize(skinCross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n));
  const b = skinCross(n, a);
  const derivative = (t: SkinVector): SkinVector => {
    const plus = point(
      skinNormalize(n.map((v, i) => v + SKIN_NORMAL_STEP * t[i]) as unknown as SkinVector),
    );
    const minus = point(
      skinNormalize(n.map((v, i) => v - SKIN_NORMAL_STEP * t[i]) as unknown as SkinVector),
    );
    return plus.map((v, i) => v - minus[i]) as unknown as SkinVector;
  };
  const normal = skinCross(derivative(a), derivative(b));
  // A fold can turn over; do not force its normal to face away from the sphere.
  return skinDot(normal, normal) > 1e-16 ? skinNormalize(normal) : n;
}

export const MEMBRANE_SHAPE_GLSL = `
${SKIN_DOMAIN_GLSL}
vec2 skinOffsets(vec2 region,int i) {
  float q=region.x,theta=region.y;
  vec4 shape=u_contact_shapes[i];
  float wave=sin(u_contact_phase.x+shape.w+2.*theta);
  float flex=1.+.14*wave*(.6+.4*u_contact_pose.w);
  float lobe=.825+.175*cos(theta-shape.w);
  float roll=(2.45+.16*wave-.7*u_contact_pose.x+.28*u_behavior.z-.32*u_behavior.w+.12*u_behavior.y)*q*q*q;
  float radius=min(.065,shape.z*flex*clamp(u_contact_pose.z,.85,1.15)*(1.+.4*u_contact_phase.y));
  return vec2((shape.y+.22*u_contact_pose.y)*q*q*flex*lobe+radius*(1.-cos(roll)),radius*(sin(roll)-roll));
}
`;

export const SKIN_SURFACE_GLSL = `
vec3 livingSkinPoint(vec3 n) {
  vec3 base=livingBodyPoint(n,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  vec3 offset=n*u_skin_clearance;
  for(int i=0;i<3;i++) {
    if(i>=u_contact_count)break;
    vec2 region=skinRegion(n,i);
    if(region.x<=0.)continue;
    vec2 delta=skinOffsets(region,i);
    offset+=n*delta.x+skinInward(n,i,region.y)*delta.y;
  }
  return base+vec3(1.,1.06,1.)*offset;
}
vec3 livingSkinNormal(vec3 n) {
  vec3 a=normalize(cross(abs(n.y)<.9 ? vec3(0.,1.,0.) : vec3(1.,0.,0.),n));
  vec3 b=cross(n,a);
  vec3 da=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*a))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*a));
  vec3 db=livingSkinPoint(normalize(n+${SKIN_NORMAL_STEP}*b))-livingSkinPoint(normalize(n-${SKIN_NORMAL_STEP}*b));
  vec3 normal=cross(da,db);
  return dot(normal,normal)>1.e-16 ? normalize(normal) : n;
}
`;
