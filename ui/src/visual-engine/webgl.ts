import type { RendererBackend } from "./backend";
import {
  createParticleGeometry,
  createPeelGeometry,
  createSphereGeometry,
  type IndexedGeometry,
} from "./geometry";
import { MotionEvaluator, type MotionFrame } from "./motion";
import type { RenderBudget } from "./quality";
import { HALO_OPACITY_SCALE } from "./tuning";
import type { VisualEngineSettings, VisualInputV1 } from "./types";

const ORB_VERTEX = `#version 300 es
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
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
void main(){
  vec3 axisA=normalize(vec3(.70,.20,.60));
  vec3 axisB=normalize(vec3(-.25,.91,.32));
  vec3 axisC=normalize(vec3(.41,-.36,.84));
  float pA=2.0*dot(axisA,a_normal)+u_breath_phase;
  float pB=3.0*dot(axisB,a_normal)+u_ripple_phase;
  float pC=7.0*dot(axisC,a_normal)-u_ripple_phase*.71;
  float deformation=.006*sin(pA)+u_deformation*.55*sin(pB)+u_ripple*.35*sin(pC);
  vec3 gradient=.012*cos(pA)*axisA+u_deformation*1.65*cos(pB)*axisB+u_ripple*2.45*cos(pC)*axisC;
  gradient-=a_normal*dot(gradient,a_normal);
  vec3 localNormal=normalize(a_normal-gradient/max(.9,u_radius+deformation));
  mat3 rotation=rotateY(u_precession)*rotateX(.22+.018*sin(u_breath_phase*.37))*rotateZ(.08*sin(u_breath_phase*.21))*rotateY(u_spin)*u_object_orientation;
  vec3 position=a_position*(u_radius+deformation);
  position.y*=1.06;
  v_position=rotation*position;
  v_normal=normalize(rotation*vec3(localNormal.x,localNormal.y/1.06,localNormal.z));
  gl_Position=vec4(v_position.xy*u_scale,-v_position.z*.25,1.);
}`;

const ORB_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_position;
uniform float u_intensity;
uniform int u_light_count;
uniform float u_light_phase;
uniform float u_rim;
uniform float u_highlight;
uniform mat3 u_object_orientation;
out vec4 color;
void main(){
  vec3 n=normalize(v_normal), view=vec3(0.,0.,1.);
  float diffuse=.09;
  float specular=0.;
  for(int i=0;i<3;i++){
    if(i>=u_light_count) break;
    float fi=float(i);
    float phase=u_light_phase*(1.+fi*.37)+fi*2.094;
    float incline=.18+fi*.17;
    vec3 orbit=vec3(cos(phase)*1.6,sin(phase*.83+fi)*1.3,1.35+sin(phase)*.18);
    orbit.yz=mat2(cos(incline),-sin(incline),sin(incline),cos(incline))*orbit.yz;
    vec3 light=normalize(orbit-v_position);
    diffuse+=max(dot(n,light),0.)*(.56-fi*.065);
    specular+=pow(max(dot(n,normalize(light+view)),0.),18.)*(.48-fi*.055);
  }
  float rim=pow(1.-max(dot(n,view),0.),3.);
  vec3 base=mix(vec3(.145,.014,.004),vec3(.98,.255,.04),clamp(diffuse,0.,1.));
  vec3 linear=base*(.28+u_intensity*.82)+vec3(1.,.49,.11)*(specular+u_highlight*.28)+vec3(.96,.24,.025)*rim*(u_rim+.08);
  linear=linear/(1.+linear);
  color=vec4(pow(linear,vec3(1./2.2)),1.);
}`;

const PEEL_VERTEX = `#version 300 es
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
out float v_alpha;
out float v_facing;
out float v_highlight;
mat3 rotateX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rotateY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rotateZ(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
vec3 carrier(float u,float family){
  float phi=atan(sinh(u));
  float lambda=(1.65+.06*sin(u_peel_travel*.17+a_surface.w))*u+family*6.2831853+(family-.33)*u_opening*.06;
  return vec3(cos(phi)*cos(lambda),sin(phi),cos(phi)*sin(lambda));
}
void main(){
  float q=a_base.x, side=a_base.y;
  float directionSign=a_motion.x<0.?-1.:1.;
  float cadence=.38+abs(a_motion.x)*7.;
  float center=a_base.z+.18*sin(directionSign*u_peel_travel*cadence+a_surface.w)+u_rephase*sin(a_surface.w);
  center=clamp(center,-1.25,1.25);
  float u=clamp(center+q*a_base.w,-1.8,1.8);
  vec3 c=carrier(u,a_motion.w);
  vec3 tangent=normalize(carrier(min(1.8,u+.003),a_motion.w)-carrier(max(-1.8,u-.003),a_motion.w));
  vec3 across=normalize(cross(c,tangent));
  float fade=smoothstep(0.,.18,1.-abs(q));
  float alignment=pow(.5+.5*cos(u_peel_travel*.37+a_motion.w*6.2831853),10.)*u_coherence;
  float peelWidth=a_surface.x*u_peel_width*(1.+alignment*.08);
  vec3 direction=normalize(c*cos(side*peelWidth*fade)+across*sin(side*peelWidth*fade));
  mat3 local=rotateX(a_motion.y)*rotateZ(a_motion.z);
  direction=local*direction;
  mat3 rotation=rotateY(u_precession)*rotateX(.22+.018*sin(u_breath_phase*.37))*rotateZ(.08*sin(u_breath_phase*.21))*rotateY(u_spin)*u_object_orientation;
  float deformation=.006*sin(2.0*dot(direction,normalize(vec3(.7,.2,.6)))+u_breath_phase)+u_deformation*.55*sin(3.0*dot(direction,normalize(vec3(-.25,.91,.32)))+u_ripple_phase)+u_ripple*.35*sin(7.0*dot(direction,normalize(vec3(.41,-.36,.84)))-u_ripple_phase*.71);
  float lift=a_surface.y+u_peel_lift*(.68+.32*sin(a_surface.w+u_peel_travel*.43));
  vec3 position=direction*(u_radius+deformation+lift);
  position.y*=1.06;
  vec3 world=rotation*position;
  vec3 normal=normalize(rotation*direction);
  v_alpha=a_surface.z*fade*fade*(1.+alignment*.16);
  v_facing=smoothstep(-.02,.15,normal.z);
  v_highlight=alignment*.35+u_highlight*(.25+.75*pow(1.-abs(q),3.));
  gl_Position=vec4(world.xy*u_scale,-world.z*.25,1.);
}`;

const PEEL_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
in float v_facing;
uniform float u_intensity;
uniform float u_emission;
in float v_highlight;
out vec4 color;
void main(){
  float alpha=clamp(v_alpha*v_facing*(.5+.5*u_emission),0.,.82);
  vec3 warm=mix(vec3(.88,.16,.025),vec3(1.,.62,.24),clamp(u_intensity*.62+v_highlight,0.,1.));
  color=vec4(warm*alpha,alpha);
}`;

const PARTICLE_VERTEX = `#version 300 es
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
  float cadence=.72+fract(a_particle.x*.159)*.46;
  float angle=a_particle.x+u_phase*cadence;
  float shell=a_particle.y+.025*sin(angle*1.37+a_particle.x);
  float incline=a_particle.z;
  vec3 point=vec3(cos(angle)*shell,sin(angle*.83+a_particle.x)*shell*.72,sin(angle)*shell);
  point.yz=mat2(cos(incline),-sin(incline),sin(incline),cos(incline))*point.yz;
  point=u_object_orientation*point*u_radius;
  v_alpha=smoothstep(-.08,.2,point.z)*(.24+u_excitation*.34)*u_density;
  gl_Position=vec4(point.xy*u_scale,-point.z*.25,1.);
  gl_PointSize=a_particle.w*u_point_scale*(1.18+u_excitation*.62);
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in float v_alpha;
out vec4 color;
void main(){
  float distanceFromCenter=length(gl_PointCoord-vec2(.5))*2.;
  float alpha=v_alpha*(1.-smoothstep(.15,1.,distanceFromCenter));
  color=vec4(vec3(.96,.39,.10)*alpha,alpha);
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
  readonly radius: WebGLUniformLocation;
  readonly intensity: WebGLUniformLocation;
  readonly scale: WebGLUniformLocation;
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
  private readonly orbUniforms: CommonUniforms & {
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
  private readonly peelUniforms: CommonUniforms & {
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
  ) {
    this.reducedMotionMedia =
      typeof matchMedia === "undefined"
        ? undefined
        : matchMedia("(prefers-reduced-motion: reduce)");
    this.orbProgram = program(gl, ORB_VERTEX, ORB_FRAGMENT);
    this.peelProgram = program(gl, PEEL_VERTEX, PEEL_FRAGMENT);
    this.haloProgram = program(gl, HALO_VERTEX, HALO_FRAGMENT);
    this.particleProgram = program(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    this.orbUniforms = {
      ...this.commonUniformLocations(this.orbProgram),
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
    this.motion = new MotionEvaluator(seed);
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
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
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

  private setCommonUniforms(uniforms: CommonUniforms, frame: MotionFrame): void {
    const gl = this.gl;
    gl.uniform1f(uniforms.radius, frame.radius);
    gl.uniform1f(uniforms.intensity, frame.glow);
    gl.uniform2f(uniforms.scale, this.scaleX, this.scaleY);
  }

  private setOrbUniforms(frame: MotionFrame): void {
    const gl = this.gl;
    const uniforms = this.orbUniforms;
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
