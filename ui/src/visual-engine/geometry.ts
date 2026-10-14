import {
  PARTICLE_POINT_SIZE_RANGE,
  PARTICLE_RADIUS_RANGE,
  type ParticleParameters,
} from "./particles";
import type { RenderBudget } from "./quality";

export interface IndexedGeometry {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
}

export interface ArrayGeometry {
  readonly vertices: Float32Array;
  readonly count: number;
}

export interface PeelDescriptor {
  readonly center: readonly [number, number, number];
  readonly tangent: readonly [number, number, number];
  readonly crossTangent: readonly [number, number, number];
  readonly halfLength: number;
  readonly halfWidth: number;
  readonly bend: number;
  readonly lift: number;
  readonly curlRadius: number;
  readonly opacity: number;
  readonly phase: number;
}

export const PEEL_VERTEX_STRIDE = 21;
const normalize = (v: readonly number[]): [number, number, number] => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const seeded = (seed: number): (() => number) => {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
};

export function createSphereGeometry(longitude: number, latitude: number): IndexedGeometry {
  const vertices = new Float32Array((longitude + 1) * (latitude + 1) * 6);
  let offset = 0;
  for (let y = 0; y <= latitude; y++) {
    const phi = (y / latitude - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);
    for (let x = 0; x <= longitude; x++) {
      const lambda = (x / longitude) * Math.PI * 2;
      const px = cosPhi * Math.cos(lambda);
      const py = Math.sin(phi);
      const pz = cosPhi * Math.sin(lambda);
      vertices.set([px, py, pz, px, py, pz], offset);
      offset += 6;
    }
  }
  const indices: number[] = [];
  for (let y = 0; y < latitude; y++) {
    for (let x = 0; x < longitude; x++) {
      const a = y * (longitude + 1) + x;
      const b = a + longitude + 1;
      if (y > 0) indices.push(a, b, a + 1);
      if (y < latitude - 1) indices.push(a + 1, b, b + 1);
    }
  }
  return { vertices, indices: new Uint16Array(indices) };
}

export function createPeelDescriptors(count: number, seed = 0x5a17): readonly PeelDescriptor[] {
  if (!Number.isInteger(count) || count < 0 || count > 6)
    throw new RangeError("membrane sheet count must be 0–6");
  const random = seeded(seed),
    rotation = random() * Math.PI * 2;
  return Array.from({ length: count }, (_, index) => {
    // The same six broad sheets exist at every tier; fidelity changes sampling.
    const y = 1 - (2 * (index + 0.5)) / 6,
      longitude = index * Math.PI * (3 - Math.sqrt(5)) + rotation;
    const r = Math.sqrt(1 - y * y),
      center: [number, number, number] = [r * Math.cos(longitude), y, r * Math.sin(longitude)];
    const a = normalize(cross(Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0], center)),
      b = cross(center, a);
    const tilt = 0.45 + (random() - 0.5) * 0.3;
    const tangent = normalize(a.map((v, i) => v * Math.cos(tilt) + b[i] * Math.sin(tilt)));
    return {
      center,
      tangent,
      crossTangent: cross(center, tangent),
      halfLength: 1.12 + random() * 0.14,
      halfWidth: 0.28 + random() * 0.07,
      bend: 0.17 + random() * 0.07,
      lift: 0.045 + random() * 0.015,
      curlRadius: 0.043 + random() * 0.007,
      opacity: 0.84 + random() * 0.06,
      phase: random() * Math.PI * 2,
    };
  });
}

/** Curved broad carrier on the sphere, with irregular but coherent long edges. */
export function peelDirection(
  peel: PeelDescriptor,
  u: number,
  v: number,
): [number, number, number] {
  const x = u * peel.halfLength;
  const width =
    peel.halfWidth *
    (0.84 + 0.12 * Math.cos(2.1 * u + peel.phase) + 0.04 * Math.sin(4.3 * u - peel.phase));
  const y = peel.bend * Math.sin(2.2 * u) + (2 * v - 1) * width;
  const distance = Math.hypot(x, y),
    scale = distance < 1e-8 ? 1 : Math.sin(distance) / distance;
  return normalize(
    peel.center.map(
      (n, i) => n * Math.cos(distance) + (peel.tangent[i] * x + peel.crossTangent[i] * y) * scale,
    ),
  );
}

export function createPeelGeometry(budget: RenderBudget, seed?: number): IndexedGeometry {
  const descriptors = createPeelDescriptors(budget.peels, seed);
  const cols = budget.peelSamples + 1,
    rows = budget.peelRows + 1;
  const vertices = new Float32Array(budget.peels * cols * rows * PEEL_VERTEX_STRIDE);
  const indices = new Uint16Array(budget.peels * budget.peelSamples * budget.peelRows * 6);
  const epsilon = 0.001;
  const derivative = (peel: PeelDescriptor, u: number, v: number, axis: "u" | "v") => {
    const a = peelDirection(
      peel,
      u + (axis === "u" ? epsilon : 0),
      v + (axis === "v" ? epsilon : 0),
    );
    const b = peelDirection(
      peel,
      u - (axis === "u" ? epsilon : 0),
      v - (axis === "v" ? epsilon : 0),
    );
    return a.map((n, i) => (n - b[i]) / (2 * epsilon));
  };
  const side = (peel: PeelDescriptor, u: number, v: number) =>
    normalize(derivative(peel, u, v, "v"));
  let offset = 0,
    indexOffset = 0;
  for (let patch = 0; patch < descriptors.length; patch++) {
    const peel = descriptors[patch];
    for (let x = 0; x < cols; x++)
      for (let y = 0; y < rows; y++) {
        const u = (2 * x) / budget.peelSamples - 1,
          v = y / budget.peelRows;
        const du = derivative(peel, u, v, "u"),
          dv = derivative(peel, u, v, "v");
        const up = side(peel, u + epsilon, v),
          um = side(peel, u - epsilon, v);
        const vp = side(peel, u, v + epsilon),
          vm = side(peel, u, v - epsilon);
        vertices.set(
          [
            ...peelDirection(peel, u, v),
            u,
            v,
            peel.lift,
            peel.phase,
            ...du,
            ...dv,
            peel.curlRadius,
            peel.opacity,
            ...up.map((n, i) => (n - um[i]) / (2 * epsilon)),
            ...vp.map((n, i) => (n - vm[i]) / (2 * epsilon)),
          ],
          offset,
        );
        offset += PEEL_VERTEX_STRIDE;
      }
    const base = patch * cols * rows;
    for (let x = 0; x < cols - 1; x++)
      for (let y = 0; y < rows - 1; y++) {
        const a = base + x * rows + y,
          b = a + rows;
        indices.set([a, b, a + 1, a + 1, b, b + 1], indexOffset);
        indexOffset += 6;
      }
  }
  return { vertices, indices };
}

/** Seeded, tier-stable analytic paths; an interleaved radial quantile gives a sparse far tail. */
export function createParticleGeometry(count: number, seed = 0x5a17): ArrayGeometry {
  const random = seeded(seed ^ 0x9e37_79b9);
  const vertices = new Float32Array(count * 8);
  for (let index = 0; index < count; index++) {
    const slot =
      ((index & 1) << 5) |
      ((index & 2) << 3) |
      ((index & 4) << 1) |
      ((index & 8) >> 1) |
      ((index & 16) >> 3) |
      ((index & 32) >> 5);
    const quantile = (slot + random() * 0.5) / 64;
    const cadence = (random() < 0.5 ? -1 : 1) * (random() < 0.36 ? 2 : 1);
    vertices.set(
      [
        random() * Math.PI * 2,
        PARTICLE_RADIUS_RANGE.minimum +
          quantile ** 2.15 * (PARTICLE_RADIUS_RANGE.maximum - PARTICLE_RADIUS_RANGE.minimum),
        (random() * 2 - 1) * (Math.PI / 3.1),
        random() * Math.PI * 2,
        PARTICLE_POINT_SIZE_RANGE.minimum +
          random() * (PARTICLE_POINT_SIZE_RANGE.maximum - PARTICLE_POINT_SIZE_RANGE.minimum),
        cadence,
        0.38 + random() * 0.35,
        random(),
      ],
      index * 8,
    );
  }
  return { vertices, count };
}

export function particleParameters(vertices: Float32Array, index: number): ParticleParameters {
  const at = index * 8;
  return {
    phase: vertices[at],
    radius: vertices[at + 1],
    inclination: vertices[at + 2],
    azimuth: vertices[at + 3],
    size: vertices[at + 4],
    cadence: vertices[at + 5] as ParticleParameters["cadence"],
    opacity: vertices[at + 6],
    tint: vertices[at + 7],
  };
}
