export const HALO_OPACITY_SCALE = 0.08;

export const haloOpacity = (intensity: number, glowIntensity: number): number =>
  HALO_OPACITY_SCALE * glowIntensity * (0.5 + 0.5 * intensity);
