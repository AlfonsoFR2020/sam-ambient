import type { AmbientVisualModel } from "./model";

export const FIELD_BUDGET = {
  particles: 64,
  ribbons: 5,
  points: 96,
  fps: 30,
  pixelRatio: 1.5,
  pixels: 4_000_000,
};

export function fieldShape(model: AmbientVisualModel) {
  const energy = Math.min(1, Math.max(0, model.pulse));
  switch (model.state) {
    case "LISTENING":
    case "USER_SPEAKING":
    case "ENDPOINT_CANDIDATE":
      return { opening: 0.6, fold: 0.3, speed: 0.42, amplitude: 0.16 + energy * 0.28 };
    case "COMMITTING":
      return { opening: 0.18, fold: 1.6, speed: 0.6, amplitude: 0.12 };
    case "THINKING":
      return { opening: 0.3, fold: 1.15, speed: 0.32, amplitude: 0.25 };
    case "SPEAKING":
      return { opening: 0.36, fold: 0.55, speed: 0.7, amplitude: 0.2 + energy * 0.65 };
    case "INTERRUPTION_CANDIDATE":
    case "INTERRUPTED":
      return { opening: 0.78, fold: 0.2, speed: 0.5, amplitude: 0.28 };
    case "OFFLINE":
    case "ERROR":
      return { opening: 0.12, fold: 0.4, speed: 0.08, amplitude: 0.08 };
    default:
      return { opening: 0.32, fold: 0.65, speed: 0.16, amplitude: 0.16 };
  }
}

export function fieldRadius(width: number, height: number) {
  return Math.max(1, Math.min(width * 0.43, height * 0.42, 680));
}

/** Bounded geometry shared by ribbons/lights, without simulation or React state. */
export function fieldPoint(
  u: number,
  band: number,
  time: number,
  shape: ReturnType<typeof fieldShape>,
) {
  const taper = Math.sin(Math.PI * u);
  const phase = time * shape.speed;
  return {
    x:
      (u * 2 - 1) * (1 + 0.045 * Math.sin(phase + band)) +
      taper * 0.1 * Math.sin(phase * 0.7 + band * 0.8),
    y:
      taper *
      ((band - 2) * shape.opening * 0.22 +
        Math.sin(u * Math.PI * (2 + shape.fold) + phase + band * 0.24) * shape.amplitude +
        Math.cos(u * Math.PI * 3 - phase * 0.7) * 0.12),
  };
}

export function drawField(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  model: AmbientVisualModel,
  time: number,
) {
  context.clearRect(0, 0, width, height);
  const radius = fieldRadius(width, height);
  const cx = width / 2,
    cy = height * 0.45;
  const shape = fieldShape(model);
  const light = model.connected ? 0.45 + model.intensity * 0.8 : 0.3;
  const halo = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.15);
  halo.addColorStop(0, `rgba(238,76,24,${0.14 * light})`);
  halo.addColorStop(0.48, `rgba(171,47,20,${0.1 * light})`);
  halo.addColorStop(1, "rgba(90,29,12,0)");
  context.fillStyle = halo;
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate(cx, cy);
  context.globalCompositeOperation = "lighter";
  for (let band = 0; band < FIELD_BUDGET.ribbons; band++) {
    const gradient = context.createLinearGradient(-radius, 0, radius, 0);
    gradient.addColorStop(0, "rgba(205,43,17,0)");
    gradient.addColorStop(0.23, `rgba(236,79,26,${0.35 * light})`);
    gradient.addColorStop(0.52, `rgba(255,195,116,${0.85 * light})`);
    gradient.addColorStop(0.78, `rgba(255,103,35,${0.35 * light})`);
    gradient.addColorStop(1, "rgba(255,75,18,0)");
    context.beginPath();
    for (let edge = 0; edge < 2; edge++) {
      for (let i = 0; i <= FIELD_BUDGET.points; i++) {
        const u = edge ? 1 - i / FIELD_BUDGET.points : i / FIELD_BUDGET.points;
        const point = fieldPoint(u, band, time, shape);
        const thickness = Math.sin(u * Math.PI) * (0.018 + band * 0.003) * radius;
        const x = point.x * radius;
        const y = point.y * radius + (edge ? thickness : -thickness);
        if (!edge && !i) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
    }
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = gradient;
    context.lineWidth = 1.2;
    context.shadowColor = "#ff9c46";
    context.shadowBlur = 12;
    context.stroke();
    context.shadowBlur = 0;
  }
  for (let i = 0; i < FIELD_BUDGET.particles; i++) {
    const u = (i * 0.61803398875 + time * shape.speed * 0.025) % 1;
    const point = fieldPoint(u, i % 5, time, shape);
    const drift = Math.sin(i * 13.7 + time * 0.2) * radius * (0.12 + shape.opening * 0.16);
    const alpha = Math.sin(u * Math.PI) * (0.25 + (i % 4) * 0.18) * light;
    context.fillStyle = `rgba(255,${145 + (i % 80)},95,${alpha})`;
    context.beginPath();
    context.arc(point.x * radius, point.y * radius + drift, 0.8 + (i % 3) * 0.55, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
