import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { createFieldOffsets, LIVING_FIELD_GLSL } from "../src/visual-engine/living-field";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import {
  ORB_FRAGMENT,
  ORB_VERTEX,
  PEEL_FRAGMENT,
  PEEL_VERTEX,
  WebGLBackend,
} from "../src/visual-engine/webgl";

type Vec3 = readonly [number, number, number];
type FieldState = readonly [number, number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v);
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Test-only scalar reference for the shared GLSL construction; never used per frame.
const twist = (direction: Vec3, axis: Vec3, phase: number, amplitude: number): Vec3 => {
  const mu = dot(axis, direction);
  const angle = -(phase + amplitude * (1 - mu * mu) * (1 + 0.35 * mu));
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const perpendicular = cross(axis, direction);
  return [
    direction[0] * c + perpendicular[0] * s + axis[0] * mu * (1 - c),
    direction[1] * c + perpendicular[1] * s + axis[1] * mu * (1 - c),
    direction[2] * c + perpendicular[2] * s + axis[2] * mu * (1 - c),
  ];
};
const transport = (direction: Vec3, state: FieldState): Vec3 => {
  const first = twist(normalize(direction), normalize([0.4, 0.8, 0.3]), state[0], state[2]);
  return normalize(twist(first, normalize([-0.7, 0.2, 0.6]), state[1], state[3]));
};

const latticeHash = (cell: Vec3): number => {
  let hash =
    Math.imul(cell[0], 0x9e3779b9) ^
    Math.imul(cell[1], 0x85ebca6b) ^
    Math.imul(cell[2], 0xc2b2ae35);
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  return (hash ^ (hash >>> 16)) >>> 0;
};
const simplexCorner = (cell: Vec3, offset: Vec3): number => {
  const h = latticeHash(cell) & 15;
  const u = h < 8 ? offset[0] : offset[1];
  const v = h < 4 ? offset[1] : h === 12 || h === 14 ? offset[0] : offset[2];
  const attenuation = Math.max(0, 0.6 - dot(offset, offset));
  return attenuation ** 4 * ((h & 1 ? -u : u) + (h & 2 ? -v : v));
};
const simplex3 = (point: Vec3): number => {
  const skew = (point[0] + point[1] + point[2]) / 3;
  const cell: Vec3 = [
    Math.floor(point[0] + skew),
    Math.floor(point[1] + skew),
    Math.floor(point[2] + skew),
  ];
  const unskew = (cell[0] + cell[1] + cell[2]) / 6;
  const first: Vec3 = [
    point[0] - cell[0] + unskew,
    point[1] - cell[1] + unskew,
    point[2] - cell[2] + unskew,
  ];
  let step1: Vec3;
  let step2: Vec3;
  if (first[0] >= first[1]) {
    if (first[1] >= first[2]) {
      step1 = [1, 0, 0];
      step2 = [1, 1, 0];
    } else if (first[0] >= first[2]) {
      step1 = [1, 0, 0];
      step2 = [1, 0, 1];
    } else {
      step1 = [0, 0, 1];
      step2 = [1, 0, 1];
    }
  } else if (first[1] < first[2]) {
    step1 = [0, 0, 1];
    step2 = [0, 1, 1];
  } else if (first[0] < first[2]) {
    step1 = [0, 1, 0];
    step2 = [0, 1, 1];
  } else {
    step1 = [0, 1, 0];
    step2 = [1, 1, 0];
  }
  const offset = (step: Vec3, multiple: number): Vec3 => [
    first[0] - step[0] + multiple / 6,
    first[1] - step[1] + multiple / 6,
    first[2] - step[2] + multiple / 6,
  ];
  const add = (step: Vec3): Vec3 => [cell[0] + step[0], cell[1] + step[1], cell[2] + step[2]];
  return (
    32 *
    (simplexCorner(cell, first) +
      simplexCorner(add(step1), offset(step1, 1)) +
      simplexCorner(add(step2), offset(step2, 2)) +
      simplexCorner(add([1, 1, 1]), offset([1, 1, 1], 3)))
  );
};
const sample = (direction: Vec3, state: FieldState, seed: number) => {
  const q = transport(direction, state);
  const [a, b] = createFieldOffsets(seed);
  const noise = (scale: number, offset: readonly number[]) =>
    simplex3([scale * q[0] + offset[0], scale * q[1] + offset[1], scale * q[2] + offset[2]]);
  const broad = Math.min(1, Math.max(0, 0.5 + 0.5 * noise(1.8, a)));
  const medium = Math.min(1, Math.max(0, 0.5 + 0.5 * noise(3.6, b)));
  const difference = Math.abs(broad - medium);
  const t = Math.min(1, Math.max(0, (difference - 0.2) / 0.3));
  return {
    q,
    broad,
    medium,
    palette: 0.7 * broad + 0.3 * medium,
    activity: t * t * (3 - 2 * t),
  };
};

const state: FieldState = [0.73, 1.2, 0.18, -0.1];
const expectNear = (
  a: ReturnType<typeof sample>,
  b: ReturnType<typeof sample>,
  tolerance: number,
) => {
  for (let i = 0; i < 3; i++) expect(Math.abs(a.q[i] - b.q[i])).toBeLessThan(tolerance);
  expect(Math.abs(a.broad - b.broad)).toBeLessThan(tolerance);
  expect(Math.abs(a.medium - b.medium)).toBeLessThan(tolerance);
  expect(Math.abs(a.palette - b.palette)).toBeLessThan(tolerance);
  expect(Math.abs(a.activity - b.activity)).toBeLessThan(tolerance);
};

describe("living field substrate", () => {
  it("has no longitude seam and remains continuous at both poles", () => {
    const nearSeam = (angle: number): Vec3 => normalize([Math.cos(angle), 0.3, Math.sin(angle)]);
    expectNear(
      sample(nearSeam(Math.PI - 1e-6), state, 42),
      sample(nearSeam(-Math.PI + 1e-6), state, 42),
      1e-4,
    );
    for (const sign of [-1, 1]) {
      const pole: Vec3 = [0, sign, 0];
      const nearby = normalize([1e-6, sign, -1e-6]);
      expectNear(sample(pole, state, 42), sample(nearby, state, 42), 1e-4);
    }
  });

  it("is deterministic at fixed seed and phase, bounded, and continuous across phase wrap", () => {
    const direction = normalize([0.43, -0.18, 0.88]);
    const first = sample(direction, state, 712);
    expect(sample(direction, state, 712)).toEqual(first);
    expect(sample(direction, state, 713)).not.toEqual(first);
    expect(Math.hypot(...first.q)).toBeCloseTo(1, 10);
    for (const value of [first.broad, first.medium, first.palette, first.activity]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expectNear(
      sample(direction, [2 * Math.PI - 1e-6, state[1], state[2], state[3]], 712),
      sample(direction, [1e-6, state[1], state[2], state[3]], 712),
      1e-4,
    );
  });

  it("shares one object-space GLSL field in body and peel materials", () => {
    for (const fragment of [ORB_FRAGMENT, PEEL_FRAGMENT]) {
      expect(fragment.split(LIVING_FIELD_GLSL)).toHaveLength(2);
      expect(fragment).toContain("sampleLivingField(normalize(v_object_direction))");
      expect(fragment).not.toContain("v_uv");
    }
    expect(ORB_VERTEX).toContain("v_object_direction=a_normal");
    expect(PEEL_VERTEX).toContain("v_object_direction=direction");
    expect(LIVING_FIELD_GLSL).toContain("simplex3(1.8 * q + u_field_offset_a)");
    expect(LIVING_FIELD_GLSL).toContain("simplex3(3.6 * q + u_field_offset_b)");
  });

  it("feeds identical seeded field uniforms to two materials within four draws", () => {
    const shaderSources: string[] = [];
    const states: { program: object; values: number[] }[] = [];
    const offsets: { program: object; name: string; values: number[] }[] = [];
    const draws: string[] = [];
    let currentProgram: object = {};
    const gl = new Proxy(
      {
        VERTEX_SHADER: 1,
        FRAGMENT_SHADER: 2,
        COMPILE_STATUS: 3,
        LINK_STATUS: 4,
        COLOR_BUFFER_BIT: 1,
        DEPTH_BUFFER_BIT: 2,
        createShader: (type: number) => ({ type }),
        shaderSource: (_shader: object, source: string) => shaderSources.push(source),
        getShaderParameter: () => true,
        createProgram: () => ({}),
        getProgramParameter: () => true,
        createVertexArray: () => ({}),
        createBuffer: () => ({}),
        getUniformLocation: (program: object, name: string) => ({ program, name }),
        useProgram: (program: object) => {
          currentProgram = program;
        },
        uniform4f: (_location: object, ...values: number[]) => {
          states.push({ program: currentProgram, values });
        },
        uniform3f: (location: { name: string }, ...values: number[]) => {
          offsets.push({ program: currentProgram, name: location.name, values });
        },
        drawElements: () => draws.push("indexed"),
        drawArrays: () => draws.push("array"),
      },
      { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
    ) as unknown as WebGL2RenderingContext;
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const motion = new MotionEvaluator(42);
    const backend = new WebGLBackend(
      canvas,
      gl,
      RENDER_BUDGETS.low,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      42,
      motion,
    );
    backend.update(new VisualInputAdapter().ingest(INITIAL_UI_STATE, 0));
    backend.render(0);
    expect(shaderSources.filter((source) => source.includes(LIVING_FIELD_GLSL))).toHaveLength(2);
    expect(states).toHaveLength(2);
    expect(states[0].values).toEqual(states[1].values);
    expect(states[0].program).not.toBe(states[1].program);
    expect(offsets).toHaveLength(4);
    expect(offsets[0].values).toEqual(offsets[2].values);
    expect(offsets[1].values).toEqual(offsets[3].values);
    expect(draws).toEqual(["indexed", "indexed", "indexed", "array"]);
    backend.dispose();
  });
});
