/** Existing visual input envelopes are interpreted here, after freshness checks. */
export interface AmbientReactivityFrame {
  /** Speech-shaped output energy; follows the waveform, not the speaking state. */
  readonly outputPulse: number;
  /** Quieter receptive response to measured microphone activity. */
  readonly inputPresence: number;
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
    outputPulse: number;
    inputPresence: number;
    sustained: number;
    onset: number;
    particleSpread: number;
    particleDrift: number;
    particleOpacity: number;
  } = {
    outputPulse: 0,
    inputPresence: 0,
    sustained: 0,
    onset: 0,
    particleSpread: 0,
    particleDrift: 0,
    particleOpacity: 0,
  };
  private outputBaseline = 0;

  get current(): Readonly<AmbientReactivityFrame> {
    return this.frame;
  }

  reset(): void {
    this.frame.outputPulse = 0;
    this.frame.inputPresence = 0;
    this.outputBaseline = 0;
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
    // RMS from ordinary speech is much smaller than full scale. Compress its
    // dynamic range before visual mapping; keep input and output independent.
    const amount = unit(strength);
    const outputDrive = Math.sqrt(unit(outputEnvelope)) * amount;
    const inputDrive = Math.sqrt(unit(inputEnvelope)) * amount;
    const combined = Math.max(outputDrive, inputDrive * 0.55);
    const sustainedTarget = combined;
    const onsetTarget = ease(unit(inputPeak) * unit(strength));
    const dt = Number.isFinite(elapsedSeconds) ? Math.min(0.05, Math.max(0, elapsedSeconds)) : 0;
    this.outputBaseline = blend(this.outputBaseline, outputDrive, dt, 0.55);
    const outputTarget = unit(
      outputDrive * 0.45 + Math.max(0, outputDrive - this.outputBaseline * 0.8) * 1.35,
    );
    this.frame.outputPulse = blend(
      this.frame.outputPulse,
      outputTarget,
      dt,
      outputTarget > this.frame.outputPulse ? 0.035 : interrupted ? 0.07 : 0.11,
    );
    this.frame.inputPresence = blend(
      this.frame.inputPresence,
      inputDrive,
      dt,
      inputDrive > this.frame.inputPresence ? 0.065 : interrupted ? 0.1 : 0.18,
    );
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
