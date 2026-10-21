import {
  PARTICLE_POINT_SIZE_RANGE,
  PARTICLE_RADIUS_RANGE,
  type ParticleParameters,
} from "./particles";


export interface IndexedGeometry {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
}

export interface ArrayGeometry {
  readonly vertices: Float32Array;
  readonly count: number;
}

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
