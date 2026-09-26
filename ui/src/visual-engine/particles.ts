export const PARTICLE_RADIUS_RANGE = Object.freeze({ minimum: 1.2, maximum: 2.45 });
export const PARTICLE_POINT_SIZE_RANGE = Object.freeze({ minimum: 2.3, maximum: 5.6 });
export const PARTICLE_RADIAL_WANDER = 0.035;
export const PARTICLE_VERTICAL_WANDER = 0.075;
export const PARTICLE_MAX_SPREAD = 0.14;
export const PARTICLE_VISIBILITY_HASH = 0.159;
export const PARTICLE_GOLD = Object.freeze({ red: 0.831, green: 0.686, blue: 0.216 });
export const PARTICLE_COPPER = Object.freeze({ red: 0.72, green: 0.35, blue: 0.17 });

export interface ParticleParameters {
  readonly phase: number;
  readonly radius: number;
  readonly inclination: number;
  readonly azimuth: number;
  readonly size: number;
  /** Signed integer harmonic; wrapped phase therefore never snaps. */
  readonly cadence: -2 | -1 | 1 | 2;
  readonly opacity: number;
  readonly tint: number;
}

/** CPU reference for analytic WebGL paths; no CPU particle positions are updated per frame. */
export function particlePosition(
  particle: ParticleParameters,
  orbitPhase: number,
  driftPhase: number,
  spread = 0,
): readonly [number, number, number] {
  const angle = particle.phase + orbitPhase * particle.cadence;
  const slowRate = Math.abs(particle.cadence);
  const safeSpread = Number.isFinite(spread)
    ? Math.min(PARTICLE_MAX_SPREAD, Math.max(0, spread))
    : 0;
  const radius =
    particle.radius +
    PARTICLE_RADIAL_WANDER * Math.sin(driftPhase * slowRate + particle.phase) +
    safeSpread * (0.35 + 0.65 * particleVisibilityRank(particle.phase));
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  const z = PARTICLE_VERTICAL_WANDER * Math.sin(2 * angle + particle.phase);
  const cy = Math.cos(particle.inclination);
  const sy = Math.sin(particle.inclination);
  const inclinedY = cy * y - sy * z;
  const inclinedZ = sy * y + cy * z;
  const ca = Math.cos(particle.azimuth);
  const sa = Math.sin(particle.azimuth);
  return [ca * x - sa * inclinedZ, inclinedY, sa * x + ca * inclinedZ];
}

export function particleVisibilityRank(phase: number): number {
  const value = phase * PARTICLE_VISIBILITY_HASH;
  return value - Math.floor(value);
}

export function particleIsVisible(phase: number, density: number): boolean {
  return density > 0 && particleVisibilityRank(phase) <= Math.min(1, density);
}
