import { describe, expect, it } from "vitest";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { chooseRendererKind, type RendererBackend } from "../src/visual-engine/backend";
import { VisualEngine } from "../src/visual-engine/engine";
import { VisualInputAdapter } from "../src/visual-engine/input";

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
});
