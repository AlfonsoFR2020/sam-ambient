import type { RendererBackend } from "./backend";
import {
  createParticleGeometry,
  createPeelDescriptors,
  createPeelGeometry,
  createSphereGeometry,
  type IndexedGeometry,
  PEEL_VERTEX_STRIDE,
} from "./geometry";
import { createFieldOffsets, LIVING_FIELD_GLSL } from "./living-field";
import { LIVING_MATERIAL_GLSL, LIVING_SURFACE_VERTEX_GLSL } from "./living-material";
import { MEMBRANE_SHAPE_GLSL } from "./membrane";
import { MEMBRANE_CONTACT_GLSL } from "./membrane-optics";
import type { MotionEvaluator, MotionFrame } from "./motion";
import {
  PARTICLE_COPPER,
  PARTICLE_GOLD,
  PARTICLE_RADIAL_WANDER,
  PARTICLE_VERTICAL_WANDER,
  PARTICLE_VISIBILITY_HASH,
} from "./particles";
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
uniform float u_radius;
out vec4 color;
${LIVING_FIELD_GLSL}
${LIVING_MATERIAL_GLSL}
${MEMBRANE_CONTACT_GLSL}
void main(){
  LivingField field=sampleLivingField(normalize(v_object_direction));
  LivingPigment pigment=livingPigment(field);
  float fine=livingSurfaceDetail(field);
  LivingLight light=livingLight(livingMaterialNormal(v_normal,v_position,fine),v_position);
  float contact=livingContactOcclusion(normalize(v_object_direction));
  float illumination=(0.20+light.diffuse*0.90+u_intensity*0.10)*(1.-contact);
  vec3 innerWarmth=vec3(0.085,0.026,0.012)*(1.0-field.broad)*0.35;
  vec3 glintColor=mix(vec3(1.0,0.68,0.38),vec3(0.55,0.77,1.0),pigment.cool);
  vec3 rimColor=mix(vec3(0.88,0.31,0.13),vec3(0.29,0.48,0.83),pigment.cool);
  vec3 linear=pigment.albedo*illumination*(1.0+fine)+innerWarmth
    +glintColor*(light.glint*(0.78+max(fine,0.0)*0.24)+u_highlight*0.20)
    +rimColor*light.rim*(0.18+u_rim*0.55);
  linear+=livingBehaviorLight(field,pigment.albedo);
  linear*=mix(0.22,1.15,u_intensity);
  linear=linear/(1.+linear);
  color=vec4(pow(linear,vec3(1./2.2)),1.);
}`;

export const PEEL_VERTEX = `#version 300 es
precision highp float;
invariant gl_Position;
layout(location=0) in vec3 a_direction;
layout(location=1) in vec4 a_sheet;
layout(location=2) in vec3 a_du;
layout(location=3) in vec3 a_dv;
layout(location=4) in vec2 a_skin;
layout(location=5) in vec3 a_side_du;
layout(location=6) in vec3 a_side_dv;
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
out float v_radial;
out float v_lift;
out float v_highlight;
out vec3 v_object_direction;
out vec3 v_normal;
out vec3 v_position;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
${LIVING_FIELD_GLSL}
${LIVING_SURFACE_VERTEX_GLSL}
${MEMBRANE_SHAPE_GLSL}
void main(){
  vec3 direction=normalize(a_direction);
  vec2 uv=a_sheet.xy;
  vec4 shape=vec4(a_sheet.z,a_skin.x,a_sheet.w,a_skin.y);
  vec2 offset=membraneOffsets(uv,shape);
  vec2 deltaU=(membraneOffsets(uv+vec2(.001,0.),shape)-membraneOffsets(uv-vec2(.001,0.),shape))/.002;
  vec2 deltaV=(membraneOffsets(uv+vec2(0.,.001),shape)-membraneOffsets(uv-vec2(0.,.001),shape))/.002;
  vec3 scale=vec3(1.,1.06,1.);
  vec3 side=normalize(a_dv);
  vec3 base=livingBodyPoint(direction,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  vec3 bodyNormal=livingBodyNormal(direction,base,u_radius,u_breath_phase,u_ripple_phase,u_deformation,u_ripple);
  float localRadius=length(base/scale);
  vec3 radial=direction*scale;
  vec3 du=a_du*scale*localRadius, dv=a_dv*scale*localRadius;
  du-=radial*dot(bodyNormal,du)/max(.2,dot(bodyNormal,radial));
  dv-=radial*dot(bodyNormal,dv)/max(.2,dot(bodyNormal,radial));
  du+=scale*(a_du*offset.x+direction*deltaU.x+a_side_du*offset.y+side*deltaU.y);
  dv+=scale*(a_dv*offset.x+direction*deltaV.x+a_side_dv*offset.y+side*deltaV.y);
  vec3 position=base+scale*(direction*offset.x+side*offset.y);
  mat3 rotation=rotateY(u_precession)*rotateX(.22+.018*sin(u_breath_phase))*rotateZ(.08*sin(u_breath_phase+1.4))*rotateY(u_spin)*u_object_orientation;
  v_position=rotation*position;
  v_normal=normalize(rotation*cross(du,dv));
  v_object_direction=direction;
  v_alpha=a_skin.y*(1.-smoothstep(.70,1.,abs(uv.x)))*smoothstep(0.,.04,uv.y);
  v_radial=uv.y;
  v_lift=clamp(offset.x/.17,0.,1.);
  v_highlight=u_highlight*(.3+.7*v_lift);
  gl_Position=vec4(v_position.xy*u_scale,-v_position.z*.25,1.);
}`;

export const PEEL_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
in float v_radial;
in float v_lift;
in vec3 v_object_direction;
in vec3 v_normal;
in vec3 v_position;
uniform float u_intensity;
uniform float u_emission;
uniform bool u_depth_only;
in float v_highlight;
out vec4 color;
${LIVING_FIELD_GLSL}
${LIVING_MATERIAL_GLSL}
void main(){
  float alpha=clamp(v_alpha*(1.-smoothstep(.98,1.,v_radial))*(.88+.12*u_emission),0.,1.);
  if(alpha<.04) discard;
  if(u_depth_only) {
    if(alpha<.72) discard;
    color=vec4(0.);
    return;
  }
  LivingField field=sampleLivingField(normalize(v_object_direction));
  LivingPigment pigment=livingPigment(field);
  float fine=livingSurfaceDetail(field);
  vec3 normal=livingMaterialNormal(gl_FrontFacing ? v_normal : -v_normal,v_position,fine*(gl_FrontFacing ? .35 : .15));
  LivingLight light=livingLight(normal,v_position,gl_FrontFacing ? .75+.2*v_lift : .25);
  vec3 glintColor=mix(vec3(1.0,0.72,0.43),vec3(0.64,0.84,1.0),pigment.cool);
  vec3 rimColor=mix(vec3(0.9,0.39,0.21),vec3(0.38,0.61,0.95),pigment.cool);
  // Lifted skin catches a broad satin response; the attached edge inherits the
  // body's tone. No independent color field or extra transparent layer.
  float pocket=exp(-22.*pow(v_radial-.22,2.))*(1.-v_lift)*.24;
  float skinLight=.12*v_lift*(.35+.65*min(light.diffuse,1.));
  float shoulder=4.*v_radial*v_radial*(1.-v_radial*v_radial);
  float film=smoothstep(.05,.75,v_lift);
  // Raised film optically softens the shared medium pigment contrast. The hinge
  // retains the body's exact field; no new sample, palette or moving pattern.
  LivingField veil=field;
  veil.medium=mix(field.medium,.5,.68*film);
  veil.palette=.5+(field.palette-.5)*(1.-.42*film);
  LivingPigment filmPigment=livingPigment(veil);
  vec3 coat=mix(pigment.albedo,filmPigment.albedo,.85*film);
  float luminance=dot(coat,vec3(.2126,.7152,.0722));
  coat=mix(coat,vec3(luminance),.28*film);
  vec3 linear=coat*(.20+light.diffuse*.90+u_intensity*.10+skinLight)*(1.-pocket)*(1.-.22*film)*(1.0+fine*.4)
    +glintColor*(light.glint*(gl_FrontFacing ? .85+.65*v_lift : .22)+v_highlight*.15)
    +glintColor*.045*shoulder*min(light.diffuse,1.)
    +rimColor*light.rim*(.18+.12*v_lift);
  linear+=livingBehaviorLight(field,pigment.albedo);
  float grazing=pow(1.-abs(normal.z),2.);
  linear+=glintColor*.28*film*grazing*(.12+.88*min(light.diffuse,1.));
  // High resolves a broad satin shoulder on the actual lifted fold, not a
  // separate glow strip. It shares pigment and follows the existing light.
#if SAM_FINE_OCTAVES >= 2
  float foldSheen=exp(-32.*pow(v_radial-.78,2.))*v_lift;
  linear+=glintColor*.23*foldSheen*(.15+.85*min(light.diffuse,1.));
#endif
  // Thin raised skin admits warm/cool local backlight without a bright outline.
  linear+=mix(coat,glintColor,.2)*light.back*v_lift*.18;
  linear*=mix(0.22,1.15,u_intensity)*(gl_FrontFacing ? 1.0 : .64);
  linear=linear/(1.0+linear);
  color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);
}`;

export const PARTICLE_VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_orbit;
layout(location=1) in vec4 a_style;
uniform float u_phase;
uniform float u_drift_phase;
uniform float u_excitation;
uniform float u_spread;
uniform float u_opacity_boost;
uniform float u_radius;
uniform float u_point_scale;
uniform float u_density;
uniform vec2 u_scale;
out float v_alpha;
out float v_tint;
out float v_shape;
void main(){
  float rank=fract(a_orbit.x*${PARTICLE_VISIBILITY_HASH.toFixed(3)});
  // a_style.y is an integer harmonic, so a wrapped phase has no seam.
  float angle=a_orbit.x+u_phase*a_style.y;
  float radius=a_orbit.y+${PARTICLE_RADIAL_WANDER.toFixed(3)}*sin(u_drift_phase*abs(a_style.y)+a_orbit.x)
    +u_spread*(.35+.65*rank);
  vec3 point=vec3(cos(angle)*radius,sin(angle)*radius,
    ${PARTICLE_VERTICAL_WANDER.toFixed(3)}*sin(2.*angle+a_orbit.x));
  float incline=a_orbit.z;
  point.yz=mat2(cos(incline),sin(incline),-sin(incline),cos(incline))*point.yz;
  point.xz=mat2(cos(a_orbit.w),sin(a_orbit.w),-sin(a_orbit.w),cos(a_orbit.w))*point.xz;
  point*=u_radius;
  float visible=step(rank,u_density)*step(.0001,u_density);
  // Depth testing against body/membrane handles occlusion; off-silhouette rear
  // particles remain visible as a subdued part of the surrounding volume.
  v_alpha=min(.85,a_style.z*(1.+u_opacity_boost)*(.74+.26*smoothstep(-2.2,2.2,point.z)))*visible;
  v_tint=a_style.w;
  v_shape=fract(a_orbit.x*.73+a_orbit.w*.31);
  gl_Position=vec4(point.xy*u_scale,-point.z*.25,1.);
  gl_PointSize=a_style.x*u_point_scale*(1.08-.25*smoothstep(1.2,2.45,a_orbit.y))*(1.+u_excitation*.2);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
in float v_tint;
in float v_shape;
out vec4 color;
void main(){
  vec2 uv=(gl_PointCoord-vec2(.5))*2.;
  float aspect=mix(.82,1.18,v_shape);
  float distanceFromCenter=length(vec2(uv.x*aspect,uv.y/aspect));
  float alpha=v_alpha*(1.-smoothstep(.46,1.,distanceFromCenter));
  vec3 pigment=mix(
    vec3(${PARTICLE_COPPER.red.toFixed(3)},${PARTICLE_COPPER.green.toFixed(3)},${PARTICLE_COPPER.blue.toFixed(3)}),
    vec3(${PARTICLE_GOLD.red.toFixed(3)},${PARTICLE_GOLD.green.toFixed(3)},${PARTICLE_GOLD.blue.toFixed(3)}),
    v_tint
  );
  color=vec4(pigment*alpha,alpha);
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
  readonly behavior: WebGLUniformLocation;
  readonly radius: WebGLUniformLocation;
  readonly intensity: WebGLUniformLocation;
  readonly scale: WebGLUniformLocation;
}

interface FieldUniforms {
  readonly state: WebGLUniformLocation;
  readonly paletteBalance: WebGLUniformLocation;
  readonly paletteContrast: WebGLUniformLocation;
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
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
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
  private readonly contactUniforms?: {
    readonly count: WebGLUniformLocation;
    readonly centers: WebGLUniformLocation;
    readonly tangents: WebGLUniformLocation;
    readonly sides: WebGLUniformLocation;
    readonly shapes: WebGLUniformLocation;
    readonly pose: WebGLUniformLocation;
    readonly phase: WebGLUniformLocation;
  };
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
      readonly depthOnly: WebGLUniformLocation;
      readonly orientation: WebGLUniformLocation;
    };
  private readonly haloUniforms: {
    readonly aspect: WebGLUniformLocation;
    readonly intensity: WebGLUniformLocation;
    readonly glow: WebGLUniformLocation;
  };
  private readonly particleUniforms: {
    readonly phase: WebGLUniformLocation;
    readonly driftPhase: WebGLUniformLocation;
    readonly excitation: WebGLUniformLocation;
    readonly spread: WebGLUniformLocation;
    readonly opacityBoost: WebGLUniformLocation;
    readonly radius: WebGLUniformLocation;
    readonly pointScale: WebGLUniformLocation;
    readonly scale: WebGLUniformLocation;
    readonly density: WebGLUniformLocation;
  };
  private readonly peelOrder: {
    center: readonly [number, number, number];
    offset: number;
    count: number;
    z: number;
  }[];
  private readonly objectOrientation = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
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
    if (budget.fineOctaves >= 2) {
      this.contactUniforms = {
        count: location(gl, this.orbProgram, "u_contact_count"),
        centers: location(gl, this.orbProgram, "u_contact_centers[0]"),
        tangents: location(gl, this.orbProgram, "u_contact_tangents[0]"),
        sides: location(gl, this.orbProgram, "u_contact_sides[0]"),
        shapes: location(gl, this.orbProgram, "u_contact_shapes[0]"),
        pose: location(gl, this.orbProgram, "u_contact_pose"),
        phase: location(gl, this.orbProgram, "u_contact_phase"),
      };
      const descriptors = createPeelDescriptors(budget.peels, seed);
      bindProgram(gl, this.orbProgram);
      gl.uniform1i(this.contactUniforms.count, descriptors.length);
      if (descriptors.length) {
        gl.uniform4fv(
          this.contactUniforms.centers,
          new Float32Array(descriptors.flatMap((p) => [...p.center, p.halfLength])),
        );
        gl.uniform4fv(
          this.contactUniforms.tangents,
          new Float32Array(descriptors.flatMap((p) => [...p.tangent, p.bend])),
        );
        gl.uniform4fv(
          this.contactUniforms.sides,
          new Float32Array(descriptors.flatMap((p) => [...p.crossTangent, p.halfWidth])),
        );
        gl.uniform4fv(
          this.contactUniforms.shapes,
          new Float32Array(descriptors.flatMap((p) => [p.lift, p.curlRadius, p.phase, p.opacity])),
        );
      }
    }
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
      depthOnly: location(gl, this.peelProgram, "u_depth_only"),
      orientation: location(gl, this.peelProgram, "u_object_orientation"),
    };
    this.haloUniforms = {
      aspect: location(gl, this.haloProgram, "u_aspect"),
      intensity: location(gl, this.haloProgram, "u_intensity"),
      glow: location(gl, this.haloProgram, "u_glow"),
    };
    this.particleUniforms = {
      phase: location(gl, this.particleProgram, "u_phase"),
      driftPhase: location(gl, this.particleProgram, "u_drift_phase"),
      excitation: location(gl, this.particleProgram, "u_excitation"),
      spread: location(gl, this.particleProgram, "u_spread"),
      opacityBoost: location(gl, this.particleProgram, "u_opacity_boost"),
      radius: location(gl, this.particleProgram, "u_radius"),
      pointScale: location(gl, this.particleProgram, "u_point_scale"),
      scale: location(gl, this.particleProgram, "u_scale"),
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
    this.peels = indexedResource(gl, createPeelGeometry(budget, seed), PEEL_VERTEX_STRIDE * 4, [
      { location: 0, size: 3, offset: 0 },
      { location: 1, size: 4, offset: 12 },
      { location: 2, size: 3, offset: 28 },
      { location: 3, size: 3, offset: 40 },
      { location: 4, size: 2, offset: 52 },
      { location: 5, size: 3, offset: 60 },
      { location: 6, size: 3, offset: 72 },
    ]);
    const perSheet = budget.peelSamples * budget.peelRows * 6;
    this.peelOrder = createPeelDescriptors(budget.peels, seed).map((peel, index) => ({
      center: peel.center,
      offset: index * perSheet * 2,
      count: perSheet,
      z: 0,
    }));
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
    this.objectOrientation.set(matrix);
    const gl = this.gl;
    gl.useProgram(this.orbProgram);
    gl.uniformMatrix3fv(this.orbUniforms.orientation, false, matrix);
    gl.useProgram(this.peelProgram);
    gl.uniformMatrix3fv(this.peelUniforms.orientation, false, matrix);
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
    if (this.contactUniforms) {
      gl.uniform4f(
        this.contactUniforms.pose,
        frame.opening,
        frame.peelLift,
        frame.peelWidth,
        frame.peelCoherence,
      );
      gl.uniform2f(this.contactUniforms.phase, frame.peelTravel, frame.peelRephase);
    }
    gl.bindVertexArray(this.orb.vao);
    gl.drawElements(gl.TRIANGLES, this.orb.count, gl.UNSIGNED_SHORT, 0);

    // Six reusable sheet ranges are ordered back-to-front. Soft alpha must not
    // write depth and punch holes through later overlapping layers.
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    bindProgram(gl, this.peelProgram);
    this.setCommonUniforms(this.peelUniforms, frame);
    gl.uniform1i(this.peelUniforms.lightCount, this.budget.lights);
    this.setPeelUniforms(frame);
    gl.bindVertexArray(this.peels.vao);
    if (this.budget.membraneDepthPass) {
      // Only opaque sheet interiors compete for nearest depth, including curled
      // self-overlaps. Their soft fringes retain sorted premultiplied blending.
      gl.colorMask(false, false, false, false);
      gl.depthMask(true);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      gl.uniform1i(this.peelUniforms.depthOnly, 1);
      gl.drawElements(gl.TRIANGLES, this.peels.count, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.colorMask(true, true, true, true);
      gl.depthMask(false);
      gl.depthFunc(gl.LEQUAL);
    }
    gl.uniform1i(this.peelUniforms.depthOnly, 0);
    for (const sheet of this.peelOrder) {
      const m = this.objectOrientation,
        c = sheet.center;
      let x = m[0] * c[0] + m[3] * c[1] + m[6] * c[2],
        y = m[1] * c[0] + m[4] * c[1] + m[7] * c[2],
        z = m[2] * c[0] + m[5] * c[1] + m[8] * c[2];
      const spinX = Math.cos(frame.spin) * x + Math.sin(frame.spin) * z;
      z = -Math.sin(frame.spin) * x + Math.cos(frame.spin) * z;
      x = spinX;
      const roll = 0.08 * Math.sin(frame.breathPhase + 1.4),
        rollX = Math.cos(roll) * x - Math.sin(roll) * y;
      y = Math.sin(roll) * x + Math.cos(roll) * y;
      x = rollX;
      const tilt = 0.22 + 0.018 * Math.sin(frame.breathPhase),
        tiltZ = Math.sin(tilt) * y + Math.cos(tilt) * z;
      sheet.z = -Math.sin(frame.precession) * x + Math.cos(frame.precession) * tiltZ;
    }
    this.peelOrder.sort((a, b) => a.z - b.z);
    for (const sheet of this.peelOrder)
      gl.drawElements(gl.TRIANGLES, sheet.count, gl.UNSIGNED_SHORT, sheet.offset);
    gl.depthFunc(gl.LESS);

    gl.depthMask(false);
    bindProgram(gl, this.particleProgram);
    gl.uniform1f(this.particleUniforms.phase, frame.particlePhase);
    gl.uniform1f(this.particleUniforms.driftPhase, frame.particleDriftPhase);
    gl.uniform1f(this.particleUniforms.excitation, frame.particleExcitation);
    gl.uniform1f(this.particleUniforms.spread, frame.reactivity.particleSpread);
    gl.uniform1f(this.particleUniforms.opacityBoost, frame.reactivity.particleOpacity);
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
      behavior: location(gl, shader, "u_behavior"),
      radius: location(gl, shader, "u_radius"),
      intensity: location(gl, shader, "u_intensity"),
      scale: location(gl, shader, "u_scale"),
    };
  }

  private fieldUniformLocations(shader: WebGLProgram): FieldUniforms {
    const gl = this.gl;
    return {
      state: location(gl, shader, "u_field_state"),
      paletteBalance: location(gl, shader, "u_palette_balance"),
      paletteContrast: location(gl, shader, "u_palette_contrast"),
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
    this.gl.uniform1f(uniforms.paletteBalance, frame.paletteBalance);
    this.gl.uniform1f(uniforms.paletteContrast, frame.paletteContrast);
  }

  private setCommonUniforms(uniforms: CommonUniforms, frame: MotionFrame): void {
    const gl = this.gl;
    gl.uniform4f(
      uniforms.behavior,
      frame.reactivity.inputPresence,
      frame.reactivity.outputPulse,
      frame.reasoningCue,
      frame.receptiveCue,
    );
    gl.uniform1f(uniforms.radius, frame.radius);
    // Keep the user setting as baseline while actual output energy illuminates
    // both body and membrane. The halo already consumes frame.glow separately.
    gl.uniform1f(
      uniforms.intensity,
      Math.min(
        1,
        this.settings.intensity +
          frame.reactivity.outputPulse * 0.32 +
          frame.reactivity.inputPresence * 0.08 +
          frame.reasoningCue * 0.04,
      ),
    );
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
