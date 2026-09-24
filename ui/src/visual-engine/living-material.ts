type Color = readonly [number, number, number];

// Linear-light pigment anchors. Warm colors remain the majority; cool colors
// occupy coherent low-density folds instead of independently animated bands.
export const PIGMENTS = Object.freeze({
  red: [0.44, 0.026, 0.045] as Color,
  copper: [0.68, 0.13, 0.038] as Color,
  orange: [1.0, 0.33, 0.065] as Color,
  gold: [1.0, 0.72, 0.24] as Color,
  pink: [0.82, 0.15, 0.38] as Color,
  violet: [0.34, 0.085, 0.64] as Color,
  blue: [0.065, 0.25, 0.76] as Color,
  teal: [0.035, 0.58, 0.46] as Color,
});

/** Optional luminance/roughness only; these never enter the palette coordinate. */
export const FINE_DETAIL_AMPLITUDES = [0.06, 0.025] as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const smooth = (lo: number, hi: number, value: number): number => {
  const t = clamp01((value - lo) / (hi - lo));
  return t * t * (3 - 2 * t);
};
const mix = (a: Color, b: Color, t: number): Color => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Test/reference counterpart of the GLSL pigment grammar; not used per frame. */
export function sampleLivingPigment(field: {
  readonly broad: number;
  readonly medium: number;
  readonly palette: number;
}): { readonly albedo: Color; readonly cool: number } {
  const { broad, medium, palette } = field;
  const warm = mix(
    mix(PIGMENTS.red, PIGMENTS.copper, smooth(0.19, 0.46, palette)),
    mix(PIGMENTS.orange, PIGMENTS.gold, smooth(0.57, 0.78, palette)),
    smooth(0.42, 0.64, palette),
  );
  const coolCoordinate = 0.55 * medium + 0.45 * (1 - broad);
  const cool = mix(
    mix(PIGMENTS.pink, PIGMENTS.violet, smooth(0.37, 0.54, coolCoordinate)),
    mix(PIGMENTS.blue, PIGMENTS.teal, smooth(0.65, 0.82, coolCoordinate)),
    smooth(0.53, 0.72, coolCoordinate),
  );
  const coolWeight = 0.94 * (1 - smooth(0.29, 0.57, broad)) * smooth(0.39, 0.63, medium);
  const fold = 0.83 + 0.29 * broad + 0.13 * (smooth(0.34, 0.68, medium) - 0.5);
  const pigment = mix(warm, cool, coolWeight);
  return {
    albedo: [clamp01(pigment[0] * fold), clamp01(pigment[1] * fold), clamp01(pigment[2] * fold)],
    cool: coolWeight,
  };
}

const glslColor = (color: Color): string => `vec3(${color.map((n) => n.toFixed(4)).join(", ")})`;

/** Shared by the sphere and existing peels after the field is sampled. */
export const LIVING_MATERIAL_GLSL = `
#ifndef SAM_FINE_OCTAVES
#define SAM_FINE_OCTAVES 0
#endif
uniform int u_light_count;
uniform float u_light_phase;

struct LivingPigment { vec3 albedo; float cool; };
LivingPigment livingPigment(LivingField field) {
  float p = field.palette;
  vec3 warm = mix(
    mix(${glslColor(PIGMENTS.red)}, ${glslColor(PIGMENTS.copper)}, smoothstep(0.19, 0.46, p)),
    mix(${glslColor(PIGMENTS.orange)}, ${glslColor(PIGMENTS.gold)}, smoothstep(0.57, 0.78, p)),
    smoothstep(0.42, 0.64, p)
  );
  float coolCoordinate = 0.55 * field.medium + 0.45 * (1.0 - field.broad);
  vec3 cool = mix(
    mix(${glslColor(PIGMENTS.pink)}, ${glslColor(PIGMENTS.violet)}, smoothstep(0.37, 0.54, coolCoordinate)),
    mix(${glslColor(PIGMENTS.blue)}, ${glslColor(PIGMENTS.teal)}, smoothstep(0.65, 0.82, coolCoordinate)),
    smoothstep(0.53, 0.72, coolCoordinate)
  );
  float coolWeight = 0.94 * (1.0 - smoothstep(0.29, 0.57, field.broad)) * smoothstep(0.39, 0.63, field.medium);
  float fold = 0.83 + 0.29 * field.broad + 0.13 * (smoothstep(0.34, 0.68, field.medium) - 0.5);
  return LivingPigment(clamp(mix(warm, cool, coolWeight) * fold, 0.0, 1.0), coolWeight);
}

float livingSurfaceDetail(LivingField field) {
  float detail = 0.0;
#if SAM_FINE_OCTAVES >= 1
  detail += ${FINE_DETAIL_AMPLITUDES[0].toFixed(3)} * simplex3(7.2 * field.transported + u_field_offset_a);
#endif
#if SAM_FINE_OCTAVES >= 2
  detail += ${FINE_DETAIL_AMPLITUDES[1].toFixed(3)} * simplex3(14.4 * field.transported + u_field_offset_b);
#endif
  return detail * (0.65 + 0.35 * field.activity);
}

struct LivingLight { float diffuse; float glint; float rim; };
LivingLight livingLight(vec3 normal, vec3 position) {
  vec3 n = normalize(normal), view = vec3(0.0, 0.0, 1.0);
  float diffuse = 0.0, glint = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= u_light_count) break;
    float fi = float(i);
    float phase = u_light_phase * (1.0 + fi * 0.37) + fi * 2.094;
    float incline = 0.18 + fi * 0.17;
    vec3 orbit = vec3(cos(phase) * 1.6, sin(phase * 0.83 + fi) * 1.3, 1.35 + sin(phase) * 0.18);
    orbit.yz = mat2(cos(incline), -sin(incline), sin(incline), cos(incline)) * orbit.yz;
    vec3 light = normalize(orbit - position);
    diffuse += max(dot(n, light), 0.0) * (0.82 - fi * 0.10);
    glint += pow(max(dot(n, normalize(light + view)), 0.0), 34.0) * (0.72 - fi * 0.12);
#if SAM_FINE_OCTAVES >= 2
    glint += pow(max(dot(n, normalize(light + view)), 0.0), 72.0) * (0.20 - fi * 0.03);
#endif
  }
  return LivingLight(diffuse, glint, pow(1.0 - max(dot(n, view), 0.0), 3.0));
}
`;

/** Body and peels share field-driven radius; only the body tangent-samples normals. */
export const LIVING_SURFACE_VERTEX_GLSL = `
float livingDisplacement(vec3 objectDirection, float breathPhase, float ripplePhase, float deformation, float ripple) {
  vec3 n = normalize(objectDirection);
  const vec3 AXIS_B = vec3(-0.25, 0.91, 0.32);
  const vec3 AXIS_C = vec3(0.41, -0.36, 0.84);
  float broad = sampleBroadDensity(n);
  float breathing = 0.006 * sin(breathPhase) * (1.0 + 0.2 * (broad - 0.5));
  float oldResponse = deformation * 0.55 * sin(3.0 * dot(normalize(AXIS_B), n) + ripplePhase)
    + ripple * 0.35 * sin(7.0 * dot(normalize(AXIS_C), n) - ripplePhase * 0.71);
  return clamp(0.012 * (broad - 0.5) + breathing + oldResponse, -0.04, 0.04);
}

vec3 livingBodyPoint(vec3 direction, float radius, float breathPhase, float ripplePhase, float deformation, float ripple) {
  vec3 n = normalize(direction);
  vec3 position = n * (radius + livingDisplacement(n, breathPhase, ripplePhase, deformation, ripple));
  position.y *= 1.06;
  return position;
}

vec3 livingBodyNormal(vec3 direction, vec3 point, float radius, float breathPhase, float ripplePhase, float deformation, float ripple) {
  vec3 n = normalize(direction);
  vec3 helper = abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangentA = normalize(cross(helper, n));
  vec3 tangentB = normalize(cross(n, tangentA));
  vec3 pointA = livingBodyPoint(normalize(n + 0.012 * tangentA), radius, breathPhase, ripplePhase, deformation, ripple);
  vec3 pointB = livingBodyPoint(normalize(n + 0.012 * tangentB), radius, breathPhase, ripplePhase, deformation, ripple);
  return normalize(cross(pointA - point, pointB - point));
}
`;
