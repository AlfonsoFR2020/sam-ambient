import type { RenderBudget } from "./quality";
import type { AudioFeatures, VisualEngineSettings, VisualForeground, VisualInputV1 } from "./types";

const TWO_PI = Math.PI * 2;
export const MAX_FRAME_DELTA_SECONDS = 0.05;

export interface StateTarget {
  readonly radius: number;
  readonly glow: number;
  readonly opening: number;
  readonly spin: number;
  readonly lift: number;
  readonly width: number;
  readonly coherence: number;
  readonly rim: number;
  readonly drift: number;
}

export const STATE_TARGETS: Readonly<Record<VisualForeground, StateTarget>> = Object.freeze({
  idle: {
    radius: 1,
    glow: 0.24,
    opening: 0.1,
    spin: 0.045,
    lift: 0.002,
    width: 1,
    coherence: 0.82,
    rim: 0.2,
    drift: 1,
  },
  listening: {
    radius: 1.05,
    glow: 0.34,
    opening: 0.78,
    spin: 0.055,
    lift: 0.015,
    width: 1.14,
    coherence: 0.58,
    rim: 0.4,
    drift: 1.08,
  },
  transcribing: {
    radius: 0.97,
    glow: 0.34,
    opening: 0.14,
    spin: 0.03,
    lift: 0.004,
    width: 0.98,
    coherence: 0.96,
    rim: 0.24,
    drift: 0.55,
  },
  thinking: {
    radius: 0.945,
    glow: 0.31,
    opening: 0.04,
    spin: 0.025,
    lift: 0,
    width: 0.94,
    coherence: 0.96,
    rim: 0.13,
    drift: -0.42,
  },
  speaking: {
    radius: 1.025,
    glow: 0.44,
    opening: 0.5,
    spin: 0.065,
    lift: 0.014,
    width: 1.2,
    coherence: 0.62,
    rim: 0.32,
    drift: 1.2,
  },
  interrupted: {
    radius: 0.94,
    glow: 0.26,
    opening: 0.12,
    spin: 0.02,
    lift: 0,
    width: 0.9,
    coherence: 1,
    rim: 0.14,
    drift: 0.08,
  },
  resuming: {
    radius: 1,
    glow: 0.34,
    opening: 0.32,
    spin: 0.052,
    lift: 0.006,
    width: 1.05,
    coherence: 0.76,
    rim: 0.24,
    drift: 0.82,
  },
});

export interface MotionFrame {
  foreground: VisualForeground;
  radius: number;
  glow: number;
  opening: number;
  spin: number;
  precession: number;
  breathPhase: number;
  ripplePhase: number;
  lightPhase: number;
  particlePhase: number;
  fieldPhase1: number;
  fieldPhase2: number;
  fieldTwist1: number;
  fieldTwist2: number;
  peelTravel: number;
  peelLift: number;
  peelWidth: number;
  peelEmission: number;
  peelCoherence: number;
  peelRephase: number;
  surfaceDeformation: number;
  surfaceRipple: number;
  highlight: number;
  rim: number;
  particleExcitation: number;
  inputEnvelope: number;
  outputEnvelope: number;
  envelope: number;
  interruption: number;
  reasoningCue: number;
  delegatedCue: number;
  warmth: number;
  reducedMotion: boolean;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
const unit = (value: number): number => clamp(value, 0, 1);
const signed = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) ? clamp(value, -1, 1) : 0;
const ease = (value: number): number => {
  const bounded = unit(value);
  return bounded * bounded * (3 - 2 * bounded);
};
const blend = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / tau));
const wrap = (value: number): number => {
  const wrapped = value % TWO_PI;
  return wrapped < 0 ? wrapped + TWO_PI : wrapped;
};

const live = (
  feature: AudioFeatures | undefined,
  now: number,
  value: number | undefined,
): number => {
  if (!feature || value === undefined || !Number.isFinite(value)) return 0;
  const age = Math.max(0, now - feature.receivedMs);
  if (age >= 1000) return 0;
  const release = age <= 250 ? 1 : Math.exp(-(age - 250) / 180);
  return unit(value) * release;
};

/** One continuous, mutable evaluator. The returned frame is reused on every call. */
export class MotionEvaluator {
  private lastMs?: number;
  private streamKey?: string;
  private lastInterruptSerial = 0;
  private initialized = false;
  private envelope = 0;
  private peak = 0;
  private radius = 1;
  private glow = 0.24;
  private renderedGlow = 0.24;
  private opening = 0.1;
  private spinSpeed = 0.045;
  private lift = 0.002;
  private width = 1;
  private coherence = 0.82;
  private rim = 0.2;
  private drift = 1;
  private reducedTarget?: VisualForeground;
  private reducedTransitionMs = 0;
  private startRadius = 1;
  private startGlow = 0.24;
  private startOpening = 0.1;
  private startSpinSpeed = 0.045;
  private startLift = 0.002;
  private startWidth = 1;
  private startCoherence = 0.82;
  private startRim = 0.2;
  private startDrift = 1;
  private interruption = 0;
  private spinPhase: number;
  private precessionPhase: number;
  private breathPhase: number;
  private ripplePhase: number;
  private lightPhase: number;
  private particlePhase: number;
  private peelTravel: number;
  private fieldPhase1: number;
  private fieldPhase2: number;
  private fieldTwistPhase1: number;
  private fieldTwistPhase2: number;
  private readonly frame: MotionFrame;

  constructor(seed = 0x5a17) {
    const phase = ((seed >>> 0) / 0x1_0000_0000) * TWO_PI;
    this.spinPhase = wrap(phase * 0.73);
    this.precessionPhase = wrap(phase * 1.19);
    this.breathPhase = wrap(phase * 1.61);
    this.ripplePhase = wrap(phase * 2.17);
    this.lightPhase = wrap(phase * 2.71);
    this.particlePhase = wrap(phase * 3.13);
    this.peelTravel = wrap(phase * 0.41);
    this.fieldPhase1 = wrap(phase * 0.83);
    this.fieldPhase2 = wrap(phase * 1.37);
    this.fieldTwistPhase1 = wrap(phase * 1.91);
    this.fieldTwistPhase2 = wrap(phase * 2.43);
    this.frame = {
      foreground: "idle",
      radius: 1,
      glow: 0.24,
      opening: 0.1,
      spin: this.spinPhase,
      precession: this.precessionPhase,
      breathPhase: this.breathPhase,
      ripplePhase: this.ripplePhase,
      lightPhase: this.lightPhase,
      particlePhase: this.particlePhase,
      fieldPhase1: this.fieldPhase1,
      fieldPhase2: this.fieldPhase2,
      fieldTwist1: 0.32 * Math.sin(this.fieldTwistPhase1),
      fieldTwist2: -0.24 * Math.sin(this.fieldTwistPhase2),
      peelTravel: this.peelTravel,
      peelLift: 0.002,
      peelWidth: 1,
      peelEmission: 0.45,
      peelCoherence: 0.82,
      peelRephase: 0,
      surfaceDeformation: 0.008,
      surfaceRipple: 0,
      highlight: 0,
      rim: 0.2,
      particleExcitation: 0.15,
      inputEnvelope: 0,
      outputEnvelope: 0,
      envelope: 0,
      interruption: 0,
      reasoningCue: 0,
      delegatedCue: 0,
      warmth: 0,
      reducedMotion: false,
    };
  }

  /** Drop wall-clock time while no surface is visible; spatial phase is not caught up. */
  pauseClock(): void {
    this.lastMs = undefined;
  }

  evaluate(
    input: VisualInputV1,
    now: number,
    settings: VisualEngineSettings,
    _budget: RenderBudget,
    reducedMotion = settings.reducedMotion === "on",
  ): MotionFrame {
    const safeNow = Number.isFinite(now) ? now : (this.lastMs ?? 0);
    const rawDt = this.lastMs === undefined ? 0 : Math.max(0, (safeNow - this.lastMs) / 1000);
    const dt = Math.min(MAX_FRAME_DELTA_SECONDS, rawDt);
    this.lastMs = safeNow;
    const reduced = reducedMotion;
    const stationary =
      input.interaction.availability === "starting" ||
      input.interaction.availability === "reconnecting" ||
      input.interaction.availability === "stopped";
    const spatiallyFrozen = reduced || stationary;
    const targetForeground = stationary ? "idle" : input.interaction.foreground;
    const target = STATE_TARGETS[targetForeground];
    const stateTau =
      input.interaction.foreground === "interrupted"
        ? 0.07
        : input.interaction.foreground === "transcribing"
          ? 0.16
          : 0.25;

    if (!this.initialized || (stationary && !reduced)) {
      this.radius = target.radius;
      this.glow = target.glow;
      this.opening = target.opening;
      this.spinSpeed = target.spin;
      this.lift = target.lift;
      this.width = target.width;
      this.coherence = target.coherence;
      this.rim = target.rim;
      this.drift = target.drift;
      this.initialized = true;
      this.reducedTarget = reduced ? targetForeground : undefined;
    } else if (reduced) {
      if (this.reducedTarget !== targetForeground) {
        this.reducedTarget = targetForeground;
        this.reducedTransitionMs = safeNow;
        this.startRadius = this.radius;
        this.startGlow = this.glow;
        this.startOpening = this.opening;
        this.startSpinSpeed = this.spinSpeed;
        this.startLift = this.lift;
        this.startWidth = this.width;
        this.startCoherence = this.coherence;
        this.startRim = this.rim;
        this.startDrift = this.drift;
      }
      const progress = ease((safeNow - this.reducedTransitionMs) / 200);
      this.radius = this.startRadius + (target.radius - this.startRadius) * progress;
      this.glow = this.startGlow + (target.glow - this.startGlow) * progress;
      this.opening = this.startOpening + (target.opening - this.startOpening) * progress;
      this.spinSpeed = this.startSpinSpeed + (target.spin - this.startSpinSpeed) * progress;
      this.lift = this.startLift + (target.lift - this.startLift) * progress;
      this.width = this.startWidth + (target.width - this.startWidth) * progress;
      this.coherence = this.startCoherence + (target.coherence - this.startCoherence) * progress;
      this.rim = this.startRim + (target.rim - this.startRim) * progress;
      this.drift = this.startDrift + (target.drift - this.startDrift) * progress;
    } else {
      this.reducedTarget = undefined;
      this.radius = blend(this.radius, target.radius, dt, stateTau);
      this.glow = blend(this.glow, target.glow, dt, stateTau);
      this.opening = blend(this.opening, target.opening, dt, stateTau);
      this.spinSpeed = blend(this.spinSpeed, target.spin, dt, 0.25);
      this.lift = blend(this.lift, target.lift, dt, stateTau);
      this.width = blend(this.width, target.width, dt, stateTau);
      this.coherence = blend(this.coherence, target.coherence, dt, stateTau);
      this.rim = blend(this.rim, target.rim, dt, stateTau);
      this.drift = blend(this.drift, target.drift, dt, 0.25);
    }

    if (input.streamKey !== this.streamKey) {
      this.streamKey = input.streamKey;
      this.lastInterruptSerial = input.interaction.interruptSerial;
      this.interruption =
        input.interaction.foreground === "interrupted" && input.interaction.interruptSerial > 0
          ? 1
          : 0;
      this.envelope = 0;
      this.peak = 0;
    } else if (input.interaction.interruptSerial > this.lastInterruptSerial) {
      this.interruption = 1;
      this.lastInterruptSerial = input.interaction.interruptSerial;
    } else if (dt > 0) this.interruption *= Math.exp(-dt / 0.12);
    if (stationary) this.interruption = 0;

    const inputEnvelope =
      !stationary && input.interaction.listening
        ? live(input.audio.input, safeNow, input.audio.input?.envelope) *
          (input.interaction.userPause ? 0.35 : 1)
        : 0;
    const outputEnvelope =
      !stationary && input.interaction.speaking
        ? live(input.audio.output, safeNow, input.audio.output?.envelope)
        : 0;
    const activity = live(input.audio.input, safeNow, input.audio.input?.activity);
    const actualPeak = input.interaction.listening
      ? Math.max(
          live(input.audio.input, safeNow, input.audio.input?.peak),
          live(input.audio.input, safeNow, input.audio.input?.transient),
        )
      : 0;
    const combined = Math.max(outputEnvelope, inputEnvelope * 0.55);
    const response = ease(combined * settings.audioReactivity);
    const inputResponse = ease(inputEnvelope * settings.audioReactivity);
    const peakResponse = ease(actualPeak * settings.audioReactivity);
    const audioTau = this.interruption > 0 ? 0.12 : combined > this.envelope ? 0.06 : 0.18;
    this.envelope = spatiallyFrozen ? 0 : blend(this.envelope, response, dt, audioTau);
    this.peak = spatiallyFrozen
      ? 0
      : blend(this.peak, peakResponse, dt, peakResponse > this.peak ? 0.025 : 0.18);

    const motion = spatiallyFrozen ? 0 : settings.motionIntensity;
    if (dt > 0 && motion > 0) {
      const speedInfluence = 1 + Math.min(0.35, this.envelope * 0.3);
      this.spinPhase = wrap(this.spinPhase + this.spinSpeed * motion * dt);
      this.precessionPhase = wrap(this.precessionPhase + 0.018 * motion * dt);
      this.breathPhase = wrap(this.breathPhase + (TWO_PI / 8.17) * motion * dt);
      this.ripplePhase = wrap(this.ripplePhase + (0.31 + this.envelope * 0.21) * motion * dt);
      this.lightPhase = wrap(this.lightPhase + 0.086 * speedInfluence * motion * dt);
      this.particlePhase = wrap(this.particlePhase + 0.041 * speedInfluence * motion * dt);
      this.fieldPhase1 = wrap(this.fieldPhase1 + 0.035 * motion * dt);
      this.fieldPhase2 = wrap(this.fieldPhase2 - 0.023 * motion * dt);
      this.fieldTwistPhase1 = wrap(this.fieldTwistPhase1 + 0.067 * motion * dt);
      this.fieldTwistPhase2 = wrap(this.fieldTwistPhase2 - 0.053 * motion * dt);
      const holding = input.interaction.floor === "holding" ? 0.86 : 1;
      this.peelTravel = wrap(this.peelTravel + this.drift * holding * speedInfluence * motion * dt);
    }

    const listeningOpening = input.interaction.listening
      ? inputResponse * 0.1 * (0.45 + activity * 0.55)
      : 0;
    const speakingLift = input.interaction.speaking ? this.envelope * 0.01 : 0;
    const inputLift = input.interaction.listening ? inputResponse * 0.005 : 0;
    const acknowledgement = !stationary && input.interaction.acknowledgement ? 0.025 : 0;
    const yielding = !stationary && input.interaction.floor === "yielding" ? 0.08 : 0;
    const reasoningCue = !stationary && input.interaction.reasoning ? 0.025 : 0;
    const delegatedCue = !stationary && input.interaction.delegatedWork ? 0.04 : 0;
    const expressionAge = input.expression ? safeNow - input.expression.receivedMs : Infinity;
    const expressionWeight =
      !stationary &&
      input.expression &&
      Number.isFinite(expressionAge) &&
      expressionAge >= 0 &&
      expressionAge <= Math.min(2000, Math.max(0, input.expression.ttlMs))
        ? unit(input.expression.confidence)
        : 0;
    const expressionEnergy = expressionWeight * signed(input.expression?.energy);
    const expressionCoherence = expressionWeight * signed(input.expression?.coherence);
    const expressionWarmth = expressionWeight * signed(input.expression?.warmth);
    const breath = spatiallyFrozen ? 0 : 0.014 * Math.sin(this.breathPhase);
    const contraction = this.interruption * 0.018;

    this.frame.foreground = input.interaction.foreground;
    this.frame.radius = clamp(
      this.radius + breath + this.envelope * 0.055 - contraction,
      0.92,
      1.1,
    );
    const availabilityScale =
      input.interaction.availability === "stopped" ? 0.45 : stationary ? 0.65 : 1;
    const desiredGlow = clamp(
      (this.glow +
        this.envelope * 0.28 +
        this.peak * 0.1 +
        reasoningCue +
        delegatedCue +
        expressionEnergy * 0.025) *
        settings.intensity *
        availabilityScale,
      0.12,
      0.85,
    );
    if (rawDt === 0 || spatiallyFrozen) this.renderedGlow = desiredGlow;
    else {
      const maximumChange = 0.8 * dt;
      this.renderedGlow += clamp(desiredGlow - this.renderedGlow, -maximumChange, maximumChange);
    }
    this.frame.glow = this.renderedGlow;
    this.frame.opening = unit(this.opening + listeningOpening + yielding + acknowledgement);
    this.frame.spin = this.spinPhase;
    this.frame.precession = this.precessionPhase;
    this.frame.breathPhase = this.breathPhase;
    this.frame.ripplePhase = this.ripplePhase;
    this.frame.lightPhase = this.lightPhase;
    this.frame.particlePhase = this.particlePhase;
    this.frame.fieldPhase1 = this.fieldPhase1;
    this.frame.fieldPhase2 = this.fieldPhase2;
    this.frame.fieldTwist1 = 0.32 * Math.sin(this.fieldTwistPhase1);
    this.frame.fieldTwist2 = -0.24 * Math.sin(this.fieldTwistPhase2);
    this.frame.peelTravel = this.peelTravel;
    this.frame.peelLift = clamp(
      this.lift + speakingLift + inputLift - this.interruption * 0.006,
      0,
      0.018,
    );
    this.frame.peelWidth = clamp(this.width + this.envelope * 0.2, 0.86, 1.35);
    this.frame.peelEmission = clamp(
      0.34 + this.frame.glow * 0.62 + this.envelope * 0.16,
      0.3,
      0.82,
    );
    this.frame.peelCoherence = unit(
      this.coherence +
        (!stationary && input.interaction.responseReady ? 0.08 : 0) +
        this.interruption * 0.08 +
        expressionCoherence * 0.08,
    );
    this.frame.peelRephase = clamp(this.interruption * 0.12, 0, 0.12);
    this.frame.surfaceDeformation = spatiallyFrozen
      ? 0
      : clamp(0.008 + this.envelope * 0.014 + this.peak * 0.004, 0, 0.026);
    this.frame.surfaceRipple = spatiallyFrozen
      ? 0
      : clamp(this.envelope * 0.018 + this.peak * 0.004, 0, 0.022);
    this.frame.highlight = spatiallyFrozen
      ? 0
      : clamp(this.peak * 0.12 + this.envelope * 0.035, 0, 0.12);
    this.frame.rim = clamp(this.rim + inputResponse * 0.12, 0.12, 0.48);
    this.frame.particleExcitation = spatiallyFrozen
      ? 0
      : unit(0.15 + this.envelope * 0.6 + inputResponse * 0.12);
    this.frame.inputEnvelope = inputEnvelope;
    this.frame.outputEnvelope = outputEnvelope;
    this.frame.envelope = this.envelope;
    this.frame.interruption = this.interruption;
    this.frame.reasoningCue = reasoningCue;
    this.frame.delegatedCue = delegatedCue;
    this.frame.warmth = expressionWarmth;
    this.frame.reducedMotion = reduced;
    return this.frame;
  }
}
