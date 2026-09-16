export const PARTICLE_SHELL_RANGE = Object.freeze({ minimum: 1.1, maximum: 1.4 });
export const PARTICLE_POINT_SIZE_RANGE = Object.freeze({ minimum: 3.2, maximum: 5.2 });
export const PARTICLE_VISIBILITY_HASH = 0.159;
export const PARTICLE_GOLD = Object.freeze({ red: 0.831, green: 0.686, blue: 0.216 });

export function particleVisibilityRank(phase: number): number {
  const value = phase * PARTICLE_VISIBILITY_HASH;
  return value - Math.floor(value);
}

export function particleIsVisible(phase: number, density: number): boolean {
  return density > 0 && particleVisibilityRank(phase) <= Math.min(1, density);
}
