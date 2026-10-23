import { SKIN_SURFACE_GLSL, type SkinPose } from "./membrane";
import type { RenderBudget } from "./quality";
import {
  createRadialShellWindows,
  packRadialShellWindows,
  RADIAL_SHELL_DOMAIN_GLSL,
  type RadialShellWindow,
  radialShellRegion,
} from "./radial-shell-domain";
import { createRadialShellGeometry } from "./radial-shell-geometry";
import type { SkinVector } from "./skin-domain";
import type { BodyPoint, SkinReference, SkinSetup, SkinStrategy } from "./skin-strategy";

/** At the actual rim q<=1 the permitted arc stays below pi/2. It lifts outward
 * without an inward rolled return. C1 offsets vanish at the resting attachment. */
export function radialShellOffsets(
  q: number,
  theta: number,
  p: RadialShellWindow,
  f: SkinPose,
): readonly [number, number] {
  const wave = Math.sin(f.travel + p.phase + 2 * theta);
  const flex = 1 + 0.14 * wave * (0.6 + 0.4 * f.coherence);
  const lobe = 0.825 + 0.175 * Math.cos(theta - p.phase);
  const arc =
    (0.85 + 0.06 * wave - 0.2 * f.opening + 0.08 * f.work - 0.1 * f.receptive + 0.04 * f.speech) *
    q ** 3;
  const radius = Math.min(
    0.065,
    0.45 * p.height * flex * Math.min(1.15, Math.max(0.85, f.width)) * (1 + 0.4 * f.rephase),
  );
  return [
    (p.height + 0.22 * f.lift) * q * q * flex * lobe + radius * (1 - Math.cos(arc)),
    radius * (Math.sin(arc) - arc),
  ];
}
export function radialShellPoint(
  n: SkinVector,
  windows: readonly RadialShellWindow[],
  pose: SkinPose,
  body: BodyPoint,
  clearance: number,
): SkinVector {
  const offset = [n[0] * clearance, n[1] * clearance, n[2] * clearance];
  for (const p of windows) {
    const region = radialShellRegion(n, p);
    if (region.q <= 0) continue;
    const delta = radialShellOffsets(region.q, region.theta, p, pose);
    for (let i = 0; i < 3; i++) offset[i] += n[i] * delta[0] + region.inward[i] * delta[1];
  }
  return body(n).map((v, i) => v + offset[i] * (i === 1 ? 1.06 : 1)) as unknown as SkinVector;
}
export function radialShellContact(
  n: SkinVector,
  p: RadialShellWindow,
  f: SkinPose,
  radius: number,
  clearance: number,
): number {
  const region = radialShellRegion(n, p);
  if (region.q <= 0) return 0;
  const q =
    region.q -
    radialShellOffsets(region.q, region.theta, p, f)[1] / (p.collar * Math.max(0.8, radius));
  const smooth = (a: number, b: number) => {
    const t = Math.min(1, Math.max(0, (q - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const gap = clearance + radialShellOffsets(Math.min(1.1, Math.max(0, q)), region.theta, p, f)[0];
  return 0.38 * smooth(0, 0.3) * (1 - smooth(0.82, 1.08)) * Math.exp(-12 * gap);
}
export const RADIAL_SHELL_SHAPE_GLSL = `
${RADIAL_SHELL_DOMAIN_GLSL}
vec2 skinOffsets(vec2 region,int i) {
  float q=region.x,theta=region.y;
  vec4 shape=u_contact_shapes[i];
  float wave=sin(u_contact_phase.x+shape.w+2.*theta);
  float flex=1.+.14*wave*(.6+.4*u_contact_pose.w);
  float lobe=.825+.175*cos(theta-shape.w);
  float arc=(.85+.06*wave-.2*u_contact_pose.x+.08*u_behavior.z-.1*u_behavior.w+.04*u_behavior.y)*q*q*q;
  float radius=min(.065,.45*shape.z*flex*clamp(u_contact_pose.z,.85,1.15)*(1.+.4*u_contact_phase.y));
  return vec2((shape.z+.22*u_contact_pose.y)*q*q*flex*lobe+radius*(1.-cos(arc)),radius*(sin(arc)-arc));
}
`;
export const RADIAL_SHELL_CONTACT_GLSL = `
#if SAM_FINE_OCTAVES >= 2
${RADIAL_SHELL_SHAPE_GLSL}
#endif
float livingContactOcclusion(vec3 n) {
  float contact=0.;
#if SAM_FINE_OCTAVES >= 2
  for(int i=0;i<3;i++) {
    if(i>=u_contact_count)break;
    vec2 region=skinRegion(n,i);
    if(region.x<=0.)continue;
    region.x-=skinOffsets(region,i).y/(u_contact_shapes[i].y*max(.8,u_radius));
    float mask=smoothstep(0.,.3,region.x)*(1.-smoothstep(.82,1.08,region.x));
    region.x=clamp(region.x,0.,1.1);
    float gap=u_skin_clearance+skinOffsets(region,i).x;
    contact=max(contact,.38*mask*exp(-12.*gap));
  }
#endif
  return contact;
}
`;
export const RADIAL_SECTOR_SKIN: SkinStrategy = Object.freeze({
  id: "radial-sectors",
  materialSpace: "unit-object-direction",
  shapeGLSL: RADIAL_SHELL_SHAPE_GLSL,
  surfaceGLSL: SKIN_SURFACE_GLSL,
  contactGLSL: RADIAL_SHELL_CONTACT_GLSL,
  create(budget: RenderBudget, seed: number): SkinSetup {
    const windows = budget.peels ? createRadialShellWindows(seed) : [];
    return {
      geometry: createRadialShellGeometry(budget, seed),
      descriptors: packRadialShellWindows(windows),
      count: windows.length,
    };
  },
  reference(seed: number): SkinReference {
    const windows = createRadialShellWindows(seed);
    return {
      point: (n, pose, body, clearance) => radialShellPoint(n, windows, pose, body, clearance),
    };
  },
});
