const AXIS = [0.36, 0.84, 0.4] as const;
const axisLength = Math.hypot(...AXIS);

/** Shared world-space wave: raised skin and near particles meet the same crest. */
export function discourseCrest(point: readonly number[], radius: number, phase: number): number {
  const length = Math.hypot(...point),
    scale = Math.max(0.0001, length);
  const direction = point.reduce((s, x, i) => s + (x * AXIS[i]) / axisLength, 0) / scale;
  const distance = 2.4 * direction + 1.7 * Math.max(0, length / Math.max(0.8, radius) - 1);
  return Math.exp(-18 * Math.sin(phase - distance) ** 2);
}

export const DISCOURSE_CREST_GLSL = `
float discourseCrest(vec3 point,float radius,float phase) {
  float r=length(point);
  float direction=dot(point/max(.0001,r),normalize(vec3(.36,.84,.40)));
  float distance=2.4*direction+1.7*max(0.,r/max(.8,radius)-1.);
  return exp(-18.*pow(sin(phase-distance),2.));
}
float discourseNearField(vec3 point,float radius) {
  return 1.-smoothstep(1.35,2.5,length(point)/max(.8,radius));
}
`;
