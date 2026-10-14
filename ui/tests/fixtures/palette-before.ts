// Baseline pigment grammar from bc91a03, test-only; geometry/light unchanged.
export const PALETTE_BEFORE = `LivingPigment livingPigment(LivingField field) {
  float p = field.palette;
  vec3 baseWarm = mix(
    mix(vec3(0.44, 0.026, 0.045), vec3(0.68, 0.13, 0.038), smoothstep(0.19, 0.46, p)),
    mix(vec3(1.0, 0.33, 0.065), vec3(1.0, 0.58, 0.13), smoothstep(0.57, 0.78, p)),
    smoothstep(0.42, 0.64, p)
  );
  float rose = .68 * (1.0 - smoothstep(.25, .58, field.medium))
    * (1.0 - smoothstep(.58, .82, field.broad));
  vec3 warm = mix(baseWarm, vec3(0.88, 0.055, 0.28), rose);
  float coolCoordinate = .15 + .70 * field.medium + .15 * (1.0 - field.broad);
  vec3 cool = mix(
    mix(vec3(0.88, 0.055, 0.28), vec3(0.3, 0.018, 0.58), smoothstep(0.37, 0.54, coolCoordinate)),
    mix(vec3(0.022, 0.12, 0.62), vec3(0.018, 0.43, 0.34), smoothstep(0.65, 0.82, coolCoordinate)),
    smoothstep(0.53, 0.72, coolCoordinate)
  );
  float coolBoundary = .12 * (u_palette_contrast - 1.0) + .10 * (u_palette_balance - .68);
  float coolWeight = 0.94 * (1.0 - smoothstep(.25 + coolBoundary, .54 + coolBoundary, field.broad))
    * (.35 + .65 * smoothstep(.22 - coolBoundary, .66 - coolBoundary, field.medium));
  float fold = 0.83 + 0.29 * field.broad + 0.13 * (smoothstep(0.34, 0.68, field.medium) - 0.5);
  return LivingPigment(clamp(mix(warm, cool, coolWeight) * fold, 0.0, 1.0), coolWeight);
}`;
