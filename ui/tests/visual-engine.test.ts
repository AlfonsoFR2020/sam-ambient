import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { chooseRendererKind, type RendererBackend } from "../src/visual-engine/backend";
import { CanvasBackend } from "../src/visual-engine/canvas";
import { VisualEngine } from "../src/visual-engine/engine";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import type { VisualInputV1 } from "../src/visual-engine/types";
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

const fakeHost = (width = 390, height = 844) => {
  const classes = new Set<string>();
  return {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    appendChild() {},
    getBoundingClientRect: () => ({ width, height }),
    classes,
  } as unknown as HTMLElement & { classes: Set<string> };
};

const readyInput = () => {
  const input = new VisualInputAdapter().ingest(INITIAL_UI_STATE, 100);
  return {
    ...input,
    interaction: { ...input.interaction, availability: "ready" as const },
  };
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
    engine.update(readyInput());
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

  it("retains engine-owned field phase through backend changes, drag, and hidden resume", () => {
    let now = 0;
    let nextFrame = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const evaluators: MotionEvaluator[] = [];
    const renders: { phase: number; twist: number; orientation: number[] }[] = [];
    const engine = new VisualEngine({
      seed: 33,
      createCanvas: fakeCanvas,
      clock: () => now,
      requestFrame: (callback) => {
        callbacks.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelFrame: (handle) => callbacks.delete(handle),
      backendFactory: (_canvas, kind, budget, settings, _seed, motion) => {
        evaluators.push(motion);
        let input: VisualInputV1 = readyInput();
        let orientation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        return {
          kind,
          update: (next) => {
            input = next;
          },
          configure() {},
          resize() {},
          setObjectOrientation: (matrix) => {
            orientation = [...matrix];
          },
          render: (time) => {
            const frame = motion.evaluate(input, time, settings, budget);
            renders.push({ phase: frame.fieldPhase1, twist: frame.fieldTwist1, orientation });
          },
          dispose() {},
        };
      },
    });
    const tick = (time: number) => {
      const pending = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(pending[0]);
      now = time;
      pending[1](time);
    };
    engine.mount(fakeHost());
    engine.update(readyInput());
    tick(50);
    tick(100);
    const phaseBeforeReplacement = renders.at(-1)?.phase;
    engine.configure({ quality: "high", deviceProfile: "high_end" });
    expect(evaluators[1]).toBe(evaluators[0]);
    expect(renders.at(-1)?.phase).toBe(phaseBeforeReplacement);
    engine.configure({ renderer: "canvas2d" });
    expect(evaluators[2]).toBe(evaluators[0]);
    expect(renders.at(-1)?.phase).toBe(phaseBeforeReplacement);
    engine.beginInteraction(100, 100, now);
    engine.moveInteraction(160, 130, now);
    expect(renders.at(-1)?.orientation).not.toEqual(renders.at(-2)?.orientation);
    expect(renders.at(-1)?.phase).toBe(phaseBeforeReplacement);
    engine.setVisible(false);
    engine.setVisible(true);
    tick(50_000);
    expect(renders.at(-1)?.phase).toBe(phaseBeforeReplacement);
    engine.dispose();
  });

  it("allocates no renderer while disabled and releases one when disabled later", () => {
    let creations = 0;
    let disposals = 0;
    const engine = new VisualEngine({
      settings: { enabled: false },
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => {
        creations++;
        return {
          kind,
          update() {},
          configure() {},
          resize() {},
          setObjectOrientation() {},
          render() {},
          dispose: () => disposals++,
        };
      },
      requestFrame: () => 1,
      cancelFrame() {},
    });
    engine.mount(fakeHost());
    expect(creations).toBe(0);
    expect(engine.rendererKind).toBe("static");
    engine.configure({ enabled: true });
    expect(creations).toBe(1);
    engine.configure({ enabled: false });
    expect(disposals).toBe(1);
    expect(engine.rendererKind).toBe("static");
    engine.dispose();
  });

  it("suspends zero-size scenes until they receive usable bounds", () => {
    let frames = 0;
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => ({
        kind,
        update() {},
        configure() {},
        resize() {},
        setObjectOrientation() {},
        render() {},
        dispose() {},
      }),
      requestFrame: () => ++frames,
      cancelFrame() {},
    });
    engine.mount(fakeHost(0, 0));
    engine.update(readyInput());
    expect(frames).toBe(0);
    engine.resize(320, 240);
    expect(frames).toBe(1);
    engine.dispose();
  });

  it("caps reduced-motion redraws at 15 Hz while retaining the latest input", () => {
    let now = 0;
    let renders = 0;
    let nextFrame = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const engine = new VisualEngine({
      settings: { reducedMotion: "on" },
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => ({
        kind,
        update() {},
        configure() {},
        resize() {},
        setObjectOrientation() {},
        render: () => renders++,
        dispose() {},
      }),
      clock: () => now,
      requestFrame: (callback) => {
        callbacks.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelFrame: (handle) => callbacks.delete(handle),
    });
    const input = readyInput();
    engine.mount(fakeHost());
    engine.update(input);
    expect(renders).toBe(1);
    now = 10;
    engine.update({ ...input, sequence: input.sequence + 1 });
    expect(renders).toBe(1);
    const early = callbacks.entries().next().value as [number, FrameRequestCallback];
    callbacks.delete(early[0]);
    early[1](20);
    expect(renders).toBe(1);
    const due = callbacks.entries().next().value as [number, FrameRequestCallback];
    callbacks.delete(due[0]);
    due[1](70);
    expect(renders).toBe(2);
    expect(callbacks.size).toBe(0);
    now = 1_000;
    engine.update({
      ...input,
      sequence: input.sequence + 2,
      interaction: { ...input.interaction, foreground: "speaking", speaking: true },
    });
    expect(renders).toBe(3);
    for (const timestamp of [1_067, 1_134, 1_201]) {
      const transition = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(transition[0]);
      transition[1](timestamp);
    }
    expect(renders).toBe(6);
    expect(callbacks.size).toBe(0);
    engine.dispose();
  });

  it("caps the Canvas fallback at 30 active frames per second", () => {
    let renders = 0;
    let nextFrame = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const engine = new VisualEngine({
      settings: { quality: "high", renderer: "canvas2d" },
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => ({
        kind,
        update() {},
        configure() {},
        resize() {},
        setObjectOrientation() {},
        render: () => renders++,
        dispose() {},
      }),
      requestFrame: (callback) => {
        callbacks.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelFrame: (handle) => callbacks.delete(handle),
      clock: () => 0,
    });
    const input = readyInput();
    engine.mount(fakeHost());
    engine.update({
      ...input,
      interaction: { ...input.interaction, foreground: "speaking", speaking: true },
    });
    for (const timestamp of [100, 116, 134]) {
      const pending = callbacks.entries().next().value as [number, FrameRequestCallback];
      callbacks.delete(pending[0]);
      pending[1](timestamp);
    }
    expect(renders).toBe(2);
    engine.dispose();
  });

  it("defers a hidden stopped-state frame until the surface is visible", () => {
    let renders = 0;
    let nextFrame = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const engine = new VisualEngine({
      createCanvas: fakeCanvas,
      backendFactory: (_canvas, kind) => ({
        kind,
        update() {},
        configure() {},
        resize() {},
        setObjectOrientation() {},
        render: () => renders++,
        dispose() {},
      }),
      requestFrame: (callback) => {
        callbacks.set(++nextFrame, callback);
        return nextFrame;
      },
      cancelFrame: (handle) => callbacks.delete(handle),
      clock: () => 100,
    });
    const input = readyInput();
    engine.mount(fakeHost());
    engine.update(input);
    engine.setVisible(false);
    engine.update({
      ...input,
      sequence: input.sequence + 1,
      interaction: { ...input.interaction, availability: "stopped" },
    });
    expect(renders).toBe(0);
    engine.setVisible(true);
    const pending = callbacks.entries().next().value as [number, FrameRequestCallback];
    callbacks.delete(pending[0]);
    pending[1](100);
    expect(renders).toBe(1);
    expect(callbacks.size).toBe(0);
    engine.dispose();
  });

  it("falls back on context loss, retries twice, then remains on Canvas", () => {
    const canvases: ReturnType<typeof fakeCanvas>[] = [];
    const callbacks = new Map<number, FrameRequestCallback>();
    let frame = 0;
    const engine = new VisualEngine({
      createCanvas: () => {
        const canvas = fakeCanvas();
        canvases.push(canvas);
        return canvas;
      },
      backendFactory: (_canvas, kind) => ({
        kind,
        update() {},
        configure() {},
        resize() {},
        setObjectOrientation() {},
        render() {},
        dispose() {},
      }),
      requestFrame: (callback) => {
        callbacks.set(++frame, callback);
        return frame;
      },
      cancelFrame: (handle) => callbacks.delete(handle),
    });
    const loseContext = () => {
      const listener = canvases.at(-1)?.listeners.get("webglcontextlost");
      expect(listener).toBeDefined();
      listener?.({ preventDefault() {} } as Event);
    };
    const restore = () => {
      const pending = callbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;
      expect(pending).toBeDefined();
      if (!pending) return;
      callbacks.delete(pending[0]);
      pending[1](0);
    };

    engine.mount(fakeHost());
    loseContext();
    expect(engine.rendererKind).toBe("canvas2d");
    restore();
    expect(engine.rendererKind).toBe("webgl2");
    loseContext();
    restore();
    expect(engine.rendererKind).toBe("webgl2");
    loseContext();
    expect(engine.rendererKind).toBe("canvas2d");
    expect(callbacks.size).toBe(0);
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
    engine.update(readyInput());
    const identity = orientations.at(-1);
    engine.beginInteraction(100, 100, 0);
    engine.moveInteraction(160, 130, 16);
    expect(orientations.at(-1)).not.toEqual(identity);
    expect(renders).toBeGreaterThan(0);
    engine.dispose();
  });

  it("applies object orientation in the Canvas fallback", () => {
    const starts: number[][] = [];
    let points = 0;
    let gradients = 0;
    let transforms = 0;
    const gradient = { addColorStop() {} } as unknown as CanvasGradient;
    const context = {
      globalAlpha: 1,
      fillStyle: "",
      globalCompositeOperation: "source-over",
      lineCap: "butt",
      lineWidth: 1,
      strokeStyle: "",
      setTransform: () => transforms++,
      createRadialGradient: () => {
        gradients++;
        return gradient;
      },
      clearRect() {},
      save() {},
      beginPath() {},
      arc() {},
      fill() {},
      ellipse() {},
      moveTo: (x: number, y: number) => starts.push([x, y]),
      lineTo: () => points++,
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
      new MotionEvaluator(12),
    );
    backend.update(new VisualInputAdapter().ingest(INITIAL_UI_STATE, 0));
    backend.resize(400, 400, 2);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
    backend.resize(400, 400, 2);
    expect(gradients).toBe(1);
    expect(transforms).toBe(1);
    backend.render(0);
    expect(starts.length + points).toBeGreaterThan(0);
    expect(starts.length + points).toBeLessThan(3 * 48);
    const initial = starts[0];
    starts.length = 0;
    backend.setObjectOrientation(new Float32Array([0, 0, -1, 0, 1, 0, 1, 0, 0]));
    backend.render(0);
    expect(starts[0]).not.toEqual(initial);
  });
});
