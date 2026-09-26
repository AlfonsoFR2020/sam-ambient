/** Existing visual input envelopes are interpreted here, after freshness checks. */
export interface AmbientReactivityFrame {
  /** Smoothed, normalized sustained input/output energy. */
  readonly sustained: number;
  /** Smoothed, normalized input peak/transient. Output transients are not reported yet. */
  readonly onset: number;
  /** Additive particle radius in Orb units; zero leaves autonomous paths intact. */
  readonly particleSpread: number;
  /** Fractional particle orbit-rate increase around the autonomous clock. */
  readonly particleDrift: number;
  /** Fractional particle alpha increase. */
  readonly particleOpacity: number;
}

const unit = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const ease = (value: number): number => {
  const bounded = unit(value);
  return bounded * bounded * (3 - 2 * bounded);
};
const blend = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

/** Owns visual attack/release; the input adapter only expires stale samples. */
export class AmbientReactivity {
  private readonly frame: {
    sustained: number;
    onset: number;
    particleSpread: number;
    particleDrift: number;
    particleOpacity: number;
  } = { sustained: 0, onset: 0, particleSpread: 0, particleDrift: 0, particleOpacity: 0 };

  get current(): Readonly<AmbientReactivityFrame> {
    return this.frame;
  }

  reset(): void {
    this.frame.sustained = 0;
    this.frame.onset = 0;
    this.mapTargets();
  }

  update(
    inputEnvelope: number,
    outputEnvelope: number,
    inputPeak: number,
    strength: number,
    elapsedSeconds: number,
    interrupted: boolean,
    frozen: boolean,
  ): Readonly<AmbientReactivityFrame> {
    if (frozen) {
      this.reset();
      return this.frame;
    }
    const combined = Math.max(unit(outputEnvelope), unit(inputEnvelope) * 0.55);
    const sustainedTarget = ease(combined * unit(strength));
    const onsetTarget = ease(unit(inputPeak) * unit(strength));
    const dt = Number.isFinite(elapsedSeconds) ? Math.min(0.05, Math.max(0, elapsedSeconds)) : 0;
    const sustainTau = interrupted ? 0.12 : combined > this.frame.sustained ? 0.06 : 0.18;
    this.frame.sustained = blend(this.frame.sustained, sustainedTarget, dt, sustainTau);
    this.frame.onset = blend(
      this.frame.onset,
      onsetTarget,
      dt,
      onsetTarget > this.frame.onset ? 0.025 : 0.18,
    );
    this.mapTargets();
    return this.frame;
  }

  private mapTargets(): void {
    const { sustained, onset } = this.frame;
    this.frame.particleSpread = Math.min(0.14, 0.1 * sustained + 0.04 * onset);
    this.frame.particleDrift = Math.min(0.3, 0.3 * sustained);
    this.frame.particleOpacity = Math.min(0.26, 0.16 * sustained + 0.1 * onset);
  }
}
