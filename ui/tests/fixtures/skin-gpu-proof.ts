import { MEMBRANE_SHAPE_GLSL, SKIN_SURFACE_GLSL, skinNormal, skinPoint, type SkinPose } from "../../src/visual-engine/membrane";
import { createSkinOpenings, packSkinOpenings, skinNormalize, skinRimRadius, type SkinVector } from "../../src/visual-engine/skin-domain";

/** Transform feedback of the production coat map/normals against the CPU reference.
 * A controlled body callback isolates coating equations; real pigment/body shaders
 * are covered by the separate actual-renderer views, not claimed by this proof.
 */
export function proveSkinGPU() {
  const canvas = document.createElement("canvas"), gl = canvas.getContext("webgl2");
  if (!gl) throw new Error("WebGL2 required for skin equation proof");
  const shaders: WebGLShader[] = [], buffers: WebGLBuffer[] = [];
  let program: WebGLProgram | null = null, vao: WebGLVertexArrayObject | null = null;
  let feedback: WebGLTransformFeedback | null = null, active = false;
  try {
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Proof shader allocation");
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Proof shader compile");
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
precision highp float;
layout(location=0) in vec3 direction;
uniform float u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple;
uniform vec4 u_behavior;
${MEMBRANE_SHAPE_GLSL}
vec3 livingBodyPoint(vec3 n,float r,float b,float p,float d,float w) {
  return vec3(1.,1.06,1.)*n*(r+.006*sin(b)+.007*d*n.z+.003*w*sin(p+3.*n.x));
}
${SKIN_SURFACE_GLSL}
out vec3 proof_position;
out vec3 proof_normal;
void main(){vec3 n=normalize(direction);proof_position=livingSkinPoint(n);proof_normal=livingSkinNormal(n);gl_Position=vec4(0.,0.,0.,1.);}`);
    const fragment = compile(gl.FRAGMENT_SHADER, "#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(0.);}");
    program = gl.createProgram();
    if (!program) throw new Error("Proof program allocation");
    gl.attachShader(program, vertex); gl.attachShader(program, fragment);
    gl.transformFeedbackVaryings(program, ["proof_position", "proof_normal"], gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Proof link");
    gl.useProgram(program);
    const location = (name: string) => gl.getUniformLocation(program as WebGLProgram, name);
    const openings = createSkinOpenings(), packed = packSkinOpenings(openings);
    for (const key of ["centers", "tangents", "sides", "shapes"] as const)
      gl.uniform4fv(location(`u_contact_${key}[0]`), packed[key]);
    gl.uniform1i(location("u_contact_count"), openings.length);
    for (const [name, value] of [["u_radius", 1.18], ["u_breath_phase", 0.7], ["u_ripple_phase", 1.1],
      ["u_deformation", 0.04], ["u_ripple", 0.02], ["u_skin_clearance", 0.004]] as const)
      gl.uniform1f(location(name), value);
    const directions: number[] = [];
    for (const p of openings) for (const theta of [0, 1.7, 3.4, 5.1]) for (const q of [0, 0.2, 0.7, 1]) {
      const r = skinRimRadius(p, theta) + p.collar * (1 - q);
      directions.push(...skinNormalize(p.center.map((v, i) => v + p.tangent[i] * (p.x + r * Math.cos(theta)) + p.side[i] * (p.y + r * Math.sin(theta))) as unknown as SkinVector));
    }
    const input = new Float32Array(directions), output = new Float32Array(input.length * 2);
    vao = gl.createVertexArray(); feedback = gl.createTransformFeedback();
    if (!vao || !feedback) throw new Error("Proof feedback allocation");
    gl.bindVertexArray(vao);
    const makeBuffer = () => {
      const buffer = gl.createBuffer(); if (!buffer) throw new Error("Proof buffer allocation");
      buffers.push(buffer); return buffer;
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, makeBuffer()); gl.bufferData(gl.ARRAY_BUFFER, input, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    const resultBuffer = makeBuffer();
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, resultBuffer);
    gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, output.byteLength, gl.STREAM_READ);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, resultBuffer);
    const body = (n: SkinVector): SkinVector => {
      const r = 1.18 + 0.006 * Math.sin(0.7) + 0.007 * 0.04 * n[2] + 0.003 * 0.02 * Math.sin(1.1 + 3 * n[0]);
      return [n[0] * r, n[1] * r * 1.06, n[2] * r];
    };
    let maxPositionError = 0, maxNormalError = 0, samples = 0;
    for (const travel of [0, 1.7, 2 * Math.PI - 1e-5, 2 * Math.PI + 1e-5]) {
      const pose: SkinPose = { travel, opening: 0.1, lift: 0.075, width: 1.15, coherence: 1, rephase: 0.12, work: 1, receptive: 0.3, speech: 0.8 };
      gl.uniform4f(location("u_contact_pose"), pose.opening, pose.lift, pose.width, pose.coherence);
      gl.uniform2f(location("u_contact_phase"), pose.travel, pose.rephase);
      gl.uniform4f(location("u_behavior"), 0, pose.speech, pose.work, pose.receptive);
      gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); active = true;
      gl.drawArrays(gl.POINTS, 0, input.length / 3);
      gl.endTransformFeedback(); active = false; gl.disable(gl.RASTERIZER_DISCARD);
      gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output);
      const point = (n: SkinVector) => skinPoint(n, openings, pose, body, 0.004);
      for (let i = 0; i < input.length / 3; i++) {
        const n = skinNormalize([input[i * 3], input[i * 3 + 1], input[i * 3 + 2]]);
        const p = point(n), normal = skinNormal(n, point);
        for (let axis = 0; axis < 3; axis++) {
          maxPositionError = Math.max(maxPositionError, Math.abs(p[axis] - output[i * 6 + axis]));
          maxNormalError = Math.max(maxNormalError, Math.abs(normal[axis] - output[i * 6 + 3 + axis]));
        }
        samples++;
      }
    }
    return { maxPositionError, maxNormalError, samples, error: gl.getError(),
      scope: "Production coat/normal GLSL with controlled spheroid body callback; full material/body rendering is a separate gate" };
  } finally {
    if (active) gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.bindVertexArray(null); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    if (feedback) gl.deleteTransformFeedback(feedback);
    for (const buffer of buffers) gl.deleteBuffer(buffer);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    for (const shader of shaders) gl.deleteShader(shader);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
