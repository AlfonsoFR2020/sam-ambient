import type { RendererBackend } from "./backend";
import {
  createParticleGeometry,
  createPeelGeometry,
  createSphereGeometry,
  type IndexedGeometry,
} from "./geometry";
import { createFieldOffsets, LIVING_FIELD_GLSL } from "./living-field";
import { LIVING_MATERIAL_GLSL, LIVING_SURFACE_VERTEX_GLSL } from "./living-material";
import type { MotionEvaluator, MotionFrame } from "./motion";
import { PARTICLE_GOLD, PARTICLE_VISIBILITY_HASH } from "./particles";
import type { RenderBudget } from "./quality";
import { HALO_OPACITY_SCALE } from "./tuning";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

export const ORB_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
uniform float u_radius;
uniform vec2 u_scale;
uniform float u_spin;
uniform float u_precession;
uniform float u_breath_phase;
uniform float u_ripple_phase;
uniform float u_deformation;
uniform float u_ripple;
uniform mat3 u_object_orientation;
out vec3 v_normal;
out vec3 v_position;
out vec3 v_object_direction;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
${LIVING_FIELD_GLSL}
${LIVING_SURFACE_VERTEX_GLSL}
void main(){
  mat3 rotation=rotateY(u_precession)*rotateX(.22+.018*sin(u_breath_phase))*rotateZ(.08*sin(u_breath_phase+1.4))*rotateY(u_spin)*u_object_orientation;
  vec3 position=livingBodyPoint(a_position,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  vec3 localNormal=livingBodyNormal(a_normal,position,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  v_position=rotation*position;
  v_normal=normalize(rotation*localNormal);
  v_object_direction=a_normal;
  gl_Position=vec4(v_position.xy*u_scale,-v_position.z*.25,1.);
}`;

export const ORB_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_position;
in vec3 v_object_direction;
uniform float u_intensity;
uniform float u_rim;
uniform float u_highlight;
out vec4 color;
${LIVING_FIELD_GLSL}
${LIVING_MATERIAL_GLSL}
void main(){
  LivingField field=sampleLivingField(normalize(v_object_direction));
  LivingPigment pigment=livingPigment(field);
  LivingLight light=livingLight(v_normal,v_position);
  float fine=livingSurfaceDetail(field);
  float illumination=0.25+light.diffuse*0.70+u_intensity*0.18;
  vec3 innerWarmth=vec3(0.085,0.026,0.012)*(1.0-field.broad)*0.35;
  vec3 glintColor=mix(vec3(1.0,0.68,0.38),vec3(0.55,0.77,1.0),pigment.cool);
  vec3 rimColor=mix(vec3(0.88,0.31,0.13),vec3(0.29,0.48,0.83),pigment.cool);
  vec3 linear=pigment.albedo*illumination*(1.0+fine)+innerWarmth
    +glintColor*(light.glint*(0.58+max(fine,0.0)*0.30)+u_highlight*0.20)
    +rimColor*light.rim*(0.18+u_rim*0.55);
  linear*=mix(0.22,1.15,u_intensity);
  linear=linear/(1.+linear);
  color=vec4(pow(linear,vec3(1./2.2)),1.);
}`;

export const PEEL_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_base;
layout(location=1) in vec4 a_surface;
layout(location=2) in vec4 a_motion;
uniform float u_radius;
uniform vec2 u_scale;
uniform float u_spin;
uniform float u_precession;
uniform float u_breath_phase;
uniform float u_ripple_phase;
uniform float u_deformation;
uniform float u_ripple;
uniform float u_peel_travel;
uniform float u_opening;
uniform float u_peel_lift;
uniform float u_peel_width;
uniform float u_coherence;
uniform float u_rephase;
uniform float u_highlight;
uniform mat3 u_object_orientation;
out float v_alpha;
out float v_facing;
out float v_highlight;
out vec3 v_object_direction;
out vec3 v_normal;
out vec3 v_position;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
${LIVING_FIELD_GLSL}
${LIVING_SURFACE_VERTEX_GLSL}
vec3 carrier(float u,float family){
  float phi=atan(sinh(u));
  float lambda=(1.65+.06*sin(u_peel_travel+a_surface.w))*u+family*6.2831853+(family-.33)*u_opening*.06;
  return vec3(cos(phi)*cos(lambda),sin(phi),cos(phi)*sin(lambda));
}
void main(){
  float q=a_base.x, side=a_base.y;
  float directionSign=a_motion.x<0.?-1.:1.;
  float cadence=abs(a_motion.x)<.012?1.:2.;
  float center=a_base.z+.18*sin(directionSign*u_peel_travel*cadence+a_surface.w)+u_rephase*sin(a_surface.w);
  center=clamp(center,-1.25,1.25);
  float u=clamp(center+q*a_base.w,-1.8,1.8);
  vec3 c=carrier(u,a_motion.w);
  vec3 tangent=normalize(carrier(min(1.8,u+.003),a_motion.w)-carrier(max(-1.8,u-.003),a_motion.w));
  vec3 across=normalize(cross(c,tangent));
  float fade=smoothstep(0.,.18,1.-abs(q));
  float alignment=pow(.5+.5*cos(u_peel_travel+a_motion.w*6.2831853),10.)*u_coherence;
  float peelWidth=a_surface.x*u_peel_width*(1.+alignment*.08);
  vec3 direction=normalize(c*cos(side*peelWidth*fade)+across*sin(side*peelWidth*fade));
  mat3 local=rotateX(a_motion.y)*rotateZ(a_motion.z);
  direction=local*direction;
  v_object_direction=direction;
  mat3 rotation=rotateY(u_precession)*rotateX(.22+.018*sin(u_breath_phase))*rotateZ(.08*sin(u_breath_phase+1.4))*rotateY(u_spin)*u_object_orientation;
  float lift=a_surface.y+u_peel_lift*(.68+.32*sin(a_surface.w+u_peel_travel));
  vec3 position=livingBodyPoint(direction,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  position+=direction*lift*vec3(1.0,1.06,1.0);
  vec3 world=rotation*position;
  vec3 normal=normalize(rotation*vec3(direction.x,direction.y/1.06,direction.z));
  v_normal=normal;
  v_position=world;
  v_alpha=a_surface.z*fade*fade*(1.+alignment*.16);
  v_facing=1.; // Depth, not a front-normal fade, decides when the ribbon disappears.
  v_highlight=alignment*.35+u_highlight*(.25+.75*pow(1.-abs(q),3.));
  gl_Position=vec4(world.xy*u_scale,-world.z*.25,1.);
}`;

export const PEEL_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
in float v_facing;
in vec3 v_object_direction;
in vec3 v_normal;
in vec3 v_position;
uniform float u_intensity;
uniform float u_emission;
in float v_highlight;
out vec4 color;
${LIVING_FIELD_GLSL}
${LIVING_MATERIAL_GLSL}
void main(){
  LivingField field=sampleLivingField(normalize(v_object_direction));
  LivingPigment pigment=livingPigment(field);
  LivingLight light=livingLight(v_normal,v_position);
  float fine=livingSurfaceDetail(field);
  float alpha=clamp(v_alpha*v_facing*(.5+.5*u_emission),0.,.82);
  vec3 glintColor=mix(vec3(1.0,0.72,0.43),vec3(0.64,0.84,1.0),pigment.cool);
  vec3 rimColor=mix(vec3(0.9,0.39,0.21),vec3(0.38,0.61,0.95),pigment.cool);
  vec3 linear=pigment.albedo*(0.32+light.diffuse*0.78+u_intensity*0.20)*(1.0+fine)
    +glintColor*(light.glint*(0.65+max(fine,0.0)*0.30)+v_highlight*0.20)
    +rimColor*light.rim*0.28;
  linear*=mix(0.22,1.15,u_intensity);
  linear=linear/(1.0+linear);
  color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);
}`;

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_particle;
uniform float u_phase;
uniform float u_excitation;
uniform float u_radius;
uniform float u_point_scale;
uniform float u_density;
uniform vec2 u_scale;
uniform mat3 u_object_orientation;
out float v_alpha;
void main(){
  float rank=fract(a_particle.x*${PARTICLE_VISIBILITY_HASH.toFixed(3)});
  float cadence=rank<.5?1.:2.;
  float direction=rank<.25?-1.:1.;
  float angle=a_particle.x+u_phase*cadence*direction;
  float shell=a_particle.y+.015*sin(angle+a_particle.x);
  float incline=a_particle.z;
  vec3 point=vec3(cos(angle)*shell,sin(angle)*shell,0.);
  point.yz=mat2(cos(incline),-sin(incline),sin(incline),cos(incline))*point.yz;
  point.xz=mat2(cos(a_particle.x),-sin(a_particle.x),sin(a_particle.x),cos(a_particle.x))*point.xz;
  point=u_object_orientation*point*u_radius;
  float visible=step(rank,u_density)*step(.0001,u_density);
  v_alpha=smoothstep(-.08,.2,point.z)*(.64+u_excitation*.26)*visible;
  gl_Position=vec4(point.xy*u_scale,-point.z*.25,1.);
  gl_PointSize=a_particle.w*u_point_scale*(1.12+u_excitation*.48);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
out vec4 color;
void main(){
  float distanceFromCenter=length(gl_PointCoord-vec2(.5))*2.;
  float alpha=v_alpha*(1.-smoothstep(.46,1.,distanceFromCenter));
  color=vec4(vec3(${PARTICLE_GOLD.red.toFixed(3)},${PARTICLE_GOLD.green.toFixed(3)},${PARTICLE_GOLD.blue.toFixed(3)})*alpha,alpha);
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
  float alpha=(1.-smoothstep(.08,.72,length(p)))*${HALO_OPACITY_SCALE.toFixed(2)}*u_glow*(.5+.5*u_intensity);
  color=vec4(vec3(.88,.18,.035)*alpha,alpha);
}`;

class ShaderBuildError extends Error {}

const compile = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader allocation failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new ShaderBuildError(message);
  }
  return shader;
};

/** Constructed only when a backend is created; optional noise compiles out on low. */
const withFineDetail = (source: string, fineOctaves: 0 | 1 | 2): string =>
  source.replace("#version 300 es\n", `#version 300 es\n#define SAM_FINE_OCTAVES ${fineOctaves}\n`);

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
    throw new ShaderBuildError(message);
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
  readonly radius: WebGLUniformLocation;
  readonly intensity: WebGLUniformLocation;
  readonly scale: WebGLUniformLocation;
}

interface FieldUniforms {
  readonly state: WebGLUniformLocation;
  readonly offsetA: WebGLUniformLocation;
  readonly offsetB: WebGLUniformLocation;
}

const arrayResource = (
  gl: WebGL2RenderingContext,
  vertices: Float32Array,
  count: number,
): DrawResource => {
  const vao = gl.createVertexArray();
  const vertex = gl.createBuffer();
  if (!vao || !vertex) throw new Error("WebGL particle buffer allocation failed");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
  gl.bindVertexArray(null);
  return { vao, vertex, count };
};

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

export class WebGLBackend implements RendererBackend {
  readonly kind = "webgl2" as const;
  private readonly orbProgram: WebGLProgram;
  private readonly peelProgram: WebGLProgram;
  private readonly haloProgram: WebGLProgram;
  private readonly particleProgram: WebGLProgram;
  private readonly orb: DrawResource;
  private readonly peels: DrawResource;
  private readonly halo: DrawResource;
  private readonly particles: DrawResource;
  private readonly orbUniforms: CommonUniforms &
    FieldUniforms & {
      readonly lightCount: WebGLUniformLocation;
      readonly spin: WebGLUniformLocation;
      readonly precession: WebGLUniformLocation;
      readonly breathPhase: WebGLUniformLocation;
      readonly ripplePhase: WebGLUniformLocation;
      readonly deformation: WebGLUniformLocation;
      readonly ripple: WebGLUniformLocation;
      readonly lightPhase: WebGLUniformLocation;
      readonly rim: WebGLUniformLocation;
      readonly highlight: WebGLUniformLocation;
      readonly orientation: WebGLUniformLocation;
    };
  private readonly peelUniforms: CommonUniforms &
    FieldUniforms & {
      readonly lightCount: WebGLUniformLocation;
      readonly lightPhase: WebGLUniformLocation;
      readonly spin: WebGLUniformLocation;
      readonly precession: WebGLUniformLocation;
      readonly breathPhase: WebGLUniformLocation;
      readonly ripplePhase: WebGLUniformLocation;
      readonly deformation: WebGLUniformLocation;
      readonly ripple: WebGLUniformLocation;
      readonly travel: WebGLUniformLocation;
      readonly opening: WebGLUniformLocation;
      readonly lift: WebGLUniformLocation;
      readonly width: WebGLUniformLocation;
      readonly coherence: WebGLUniformLocation;
      readonly rephase: WebGLUniformLocation;
      readonly highlight: WebGLUniformLocation;
      readonly emission: WebGLUniformLocation;
      readonly orientation: WebGLUniformLocation;
    };
  private readonly haloUniforms: {
    readonly aspect: WebGLUniformLocation;
    readonly intensity: WebGLUniformLocation;
    readonly glow: WebGLUniformLocation;
  };
  private readonly particleUniforms: {
    readonly phase: WebGLUniformLocation;
    readonly excitation: WebGLUniformLocation;
    readonly radius: WebGLUniformLocation;
    readonly pointScale: WebGLUniformLocation;
    readonly scale: WebGLUniformLocation;
    readonly orientation: WebGLUniformLocation;
    readonly density: WebGLUniformLocation;
  };
  private readonly motion: MotionEvaluator;
  private input?: VisualInputV1;
  private scaleX = 0.56;
  private scaleY = 0.56;
  private aspect = 1;
  private pointScale = 1;
  private readonly reducedMotionMedia: MediaQueryList | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGL2RenderingContext,
    private readonly budget: RenderBudget,
    private settings: VisualEngineSettings,
    seed: number,
    motion: MotionEvaluator,
  ) {
    this.reducedMotionMedia =
      typeof matchMedia === "undefined"
        ? undefined
        : matchMedia("(prefers-reduced-motion: reduce)");
    this.orbProgram = program(gl, ORB_VERTEX, withFineDetail(ORB_FRAGMENT, budget.fineOctaves));
    this.peelProgram = program(gl, PEEL_VERTEX, withFineDetail(PEEL_FRAGMENT, budget.fineOctaves));
    this.haloProgram = program(gl, HALO_VERTEX, HALO_FRAGMENT);
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.orbUniforms = {
      ...this.commonUniformLocations(this.orbProgram),
      ...this.fieldUniformLocations(this.orbProgram),
      lightCount: location(gl, this.orbProgram, "u_light_count"),
      spin: location(gl, this.orbProgram, "u_spin"),
      precession: location(gl, this.orbProgram, "u_precession"),
      breathPhase: location(gl, this.orbProgram, "u_breath_phase"),
      ripplePhase: location(gl, this.orbProgram, "u_ripple_phase"),
      deformation: location(gl, this.orbProgram, "u_deformation"),
      ripple: location(gl, this.orbProgram, "u_ripple"),
      lightPhase: location(gl, this.orbProgram, "u_light_phase"),
      rim: location(gl, this.orbProgram, "u_rim"),
      highlight: location(gl, this.orbProgram, "u_highlight"),
      orientation: location(gl, this.orbProgram, "u_object_orientation"),
    };
    this.peelUniforms = {
      ...this.commonUniformLocations(this.peelProgram),
      ...this.fieldUniformLocations(this.peelProgram),
      lightCount: location(gl, this.peelProgram, "u_light_count"),
      lightPhase: location(gl, this.peelProgram, "u_light_phase"),
      spin: location(gl, this.peelProgram, "u_spin"),
      precession: location(gl, this.peelProgram, "u_precession"),
      breathPhase: location(gl, this.peelProgram, "u_breath_phase"),
      ripplePhase: location(gl, this.peelProgram, "u_ripple_phase"),
      deformation: location(gl, this.peelProgram, "u_deformation"),
      ripple: location(gl, this.peelProgram, "u_ripple"),
      travel: location(gl, this.peelProgram, "u_peel_travel"),
      opening: location(gl, this.peelProgram, "u_opening"),
      lift: location(gl, this.peelProgram, "u_peel_lift"),
      width: location(gl, this.peelProgram, "u_peel_width"),
      coherence: location(gl, this.peelProgram, "u_coherence"),
      rephase: location(gl, this.peelProgram, "u_rephase"),
      highlight: location(gl, this.peelProgram, "u_highlight"),
      emission: location(gl, this.peelProgram, "u_emission"),
      orientation: location(gl, this.peelProgram, "u_object_orientation"),
    };
    this.haloUniforms = {
      aspect: location(gl, this.haloProgram, "u_aspect"),
      intensity: location(gl, this.haloProgram, "u_intensity"),
      glow: location(gl, this.haloProgram, "u_glow"),
    };
    this.particleUniforms = {
      phase: location(gl, this.particleProgram, "u_phase"),
      excitation: location(gl, this.particleProgram, "u_excitation"),
      radius: location(gl, this.particleProgram, "u_radius"),
      pointScale: location(gl, this.particleProgram, "u_point_scale"),
      scale: location(gl, this.particleProgram, "u_scale"),
      orientation: location(gl, this.particleProgram, "u_object_orientation"),
      density: location(gl, this.particleProgram, "u_density"),
    };
    this.motion = motion;
    const [offsetA, offsetB] = createFieldOffsets(seed);
    bindProgram(gl, this.orbProgram);
    gl.uniform3f(this.orbUniforms.offsetA, offsetA[0], offsetA[1], offsetA[2]);
    gl.uniform3f(this.orbUniforms.offsetB, offsetB[0], offsetB[1], offsetB[2]);
    bindProgram(gl, this.peelProgram);
    gl.uniform3f(this.peelUniforms.offsetA, offsetA[0], offsetA[1], offsetA[2]);
    gl.uniform3f(this.peelUniforms.offsetB, offsetB[0], offsetB[1], offsetB[2]);
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
    const particleGeometry = createParticleGeometry(budget.particles, seed);
    this.particles = arrayResource(gl, particleGeometry.vertices, particleGeometry.count);
    gl.clearColor(0, 0, 0, 0);
    this.setObjectOrientation(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
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

  setObjectOrientation(matrix: Float32Array): void {
    const gl = this.gl;
    gl.useProgram(this.orbProgram);
    gl.uniformMatrix3fv(this.orbUniforms.orientation, false, matrix);
    gl.useProgram(this.peelProgram);
    gl.uniformMatrix3fv(this.peelUniforms.orientation, false, matrix);
    gl.useProgram(this.particleProgram);
    gl.uniformMatrix3fv(this.particleUniforms.orientation, false, matrix);
  }

  resize(width: number, height: number, dpr: number): void {
    const backingWidth = Math.max(1, Math.round(width * dpr));
    const backingHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
      this.gl.viewport(0, 0, backingWidth, backingHeight);
    }
    this.aspect = width / Math.max(1, height);
    this.pointScale = Math.max(0.75, Math.min(2, dpr));
    this.scaleX = 0.56 / Math.max(1, this.aspect);
    this.scaleY = 0.56 * Math.min(1, this.aspect);
  }

  render(now: number): void {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.input || !this.settings.enabled) return;
    const frame = this.motion.evaluate(
      this.input,
      now,
      this.settings,
      this.budget,
      this.reducedMotion(),
    );

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bindProgram(gl, this.haloProgram);
    gl.uniform1f(this.haloUniforms.aspect, this.aspect);
    gl.uniform1f(this.haloUniforms.intensity, frame.glow);
    gl.uniform1f(this.haloUniforms.glow, this.settings.glowIntensity);
    gl.bindVertexArray(this.halo.vao);
    gl.drawElements(gl.TRIANGLES, this.halo.count, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    bindProgram(gl, this.orbProgram);
    this.setCommonUniforms(this.orbUniforms, frame);
    gl.uniform1i(this.orbUniforms.lightCount, this.budget.lights);
    this.setOrbUniforms(frame);
    gl.bindVertexArray(this.orb.vao);
    gl.drawElements(gl.TRIANGLES, this.orb.count, gl.UNSIGNED_SHORT, 0);

    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bindProgram(gl, this.peelProgram);
    this.setCommonUniforms(this.peelUniforms, frame);
    gl.uniform1i(this.peelUniforms.lightCount, this.budget.lights);
    this.setPeelUniforms(frame);
    gl.bindVertexArray(this.peels.vao);
    gl.drawElements(gl.TRIANGLES, this.peels.count, gl.UNSIGNED_SHORT, 0);

    bindProgram(gl, this.particleProgram);
    gl.uniform1f(this.particleUniforms.phase, frame.particlePhase);
    gl.uniform1f(this.particleUniforms.excitation, frame.particleExcitation);
    gl.uniform1f(this.particleUniforms.radius, frame.radius);
    gl.uniform1f(this.particleUniforms.pointScale, this.pointScale);
    gl.uniform1f(this.particleUniforms.density, this.settings.particleDensity);
    gl.uniform2f(this.particleUniforms.scale, this.scaleX, this.scaleY);
    gl.bindVertexArray(this.particles.vao);
    gl.drawArrays(gl.POINTS, 0, this.particles.count);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  private commonUniformLocations(shader: WebGLProgram): CommonUniforms {
    const gl = this.gl;
    return {
      radius: location(gl, shader, "u_radius"),
      intensity: location(gl, shader, "u_intensity"),
      scale: location(gl, shader, "u_scale"),
    };
  }

  private fieldUniformLocations(shader: WebGLProgram): FieldUniforms {
    const gl = this.gl;
    return {
      state: location(gl, shader, "u_field_state"),
      offsetA: location(gl, shader, "u_field_offset_a"),
      offsetB: location(gl, shader, "u_field_offset_b"),
    };
  }

  private setFieldState(uniforms: FieldUniforms, frame: MotionFrame): void {
    this.gl.uniform4f(
      uniforms.state,
      frame.fieldPhase1,
      frame.fieldPhase2,
      frame.fieldTwist1,
      frame.fieldTwist2,
    );
  }

  private setCommonUniforms(uniforms: CommonUniforms, frame: MotionFrame): void {
    const gl = this.gl;
    gl.uniform1f(uniforms.radius, frame.radius);
    gl.uniform1f(uniforms.intensity, this.settings.intensity);
    gl.uniform2f(uniforms.scale, this.scaleX, this.scaleY);
  }

  private setOrbUniforms(frame: MotionFrame): void {
    const gl = this.gl;
    const uniforms = this.orbUniforms;
    this.setFieldState(uniforms, frame);
    gl.uniform1f(uniforms.spin, frame.spin);
    gl.uniform1f(uniforms.precession, frame.precession);
    gl.uniform1f(uniforms.breathPhase, frame.breathPhase);
    gl.uniform1f(uniforms.ripplePhase, frame.ripplePhase);
    gl.uniform1f(uniforms.deformation, frame.surfaceDeformation);
    gl.uniform1f(uniforms.ripple, frame.surfaceRipple);
    gl.uniform1f(uniforms.lightPhase, frame.lightPhase);
    gl.uniform1f(uniforms.rim, frame.rim);
    gl.uniform1f(uniforms.highlight, frame.highlight);
  }

  private setPeelUniforms(frame: MotionFrame): void {
    const gl = this.gl;
    const uniforms = this.peelUniforms;
    this.setFieldState(uniforms, frame);
    gl.uniform1f(uniforms.lightPhase, frame.lightPhase);
    gl.uniform1f(uniforms.spin, frame.spin);
    gl.uniform1f(uniforms.precession, frame.precession);
    gl.uniform1f(uniforms.breathPhase, frame.breathPhase);
    gl.uniform1f(uniforms.ripplePhase, frame.ripplePhase);
    gl.uniform1f(uniforms.deformation, frame.surfaceDeformation);
    gl.uniform1f(uniforms.ripple, frame.surfaceRipple);
    gl.uniform1f(uniforms.travel, frame.peelTravel);
    gl.uniform1f(uniforms.opening, frame.opening);
    gl.uniform1f(uniforms.lift, frame.peelLift);
    gl.uniform1f(uniforms.width, frame.peelWidth);
    gl.uniform1f(uniforms.coherence, frame.peelCoherence);
    gl.uniform1f(uniforms.rephase, frame.peelRephase);
    gl.uniform1f(uniforms.highlight, frame.highlight);
    gl.uniform1f(uniforms.emission, frame.peelEmission);
  }

  private reducedMotion(): boolean {
    if (this.settings.reducedMotion === "on") return true;
    if (this.settings.reducedMotion === "off") return false;
    return this.reducedMotionMedia?.matches ?? false;
  }

  dispose(): void {
    const gl = this.gl;
    for (const resource of [this.orb, this.peels, this.halo, this.particles]) {
      gl.deleteVertexArray(resource.vao);
      gl.deleteBuffer(resource.vertex);
      if (resource.index) gl.deleteBuffer(resource.index);
    }
    gl.deleteProgram(this.orbProgram);
    gl.deleteProgram(this.peelProgram);
    gl.deleteProgram(this.haloProgram);
    gl.deleteProgram(this.particleProgram);
    this.input = undefined;
  }
}

export function createWebGLBackend(
  canvas: HTMLCanvasElement,
  budget: RenderBudget,
  settings: VisualEngineSettings,
  seed: number,
  motion: MotionEvaluator,
): WebGLBackend | null {
  let gl: WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: budget.antialias,
      depth: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
  } catch (error) {
    if (canvas.dataset) canvas.dataset.samWebglFailure = "context-error";
    console.warn("Sam WebGL2 context failed; using the Canvas fallback.", error);
    return null;
  }
  if (!gl) {
    if (canvas.dataset) canvas.dataset.samWebglFailure = "context-unavailable";
    return null;
  }
  try {
    return new WebGLBackend(canvas, gl, budget, settings, seed, motion);
  } catch (error) {
    if (canvas.dataset)
      canvas.dataset.samWebglFailure =
        error instanceof ShaderBuildError ? "shader-build" : "backend-initialization";
    console.warn("Sam WebGL2 renderer failed; using the Canvas fallback.", error);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
}
