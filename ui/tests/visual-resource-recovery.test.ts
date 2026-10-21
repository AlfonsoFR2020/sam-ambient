import { describe, expect, it, vi } from "vitest";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { createWebGLBackend } from "../src/visual-engine/webgl";

describe("partially initialized renderer recovery (mock GL only)", () => {
  for (const failure of ["second-program", "missing-uniform", "partial-buffer", "none"] as const) {
    it(`${failure}: retires every owned resource without depending on lose-context support`, () => {
      const live = {
        programs: new Set<object>(),
        shaders: new Set<object>(),
        vaos: new Set<object>(),
        buffers: new Set<object>(),
      };
      let shaders = 0,
        buffers = 0;
      const allocate = (kind: keyof typeof live) => {
        const value = {};
        live[kind].add(value);
        return value;
      };
      const mock = {
        VERTEX_SHADER: 1,
        FRAGMENT_SHADER: 2,
        COMPILE_STATUS: 3,
        LINK_STATUS: 4,
        createShader: () => {
          shaders++;
          return allocate("shaders");
        },
        createProgram: () => allocate("programs"),
        getShaderParameter: () => failure !== "second-program" || shaders !== 3,
        getProgramParameter: () => true,
        getShaderInfoLog: () => "intentional test failure",
        getUniformLocation: (_program: object, name: string) =>
          failure === "missing-uniform" && name === "u_contact_count" ? null : { name },
        createVertexArray: () => allocate("vaos"),
        createBuffer: () => {
          buffers++;
          return failure === "partial-buffer" && buffers === 4 ? null : allocate("buffers");
        },
        deleteProgram: (value: object) => {
          expect(live.programs.delete(value)).toBe(true);
        },
        deleteShader: (value: object) => {
          expect(live.shaders.delete(value)).toBe(true);
        },
        deleteVertexArray: (value: object) => {
          expect(live.vaos.delete(value)).toBe(true);
        },
        deleteBuffer: (value: object) => {
          expect(live.buffers.delete(value)).toBe(true);
        },
        getExtension: () => null,
      };
      const gl = new Proxy(mock, {
        get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
      }) as unknown as WebGL2RenderingContext;
      const canvas = { dataset: {}, getContext: () => gl } as unknown as HTMLCanvasElement;
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        const backend = createWebGLBackend(
          canvas,
          RENDER_BUDGETS.low,
          DEFAULT_VISUAL_ENGINE_SETTINGS,
          0x5a17,
          new MotionEvaluator(0x5a17),
        );
        if (failure === "none") {
          expect(backend).not.toBeNull();
          backend?.dispose();
          backend?.dispose();
        } else expect(backend).toBeNull();
        expect(
          Object.fromEntries(Object.entries(live).map(([key, values]) => [key, values.size])),
        ).toEqual({ programs: 0, shaders: 0, vaos: 0, buffers: 0 });
      } finally {
        warn.mockRestore();
      }
    });
  }
});
