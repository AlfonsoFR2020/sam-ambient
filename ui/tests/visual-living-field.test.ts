import { describe, expect, it, vi } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { createFieldOffsets, LIVING_FIELD_GLSL } from "../src/visual-engine/living-field";
import {
  FINE_DETAIL_AMPLITUDES,
  LIVING_MATERIAL_GLSL,
  LIVING_SURFACE_VERTEX_GLSL,
  sampleLivingPigment,
} from "../src/visual-engine/living-material";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import {
  createWebGLBackend,
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
const twist = (
  direction: Vec3,
  axis: Vec3,
  companion: Vec3,
  phase: number,
  amplitude: number,
): Vec3 => {
  const mu = dot(axis, direction);
  const profile = (1 - mu * mu) * (1 + 0.35 * mu) * (1 + 0.42 * dot(companion, direction));
  const angle = -(phase + amplitude * profile);
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
  const a = normalize([0.4, 0.8, 0.3]);
  const b = normalize([-0.7, 0.2, 0.6]);
  const first = twist(normalize(direction), a, b, state[0], state[2]);
  return normalize(twist(first, b, a, state[1], state[3]));
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
const sample = (direction: Vec3, state: FieldState, seed: number, balance = 0.7) => {
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
    palette: balance * broad + (1 - balance) * medium,
    activity: t * t * (3 - 2 * t),
  };
};

const state: FieldState = [0.73, 1.2, 0.18, -0.1];
const fibonacciDirection = (index: number, count: number): Vec3 => {
  const y = 1 - (2 * (index + 0.5)) / count;
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const radial = Math.sqrt(1 - y * y);
  return [Math.cos(angle) * radial, y, Math.sin(angle) * radial];
};
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const scale = (direction: Vec3, factor: number): Vec3 => [
  direction[0] * factor,
  direction[1] * factor,
  direction[2] * factor,
];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const displacement = (
  direction: Vec3,
  breath: number,
  ripplePhase: number,
  deformation: number,
  ripple: number,
) => {
  const broad = sample(direction, state, 42).broad;
  return clamp(
    0.012 * (broad - 0.5) +
      0.006 * Math.sin(breath) * (1 + 0.2 * (broad - 0.5)) +
      deformation *
        0.55 *
        Math.sin(3 * dot(normalize([-0.25, 0.91, 0.32]), direction) + ripplePhase) +
      ripple * 0.35 * Math.sin(7 * dot(normalize([0.41, -0.36, 0.84]), direction) - ripplePhase),
    -0.04,
    0.04,
  );
};
const bodyPoint = (direction: Vec3, breath: number): Vec3 => {
  const n = normalize(direction);
  const point = scale(n, 1 + displacement(n, breath, 0.5, 0.026, 0.022));
  return [point[0], point[1] * 1.06, point[2]];
};
const bodyNormal = (direction: Vec3, breath: number): Vec3 => {
  const n = normalize(direction);
  const helper: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangentA = normalize(cross(helper, n));
  const tangentB = normalize(cross(n, tangentA));
  const point = bodyPoint(n, breath);
  const pointA = bodyPoint(normalize(add(n, scale(tangentA, 0.012))), breath);
  const pointB = bodyPoint(normalize(add(n, scale(tangentB, 0.012))), breath);
  return normalize(cross(subtract(pointA, point), subtract(pointB, point)));
};
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
  it("deforms broad front-facing material relationships instead of only rotating a texture", () => {
    const evaluator = new MotionEvaluator(0x5a17);
    const input = new VisualInputAdapter().ingest(
      { ...INITIAL_UI_STATE, connection: "connected", provider: "demo", model: "demo" },
      0,
    );
    const start = evaluator.evaluate(input, 0, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const initial: FieldState = [
      start.fieldPhase1,
      start.fieldPhase2,
      start.fieldTwist1,
      start.fieldTwist2,
    ];
    const initialBalance = start.paletteBalance;
    for (let time = 50; time <= 6_000; time += 50)
      evaluator.evaluate(input, time, DEFAULT_VISUAL_ENGINE_SETTINGS, RENDER_BUDGETS.low);
    const end = evaluator.currentFrame;
    const later: FieldState = [end.fieldPhase1, end.fieldPhase2, end.fieldTwist1, end.fieldTwist2];
    const front = Array.from({ length: 512 }, (_, i) => fibonacciDirection(i, 512)).filter(
      (direction) => direction[2] > 0.3,
    );
    let changedSeparation = 0;
    let changedPalette = 0;
    let frameChange = 0;
    const nextFrame: FieldState = [
      later[0] + (0.14 * 0.6) / 30,
      later[1] - (0.09 * 0.6) / 30,
      later[2],
      later[3],
    ];
    for (let i = 0; i < front.length; i++) {
      const direction = front[i];
      const other = front[(i + 31) % front.length];
      const first = sample(direction, initial, 0x5a17, initialBalance);
      const second = sample(direction, later, 0x5a17, end.paletteBalance);
      changedSeparation += Math.abs(
        dot(first.q, sample(other, initial, 0x5a17).q) -
          dot(second.q, sample(other, later, 0x5a17).q),
      );
      changedPalette += Math.abs(first.palette - second.palette);
      frameChange += Math.abs(
        second.palette - sample(direction, nextFrame, 0x5a17, end.paletteBalance).palette,
      );
    }
    expect(changedSeparation / front.length).toBeGreaterThan(0.03);
    expect(changedPalette / front.length).toBeGreaterThan(0.04);
    expect(frameChange / front.length).toBeLessThan(0.005);
  });

  it("moves pigment at fixed object directions over human time without boiling frame to frame", () => {
    const tenSeconds: FieldState = [
      state[0] + 0.14 * 0.6 * 10,
      state[1] - 0.09 * 0.6 * 10,
      state[2],
      state[3],
    ];
    const oneFrame: FieldState = [
      state[0] + (0.14 * 0.6) / 30,
      state[1] - (0.09 * 0.6) / 30,
      state[2],
      state[3],
    ];
    let longChange = 0;
    let frameChange = 0;
    for (let index = 0; index < 128; index++) {
      const direction = fibonacciDirection(index, 128);
      const first = sample(direction, state, 42).palette;
      longChange += Math.abs(sample(direction, tenSeconds, 42).palette - first);
      frameChange += Math.abs(sample(direction, oneFrame, 42).palette - first);
    }
    expect(longChange / 128).toBeGreaterThan(0.06);
    expect(frameChange / 128).toBeLessThan(0.005);
  });

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
      expect(fragment.split(LIVING_MATERIAL_GLSL)).toHaveLength(2);
      expect(fragment).toContain("sampleLivingField(normalize(v_object_direction))");
      expect(fragment).toContain("LivingPigment pigment=livingPigment(field)");
      expect(fragment).not.toContain("v_uv");
    }
    for (const vertex of [ORB_VERTEX, PEEL_VERTEX]) {
      expect(vertex).toContain(LIVING_SURFACE_VERTEX_GLSL);
      expect(vertex).toContain("livingBodyPoint(");
    }
    expect(ORB_VERTEX).toContain("v_object_direction=a_normal");
    expect(PEEL_VERTEX).toContain("v_object_direction=direction");
    for (const vertex of [ORB_VERTEX, PEEL_VERTEX]) {
      expect(vertex).toContain("uniform mat3 u_object_orientation;");
      expect(vertex).toContain("*u_object_orientation");
    }
    expect(ORB_VERTEX).toContain("livingBodyNormal(");
    expect(LIVING_FIELD_GLSL).toContain("simplex3(1.8 * transportedDirection + u_field_offset_a)");
    expect(LIVING_FIELD_GLSL).toContain("simplex3(3.6 * q + u_field_offset_b)");
  });

  it("maps bounded, warm-dominant but non-monochrome pigments over the sphere", () => {
    let warm = 0;
    let cool = 0;
    let blueDominant = 0;
    let darkestRed = 1;
    let brightestRed = 0;
    for (let i = 0; i < 512; i++) {
      const field = sample(fibonacciDirection(i, 512), state, 42);
      const pigment = sampleLivingPigment(field);
      expect(sampleLivingPigment(field)).toEqual(pigment);
      for (const channel of pigment.albedo) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
      if (pigment.cool < 0.5) warm++;
      else cool++;
      if (pigment.albedo[2] > pigment.albedo[0]) blueDominant++;
      darkestRed = Math.min(darkestRed, pigment.albedo[0]);
      brightestRed = Math.max(brightestRed, pigment.albedo[0]);
    }
    expect(warm).toBeGreaterThan(256);
    expect(cool).toBeGreaterThan(12);
    expect(blueDominant).toBeGreaterThan(4);
    expect(brightestRed - darkestRed).toBeGreaterThan(0.25);
  });

  it("evolves local warm and cool boundaries without globally tinting every region", () => {
    const pigmentAt = (broad: number, medium: number, balance: number, contrast: number) => {
      const blend = balance * broad + (1 - balance) * medium;
      return sampleLivingPigment(
        { broad, medium, palette: clamp(0.5 + (blend - 0.5) * contrast, 0, 1) },
        balance,
        contrast,
      );
    };
    const coolFoldA = pigmentAt(0.42, 0.62, 0.61, 0.86);
    const coolFoldB = pigmentAt(0.42, 0.62, 0.75, 1.14);
    expect(Math.abs(coolFoldA.cool - coolFoldB.cool)).toBeGreaterThan(0.03);
    const stableWarmA = pigmentAt(0.9, 0.2, 0.61, 0.86);
    const stableWarmB = pigmentAt(0.9, 0.2, 0.75, 1.14);
    expect(stableWarmA.cool).toBe(0);
    expect(stableWarmB.cool).toBe(0);
    expect(stableWarmA.albedo[0]).toBeGreaterThan(stableWarmA.albedo[2]);
    expect(stableWarmB.albedo[0]).toBeGreaterThan(stableWarmB.albedo[2]);
  });

  it("bounds field/breath/audio displacement and keeps tangent normals stable at poles", () => {
    expect(LIVING_SURFACE_VERTEX_GLSL).toContain("sampleBroadDensity(n)");
    expect(LIVING_SURFACE_VERTEX_GLSL).toContain("clamp(0.012 * (broad - 0.5)");
    expect(LIVING_SURFACE_VERTEX_GLSL).toContain("abs(n.y) < 0.9");
    for (let i = 0; i < 512; i++) {
      const direction = fibonacciDirection(i, 512);
      const value = displacement(direction, i * 0.13, i * 0.07, 0.026, 0.022);
      expect(value).toBeGreaterThanOrEqual(-0.04);
      expect(value).toBeLessThanOrEqual(0.04);
      const normal = bodyNormal(direction, i * 0.13);
      expect(normal.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...normal)).toBeCloseTo(1, 6);
      expect(dot(normal, direction)).toBeGreaterThan(0.8);
    }
    for (const direction of [
      [0, 1, 0],
      [0, -1, 0],
    ] as Vec3[]) {
      const normal = bodyNormal(direction, 1.2);
      expect(normal.every(Number.isFinite)).toBe(true);
      expect(dot(normal, direction)).toBeGreaterThan(0.8);
    }
  });

  it("keeps object-space pigment under drag while world-space illumination changes", () => {
    const direction = normalize([0.33, -0.26, 0.91]);
    const material = sampleLivingPigment(sample(direction, state, 42));
    const normal = bodyNormal(direction, 0.4);
    const rotated: Vec3 = [normal[2], normal[1], -normal[0]];
    const light = normalize([0.6, 0.2, 1.2]);
    expect(sampleLivingPigment(sample(direction, state, 42))).toEqual(material);
    expect(Math.abs(dot(normal, light) - dot(rotated, light))).toBeGreaterThan(0.2);
    expect(ORB_VERTEX).toContain("v_normal=normalize(rotation*localNormal)");
    expect(ORB_VERTEX).toContain("v_object_direction=a_normal");
    expect(LIVING_MATERIAL_GLSL).toContain("orbit - position");
  });

  it("keeps seeded field/material identity and four draws across all quality tiers", () => {
    let baseFragments: string[] | undefined;
    let baseOffsets: number[][] | undefined;
    for (const budget of Object.values(RENDER_BUDGETS)) {
      const shaderSources: string[] = [];
      const states: { program: object; values: number[] }[] = [];
      const offsets: { program: object; name: string; values: number[] }[] = [];
      const draws: string[] = [];
      const materialIntensity: number[] = [];
      const paletteBalanceUniforms: { program: object; value: number }[] = [];
      const deleted = { programs: 0, vaos: 0, buffers: 0 };
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
          deleteProgram: () => deleted.programs++,
          deleteVertexArray: () => deleted.vaos++,
          deleteBuffer: () => deleted.buffers++,
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
          uniform1f: (location: { name: string }, value: number) => {
            if (location.name === "u_intensity") materialIntensity.push(value);
            if (location.name === "u_palette_balance")
              paletteBalanceUniforms.push({ program: currentProgram, value });
          },
          drawElements: () => draws.push("indexed"),
          drawArrays: () => draws.push("array"),
        },
        { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}) },
      ) as unknown as WebGL2RenderingContext;
      const backend = new WebGLBackend(
        { width: 0, height: 0 } as HTMLCanvasElement,
        gl,
        budget,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        42,
        new MotionEvaluator(42),
      );
      const adapter = new VisualInputAdapter();
      backend.update(adapter.ingest(INITIAL_UI_STATE, 0));
      backend.render(0);
      expect(materialIntensity.slice(-2)).toEqual([0.82, 0.82]);
      backend.configure({ ...DEFAULT_VISUAL_ENGINE_SETTINGS, intensity: 0.1 });
      backend.render(50);
      expect(materialIntensity.slice(-2)).toEqual([0.1, 0.1]);
      backend.update(
        adapter.ingest(
          {
            ...INITIAL_UI_STATE,
            connection: "connected",
            provider: "local",
            model: "chat",
            sessionId: "session",
            generationId: "generation",
            conversationalState: "SPEAKING",
            ttsOutputEnabled: true,
            lastMonotonicByType: { "tts.level": 100 },
            metrics: { ...INITIAL_UI_STATE.metrics, playbackEnvelope: 0.6 },
          },
          100,
        ),
      );
      backend.render(100);
      backend.render(150);
      expect(materialIntensity.at(-2)).toBeGreaterThan(0.1);
      expect(materialIntensity.at(-1)).toBe(materialIntensity.at(-2));
      const fragments = shaderSources.filter((source) => source.includes(LIVING_MATERIAL_GLSL));
      expect(shaderSources.filter((source) => source.includes(LIVING_FIELD_GLSL))).toHaveLength(4);
      expect(fragments).toHaveLength(2);
      for (const fragment of fragments) {
        expect(fragment).toContain(`#define SAM_FINE_OCTAVES ${budget.fineOctaves}`);
        expect(fragment).toContain("sampleLivingField(normalize(v_object_direction))");
        expect(fragment).toContain("LivingPigment pigment=livingPigment(field)");
      }
      expect(PEEL_VERTEX).toContain("curvedNormal");
      expect(PEEL_FRAGMENT).toContain("smoothstep(.72,.98,v_radial)");
      expect(PEEL_FRAGMENT).not.toContain("dFdx(v_position)");
      const normalized = fragments.map((source) =>
        source.replace(
          `#define SAM_FINE_OCTAVES ${budget.fineOctaves}`,
          "#define SAM_FINE_OCTAVES 0",
        ),
      );
      if (baseFragments) expect(normalized).toEqual(baseFragments);
      else baseFragments = normalized;
      expect(states).toHaveLength(8);
      expect(states[0].values).toEqual(states[1].values);
      expect(states[0].program).not.toBe(states[1].program);
      expect(paletteBalanceUniforms).toHaveLength(8);
      expect(paletteBalanceUniforms[0].value).toBe(paletteBalanceUniforms[1].value);
      expect(paletteBalanceUniforms[2].value).toBe(paletteBalanceUniforms[3].value);
      expect(offsets).toHaveLength(4);
      expect(offsets[0].values).toEqual(offsets[2].values);
      expect(offsets[1].values).toEqual(offsets[3].values);
      const seeded = offsets.map((entry) => entry.values);
      if (baseOffsets) expect(seeded).toEqual(baseOffsets);
      else baseOffsets = seeded;
      expect(draws).toEqual([
        "indexed",
        "indexed",
        "indexed",
        "array",
        "indexed",
        "indexed",
        "indexed",
        "array",
        "indexed",
        "indexed",
        "indexed",
        "array",
        "indexed",
        "indexed",
        "indexed",
        "array",
      ]);
      backend.dispose();
      expect(deleted).toEqual({ programs: 4, vaos: 4, buffers: 7 });
    }
  });

  it("makes optional fine detail deterministic and unable to move primary pigment", () => {
    expect(FINE_DETAIL_AMPLITUDES).toEqual([0.06, 0.025]);
    expect(LIVING_MATERIAL_GLSL).toContain("simplex3(7.2 * field.transported");
    expect(LIVING_MATERIAL_GLSL).toContain("simplex3(14.4 * field.transported");
    const [offsetA, offsetB] = createFieldOffsets(42);
    for (let i = 0; i < 256; i++) {
      const field = sample(fibonacciDirection(i, 256), state, 42);
      const pigment = sampleLivingPigment(field);
      const q = field.q;
      const sampleFine = (frequency: number, offset: Vec3) =>
        simplex3([
          frequency * q[0] + offset[0],
          frequency * q[1] + offset[1],
          frequency * q[2] + offset[2],
        ]);
      const first = FINE_DETAIL_AMPLITUDES[0] * sampleFine(7.2, offsetA);
      const second = FINE_DETAIL_AMPLITUDES[1] * sampleFine(14.4, offsetB);
      for (const budget of Object.values(RENDER_BUDGETS)) {
        const detail =
          (budget.fineOctaves >= 1 ? first : 0) + (budget.fineOctaves >= 2 ? second : 0);
        expect(Math.abs(detail)).toBeLessThanOrEqual(0.085);
        expect(sampleLivingPigment(field)).toEqual(pigment);
      }
    }
  });

  it("records shader-build and missing-WebGL fallback causes without suppressing them", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const failingGL = {
        VERTEX_SHADER: 1,
        createShader: () => ({}),
        createProgram: () => ({}),
        shaderSource() {},
        compileShader() {},
        getShaderParameter: () => false,
        getShaderInfoLog: () => "undeclared uniform",
        deleteShader() {},
        getExtension: () => null,
      } as unknown as WebGL2RenderingContext;
      const shaderCanvas = {
        dataset: {} as DOMStringMap,
        getContext: () => failingGL,
      } as unknown as HTMLCanvasElement;
      expect(
        createWebGLBackend(
          shaderCanvas,
          RENDER_BUDGETS.low,
          DEFAULT_VISUAL_ENGINE_SETTINGS,
          42,
          new MotionEvaluator(42),
        ),
      ).toBeNull();
      expect(shaderCanvas.dataset.samWebglFailure).toBe("shader-build");
      expect(warn).toHaveBeenCalledOnce();
      expect(String(warn.mock.calls[0]?.[1])).toContain("undeclared uniform");
      const missingCanvas = {
        dataset: {} as DOMStringMap,
        getContext: () => null,
      } as unknown as HTMLCanvasElement;
      expect(
        createWebGLBackend(
          missingCanvas,
          RENDER_BUDGETS.low,
          DEFAULT_VISUAL_ENGINE_SETTINGS,
          42,
          new MotionEvaluator(42),
        ),
      ).toBeNull();
      expect(missingCanvas.dataset.samWebglFailure).toBe("context-unavailable");
    } finally {
      warn.mockRestore();
    }
  });
});
