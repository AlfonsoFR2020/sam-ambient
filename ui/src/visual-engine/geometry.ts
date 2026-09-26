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
  readonly angularRadius: number;
  readonly lift: number;
  readonly opacity: number;
  readonly phase: number;
  readonly asymmetry: number;
}

export const PEEL_WIDTH_RANGE = Object.freeze({ minimum: 0.35, maximum: 0.48 });
export const PEEL_LIFT_RANGE = Object.freeze({ minimum: 0.038, maximum: 0.058 });
export const PEEL_EDGE_LIFT = 0.006;

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
  const random = seeded(seed);
  const rotation = random() * Math.PI * 2;
  return Array.from({ length: count }, (_, index) => {
    // Interleave a fixed 16-site spiral so tier changes add fragments without
    // moving the ones already present on the lower tiers.
    const slot = ((index & 1) << 3) | ((index & 2) << 1) | ((index & 4) >> 1) | ((index & 8) >> 3);
    const y = 1 - (2 * (slot + 0.5)) / 16;
    const longitude = slot * Math.PI * (3 - Math.sqrt(5)) + rotation + (random() - 0.5) * 0.16;
    const horizontal = Math.sqrt(1 - y * y);
    return {
      center: [horizontal * Math.cos(longitude), y, horizontal * Math.sin(longitude)],
      angularRadius:
        PEEL_WIDTH_RANGE.minimum + random() * (PEEL_WIDTH_RANGE.maximum - PEEL_WIDTH_RANGE.minimum),
      lift:
        PEEL_LIFT_RANGE.minimum + random() * (PEEL_LIFT_RANGE.maximum - PEEL_LIFT_RANGE.minimum),
      opacity: 0.91 + random() * 0.07,
      phase: random() * Math.PI * 2,
      asymmetry: (random() - 0.5) * 0.34,
    } as PeelDescriptor;
  });
}

/** Irregular spherical membrane patches, each with an attached outer edge. */
export function createPeelGeometry(budget: RenderBudget, seed?: number): IndexedGeometry {
  const descriptors = createPeelDescriptors(budget.peels, seed);
  const stride = 10;
  const rings = [0.55, 0.82, 1] as const;
  const perPatch = 1 + rings.length * budget.peelSamples;
  const vertices = new Float32Array(budget.peels * perPatch * stride);
  const indices = new Uint16Array(budget.peels * budget.peelSamples * (rings.length * 6 - 3));
  let vertexOffset = 0;
  let indexOffset = 0;
  let base = 0;
  for (const peel of descriptors) {
    const [cx, cy, cz] = peel.center;
    const helper: readonly [number, number, number] = Math.abs(cy) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const tangent = [
      helper[1] * cz - helper[2] * cy,
      helper[2] * cx - helper[0] * cz,
      helper[0] * cy - helper[1] * cx,
    ];
    const length = Math.hypot(...tangent);
    const a = tangent.map((component) => component / length);
    const b = [cy * a[2] - cz * a[1], cz * a[0] - cx * a[2], cx * a[1] - cy * a[0]];
    const write = (direction: readonly number[], radius: number) => {
      vertices.set(
        [
          direction[0],
          direction[1],
          direction[2],
          radius,
          cx,
          cy,
          cz,
          peel.lift,
          peel.opacity,
          peel.phase,
        ],
        vertexOffset,
      );
      vertexOffset += stride;
    };
    write(peel.center, 0);
    for (const radius of rings) {
      for (let sample = 0; sample < budget.peelSamples; sample++) {
        const angle = (sample / budget.peelSamples) * Math.PI * 2;
        const boundary =
          1 +
          peel.asymmetry * Math.cos(angle - peel.phase) +
          0.11 * Math.cos(3 * angle + peel.phase) +
          0.055 * Math.sin(5 * angle - peel.phase);
        const arc = radius * peel.angularRadius * boundary;
        const cosine = Math.cos(arc);
        const sine = Math.sin(arc);
        write(
          [
            cx * cosine + (a[0] * Math.cos(angle) + b[0] * Math.sin(angle)) * sine,
            cy * cosine + (a[1] * Math.cos(angle) + b[1] * Math.sin(angle)) * sine,
            cz * cosine + (a[2] * Math.cos(angle) + b[2] * Math.sin(angle)) * sine,
          ],
          radius,
        );
      }
    }
    for (let sample = 0; sample < budget.peelSamples; sample++) {
      const next = (sample + 1) % budget.peelSamples;
      indices.set([base, base + 1 + sample, base + 1 + next], indexOffset);
      indexOffset += 3;
      for (let ring = 0; ring < rings.length - 1; ring++) {
        const inner = base + 1 + ring * budget.peelSamples;
        const outer = inner + budget.peelSamples;
        indices.set(
          [
            inner + sample,
            outer + sample,
            inner + next,
            inner + next,
            outer + sample,
            outer + next,
          ],
          indexOffset,
        );
        indexOffset += 6;
      }
    }
    base += perPatch;
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
