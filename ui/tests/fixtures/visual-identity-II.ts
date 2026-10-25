import { type OrbAppearanceId, resolveOrbAppearance } from "../../src/visual-engine/appearance";
import { BIPOLAR_SHAPE_GLSL, BIPOLAR_SURFACE_GLSL } from "../../src/visual-engine/bipolar-peel";
import type { ParticlePresentation } from "../../src/visual-engine/geometry";
import { MotionEvaluator, type MotionFrame } from "../../src/visual-engine/motion";
import { RENDER_BUDGETS, type ResolvedQuality } from "../../src/visual-engine/quality";
import {
  DEFAULT_VISUAL_ENGINE_SETTINGS,
  type VisualForeground,
  type VisualInputV1,
} from "../../src/visual-engine/types";
import { WebGLBackend } from "../../src/visual-engine/webgl";
import * as VF4 from "./bipolar-vf4-baseline";
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
    appearance?: OrbAppearanceId;
    particleCount?: 64 | 128 | 256;
    particlePresentation?: ParticlePresentation;
    dpr?: number;
    pitch?: number;
    bodyOnly?: boolean;
    membraneOnly?: boolean;
    gray?: boolean;
    particlesOnly?: boolean;
    depthPass?: boolean;
    neutralMaterial?: boolean;
    contact?: boolean;
    paletteBefore?: boolean;
    diagnostic?: "normals" | "depth" | "attachment";
    /** Hosted-only diagnostic: transform feedback of the actual production map. */
    captureSkinVertices?: boolean;
    /** Geometry-only historical diagnosis, never used as an optical baseline. */
    vf4Surface?: boolean;
    /** Optical ablations only; never part of runtime appearance selection. */
    reverseSkinOrder?: boolean;
    legacyBipolarFilm?: boolean;
  } = {},
) {
  const size = options.size ?? 720,
    dpr = options.dpr ?? 1;
  const budget = {
    ...RENDER_BUDGETS[quality],
    ...(quality === "high" && options.particleCount ? { particles: options.particleCount } : {}),
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
  if (!gl) {
    canvas.remove();
    throw new Error("Headless WebGL2 unavailable");
  }
  if (options.reverseSkinOrder || options.legacyBipolarFilm) {
    if (options.appearance !== "bipolar-peel-experimental" || options.depthPass !== false)
      throw new Error("Optical ablation requires explicit bipolar/no-prepass fixture");
    const source = gl.shaderSource.bind(gl),
      locate = gl.getUniformLocation.bind(gl),
      bind = gl.useProgram.bind(gl),
      draw = gl.drawElements.bind(gl);
    let skin: WebGLProgram | null = null,
      current: WebGLProgram | null = null;
    const pending: Parameters<WebGL2RenderingContext["drawElements"]>[] = [];
    gl.getUniformLocation = (program, name) => {
      if (name === "u_depth_only") skin = program;
      return locate(program, name);
    };
    gl.shaderSource = (shader, text) =>
      source(
        shader,
        options.legacyBipolarFilm
          ? text.replace("float alpha=.9999+.0001*clamp(", "float alpha=clamp(")
          : text,
      );
    gl.useProgram = (program) => {
      bind(program);
      current = program;
      if (program === skin && options.legacyBipolarFilm) {
        gl.depthMask(false);
        gl.enable(gl.BLEND);
      }
    };
    gl.drawElements = (...args) => {
      if (options.reverseSkinOrder && current === skin) {
        pending.push(args);
        if (pending.length === 6) {
          for (const call of pending.reverse()) draw(...call);
          pending.length = 0;
        }
      } else draw(...args);
    };
  }
  if (options.vf4Surface) {
    if (options.appearance !== "bipolar-peel-experimental" || !options.captureSkinVertices)
      throw new Error("Frozen surface is only a bipolar transform-feedback diagnostic");
    const source = gl.shaderSource.bind(gl),
      locate = gl.getUniformLocation.bind(gl),
      set = gl.uniform4fv.bind(gl);
    const names = new Map<WebGLUniformLocation, string>(),
      packed = VF4.BIPOLAR_PEEL_SKIN.create(budget, 0x5a17).descriptors;
    gl.shaderSource = (shader, text) =>
      source(
        shader,
        text
          .replace(BIPOLAR_SHAPE_GLSL, VF4.BIPOLAR_SHAPE_GLSL)
          .replace(BIPOLAR_SURFACE_GLSL, VF4.BIPOLAR_SURFACE_GLSL),
      );
    gl.getUniformLocation = (program, name) => {
      const value = locate(program, name);
      if (value) names.set(value, name);
      return value;
    };
    gl.uniform4fv = (location, values) => {
      const name = location ? names.get(location) : undefined;
      const key =
        name === "u_contact_centers[0]"
          ? "centers"
          : name === "u_contact_tangents[0]"
            ? "tangents"
            : name === "u_contact_sides[0]"
              ? "sides"
              : name === "u_contact_shapes[0]"
                ? "shapes"
                : undefined;
      set(location, key ? packed[key] : values);
    };
  }
  let sampledProgram: WebGLProgram | undefined, sampledVAO: WebGLVertexArrayObject | undefined;
  if (options.captureSkinVertices) {
    const link = gl.linkProgram.bind(gl),
      draw = gl.drawElements.bind(gl);
    gl.linkProgram = (program) => {
      if (
        gl
          .getAttachedShaders(program)
          ?.some((s) => gl.getShaderSource(s)?.includes("vec3 position=livingSkinPoint(direction)"))
      ) {
        sampledProgram = program;
        gl.transformFeedbackVaryings(program, ["v_position"], gl.INTERLEAVED_ATTRIBS);
      }
      link(program);
    };
    gl.drawElements = (...args) => {
      if (sampledProgram && gl.getParameter(gl.CURRENT_PROGRAM) === sampledProgram)
        sampledVAO = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      draw(...args);
    };
  }
  if (options.diagnostic) {
    const original = gl.shaderSource.bind(gl);
    gl.shaderSource = (shader, source) => {
      const body =
        options.diagnostic === "normals"
          ? "normalize(v_normal)*.5+.5"
          : options.diagnostic === "depth"
            ? "vec3(gl_FragCoord.z)"
            : "vec3(.18)";
      const skin =
        options.diagnostic === "normals"
          ? "normalize(gl_FrontFacing ? v_normal : -v_normal)*.5+.5"
          : options.diagnostic === "depth"
            ? "vec3(gl_FragCoord.z)"
            : "vec3(v_radial,1.-v_radial,.2)";
      original(
        shader,
        source
          .replace(
            "color=vec4(pow(linear,vec3(1./2.2)),1.);",
            `color=vec4(pow(linear,vec3(1./2.2)),1.);color=mix(vec4(${body},1.),color,1.e-7);`,
          )
          .replace(
            "color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);",
            `color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);color=mix(vec4((${skin})*alpha,alpha),color,1.e-7);`,
          ),
      );
    };
  }
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
    const names = new Map<WebGLUniformLocation, { name: string; program: WebGLProgram }>(),
      locate = gl.getUniformLocation.bind(gl),
      set = gl.uniform1i.bind(gl);
    let bodyProgram: WebGLProgram | undefined;
    gl.getUniformLocation = (program, name) => {
      if (name === "u_rim") bodyProgram = program;
      const value = locate(program, name);
      if (value) names.set(value, { name, program });
      return value;
    };
    gl.uniform1i = (location, value) => {
      const entry = location ? names.get(location) : undefined;
      set(location, entry?.name === "u_contact_count" && entry.program === bodyProgram ? 0 : value);
    };
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
  const bindShader = gl.useProgram.bind(gl);
  let current = frameAt(0);
  const evaluator = new MotionEvaluator(0x5a17);
  evaluator.evaluate = () => current;
  let backend: WebGLBackend;
  try {
    backend = new WebGLBackend(
      canvas,
      gl,
      budget,
      { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "off" },
      0x5a17,
      evaluator,
      options.appearance,
      options.particlePresentation,
    );
    backend.resize(size, size, dpr);
    backend.update(visualInput(0));
  } catch (error) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.remove();
    throw error;
  }
  const render = (frame: MotionFrame, yaw = 0) => {
    current = frame;
    backend.setObjectOrientation(
      new Float32Array([
        Math.cos(yaw),
        0,
        -Math.sin(yaw),
        Math.sin(yaw) * Math.sin(options.pitch ?? 0),
        Math.cos(options.pitch ?? 0),
        Math.cos(yaw) * Math.sin(options.pitch ?? 0),
        Math.sin(yaw) * Math.cos(options.pitch ?? 0),
        -Math.sin(options.pitch ?? 0),
        Math.cos(yaw) * Math.cos(options.pitch ?? 0),
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
    readSkinVertices() {
      if (!sampledProgram || !sampledVAO)
        throw new Error("Production skin must render before sampling");
      const geometry = resolveOrbAppearance(options.appearance).skin.create(
        budget,
        0x5a17,
      ).geometry;
      const points = new Float32Array(geometry.vertices.length),
        buffer = gl.createBuffer(),
        feedback = gl.createTransformFeedback();
      if (!buffer || !feedback) {
        if (buffer) gl.deleteBuffer(buffer);
        if (feedback) gl.deleteTransformFeedback(feedback);
        throw new Error("Surface feedback allocation");
      }
      const program = gl.getParameter(gl.CURRENT_PROGRAM),
        vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
      let active = false;
      try {
        bindShader(sampledProgram);
        gl.bindVertexArray(sampledVAO);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buffer);
        gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, points.byteLength, gl.STREAM_READ);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        active = true;
        gl.drawArrays(gl.POINTS, 0, points.length / 3);
        gl.endTransformFeedback();
        active = false;
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, points);
        if (gl.getError() || !points.every(Number.isFinite))
          throw new Error("Invalid production surface feedback");
        return { points, geometry };
      } finally {
        if (active) gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
        gl.deleteBuffer(buffer);
        gl.deleteTransformFeedback(feedback);
        bindShader(program);
        gl.bindVertexArray(vao);
      }
    },
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
