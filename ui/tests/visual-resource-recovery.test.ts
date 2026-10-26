import { describe, expect, it, vi } from "vitest";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";
import { createWebGLBackend } from "../src/visual-engine/webgl";
import { visualInput } from "./fixtures/visual-identity-II";

describe("partially initialized renderer recovery (mock GL only)", () => {
  for (const appearance of [
    "living-connected",
    "radial-shell-experimental",
    "bipolar-peel-experimental",
    "bipolar-film-experimental",
  ] as const)
    for (const { failure, budget } of [
      ...(["second-program", "missing-uniform", "partial-buffer", "none"] as const).map(
        (failure) => ({ failure, budget: RENDER_BUDGETS.low }),
      ),
      { failure: "none", budget: RENDER_BUDGETS.medium },
      { failure: "none", budget: RENDER_BUDGETS.high },
    ]) {
      it(`${appearance}/${budget.quality}/${failure}: retires every owned resource without depending on lose-context support`, () => {
        const live = {
          programs: new Set<object>(),
          shaders: new Set<object>(),
          vaos: new Set<object>(),
          buffers: new Set<object>(),
        };
        let shaders = 0,
          buffers = 0,
          uploads = 0,
          draws = 0;
        let blending = false,
          depthWrite = true;
        let colorWrite = true,
          depthMode = 6,
          offsets = 0;
        const drawStates: {
          blending: boolean;
          depthWrite: boolean;
          colorWrite: boolean;
          depthMode: number;
        }[] = [];
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
          BLEND: 5,
          LESS: 6,
          EQUAL: 7,
          LEQUAL: 8,
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
          bufferData: () => uploads++,
          enable: (cap: number) => {
            if (cap === 5) blending = true;
          },
          disable: (cap: number) => {
            if (cap === 5) blending = false;
          },
          depthMask: (value: boolean) => {
            depthWrite = value;
          },
          colorMask: (...flags: boolean[]) => {
            colorWrite = flags.every(Boolean);
          },
          depthFunc: (mode: number) => {
            depthMode = mode;
          },
          polygonOffset: () => {
            offsets++;
          },
          drawElements: () => {
            draws++;
            drawStates.push({ blending, depthWrite, colorWrite, depthMode });
          },
          drawArrays: () => {
            draws++;
            drawStates.push({ blending, depthWrite, colorWrite, depthMode });
          },
        };
        const gl = new Proxy(mock, {
          get: (target, key) => (key in target ? target[key as keyof typeof target] : () => {}),
        }) as unknown as WebGL2RenderingContext;
        const canvas = { dataset: {}, getContext: () => gl } as unknown as HTMLCanvasElement;
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
          const backend = createWebGLBackend(
            canvas,
            budget,
            DEFAULT_VISUAL_ENGINE_SETTINGS,
            0x5a17,
            new MotionEvaluator(0x5a17),
            appearance,
          );
          if (failure === "none") {
            expect(backend).not.toBeNull();
            expect(uploads).toBe(7);
            const allocationCounts = [shaders, buffers];
            backend?.update(visualInput(0));
            backend?.render(0);
            backend?.render(100);
            expect(draws).toBe(
              2 *
                (appearance === "bipolar-film-experimental" ||
                (budget.membraneDepthPass && appearance !== "bipolar-peel-experimental")
                  ? 10
                  : 9),
            );
            if (appearance === "bipolar-peel-experimental") {
              for (const start of [0, 9]) {
                expect(
                  drawStates
                    .slice(start + 2, start + 8)
                    .map(({ blending, depthWrite }) => ({ blending, depthWrite })),
                ).toEqual(Array.from({ length: 6 }, () => ({ blending: false, depthWrite: true })));
                expect(drawStates[start + 8]).toMatchObject({ blending: true, depthWrite: false });
              }
            }
            if (appearance === "bipolar-film-experimental") {
              for (const start of [0, 10]) {
                expect(drawStates[start + 2]).toEqual({
                  blending: true,
                  depthWrite: true,
                  colorWrite: false,
                  depthMode: 6,
                });
                expect(drawStates.slice(start + 3, start + 9)).toEqual(
                  Array.from({ length: 6 }, () => ({
                    blending: true,
                    depthWrite: false,
                    colorWrite: true,
                    depthMode: 7,
                  })),
                );
                expect(drawStates[start + 9]).toEqual({
                  blending: true,
                  depthWrite: false,
                  colorWrite: true,
                  depthMode: 6,
                });
              }
              expect(offsets).toBe(0);
            }
            expect(uploads).toBe(7);
            expect([shaders, buffers]).toEqual(allocationCounts);
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
