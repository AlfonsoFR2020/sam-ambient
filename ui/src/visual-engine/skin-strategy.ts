import { MEMBRANE_SHAPE_GLSL, SKIN_SURFACE_GLSL, type SkinPose, skinPoint } from "./membrane";
import { MEMBRANE_CONTACT_GLSL } from "./membrane-optics";
import type { RenderBudget } from "./quality";
import { createSkinOpenings, packSkinOpenings, type SkinVector } from "./skin-domain";
import { createSkinGeometry, type SkinGeometry } from "./skin-geometry";

export type SkinStrategyId =
  | "connected-parent"
  | "radial-sectors"
  | "organic-peels"
  | "bipolar-peels";
export type BodyPoint = (direction: SkinVector) => SkinVector;
export interface SkinDescriptors {
  readonly centers: Float32Array;
  readonly tangents: Float32Array;
  readonly sides: Float32Array;
  readonly shapes: Float32Array;
}
export interface SkinSetup {
  readonly geometry: SkinGeometry;
  /** Four vec4[3] arrays; their meanings belong to the selected strategy. */
  readonly descriptors: SkinDescriptors;
  readonly count: number;
}
export interface SkinReference {
  point(n: SkinVector, pose: SkinPose, body: BodyPoint, clearance: number): SkinVector;
}
/** Static trusted source only. Geometry, equations and contact must travel together.
 * Setup owns immutable directions (body or explicit atlas) and Uint16 indices. Frame updates
 * consume MotionFrame uniforms only; no strategy callback runs in the draw loop.
 */
export interface SkinStrategy {
  readonly id: SkinStrategyId;
  readonly materialSpace: "unit-object-direction";
  /** Only this closed atlas strategy maps setup parameters back to body pigment. */
  readonly materialDirection?: "bipolarMaterialDirection" | "roundedMaterialDirection";
  /** Solid positive peels resolve visibility per fragment with the ordinary
   * depth buffer. Omitted retains the existing sorted translucent film path. */
  readonly layering?: "opaque-depth" | "nearest-transmission";
  readonly shapeGLSL: string;
  readonly surfaceGLSL: string;
  readonly contactGLSL: string;
  create(budget: RenderBudget, seed: number): SkinSetup;
  reference(seed: number): SkinReference;
}

export const CONNECTED_PARENT_SKIN: SkinStrategy = Object.freeze({
  id: "connected-parent",
  materialSpace: "unit-object-direction",
  shapeGLSL: MEMBRANE_SHAPE_GLSL,
  surfaceGLSL: SKIN_SURFACE_GLSL,
  contactGLSL: MEMBRANE_CONTACT_GLSL,
  create(budget: RenderBudget, seed: number): SkinSetup {
    const openings = budget.peels ? createSkinOpenings(seed) : [];
    return {
      geometry: createSkinGeometry(budget, seed),
      descriptors: packSkinOpenings(openings),
      count: openings.length,
    };
  },
  reference(seed: number): SkinReference {
    const openings = createSkinOpenings(seed);
    return { point: (n, pose, body, clearance) => skinPoint(n, openings, pose, body, clearance) };
  },
});
