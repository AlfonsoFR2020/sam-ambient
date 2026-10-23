import { MEMBRANE_SHAPE_GLSL, type SkinPose, skinOffsets } from "./membrane";
import type { MotionFrame } from "./motion";
import { type SkinOpening, type SkinVector, skinRegion } from "./skin-domain";

export const skinPoseFromFrame = (f: MotionFrame): SkinPose => ({
  bodyRadius: f.radius,
  travel: f.peelTravel,
  opening: f.opening,
  lift: f.peelLift,
  width: f.peelWidth,
  coherence: f.peelCoherence,
  rephase: f.peelRephase,
  work: f.reasoningCue,
  receptive: f.receptiveCue,
  speech: f.reactivity.outputPulse,
});
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Local ambient proxy under the actual opening collar, not a cast shadow. */
export function skinContact(
  n: SkinVector,
  p: SkinOpening,
  f: SkinPose,
  radius: number,
  clearance: number,
): number {
  const region = skinRegion(n, p);
  if (region.q <= 0) return 0;
  const initial = skinOffsets(region.q, region.theta, p, f);
  const q = region.q - initial[1] / (p.collar * Math.max(0.8, radius));
  const gap = clearance + skinOffsets(Math.min(1.1, Math.max(0, q)), region.theta, p, f)[0];
  return 0.38 * smooth(0, 0.3, q) * (1 - smooth(0.82, 1.08, q)) * Math.exp(-12 * gap);
}

export const MEMBRANE_CONTACT_GLSL = `
#if SAM_FINE_OCTAVES >= 2
${MEMBRANE_SHAPE_GLSL}
#endif
float livingContactOcclusion(vec3 n) {
  float contact=0.;
#if SAM_FINE_OCTAVES >= 2
  for(int i=0;i<3;i++) {
    if(i>=u_contact_count)break;
    vec2 region=skinRegion(n,i);
    if(region.x<=0.)continue;
    region.x-=skinOffsets(region,i).y/(u_contact_shapes[i].x*max(.8,u_radius));
    float mask=smoothstep(0.,.3,region.x)*(1.-smoothstep(.82,1.08,region.x));
    region.x=clamp(region.x,0.,1.1);
    float gap=u_skin_clearance+skinOffsets(region,i).x;
    contact=max(contact,.38*mask*exp(-12.*gap));
  }
#endif
  return contact;
}
`;
