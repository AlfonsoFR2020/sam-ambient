import type { RenderBudget } from "./quality";

export interface IndexedGeometry {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
}

export interface PeelDescriptor {
  readonly family: number;
  readonly center: number;
  readonly halfLength: number;
  readonly width: number;
  readonly lift: number;
  readonly opacity: number;
  readonly phase: number;
  readonly speed: number;
  readonly tiltX: number;
  readonly tiltZ: number;
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

export function createPeelDescriptors(count: number, seed = 0x5a17): readonly PeelDescriptor[] {
  const random = seeded(seed);
  return Array.from({ length: count }, (_, index) => ({
    family: (index % 3) / 3,
    center: -1.25 + random() * 2.5,
    halfLength: 0.22 + random() * 0.36,
    width: 0.018 + random() * 0.037,
    lift: 0.01 + random() * 0.022,
    opacity: 0.28 + random() * 0.44,
    phase: random() * Math.PI * 2,
    speed: (random() < 0.5 ? -1 : 1) * (0.006 + random() * 0.012),
    tiltX: (random() * 2 - 1) * (Math.PI / 15),
    tiltZ: (random() * 2 - 1) * (Math.PI / 15),
  }));
}

/** Static vertex attributes; carrier positions are evaluated in the vertex shader. */
export function createPeelGeometry(budget: RenderBudget, seed?: number): IndexedGeometry {
  const descriptors = createPeelDescriptors(budget.peels, seed);
  const stride = 12;
  const vertices = new Float32Array(budget.peels * budget.peelSamples * 2 * stride);
  const indices = new Uint16Array(budget.peels * (budget.peelSamples - 1) * 6);
  let vertexOffset = 0;
  let indexOffset = 0;
  let base = 0;
  for (const peel of descriptors) {
    for (let sample = 0; sample < budget.peelSamples; sample++) {
      const q = (sample / (budget.peelSamples - 1)) * 2 - 1;
      for (const side of [-1, 1]) {
        vertices.set(
          [
            q,
            side,
            peel.center,
            peel.halfLength,
            peel.width,
            peel.lift,
            peel.opacity,
            peel.phase,
            peel.speed,
            peel.tiltX,
            peel.tiltZ,
            peel.family,
          ],
          vertexOffset,
        );
        vertexOffset += stride;
      }
    }
    for (let sample = 0; sample < budget.peelSamples - 1; sample++) {
      const a = base + sample * 2;
      indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], indexOffset);
      indexOffset += 6;
    }
    base += budget.peelSamples * 2;
  }
  return { vertices, indices };
}
