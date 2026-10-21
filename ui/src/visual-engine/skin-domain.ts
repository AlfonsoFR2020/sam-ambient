/** Fixed cube-sphere charts are topology only; pigment stays in object space. */
export type SkinVector = readonly [number, number, number];
export const SKIN_OPENING_COUNT = 3;
export const SKIN_VERTEX_STRIDE = 3;
export const skinDot = (a: SkinVector, b: SkinVector): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const skinCross = (a: SkinVector, b: SkinVector): SkinVector => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const skinNormalize = (v: SkinVector): SkinVector => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};

export interface SkinFace {
  readonly center: SkinVector;
  readonly tangent: SkinVector;
  readonly side: SkinVector;
}
export interface SkinOpening extends SkinFace {
  readonly face: number;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly collar: number;
  readonly height: number;
  readonly curl: number;
  readonly phase: number;
}

export function createSkinFaces(seed = 0x5a17): readonly SkinFace[] {
  // One rigid, seed-dependent layout rotation; never a running material clock.
  const angle = ((seed >>> 0) / 0x1_0000_0000) * Math.PI * 2 + 0.27;
  const rotate = (n: SkinVector): SkinVector => [
    Math.cos(angle) * n[0] + Math.sin(angle) * n[2], n[1],
    -Math.sin(angle) * n[0] + Math.cos(angle) * n[2],
  ];
  const axes: readonly SkinVector[] = [[0, 0, 1], [1, 0, 0], [0, -1, 0],
    [0, 0, -1], [-1, 0, 0], [0, 1, 0]];
  return axes.map((n) => {
    const a = skinNormalize(skinCross(Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], n));
    return { center: rotate(n), tangent: rotate(a), side: rotate(skinCross(n, a)) };
  });
}

export function createSkinOpenings(seed = 0x5a17): readonly SkinOpening[] {
  const faces = createSkinFaces(seed);
  let state = (seed ^ 0x7351_4e27) >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  return [0, 1, 2].map((face) => ({
    ...faces[face], face,
    x: [0.09, -0.12, 0.04][face], y: [-0.12, 0.08, 0.15][face],
    radius: [0.43, 0.34, 0.29][face], collar: [0.30, 0.34, 0.31][face],
    height: [0.051, 0.043, 0.037][face], curl: [0.047, 0.043, 0.039][face],
    phase: random() * Math.PI * 2,
  }));
}

/** Periodic C-infinity rim. Maximum radius + collar + center offset stays < 1. */
export const skinRimRadius = (p: SkinOpening, theta: number): number =>
  p.radius * (1 + 0.12 * Math.cos(3 * theta + p.phase) + 0.07 * Math.sin(2 * theta - p.phase));

export interface SkinRegion {
  readonly q: number;
  readonly theta: number;
  readonly inward: SkinVector;
}
export function skinRegion(n: SkinVector, p: SkinOpening): SkinRegion {
  const cosine = skinDot(n, p.center);
  if (cosine < 0.55) return { q: 0, theta: 0, inward: p.tangent };
  const x = skinDot(n, p.tangent) / cosine - p.x;
  const y = skinDot(n, p.side) / cosine - p.y;
  const theta = Math.atan2(y, x);
  const radial: SkinVector = p.tangent.map((v, i) =>
    v * Math.cos(theta) + p.side[i] * Math.sin(theta)) as unknown as SkinVector;
  const projection = skinDot(radial, n);
  return {
    // Extend through the free boundary for symmetric derivative samples.
    q: Math.min(1.1, Math.max(0, (skinRimRadius(p, theta) + p.collar - Math.hypot(x, y)) / p.collar)),
    theta,
    inward: skinNormalize(radial.map((v, i) => -v + n[i] * projection) as unknown as SkinVector),
  };
}

/** Identical descriptor layout in skin vertices and High body contact fragments. */
export const SKIN_DOMAIN_GLSL = `
uniform int u_contact_count;
uniform vec4 u_contact_centers[3]; // center.xyz, opening radius
uniform vec4 u_contact_tangents[3]; // tangent.xyz, center x
uniform vec4 u_contact_sides[3]; // side.xyz, center y
uniform vec4 u_contact_shapes[3]; // collar width, lift, curl, phase
uniform vec4 u_contact_pose; // opening, lift response, width response, coherence
uniform vec2 u_contact_phase; // membrane clock, recovery rephase
uniform float u_skin_clearance;
float skinRimRadius(int i,float theta) {
  float phase=u_contact_shapes[i].w;
  return u_contact_centers[i].w*(1.+.12*cos(3.*theta+phase)+.07*sin(2.*theta-phase));
}
vec2 skinRegion(vec3 n,int i) {
  float cosine=dot(n,u_contact_centers[i].xyz);
  if(cosine<.55)return vec2(0.);
  vec2 xy=vec2(dot(n,u_contact_tangents[i].xyz),dot(n,u_contact_sides[i].xyz))/cosine
    -vec2(u_contact_tangents[i].w,u_contact_sides[i].w);
  float theta=length(xy)<1.e-8 ? 0. : atan(xy.y,xy.x);
  return vec2(clamp((skinRimRadius(i,theta)+u_contact_shapes[i].x-length(xy))/u_contact_shapes[i].x,0.,1.1),theta);
}
vec3 skinInward(vec3 n,int i,float theta) {
  vec3 radial=u_contact_tangents[i].xyz*cos(theta)+u_contact_sides[i].xyz*sin(theta);
  return normalize(-radial+n*dot(radial,n));
}
`;
