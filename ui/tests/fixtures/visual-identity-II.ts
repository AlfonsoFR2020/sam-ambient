import { MotionEvaluator, type MotionFrame } from "../../src/visual-engine/motion";
import { RENDER_BUDGETS, type ResolvedQuality } from "../../src/visual-engine/quality";
import {
  DEFAULT_VISUAL_ENGINE_SETTINGS,
  type VisualForeground,
  type VisualInputV1,
} from "../../src/visual-engine/types";
import { WebGLBackend } from "../../src/visual-engine/webgl";
import { PALETTE_BEFORE } from "./palette-before";

export function visualInput(
  time: number,
  state: VisualForeground = "idle",
  rms = 0,
): VisualInputV1 {
  return {
    version: 1,
    streamKey: "isolated",
    sequence: time + 1,
    receivedMs: time,
    audio:
      state === "speaking"
        ? { output: { receivedMs: time, envelope: rms } }
        : state === "listening"
          ? { input: { receivedMs: time, envelope: rms, peak: rms * 1.4, activity: rms ? 0.9 : 0 } }
          : {},
    interaction: {
      foreground: state,
      listening: state === "listening",
      speaking: state === "speaking",
      reasoning: state === "thinking",
      delegatedWork: false,
      floor: "none",
      acknowledgement: false,
      userPause: false,
      responseReady: false,
      interruptSerial: state === "interrupted" ? 1 : 0,
      availability: "ready",
    },
  };
}

export function frameAt(
  time: number,
  state: VisualForeground = "idle",
  rms = 0,
  audioReactivity = 0.7,
): MotionFrame {
  const evaluator = new MotionEvaluator(0x5a17);
  const settings = {
    ...DEFAULT_VISUAL_ENGINE_SETTINGS,
    reducedMotion: "off" as const,
    audioReactivity,
  };
  for (let t = 0; t <= time; t += 20)
    evaluator.evaluate(visualInput(t, state, rms), t, settings, RENDER_BUDGETS.high);
  return { ...evaluator.currentFrame, reactivity: { ...evaluator.currentFrame.reactivity } };
}

export function fixture(
  quality: ResolvedQuality = "high",
  options: {
    size?: number;
    dpr?: number;
    bodyOnly?: boolean;
    membraneOnly?: boolean;
    gray?: boolean;
    particlesOnly?: boolean;
    depthPass?: boolean;
    neutralMaterial?: boolean;
    contact?: boolean;
    paletteBefore?: boolean;
  } = {},
) {
  const size = options.size ?? 720,
    dpr = options.dpr ?? 1;
  const budget = {
    ...RENDER_BUDGETS[quality],
    membraneDepthPass: options.depthPass ?? RENDER_BUDGETS[quality].membraneDepthPass,
    peels: options.bodyOnly || options.particlesOnly ? 0 : RENDER_BUDGETS[quality].peels,
    ...(options.membraneOnly || options.particlesOnly
      ? { sphereLongitude: 1, sphereLatitude: 1 }
      : {}),
  };
  const canvas = document.createElement("canvas");
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  document.body.append(canvas);
  const gl = canvas.getContext("webgl2", {
    antialias: budget.antialias,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("Headless WebGL2 unavailable");
  if (options.paletteBefore) {
    const source = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, text) =>
      source(
        shader,
        text
          .replace(
            /LivingPigment livingPigment\(LivingField field\) \{[\s\S]*?\n\}/,
            PALETTE_BEFORE,
          )
          .replace(
            "linear*=mix(0.22,1.15,u_intensity)",
            "linear+=vec3(1.e-8*sin(u_palette_phase.x+u_palette_phase.y));linear*=mix(0.22,1.15,u_intensity)",
          ),
      );
  }
  if (options.contact === false) {
    const names = new Map<WebGLUniformLocation, string>(),
      locate = gl.getUniformLocation.bind(gl),
      set = gl.uniform1i.bind(gl);
    gl.getUniformLocation = (program, name) => {
      const value = locate(program, name);
      if (value) names.set(value, name);
      return value;
    };
    gl.uniform1i = (location, value) =>
      set(location, location && names.get(location) === "u_contact_count" ? 0 : value);
  }
  if (options.particlesOnly) gl.drawElements = () => {};
  if (options.neutralMaterial) {
    const original = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, source) =>
      original(
        shader,
        source
          .replace(
            "LivingPigment pigment=livingPigment(field);",
            "LivingPigment pigment=livingPigment(field);pigment.albedo=vec3(.32)+pigment.albedo*.000001;pigment.cool=.25+pigment.cool*.000001;",
          )
          .replace(
            "LivingPigment filmPigment=livingPigment(veil);",
            "LivingPigment filmPigment=livingPigment(veil);filmPigment.albedo=vec3(.32)+filmPigment.albedo*.000001;",
          ),
      );
  }
  if (options.gray) {
    const original = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, source) =>
      original(
        shader,
        source
          .replace(
            "color=vec4(pow(linear,vec3(1./2.2)),1.);",
            "color=vec4(vec3(.20+light.diffuse*.48+light.glint*.24),1.)+color*.00001;",
          )
          .replace(
            "color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);",
            "color=vec4(vec3(.24+light.diffuse*.56+light.glint*.38)*alpha,alpha)+color*.00001;",
          ),
      );
  }
  let current = frameAt(0);
  const evaluator = new MotionEvaluator(0x5a17);
  evaluator.evaluate = () => current;
  const backend = new WebGLBackend(
    canvas,
    gl,
    budget,
    { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" },
    0x5a17,
    evaluator,
  );
  backend.resize(size, size, dpr);
  backend.update(visualInput(0));
  const render = (frame: MotionFrame, yaw = 0) => {
    current = frame;
    backend.setObjectOrientation(
      new Float32Array([
        Math.cos(yaw),
        0,
        -Math.sin(yaw),
        0,
        1,
        0,
        Math.sin(yaw),
        0,
        Math.cos(yaw),
      ]),
    );
    backend.render(0);
    if (gl.getError()) throw new Error("GL error");
  };
  return {
    canvas,
    gl,
    budget,
    backend,
    render,
    draw(frame: MotionFrame, yaw = 0) {
      render(frame, yaw);
      return canvas.toDataURL("image/png");
    },
    close() {
      backend.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}

/** A renderer-only synthetic lifecycle; it never connects to Sam or emits core events. */
export function behaviorFrameAt(
  time: number,
  state: VisualForeground,
  strength = 0.7,
): MotionFrame {
  const evaluator = new MotionEvaluator(0x5a17);
  const settings = {
    ...DEFAULT_VISUAL_ENGINE_SETTINGS,
    reducedMotion: "off" as const,
    audioReactivity: strength,
  };
  for (let t = 0; t <= time; t += 20) {
    const active = t >= 200;
    const rms =
      !active || t >= 1000
        ? 0
        : state === "speaking"
          ? 0.025 +
            0.1 * Math.exp(-(((t - 420) / 90) ** 2)) +
            0.42 * Math.exp(-(((t - 760) / 90) ** 2))
          : state === "listening"
            ? 0.025 + 0.12 * Math.exp(-(((t - 650) / 170) ** 2))
            : 0;
    evaluator.evaluate(
      visualInput(t, active ? state : "idle", rms),
      t,
      settings,
      RENDER_BUDGETS.high,
    );
  }
  return { ...evaluator.currentFrame, reactivity: { ...evaluator.currentFrame.reactivity } };
}
