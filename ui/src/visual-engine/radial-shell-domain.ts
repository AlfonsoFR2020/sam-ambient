import { type SkinRegion, type SkinVector, skinCross, skinDot, skinNormalize } from "./skin-domain";
import type { SkinDescriptors } from "./skin-strategy";

export const RADIAL_SECTOR_CUTS = Object.freeze([-Math.PI, -1.4, 0.25, 1.95, Math.PI]);
export const RADIAL_ATTACHED_LATITUDE = 1.18;
export interface RadialShellFrame {
  readonly axis: SkinVector;
  readonly equator: SkinVector;
  readonly side: SkinVector;
}
export interface RadialShellWindow extends RadialShellFrame {
  readonly patch: number;
  readonly azimuth: number;
  readonly latitude: number;
  readonly halfAzimuth: number;
  readonly halfLatitude: number;
  readonly collar: number;
  readonly height: number;
  readonly phase: number;
}
export function createRadialShellFrame(seed = 0x5a17): RadialShellFrame {
  const axis = skinNormalize([0.24, 0.94, 0.24]);
  const a = skinNormalize(skinCross([0, 1, 0], axis)),
    b = skinCross(axis, a);
  const angle = ((seed >>> 0) / 0x1_0000_0000) * Math.PI * 2 + 0.27;
  const equator = a.map(
    (v, i) => v * Math.cos(angle) + b[i] * Math.sin(angle),
  ) as unknown as SkinVector;
  return { axis, equator, side: skinCross(axis, equator) };
}
export function radialShellDirection(
  frame: RadialShellFrame,
  azimuth: number,
  latitude: number,
): SkinVector {
  return frame.axis.map(
    (v, i) =>
      v * Math.sin(latitude) +
      Math.cos(latitude) *
        (frame.equator[i] * Math.cos(azimuth) + frame.side[i] * Math.sin(azimuth)),
  ) as unknown as SkinVector;
}
export function createRadialShellWindows(seed = 0x5a17): readonly RadialShellWindow[] {
  const frame = createRadialShellFrame(seed);
  let state = (seed ^ 0x7351_4e27) >>> 0;
  return [0, 1, 2].map((patch) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return {
      ...frame,
      patch,
      azimuth:
        (RADIAL_SECTOR_CUTS[patch] + RADIAL_SECTOR_CUTS[patch + 1]) / 2 +
        [0.03, -0.05, 0.06][patch],
      latitude: [0.1, -0.12, 0.05][patch],
      halfAzimuth: [0.48, 0.44, 0.5][patch],
      halfLatitude: [0.6, 0.52, 0.57][patch],
      collar: [0.2, 0.21, 0.19][patch],
      height: [0.055, 0.047, 0.051][patch],
      phase: (state / 0x1_0000_0000) * Math.PI * 2,
    };
  });
}
/** Smooth, perturbed superellipse in angular coordinates: sector sides follow
 * meridians; rounded ends avoid a rectangular cut or singular corner normals. */
export function radialShellRim(p: RadialShellWindow, theta: number): readonly [number, number] {
  const c = Math.cos(theta),
    s = Math.sin(theta);
  const sum = (c / p.halfAzimuth) ** 4 + (s / p.halfLatitude) ** 4;
  const derivative = 4 * c * s * ((s * s) / p.halfLatitude ** 4 - (c * c) / p.halfAzimuth ** 4);
  const base = sum ** -0.25;
  const shape = 1 + 0.065 * Math.cos(3 * theta + p.phase) + 0.035 * Math.sin(2 * theta - p.phase);
  const slope = -0.195 * Math.sin(3 * theta + p.phase) + 0.07 * Math.cos(2 * theta - p.phase);
  return [base * shape, base * (slope - (0.25 * shape * derivative) / sum)];
}
export function radialShellRegion(n: SkinVector, p: RadialShellWindow): SkinRegion {
  const along = skinDot(n, p.axis),
    across = skinDot(n, p.equator),
    side = skinDot(n, p.side);
  // atan2 with both projected components avoids inverse-sine amplification and
  // matches the stable GPU map. No transcendental round trip is needed to wrap.
  const latitude = Math.atan2(along, Math.hypot(across, side));
  const cosine = Math.cos(latitude);
  if (cosine < 0.1) return { q: 0, theta: 0, inward: p.equator };
  const azimuth = Math.atan2(side, across);
  const delta = azimuth - p.azimuth;
  const x = delta - 2 * Math.PI * Math.floor((delta + Math.PI) / (2 * Math.PI));
  const y = latitude - p.latitude,
    r = Math.hypot(x, y);
  const theta = r < 1e-8 ? 0 : Math.atan2(y, x);
  const [rim, slope] = radialShellRim(p, theta);
  const gx = -Math.cos(theta) - (slope * Math.sin(theta)) / Math.max(1e-5, r);
  const gy = -Math.sin(theta) + (slope * Math.cos(theta)) / Math.max(1e-5, r);
  const gradient = p.axis.map(
    (v, i) =>
      (gx * (p.side[i] * Math.cos(azimuth) - p.equator[i] * Math.sin(azimuth)) +
        gy * (v - Math.sin(latitude) * n[i])) /
      cosine,
  ) as unknown as SkinVector;
  return {
    q: Math.min(1.1, Math.max(0, (rim + p.collar - r) / p.collar)),
    theta,
    inward: skinNormalize(gradient),
  };
}
/** Same 192-byte interface as the default, with explicitly different meanings:
 * axis/half-azimuth; equator/azimuth; side/latitude; half-latitude/collar/lift/phase. */
export function packRadialShellWindows(windows: readonly RadialShellWindow[]): SkinDescriptors {
  return {
    centers: new Float32Array(windows.flatMap((p) => [...p.axis, p.halfAzimuth])),
    tangents: new Float32Array(windows.flatMap((p) => [...p.equator, p.azimuth])),
    sides: new Float32Array(windows.flatMap((p) => [...p.side, p.latitude])),
    shapes: new Float32Array(windows.flatMap((p) => [p.halfLatitude, p.collar, p.height, p.phase])),
  };
}

export const RADIAL_SHELL_DOMAIN_GLSL = `
uniform int u_contact_count;
uniform vec4 u_contact_centers[3]; // axis, angular half-width
uniform vec4 u_contact_tangents[3]; // equator, azimuth
uniform vec4 u_contact_sides[3]; // side, latitude
uniform vec4 u_contact_shapes[3]; // half-height, collar, lift, phase
uniform vec4 u_contact_pose;
uniform vec2 u_contact_phase;
uniform float u_skin_clearance;
vec2 radialShellRim(int i,float theta) {
  float c=cos(theta),s=sin(theta),a=u_contact_centers[i].w,b=u_contact_shapes[i].x;
  vec2 square=vec2(c*c/(a*a),s*s/(b*b));
  float sum=dot(square,square);
  float derivative=4.*c*s*(s*s/(b*b*b*b)-c*c/(a*a*a*a));
  float phase=u_contact_shapes[i].w,base=pow(sum,-.25);
  float shape=1.+.065*cos(3.*theta+phase)+.035*sin(2.*theta-phase);
  float slope=-.195*sin(3.*theta+phase)+.07*cos(2.*theta-phase);
  return vec2(base*shape,base*(slope-.25*shape*derivative/sum));
}
vec2 radialShellCoordinates(vec3 n,int i) {
  vec3 projected=vec3(dot(n,u_contact_tangents[i].xyz),dot(n,u_contact_centers[i].xyz),dot(n,u_contact_sides[i].xyz));
  float azimuth=atan(projected.z,projected.x);
  float delta=azimuth-u_contact_tangents[i].w;
  delta-=6.283185307179586*floor((delta+3.141592653589793)/6.283185307179586);
  return vec2(delta,atan(projected.y,length(projected.xz))-u_contact_sides[i].w);
}
vec2 skinRegion(vec3 n,int i) {
  if(abs(dot(n,u_contact_centers[i].xyz))>sqrt(.99))return vec2(0.);
  vec2 xy=radialShellCoordinates(n,i);
  float r=length(xy),theta=r<1.e-8 ? 0. : atan(xy.y,xy.x);
  return vec2(clamp((radialShellRim(i,theta).x+u_contact_shapes[i].y-r)/u_contact_shapes[i].y,0.,1.1),theta);
}
vec3 skinInward(vec3 n,int i,float theta) {
  vec2 xy=radialShellCoordinates(n,i);
  float latitude=xy.y+u_contact_sides[i].w;
  float azimuth=xy.x+u_contact_tangents[i].w;
  float slope=radialShellRim(i,theta).y/max(1.e-5,length(xy));
  vec2 g=vec2(-cos(theta)-slope*sin(theta),-sin(theta)+slope*cos(theta));
  return normalize((g.x*(u_contact_sides[i].xyz*cos(azimuth)-u_contact_tangents[i].xyz*sin(azimuth))
    +g.y*(u_contact_centers[i].xyz-sin(latitude)*n))/max(.1,cos(latitude)));
}
`;
