import { LIVING_FIELD_GLSL } from "./living-field";

/** One selected thin surface transmits the already shaded body. This is a
 * premultiplied approximation, not refraction, OIT or multilayer absorption. */
export const bipolarFilmFragment = (materialGLSL: string) => `#version 300 es
precision highp float;
in float v_alpha,v_radial,v_lift,v_highlight;
in vec3 v_object_direction,v_normal,v_position;
uniform float u_intensity,u_emission,u_radius;
uniform bool u_depth_only;
out vec4 color;
${LIVING_FIELD_GLSL}
${materialGLSL}
void main() {
  // Every covered fragment competes for nearest depth, even where alpha is low.
  if(u_depth_only){color=vec4(0.);return;}
  LivingField field=sampleLivingField(normalize(v_object_direction));
  LivingPigment pigment=livingPigment(field);
  float fine=livingSurfaceDetail(field);
  vec3 normal=livingMaterialNormal(gl_FrontFacing?v_normal:-v_normal,v_position,fine*mix(.4,.07,v_lift));
  LivingLight light=livingLight(normal,v_position,gl_FrontFacing?1.:.8);
  float fresnel=.04+.96*pow(1.-clamp(abs(normal.z),0.,1.),5.);
  float attached=1.-smoothstep(.08,.24,v_radial);
  float alpha=mix((gl_FrontFacing?.27:.36)+.55*fresnel,.96,attached);
  alpha*=.98+.02*clamp(v_alpha*u_emission,0.,1.);
  vec3 glintColor=mix(vec3(1.,.82,.65),vec3(.76,.88,1.),pigment.cool);
  vec3 coat=pigment.albedo;
  vec3 reflected=coat*(.10+.24*light.diffuse)
    +glintColor*(light.glint*(gl_FrontFacing?2.4:1.15)+.12*fresnel*(.2+.8*min(light.diffuse,1.))+v_highlight*.12);
  vec3 attachedCoat=coat*(.20+.9*light.diffuse+u_intensity*.10)+glintColor*light.glint;
  vec3 linear=mix(reflected,attachedCoat,attached);
  linear+=livingBehaviorLight(field,coat,v_position,u_radius)*.5;
  linear+=coat*light.back*.045*v_lift;
  linear*=mix(.22,1.15,u_intensity)*(gl_FrontFacing?1.:.82);
  linear=linear/(1.+linear);
  color=vec4(pow(linear,vec3(1.0/2.2))*alpha,alpha);
}`;
