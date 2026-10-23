import { type OrbAppearanceId, resolveOrbAppearance } from "../../src/visual-engine/appearance";
import { type SkinPose, skinNormal } from "../../src/visual-engine/membrane";
import {
  createOrganicPeels,
  organicPeelDirection,
  organicPeelRegion,
} from "../../src/visual-engine/organic-peel";
import { RENDER_BUDGETS } from "../../src/visual-engine/quality";
import {
  createRadialShellWindows,
  radialShellDirection,
  radialShellRegion,
  radialShellRim,
} from "../../src/visual-engine/radial-shell-domain";
import {
  createSkinOpenings,
  type SkinVector,
  skinDot,
  skinNormalize,
  skinRegion,
  skinRimRadius,
} from "../../src/visual-engine/skin-domain";

/** Domain rows reach both actual free side boundaries, not only the centerline. */
export function organicGPUProofDirections(): readonly SkinVector[] {
  return createOrganicPeels().flatMap((p) =>
    [-0.7, -0.3, 0.4, 0.99].flatMap((u) =>
      [-1, -0.35, 0.35, 1].map((fraction) =>
        organicPeelDirection(p, u, fraction * Math.sqrt(1 - u * u)),
      ),
    ),
  );
}

/** Transform feedback of the production coat map/normals against the CPU reference.
 * A controlled body callback isolates coating equations; real pigment/body shaders
 * are covered by the separate actual-renderer views, not claimed by this proof.
 */
export function proveSkinGPU(
  appearance?: OrbAppearanceId,
  variant: "production" | "sqrt-rim" = "production",
) {
  const definition = resolveOrbAppearance(appearance),
    strategy = definition.skin;
  let shapeGLSL = strategy.shapeGLSL;
  if (variant === "sqrt-rim") {
    if (strategy.id !== "radial-sectors" || !shapeGLSL.includes("base=pow(sum,-.25)"))
      throw new Error("Rim hypothesis must replace exactly the radial quarter-power");
    shapeGLSL = shapeGLSL.replace("base=pow(sum,-.25)", "base=inversesqrt(sqrt(sum))");
  }
  const canvas = document.createElement("canvas"),
    gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 required for skin equation proof");
  const shaders: WebGLShader[] = [],
    buffers: WebGLBuffer[] = [];
  let program: WebGLProgram | null = null,
    vao: WebGLVertexArrayObject | null = null;
  let feedback: WebGLTransformFeedback | null = null,
    active = false;
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Proof shader allocation");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? "Proof shader compile");
      return shader;
    };
    const vertex = compile(
      gl.VERTEX_SHADER,
      `#version 300 es
precision highp float;
layout(location=0) in vec3 direction;
uniform float u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple;
uniform vec4 u_behavior;
${shapeGLSL}
vec3 livingBodyPoint(vec3 n,float r,float b,float p,float d,float w) {
  return vec3(1.,1.06,1.)*n*(r+.006*sin(b)+.007*d*n.z+.003*w*sin(p+3.*n.x));
}
${strategy.surfaceGLSL}
out vec3 proof_position;
out vec3 proof_normal;
out vec3 proof_regions;
out vec3 proof_domain;
out vec4 proof_rim;
out vec4 proof_math;
out vec4 proof_shape;
void main(){vec3 n=normalize(direction);proof_position=livingSkinPoint(n);proof_normal=livingSkinNormal(n);
proof_regions=vec3(skinRegion(n,0).x,skinRegion(n,1).x,skinRegion(n,2).x);
${strategy.id === "radial-sectors" ? "vec2 xy=radialShellCoordinates(n,0);proof_domain=vec3(xy,atan(xy.y,xy.x));" : "proof_domain=vec3(0.);"}
${
  strategy.id === "radial-sectors"
    ? `
float t=proof_domain.z,c=cos(t),s=sin(t),a=u_contact_centers[0].w,b=u_contact_shapes[0].x;
vec2 square=vec2(c*c/(a*a),s*s/(b*b));float sum=dot(square,square),phase=u_contact_shapes[0].w;
proof_rim=vec4(length(proof_domain.xy),radialShellRim(0,t,normalize(proof_domain.xy)).x,c,s);
proof_math=vec4(sum,pow(sum,-.25),cos(3.*t+phase),sin(2.*t-phase));
proof_shape=vec4(a,b,phase,u_contact_shapes[0].y);`
    : "proof_rim=vec4(0.);proof_math=vec4(0.);proof_shape=vec4(0.);"
}
gl_Position=vec4(0.,0.,0.,1.);}`,
    );
    const fragment = compile(
      gl.FRAGMENT_SHADER,
      "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.);}",
    );
    program = gl.createProgram();
    if (!program) throw new Error("Proof program allocation");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.transformFeedbackVaryings(
      program,
      [
        "proof_position",
        "proof_normal",
        "proof_regions",
        "proof_domain",
        "proof_rim",
        "proof_math",
        "proof_shape",
      ],
      gl.INTERLEAVED_ATTRIBS,
    );
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(program) ?? "Proof link");
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL binding, not a React hook.
    gl.useProgram(program);
    const location = (name: string) => gl.getUniformLocation(program as WebGLProgram, name);
    const setup = strategy.create(RENDER_BUDGETS.high, 0x5a17),
      packed = setup.descriptors;
    for (const key of ["centers", "tangents", "sides", "shapes"] as const)
      gl.uniform4fv(location(`u_contact_${key}[0]`), packed[key]);
    gl.uniform1i(location("u_contact_count"), setup.count);
    for (const [name, value] of [
      ["u_radius", 1.18],
      ["u_breath_phase", 0.7],
      ["u_ripple_phase", 1.1],
      ["u_deformation", 0.04],
      ["u_ripple", 0.02],
      ["u_skin_clearance", 0.004],
    ] as const)
      gl.uniform1f(location(name), value);
    const directions: number[] = [];
    if (strategy.id === "connected-parent")
      for (const p of createSkinOpenings())
        for (const theta of [0, 1.7, 3.4, 5.1])
          for (const q of [0, 0.2, 0.7, 1]) {
            const r = skinRimRadius(p, theta) + p.collar * (1 - q);
            directions.push(
              ...skinNormalize(
                p.center.map(
                  (v, i) =>
                    v +
                    p.tangent[i] * (p.x + r * Math.cos(theta)) +
                    p.side[i] * (p.y + r * Math.sin(theta)),
                ) as unknown as SkinVector,
              ),
            );
          }
    else if (strategy.id === "organic-peels")
      for (const n of organicGPUProofDirections()) directions.push(...n);
    else
      for (const p of createRadialShellWindows())
        for (const theta of [0, 1.7, 3.4, 5.1])
          for (const q of [0, 0.2, 0.7, 1]) {
            const r = radialShellRim(p, theta)[0] + p.collar * (1 - q);
            directions.push(
              ...radialShellDirection(
                p,
                p.azimuth + r * Math.cos(theta),
                p.latitude + r * Math.sin(theta),
              ),
            );
          }
    const stride = 24;
    const input = new Float32Array(directions),
      output = new Float32Array((input.length / 3) * stride);
    vao = gl.createVertexArray();
    feedback = gl.createTransformFeedback();
    if (!vao || !feedback) throw new Error("Proof feedback allocation");
    gl.bindVertexArray(vao);
    const makeBuffer = () => {
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Proof buffer allocation");
      buffers.push(buffer);
      return buffer;
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, makeBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, input, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    const resultBuffer = makeBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, resultBuffer);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, output.byteLength, gl.STREAM_READ);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, resultBuffer);
    const body = (n: SkinVector): SkinVector => {
      const r =
        1.18 +
        0.006 * Math.sin(0.7) +
        0.007 * 0.04 * n[2] +
        0.003 * 0.02 * Math.sin(1.1 + 3 * n[0]);
      return [n[0] * r, n[1] * r * 1.06, n[2] * r];
    };
    const reference = strategy.reference(0x5a17);
    const radialWindow = createRadialShellWindows()[0];
    const domainReference = (n: SkinVector) => {
      const p = radialWindow;
      const a = Math.atan2(skinDot(n, p.side), skinDot(n, p.equator)) - p.azimuth;
      const x = a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
      const y =
        Math.atan2(skinDot(n, p.axis), Math.hypot(skinDot(n, p.equator), skinDot(n, p.side))) -
        p.latitude;
      const theta = Math.atan2(y, x);
      return { coordinates: [x, y, theta], rim: radialShellRim(p, theta)[0], collar: p.collar };
    };
    let maxPositionError = 0,
      maxNormalError = 0,
      maxRegionError = 0,
      finite = true,
      samples = 0;
    let worstPosition: unknown = null;
    let fixedRadialSample: unknown = null;
    for (const travel of [0, 1.7, 2 * Math.PI - 1e-5, 2 * Math.PI + 1e-5]) {
      const pose: SkinPose = {
        travel,
        opening: 0.1,
        lift: 0.075,
        width: 1.15,
        coherence: 1,
        rephase: 0.12,
        work: 1,
        receptive: 0.3,
        speech: 0.8,
      };
      gl.uniform4f(location("u_contact_pose"), pose.opening, pose.lift, pose.width, pose.coherence);
      gl.uniform2f(location("u_contact_phase"), pose.travel, pose.rephase);
      gl.uniform4f(location("u_behavior"), 0, pose.speech, pose.work, pose.receptive);
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.beginTransformFeedback(gl.POINTS);
      active = true;
      gl.drawArrays(gl.POINTS, 0, input.length / 3);
      gl.endTransformFeedback();
      active = false;
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
      finite &&= output.every(Number.isFinite);
      const point = (n: SkinVector) => reference.point(n, pose, body, 0.004);
      for (let i = 0; i < input.length / 3; i++) {
        const n = skinNormalize([input[i * 3], input[i * 3 + 1], input[i * 3 + 2]]);
        const p = point(n),
          normal = skinNormal(n, point);
        const q =
          strategy.id === "connected-parent"
            ? createSkinOpenings().map((opening) => skinRegion(n, opening).q)
            : strategy.id === "organic-peels"
              ? createOrganicPeels().map((p) => organicPeelRegion(n, p)[0])
              : createRadialShellWindows().map((window) => radialShellRegion(n, window).q);
        if (
          strategy.id === "radial-sectors" &&
          travel === 1.7 &&
          Math.abs(n[0] - 0.35471242628781263) < 1e-7 &&
          Math.abs(n[1] - 0.4076248105035505) < 1e-7
        )
          fixedRadialSample = {
            travel,
            n,
            cpu: p,
            gpu: Array.from(output.slice(i * stride, i * stride + 3)),
            qCPU: q,
            qGPU: Array.from(output.slice(i * stride + 6, i * stride + 9)),
            domainCPU: domainReference(n),
            domainGPU: Array.from(output.slice(i * stride + 9, i * stride + 12)),
            traceGPU: Array.from(output.slice(i * stride + 12, i * stride + 24)),
          };
        for (let axis = 0; axis < 3; axis++) {
          const error = Math.abs(p[axis] - output[i * stride + axis]);
          if (error > maxPositionError) {
            maxPositionError = error;
            worstPosition = {
              travel,
              n,
              axis,
              cpu: p,
              gpu: Array.from(output.slice(i * stride, i * stride + 3)),
              qCPU: q,
              qGPU: Array.from(output.slice(i * stride + 6, i * stride + 9)),
              domainCPU: strategy.id === "radial-sectors" ? domainReference(n) : null,
              domainGPU:
                strategy.id === "radial-sectors"
                  ? Array.from(output.slice(i * stride + 9, i * stride + 12))
                  : null,
              traceGPU:
                strategy.id === "radial-sectors"
                  ? {
                      radiusRimCosSin: Array.from(output.slice(i * stride + 12, i * stride + 16)),
                      sumBaseCos3Sin2: Array.from(output.slice(i * stride + 16, i * stride + 20)),
                      halfWidthHeightPhaseCollar: Array.from(
                        output.slice(i * stride + 20, i * stride + 24),
                      ),
                    }
                  : null,
            };
          }
          maxNormalError = Math.max(
            maxNormalError,
            Math.abs(normal[axis] - output[i * stride + 3 + axis]),
          );
          maxRegionError = Math.max(
            maxRegionError,
            Math.abs(q[axis] - output[i * stride + 6 + axis]),
          );
        }
        samples++;
      }
    }
    return {
      appearance: definition.id,
      variant,
      maxPositionError,
      maxNormalError,
      maxRegionError,
      finite,
      worstPosition,
      fixedRadialSample,
      highFloatPrecision: gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)?.precision,
      samples,
      error: gl.getError(),
      scope:
        variant === "production"
          ? "Production coat/normal GLSL with controlled spheroid body callback; full material/body rendering is a separate gate"
          : "Test-only quarter-root hypothesis, not production source or rendered candidate",
    };
  } finally {
    if (active) gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    if (feedback) gl.deleteTransformFeedback(feedback);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
