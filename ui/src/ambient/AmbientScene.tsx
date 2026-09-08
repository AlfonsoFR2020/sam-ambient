import { useEffect, useRef } from "react";
import { drawField, FIELD_BUDGET } from "./field";
import type { AmbientVisualModel } from "./model";

interface AmbientSceneProps {
  model: AmbientVisualModel;
  reducedMotion: boolean;
}

export function AmbientScene({ model, reducedMotion }: AmbientSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(model);
  const redraw = useRef<() => void>(() => {});
  useEffect(() => {
    latest.current = model;
    if (reducedMotion) redraw.current();
  }, [model, reducedMotion]);
  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext("2d");
    if (!surface || !context) return;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      time = 0;
    let pulse = reducedMotion ? 0 : latest.current.pulse;
    const paint = () => drawField(context, width, height, { ...latest.current, pulse }, time);
    const resize = () => {
      const rect = surface.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(
        window.devicePixelRatio || 1,
        FIELD_BUDGET.pixelRatio,
        Math.sqrt(FIELD_BUDGET.pixels / Math.max(1, width * height)),
      );
      surface.width = Math.round(width * ratio);
      surface.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
    };
    const animate = (now: number) => {
      frame = 0;
      if (document.hidden || reducedMotion) return;
      if (now - last >= 1000 / FIELD_BUDGET.fps) {
        const dt = Math.min((now - last) / 1000, 0.08);
        time += dt;
        pulse += (latest.current.pulse - pulse) * (1 - Math.exp(-dt * 14));
        last = now;
        paint();
      }
      frame = requestAnimationFrame(animate);
    };
    const visibility = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = performance.now();
      if (!document.hidden && !reducedMotion) frame = requestAnimationFrame(animate);
    };
    redraw.current = () => {
      pulse = reducedMotion ? 0 : latest.current.pulse;
      paint();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    document.addEventListener("visibilitychange", visibility);
    resize();
    visibility();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      redraw.current = () => {};
    };
  }, [reducedMotion]);

  return (
    <div
      className="ambient-scene"
      data-state={model.state.toLowerCase()}
      data-reduced-motion={reducedMotion || undefined}
      aria-hidden="true"
    >
      <canvas ref={canvas} className="ambient-scene__field" />
    </div>
  );
}
