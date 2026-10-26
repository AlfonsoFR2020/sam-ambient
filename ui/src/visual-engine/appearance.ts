import { BIPOLAR_FILM_SKIN } from "./bipolar-film";
import { BIPOLAR_PEEL_SKIN } from "./bipolar-peel";
import { LIVING_MATERIAL_GLSL } from "./living-material";
import { ORGANIC_PEEL_SKIN } from "./organic-peel";
import { RADIAL_SECTOR_SKIN } from "./radial-shell";
import { CONNECTED_PARENT_SKIN, type SkinStrategy } from "./skin-strategy";

export type OrbAppearanceId =
  | "living-connected"
  | "radial-shell-experimental"
  | "organic-peel-experimental"
  | "bipolar-peel-experimental"
  | "bipolar-film-experimental";
export type OrbMaterialId = "living-pigment";
/** A material is independent of skin topology but not of its coordinate contract.
 * Future palette variants must also coordinate particle colour; this is no promise
 * that volume, wireframe or arbitrary GLSL can use the surface pipeline unchanged.
 */
export interface OrbMaterial {
  readonly id: OrbMaterialId;
  readonly coordinateSpace: "unit-object-direction";
  readonly particlePalette: "regional-three-bank";
  readonly fragmentGLSL: string;
}
export const LIVING_PIGMENT_MATERIAL: OrbMaterial = Object.freeze({
  id: "living-pigment",
  coordinateSpace: "unit-object-direction",
  particlePalette: "regional-three-bank",
  fragmentGLSL: LIVING_MATERIAL_GLSL,
});
export interface OrbAppearance {
  readonly id: OrbAppearanceId;
  readonly status: "integration-baseline" | "experimental";
  readonly body: "living-displaced-sphere";
  readonly material: OrbMaterial;
  readonly skin: SkinStrategy;
  /** Canvas/static keep their existing recovery identity, not experimental geometry. */
  readonly fallback: "shared-recovery";
}
export const DEFAULT_ORB_APPEARANCE: OrbAppearance = Object.freeze({
  id: "living-connected",
  status: "integration-baseline",
  body: "living-displaced-sphere",
  material: LIVING_PIGMENT_MATERIAL,
  skin: CONNECTED_PARENT_SKIN,
  fallback: "shared-recovery",
});
export const RADIAL_SHELL_APPEARANCE: OrbAppearance = Object.freeze({
  id: "radial-shell-experimental",
  status: "experimental",
  body: "living-displaced-sphere",
  material: LIVING_PIGMENT_MATERIAL,
  skin: RADIAL_SECTOR_SKIN,
  fallback: "shared-recovery",
});
/** Explicit internal selection; no persisted setting, registry or runtime code loading. */
export const ORGANIC_PEEL_APPEARANCE: OrbAppearance = Object.freeze({
  id: "organic-peel-experimental",
  status: "experimental",
  body: "living-displaced-sphere",
  material: LIVING_PIGMENT_MATERIAL,
  skin: ORGANIC_PEEL_SKIN,
  fallback: "shared-recovery",
});
export function resolveOrbAppearance(id: OrbAppearanceId = "living-connected"): OrbAppearance {
  if (id === "living-connected") return DEFAULT_ORB_APPEARANCE;
  if (id === "radial-shell-experimental") return RADIAL_SHELL_APPEARANCE;
  if (id === "organic-peel-experimental") return ORGANIC_PEEL_APPEARANCE;
  if (id === "bipolar-peel-experimental") return BIPOLAR_PEEL_APPEARANCE;
  if (id === "bipolar-film-experimental") return BIPOLAR_FILM_APPEARANCE;
  throw new RangeError(`Unsupported Orb appearance: ${String(id)}`);
}
export const BIPOLAR_PEEL_APPEARANCE: OrbAppearance = Object.freeze({
  id: "bipolar-peel-experimental",
  status: "experimental",
  body: "living-displaced-sphere",
  material: LIVING_PIGMENT_MATERIAL,
  skin: BIPOLAR_PEEL_SKIN,
  fallback: "shared-recovery",
});
export const BIPOLAR_FILM_APPEARANCE: OrbAppearance = Object.freeze({
  id: "bipolar-film-experimental",
  status: "experimental",
  body: "living-displaced-sphere",
  material: LIVING_PIGMENT_MATERIAL,
  skin: BIPOLAR_FILM_SKIN,
  fallback: "shared-recovery",
});
