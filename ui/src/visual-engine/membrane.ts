/** Body-attached sheets share this bounded curl law in CPU evidence and GLSL. */
export const MEMBRANE_FLEX_RATE = 0.5;
export const MEMBRANE_GAP = 0.002;
export const MEMBRANE_RADIUS_BOUND = 1.56;

export function membraneOffsets(
  u: number,
  v: number,
  height: number,
  curlRadius: number,
  phase: number,
  travel: number,
  opening = 0.1,
  lift = 0.002,
  width = 1,
  coherence = 0.82,
  rephase = 0,
  work = 0,
  receptive = 0,
  speech = 0,
): readonly [number, number] {
  const end = Math.max(0, 1 - u * u) ** 2;
  const wave = Math.sin(travel + phase + 0.9 * u);
  const flex = 1 + 0.16 * wave * (0.6 + 0.4 * coherence);
  const roll =
    (2.65 + 0.18 * wave - 0.7 * opening + 0.35 * work - 0.3 * receptive + 0.12 * speech) *
    v *
    v *
    v;
  const radius = Math.min(
    0.068,
    (curlRadius + 0.24 * lift) * flex * Math.min(1.15, Math.max(0.85, width)) * (1 + 0.4 * rephase),
  );
  const smoothV = Math.min(1, Math.max(0, v / 0.2));
  const gap = MEMBRANE_GAP * smoothV * smoothV * (3 - 2 * smoothV);
  return [
    gap + end * ((height + 0.22 * lift) * v * v * flex + radius * (1 - Math.cos(roll))),
    end * radius * (Math.sin(roll) - roll),
  ];
}

export const MEMBRANE_SHAPE_GLSL = `
vec2 membraneOffsets(vec2 uv, vec4 shape) {
  float u=uv.x, v=uv.y;
  float end=pow(max(0.,1.-u*u),2.);
  float wave=sin(u_peel_travel+shape.z+.9*u);
  float flex=1.+.16*wave*(.6+.4*u_coherence);
  float roll=(2.65+.18*wave-.70*u_opening+.35*u_behavior.z-.30*u_behavior.w+.12*u_behavior.y)*v*v*v;
  float radius=min(.068,(shape.y+.24*u_peel_lift)*flex*clamp(u_peel_width,.85,1.15)*(1.+.4*u_rephase));
  float gap=${MEMBRANE_GAP.toFixed(3)}*smoothstep(0.,.2,v);
  return vec2(gap+end*((shape.x+.22*u_peel_lift)*v*v*flex+radius*(1.-cos(roll))),
    end*radius*(sin(roll)-roll));
}
`;
