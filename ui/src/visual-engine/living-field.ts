/** Fixed material offsets; generated once from the engine seed, never animated. */
export function createFieldOffsets(
  seed: number,
): readonly [readonly [number, number, number], readonly [number, number, number]] {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0x1_0000_0000 - 0.5) * 16;
  };
  return [
    [next(), next(), next()],
    [next(), next(), next()],
  ];
}

/** The single material-field definition shared by the body and existing peels. */
export const LIVING_FIELD_GLSL = `
precision highp int;
uniform vec4 u_field_state; // phi1, phi2, twist1, twist2
uniform vec3 u_field_offset_a;
uniform vec3 u_field_offset_b;

struct LivingField {
  vec3 transported;
  float broad;
  float medium;
  float palette;
  float activity;
};

vec3 sphericalTwist(vec3 direction, vec3 axis, float phase, float twist) {
  float mu = clamp(dot(axis, direction), -1.0, 1.0);
  float profile = (1.0 - mu * mu) * (1.0 + 0.35 * mu);
  float angle = -(phase + twist * profile);
  float s = sin(angle), c = cos(angle);
  return direction * c + cross(axis, direction) * s + axis * mu * (1.0 - c);
}

uint latticeHash(ivec3 cell) {
  uvec3 bits = uvec3(cell) * uvec3(0x9e3779b9u, 0x85ebca6bu, 0xc2b2ae35u);
  uint hash = bits.x ^ bits.y ^ bits.z;
  hash ^= hash >> 16u;
  hash *= 0x7feb352du;
  hash ^= hash >> 15u;
  hash *= 0x846ca68bu;
  return hash ^ (hash >> 16u);
}

float gradientDot(ivec3 cell, vec3 offset) {
  uint h = latticeHash(cell) & 15u;
  float u = h < 8u ? offset.x : offset.y;
  float v = h < 4u ? offset.y : ((h == 12u || h == 14u) ? offset.x : offset.z);
  return ((h & 1u) == 0u ? u : -u) + ((h & 2u) == 0u ? v : -v);
}

float simplexCorner(ivec3 cell, vec3 offset) {
  float attenuation = max(0.6 - dot(offset, offset), 0.0);
  float squared = attenuation * attenuation;
  return squared * squared * gradientDot(cell, offset);
}

float simplex3(vec3 point) {
  const float F3 = 1.0 / 3.0;
  const float G3 = 1.0 / 6.0;
  ivec3 cell = ivec3(floor(point + dot(point, vec3(F3))));
  vec3 first = point - vec3(cell) + dot(vec3(cell), vec3(G3));
  ivec3 step1, step2;
  if (first.x >= first.y) {
    if (first.y >= first.z) {
      step1 = ivec3(1, 0, 0); step2 = ivec3(1, 1, 0);
    } else if (first.x >= first.z) {
      step1 = ivec3(1, 0, 0); step2 = ivec3(1, 0, 1);
    } else {
      step1 = ivec3(0, 0, 1); step2 = ivec3(1, 0, 1);
    }
  } else if (first.y < first.z) {
    step1 = ivec3(0, 0, 1); step2 = ivec3(0, 1, 1);
  } else if (first.x < first.z) {
    step1 = ivec3(0, 1, 0); step2 = ivec3(0, 1, 1);
  } else {
    step1 = ivec3(0, 1, 0); step2 = ivec3(1, 1, 0);
  }
  vec3 second = first - vec3(step1) + G3;
  vec3 third = first - vec3(step2) + 2.0 * G3;
  vec3 fourth = first - 1.0 + 3.0 * G3;
  return 32.0 * (
    simplexCorner(cell, first) +
    simplexCorner(cell + step1, second) +
    simplexCorner(cell + step2, third) +
    simplexCorner(cell + ivec3(1), fourth)
  );
}

vec3 transportFieldDirection(vec3 objectDirection) {
  const vec3 AXIS_A = vec3(0.4, 0.8, 0.3);
  const vec3 AXIS_B = vec3(-0.7, 0.2, 0.6);
  vec3 q = normalize(objectDirection);
  q = sphericalTwist(q, normalize(AXIS_A), u_field_state.x, u_field_state.z);
  return normalize(sphericalTwist(q, normalize(AXIS_B), u_field_state.y, u_field_state.w));
}

float broadDensityAt(vec3 transportedDirection) {
  return clamp(0.5 + 0.5 * simplex3(1.8 * transportedDirection + u_field_offset_a), 0.0, 1.0);
}

float sampleBroadDensity(vec3 objectDirection) {
  return broadDensityAt(transportFieldDirection(objectDirection));
}

LivingField sampleLivingField(vec3 objectDirection) {
  vec3 q = transportFieldDirection(objectDirection);
  LivingField field;
  field.transported = q;
  field.broad = broadDensityAt(q);
  field.medium = clamp(0.5 + 0.5 * simplex3(3.6 * q + u_field_offset_b), 0.0, 1.0);
  field.palette = 0.70 * field.broad + 0.30 * field.medium;
  field.activity = smoothstep(0.20, 0.50, abs(field.broad - field.medium));
  return field;
}
`;
