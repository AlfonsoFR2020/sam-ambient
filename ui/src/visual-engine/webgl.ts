import type { RendererBackend } from "./backend";
import { createPeelGeometry, createSphereGeometry, type IndexedGeometry } from "./geometry";
import type { RenderBudget } from "./quality";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

const ORB_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform float u_time;
uniform float u_radius;
uniform float u_motion;
uniform vec2 u_scale;
out vec3 v_normal;
out vec3 v_position;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
void main(){
  float slow=u_time*0.045*u_motion;
  mat3 rotation=rotateY(slow)*rotateX(.22)*rotateZ(.08*sin(u_time*.035*u_motion));
  float deformation=.008*sin(2.0*dot(a_normal,normalize(vec3(.7,.2,.6)))+u_time*.78*u_motion);
  vec3 position=a_position*(u_radius+deformation);
  position.y*=1.06;
  v_position=rotation*position;
  v_normal=normalize(rotation*vec3(a_normal.x,a_normal.y/1.06,a_normal.z));
  gl_Position=vec4(v_position.xy*u_scale,-v_position.z*.25,1.);
}`;

const ORB_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_position;
uniform float u_time;
uniform float u_intensity;
uniform int u_light_count;
out vec4 color;
void main(){
  vec3 n=normalize(v_normal), view=vec3(0.,0.,1.);
  float diffuse=.12;
  float specular=0.;
  for(int i=0;i<3;i++){
    if(i>=u_light_count) break;
    float fi=float(i);
    float phase=u_time*(.07+fi*.03)+fi*2.094;
    vec3 light=normalize(vec3(cos(phase)*1.6,sin(phase*.83+fi)*1.3,1.3+sin(phase)*.2)-v_position);
    diffuse+=max(dot(n,light),0.)*(.48-fi*.07);
    specular+=pow(max(dot(n,normalize(light+view)),0.),24.)*(.36-fi*.06);
  }
  float rim=pow(1.-max(dot(n,view),0.),3.);
  vec3 base=mix(vec3(.20,.025,.008),vec3(.95,.24,.045),clamp(diffuse,0.,1.));
  vec3 linear=base*(.32+u_intensity*.78)+vec3(1.,.55,.19)*specular+vec3(.8,.16,.025)*rim*.34;
  linear=linear/(1.+linear);
  color=vec4(pow(linear,vec3(1./2.2)),1.);
}`;

const PEEL_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_base;
layout(location=1) in vec4 a_surface;
layout(location=2) in vec4 a_motion;
uniform float u_time;
uniform float u_radius;
uniform float u_motion;
uniform vec2 u_scale;
out float v_alpha;
out float v_facing;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
vec3 carrier(float u,float family){
  float phi=atan(sinh(u));
  float lambda=(1.65+.12*sin(u_time*.07+a_surface.w))*u+family*6.2831853;
  return vec3(cos(phi)*cos(lambda),sin(phi),cos(phi)*sin(lambda));
}
void main(){
  float q=a_base.x, side=a_base.y;
  float center=a_base.z+a_motion.x*u_time;
  center=mod(center+1.8,3.6)-1.8;
  float u=clamp(center+q*a_base.w,-1.8,1.8);
  vec3 c=carrier(u,a_motion.w);
  vec3 tangent=normalize(carrier(min(1.8,u+.003),a_motion.w)-carrier(max(-1.8,u-.003),a_motion.w));
  vec3 across=normalize(cross(c,tangent));
  float fade=smoothstep(0.,.18,1.-abs(q));
  vec3 direction=normalize(c*cos(side*a_surface.x*fade)+across*sin(side*a_surface.x*fade));
  mat3 local=rotateX(a_motion.y)*rotateZ(a_motion.z);
  direction=local*direction;
  float slow=u_time*.045*u_motion;
  mat3 rotation=rotateY(slow)*rotateX(.22)*rotateZ(.08*sin(u_time*.035*u_motion));
  float deformation=.008*sin(2.0*dot(direction,normalize(vec3(.7,.2,.6)))+u_time*.78*u_motion);
  vec3 position=direction*(u_radius+deformation+a_surface.y);
  position.y*=1.06;
  vec3 world=rotation*position;
  vec3 normal=normalize(rotation*local*direction);
  v_alpha=a_surface.z*fade*fade;
  v_facing=smoothstep(-.02,.15,normal.z);
  gl_Position=vec4(world.xy*u_scale,-world.z*.25,1.);
}`;

const PEEL_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
in float v_facing;
uniform float u_intensity;
out vec4 color;
void main(){
  float alpha=clamp(v_alpha*v_facing*(.55+.45*u_intensity),0.,.82);
  vec3 warm=mix(vec3(.92,.19,.035),vec3(1.,.68,.30),u_intensity*.72);
  color=vec4(warm*alpha,alpha);
}`;

const HALO_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_position;
out vec2 v_uv;
void main(){v_uv=a_position;gl_Position=vec4(a_position,0.,1.);}`;

const HALO_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_aspect;
uniform float u_intensity;
uniform float u_glow;
out vec4 color;
void main(){
  vec2 p=vec2(v_uv.x*u_aspect,v_uv.y);
  float alpha=(1.-smoothstep(.08,.72,length(p)))*.22*u_glow*(.5+.5*u_intensity);
  color=vec4(vec3(.88,.18,.035)*alpha,alpha);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
};

const program = (gl: WebGL2RenderingContext, vertex: string, fragment: string): WebGLProgram => {
  const result = gl.createProgram();
  if (!result) throw new Error("WebGL program allocation failed");
  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertex);
  const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(result, vertexShader);
  gl.attachShader(result, fragmentShader);
  gl.linkProgram(result);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(result) ?? "unknown link error";
    gl.deleteProgram(result);
    throw new Error(message);
  }
  return result;
};

const location = (gl: WebGL2RenderingContext, shader: WebGLProgram, name: string) => {
  const value = gl.getUniformLocation(shader, name);
  if (value === null) throw new Error(`missing WebGL uniform ${name}`);
  return value;
};

// Named to avoid React-hook heuristics treating WebGL's useProgram method as a hook.
const bindProgram = (gl: WebGL2RenderingContext, shader: WebGLProgram): void => {
  // biome-ignore lint/correctness/useHookAtTopLevel: this is the WebGL API, not a React hook
  gl.useProgram(shader);
};

interface DrawResource {
  readonly vao: WebGLVertexArrayObject;
  readonly vertex: WebGLBuffer;
  readonly index?: WebGLBuffer;
  readonly count: number;
}

interface CommonUniforms {
  readonly time: WebGLUniformLocation;
  readonly radius: WebGLUniformLocation;
  readonly motion: WebGLUniformLocation;
  readonly intensity: WebGLUniformLocation;
  readonly scale: WebGLUniformLocation;
}

const indexedResource = (
  gl: WebGL2RenderingContext,
  geometry: IndexedGeometry,
  stride: number,
  attributes: readonly { location: number; size: number; offset: number }[],
): DrawResource => {
  const vao = gl.createVertexArray();
  const vertex = gl.createBuffer();
  const index = gl.createBuffer();
  if (!vao || !vertex || !index) throw new Error("WebGL buffer allocation failed");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);
  for (const attribute of attributes) {
    gl.enableVertexAttribArray(attribute.location);
    gl.vertexAttribPointer(
      attribute.location,
      attribute.size,
      gl.FLOAT,
      false,
      stride,
      attribute.offset,
    );
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, vertex, index, count: geometry.indices.length };
};

const stateBase: Readonly<
  Record<VisualInputV1["interaction"]["foreground"], readonly [number, number]>
> = {
  idle: [1, 0.24],
  listening: [1.035, 0.31],
  transcribing: [0.985, 0.32],
  thinking: [0.955, 0.29],
  speaking: [1.015, 0.38],
  interrupted: [0.94, 0.26],
  resuming: [1, 0.34],
};

const liveEnvelope = (input: VisualInputV1, now: number): number => {
  const feature = input.interaction.speaking ? input.audio.output : input.audio.input;
  if (!feature) return 0;
  const age = Math.max(0, now - feature.receivedMs);
  if (age >= 1000) return 0;
  return feature.envelope * (age <= 250 ? 1 : Math.exp(-(age - 250) / 180));
};

export class WebGLBackend implements RendererBackend {
  readonly kind = "webgl2" as const;
  private readonly orbProgram: WebGLProgram;
  private readonly peelProgram: WebGLProgram;
  private readonly haloProgram: WebGLProgram;
  private readonly orb: DrawResource;
  private readonly peels: DrawResource;
  private readonly halo: DrawResource;
  private readonly orbUniforms: CommonUniforms & { readonly lightCount: WebGLUniformLocation };
  private readonly peelUniforms: CommonUniforms;
  private readonly haloUniforms: {
    readonly aspect: WebGLUniformLocation;
    readonly intensity: WebGLUniformLocation;
    readonly glow: WebGLUniformLocation;
  };
  private input?: VisualInputV1;
  private scaleX = 0.56;
  private scaleY = 0.56;
  private aspect = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly budget: RenderBudget,
    private settings: VisualEngineSettings,
    seed: number,
  ) {
    this.orbProgram = program(gl, ORB_VERTEX, ORB_FRAGMENT);
    this.peelProgram = program(gl, PEEL_VERTEX, PEEL_FRAGMENT);
    this.haloProgram = program(gl, HALO_VERTEX, HALO_FRAGMENT);
    this.orbUniforms = {
      ...this.commonUniformLocations(this.orbProgram),
      lightCount: location(gl, this.orbProgram, "u_light_count"),
    };
    this.peelUniforms = this.commonUniformLocations(this.peelProgram);
    this.haloUniforms = {
      aspect: location(gl, this.haloProgram, "u_aspect"),
      intensity: location(gl, this.haloProgram, "u_intensity"),
      glow: location(gl, this.haloProgram, "u_glow"),
    };
    this.orb = indexedResource(
      gl,
      createSphereGeometry(budget.sphereLongitude, budget.sphereLatitude),
      24,
      [
        { location: 0, size: 3, offset: 0 },
        { location: 1, size: 3, offset: 12 },
      ],
    );
    this.peels = indexedResource(gl, createPeelGeometry(budget, seed), 48, [
      { location: 0, size: 4, offset: 0 },
      { location: 1, size: 4, offset: 16 },
      { location: 2, size: 4, offset: 32 },
    ]);
    this.halo = indexedResource(
      gl,
      {
        vertices: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        indices: new Uint16Array([0, 1, 2, 2, 1, 3]),
      },
      8,
      [{ location: 0, size: 2, offset: 0 }],
    );
    gl.clearColor(0, 0, 0, 0);
  }

  update(input: VisualInputV1): void {
    if (
      !this.input ||
      input.streamKey !== this.input.streamKey ||
      input.sequence > this.input.sequence
    )
      this.input = input;
  }

  configure(settings: VisualEngineSettings): void {
    this.settings = settings;
  }

  resize(width: number, height: number, dpr: number): void {
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.aspect = width / Math.max(1, height);
    this.scaleX = 0.56 / Math.max(1, this.aspect);
    this.scaleY = 0.56 * Math.min(1, this.aspect);
  }

  render(now: number): void {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.input || !this.settings.enabled) return;
    const reduced = this.settings.reducedMotion === "on";
    const time = reduced ? 0 : (now / 1000) % 1000;
    const [baseRadius, baseGlow] = stateBase[this.input.interaction.foreground];
    const envelope = liveEnvelope(this.input, now) * this.settings.audioReactivity;
    const radius = Math.min(1.1, Math.max(0.92, baseRadius + envelope * 0.055));
    const intensity = Math.min(0.85, (baseGlow + envelope * 0.28) * this.settings.intensity);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bindProgram(gl, this.haloProgram);
    gl.uniform1f(this.haloUniforms.aspect, this.aspect);
    gl.uniform1f(this.haloUniforms.intensity, intensity);
    gl.uniform1f(this.haloUniforms.glow, this.settings.glowIntensity);
    gl.bindVertexArray(this.halo.vao);
    gl.drawElements(gl.TRIANGLES, this.halo.count, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    bindProgram(gl, this.orbProgram);
    this.setCommonUniforms(this.orbUniforms, time, radius, intensity);
    gl.uniform1i(this.orbUniforms.lightCount, this.budget.lights);
    gl.bindVertexArray(this.orb.vao);
    gl.drawElements(gl.TRIANGLES, this.orb.count, gl.UNSIGNED_SHORT, 0);

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bindProgram(gl, this.peelProgram);
    this.setCommonUniforms(this.peelUniforms, time, radius, intensity);
    gl.bindVertexArray(this.peels.vao);
    gl.drawElements(gl.TRIANGLES, this.peels.count, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  private commonUniformLocations(shader: WebGLProgram): CommonUniforms {
    const gl = this.gl;
    return {
      time: location(gl, shader, "u_time"),
      radius: location(gl, shader, "u_radius"),
      motion: location(gl, shader, "u_motion"),
      intensity: location(gl, shader, "u_intensity"),
      scale: location(gl, shader, "u_scale"),
    };
  }

  private setCommonUniforms(
    uniforms: CommonUniforms,
    time: number,
    radius: number,
    intensity: number,
  ): void {
    const gl = this.gl;
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.radius, radius);
    gl.uniform1f(uniforms.motion, this.settings.motionIntensity);
    gl.uniform1f(uniforms.intensity, intensity);
    gl.uniform2f(uniforms.scale, this.scaleX, this.scaleY);
  }

  dispose(): void {
    const gl = this.gl;
    for (const resource of [this.orb, this.peels, this.halo]) {
      gl.deleteVertexArray(resource.vao);
      gl.deleteBuffer(resource.vertex);
      if (resource.index) gl.deleteBuffer(resource.index);
    }
    gl.deleteProgram(this.orbProgram);
    gl.deleteProgram(this.peelProgram);
    gl.deleteProgram(this.haloProgram);
    this.input = undefined;
  }
}

export function createWebGLBackend(
  canvas: HTMLCanvasElement,
  budget: RenderBudget,
  settings: VisualEngineSettings,
  seed: number,
): WebGLBackend | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: budget.antialias,
    depth: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  try {
    return new WebGLBackend(canvas, gl, budget, settings, seed);
  } catch {
    return null;
  }
}
