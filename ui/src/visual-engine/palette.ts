export type Color = readonly [number, number, number];

// Linear-light anchors, shared by all quality tiers and the lifted film.
export const PIGMENTS = Object.freeze({
  red: [0.44, 0.026, 0.045] as Color,
  copper: [0.68, 0.13, 0.038] as Color,
  orange: [1.0, 0.33, 0.065] as Color,
  gold: [1.0, 0.58, 0.13] as Color,
  pink: [0.88, 0.055, 0.28] as Color,
  violet: [0.3, 0.018, 0.58] as Color,
  blue: [0.022, 0.12, 0.62] as Color,
  emerald: [0.018, 0.38, 0.075] as Color,
  teal: [0.018, 0.43, 0.34] as Color,
});

export const PALETTE_BANKS = [
  [PIGMENTS.gold, PIGMENTS.red, PIGMENTS.blue, PIGMENTS.copper],
  [PIGMENTS.blue, PIGMENTS.violet, PIGMENTS.emerald, PIGMENTS.teal],
  [PIGMENTS.emerald, PIGMENTS.pink, PIGMENTS.gold, PIGMENTS.violet],
] as const;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a: Color, b: Color, t: number): Color =>
  a.map((x, i) => x + (b[i] - x) * t) as unknown as Color;
/** Cyclic C1 interpolation of two adjacent composed anchors, never a hue rotation. */
export function paletteBank(bank: readonly Color[], phase: number): Color {
  const turn = ((((phase / (2 * Math.PI)) % 1) + 1) % 1) * 4;
  const index = Math.floor(turn);
  return mix(bank[index], bank[(index + 1) % 4], smooth(0, 1, turn - index));
}
export function samplePalette(
  field: { broad: number; medium: number; palette: number },
  balance = 0.68,
  contrast = 1,
  phases: readonly [number, number] = [0.4, 1.1],
): { albedo: Color; cool: number } {
  const { broad, medium, palette } = field;
  const [a, b] = phases;
  const warm = paletteBank(PALETTE_BANKS[0], a + 0.6 * (broad - 0.5) + 0.2 * (palette - 0.5));
  const cool = paletteBank(PALETTE_BANKS[1], b - 0.5 * (broad - 0.5));
  const bridge = paletteBank(PALETTE_BANKS[2], b + 0.8 * Math.sin(a) + 1.9 + 0.4 * (medium - 0.5));
  const bridgeWeight = 0.68 * (1 - smooth(0.25, 0.58, medium)) * (1 - smooth(0.58, 0.82, broad));
  const boundary = 0.12 * (contrast - 1) + 0.1 * (balance - 0.68);
  const weight =
    0.94 *
    (1 - smooth(0.25 + boundary, 0.54 + boundary, broad)) *
    (0.35 + 0.65 * smooth(0.22 - boundary, 0.66 - boundary, medium));
  const pigment = mix(mix(warm, bridge, bridgeWeight), cool, weight);
  const luminance = 0.2126 * pigment[0] + 0.7152 * pigment[1] + 0.0722 * pigment[2];
  const chroma = 0.94 + 0.06 * Math.sin(a + 2 * broad - 1.4 * medium);
  const fold =
    (0.83 + 0.29 * broad + 0.13 * (smooth(0.34, 0.68, medium) - 0.5)) *
    (0.95 + 0.05 * Math.sin(b + 1.7 * broad));
  return {
    albedo: pigment.map((x) =>
      Math.max(0, Math.min(1, (luminance + (x - luminance) * chroma) * fold)),
    ) as unknown as Color,
    cool: weight,
  };
}
const glslColor = (c: Color) => `vec3(${c.map((n) => n.toFixed(4)).join(",")})`;
/** One generated anchor table for CPU reference and GPU; no additional field samples. */
export const LIVING_PALETTE_GLSL = `
uniform vec2 u_palette_phase;
vec3 paletteBank(vec3 a,vec3 b,vec3 c,vec3 d,float phase) {
 float t=fract(phase/6.28318530718)*4.;
 if(t<1.) return mix(a,b,smoothstep(0.,1.,t));
 if(t<2.) return mix(b,c,smoothstep(1.,2.,t));
 if(t<3.) return mix(c,d,smoothstep(2.,3.,t));
 return mix(d,a,smoothstep(3.,4.,t));
}
vec3 paletteColor(float broad,float medium,float p,float weight) {
 float a=u_palette_phase.x,b=u_palette_phase.y;
 vec3 warm=paletteBank(${PALETTE_BANKS[0].map(glslColor).join(",")},a+.6*(broad-.5)+.2*(p-.5));
 vec3 cool=paletteBank(${PALETTE_BANKS[1].map(glslColor).join(",")},b-.5*(broad-.5));
 vec3 bridge=paletteBank(${PALETTE_BANKS[2].map(glslColor).join(",")},b+.8*sin(a)+1.9+.4*(medium-.5));
 float bridgeWeight=.68*(1.-smoothstep(.25,.58,medium))*(1.-smoothstep(.58,.82,broad));
 vec3 pigment=mix(mix(warm,bridge,bridgeWeight),cool,weight);
 float luminance=dot(pigment,vec3(.2126,.7152,.0722));
 float chroma=.94+.06*sin(a+2.*broad-1.4*medium);
 float fold=(.83+.29*broad+.13*(smoothstep(.34,.68,medium)-.5))*(.95+.05*sin(b+1.7*broad));
 return clamp(mix(vec3(luminance),pigment,chroma)*fold,0.,1.);
}
`;
