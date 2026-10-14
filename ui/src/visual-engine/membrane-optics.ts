import type { PeelDescriptor } from "./geometry";
import { MEMBRANE_SHAPE_GLSL, membraneOffsets } from "./membrane";
import type { MotionFrame } from "./motion";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

/** Inverse of the immutable spherical carrier, before curl displacement. */
export function sheetCoordinates(
  n: readonly number[],
  p: PeelDescriptor,
): readonly [number, number] {
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(n, p.center))));
  const scale = angle < 1e-7 ? 1 : angle / Math.max(1e-7, Math.sin(angle));
  const u = (dot(n, p.tangent) * scale) / p.halfLength;
  const width =
    p.halfWidth * (0.84 + 0.12 * Math.cos(2.1 * u + p.phase) + 0.04 * Math.sin(4.3 * u - p.phase));
  return [u, 0.5 + (0.5 * (dot(n, p.crossTangent) * scale - p.bend * Math.sin(2.2 * u))) / width];
}

/** Bounded local ambient contact proxy, not a light-space ray-traced shadow. */
export function sheetContact(n: readonly number[], p: PeelDescriptor, f: MotionFrame): number {
  if (dot(n, p.center) < 0.08) return 0;
  const [u, initialV] = sheetCoordinates(n, p);
  if (Math.abs(u) > 1.05) return 0;
  const offsets = (v: number) =>
    membraneOffsets(
      u,
      Math.min(1, Math.max(0, v)),
      p.lift,
      p.curlRadius,
      p.phase,
      f.peelTravel,
      f.opening,
      f.peelLift,
      f.peelWidth,
      f.peelCoherence,
      f.peelRephase,
      f.reasoningCue,
      f.receptiveCue,
      f.reactivity.outputPulse,
    );
  const width =
    p.halfWidth * (0.84 + 0.12 * Math.cos(2.1 * u + p.phase) + 0.04 * Math.sin(4.3 * u - p.phase));
  const v = initialV - offsets(initialV)[1] / (2 * width * Math.max(0.8, f.radius));
  const mask =
    (1 - smooth(0.68, 1.02, Math.abs(u))) * smooth(-0.05, 0.1, v) * (1 - smooth(0.7, 1.02, v));
  return 0.38 * p.opacity * mask * Math.exp(-12 * offsets(v)[0]);
}

export const MEMBRANE_CONTACT_GLSL = `
#if SAM_FINE_OCTAVES >= 2
uniform int u_contact_count;
uniform vec4 u_contact_centers[6];
uniform vec4 u_contact_tangents[6];
uniform vec4 u_contact_sides[6];
uniform vec4 u_contact_shapes[6];
uniform vec4 u_contact_pose;
uniform vec2 u_contact_phase;
#define u_peel_travel u_contact_phase.x
#define u_opening u_contact_pose.x
#define u_peel_lift u_contact_pose.y
#define u_peel_width u_contact_pose.z
#define u_coherence u_contact_pose.w
#define u_rephase u_contact_phase.y
${MEMBRANE_SHAPE_GLSL.replaceAll("membraneOffsets", "contactOffsets")}
#undef u_peel_travel
#undef u_opening
#undef u_peel_lift
#undef u_peel_width
#undef u_coherence
#undef u_rephase
#endif

float livingContactOcclusion(vec3 n) {
  float contact=0.;
#if SAM_FINE_OCTAVES >= 2
  for(int i=0;i<6;i++) {
    if(i>=u_contact_count)break;
    vec4 c=u_contact_centers[i],t=u_contact_tangents[i],s=u_contact_sides[i],shape=u_contact_shapes[i];
    float cosine=dot(n,c.xyz);
    if(cosine<.08)continue;
    float angle=acos(clamp(cosine,-1.,1.)), scale=angle/max(.00001,sin(angle));
    float u=dot(n,t.xyz)*scale/c.w;
    if(abs(u)>1.05)continue;
    float width=s.w*(.84+.12*cos(2.1*u+shape.z)+.04*sin(4.3*u-shape.z));
    float v=.5+.5*(dot(n,s.xyz)*scale-t.w*sin(2.2*u))/width;
    v-=contactOffsets(vec2(u,clamp(v,0.,1.)),shape).y/(2.*width*max(.8,u_radius));
    float gap=contactOffsets(vec2(u,clamp(v,0.,1.)),shape).x;
    float mask=(1.-smoothstep(.68,1.02,abs(u)))*smoothstep(-.05,.1,v)*(1.-smoothstep(.7,1.02,v));
    contact=max(contact,.38*shape.w*mask*exp(-12.*gap));
  }
#endif
  return contact;
}
`;
