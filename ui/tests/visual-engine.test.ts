import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { chooseRendererKind, type RendererBackend } from "../src/visual-engine/backend";
import { CanvasBackend } from "../src/visual-engine/canvas";
import { VisualEngine } from "../src/visual-engine/engine";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const fakeCanvas = () => {
  const listeners = new Map<string, EventListener>();
  return {
    className: "",
    style: {} as CSSStyleDeclaration,
    width: 0,
    height: 0,
    setAttribute() {},
    addEventListener(name: string, callback: EventListener) {
      listeners.set(name, callback);
    },
    removeEventListener(name: string) {
      listeners.delete(name);
    },
    remove() {},
    listeners,
  } as unknown as HTMLCanvasElement & { listeners: Map<string, EventListener> };
};

const fakeHost = () => {
  const classes = new Set<string>();
  return {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    appendChild() {},
    getBoundingClientRect: () => ({ width: 390, height: 844 }),
    classes,
  } as unknown as HTMLElement & { classes: Set<string> };
};

describe("visual engine lifecycle", () => {
  it("chooses WebGL, Canvas, then static fallback deterministically", () => {
    expect(chooseRendererKind("auto", true, true)).toBe("webgl2");
    expect(chooseRendererKind("canvas2d", true, true)).toBe("canvas2d");
    expect(chooseRendererKind("webgl2", false, true)).toBe("canvas2d");
    expect(chooseRendererKind("auto", false, false)).toBe("static");
  });

  it("mounts, suspends while hidden, updates, and disposes owned resources", () => {
    let frames = 0;
    let cancelled = 0;
    let disposed = 0;
    let updates = 0;
    const backend: RendererBackend = {
      kind: "webgl2",
      update: () => updates++,
      configure() {},
      resize() {},
      setObjectOrientation() {},
      render() {},
      dispose: () => disposed++,
    };
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: () => backend,
      requestFrame: () => ++frames,
      cancelFrame: () => cancelled++,
      clock: () => 100,
    });
    engine.mount(fakeHost());
    engine.update(new VisualInputAdapter().ingest(INITIAL_UI_STATE, 100));
    expect(engine.rendererKind).toBe("webgl2");
    expect(frames).toBe(1);
    expect(updates).toBe(1);
    engine.setVisible(false);
    expect(cancelled).toBe(1);
    engine.dispose();
    expect(disposed).toBe(1);
  });

  it("falls back without binding Canvas onto a failed WebGL surface", () => {
    let attempts = 0;
    const backend: RendererBackend = {
      kind: "canvas2d",
      update() {},
      configure() {},
      resize() {},
      setObjectOrientation() {},
      render() {},
      dispose() {},
    };
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => {
        attempts++;
        return kind === "webgl2" ? null : backend;
      },
      requestFrame: () => 1,
      cancelFrame() {},
    });
    engine.mount(fakeHost());
    expect(engine.rendererKind).toBe("canvas2d");
    expect(attempts).toBe(2);
    engine.dispose();
  });

  it("rebuilds renderer resources when quality or profile changes the effective budget", () => {
    const particleBudgets: number[] = [];
    let disposed = 0;
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, _kind, budget) => {
        particleBudgets.push(budget.particles);
        return {
          kind: "webgl2",
          update() {},
          configure() {},
          resize() {},
          setObjectOrientation() {},
          render() {},
          dispose: () => disposed++,
        };
      },
      requestFrame: () => 1,
      cancelFrame() {},
    });

    engine.mount(fakeHost());
    engine.configure({ quality: "high", deviceProfile: "high_end" });
    engine.configure({ deviceProfile: "mobile_2020" });

    expect(particleBudgets).toEqual([12, 40, 12]);
    expect(disposed).toBe(2);
    engine.dispose();
  });

  it("forwards direct drag orientation to the active renderer", () => {
    const orientations: number[][] = [];
    let renders = 0;
    const backend: RendererBackend = {
      kind: "webgl2",
      update() {},
      configure() {},
      resize() {},
      setObjectOrientation: (matrix) => orientations.push([...matrix]),
      render: () => renders++,
      dispose() {},
    };
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: () => backend,
      requestFrame: () => 1,
      cancelFrame() {},
    });
    engine.mount(fakeHost());
    const identity = orientations.at(-1);
    engine.beginInteraction(100, 100, 0);
    engine.moveInteraction(160, 130, 16);
    expect(orientations.at(-1)).not.toEqual(identity);
    expect(renders).toBeGreaterThan(0);
    engine.dispose();
  });

  it("applies object orientation in the Canvas fallback", () => {
    const starts: number[][] = [];
    const gradient = { addColorStop() {} } as unknown as CanvasGradient;
    const context = {
      globalAlpha: 1,
      fillStyle: "",
      globalCompositeOperation: "source-over",
      lineCap: "butt",
      lineWidth: 1,
      strokeStyle: "",
      setTransform() {},
      createRadialGradient: () => gradient,
      clearRect() {},
      save() {},
      beginPath() {},
      arc() {},
      fill() {},
      ellipse() {},
      moveTo: (x: number, y: number) => starts.push([x, y]),
      lineTo() {},
      stroke() {},
      restore() {},
    } as unknown as CanvasRenderingContext2D;
    const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
    const backend = new CanvasBackend(
      canvas,
      context,
      RENDER_BUDGETS.low,
      { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" },
      12,
    );
    backend.update(new VisualInputAdapter().ingest(INITIAL_UI_STATE, 0));
    backend.resize(400, 400, 1);
    backend.render(0);
    const initial = starts[0];
    starts.length = 0;
    backend.setObjectOrientation(new Float32Array([0, 0, -1, 0, 1, 0, 1, 0, 0]));
    backend.render(0);
    expect(starts[0]).not.toEqual(initial);
  });
});
