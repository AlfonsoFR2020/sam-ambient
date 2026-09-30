import { describe, expect, it } from "vitest";
import { AmbientReactivity } from "../src/visual-engine/ambient-reactivity";

describe("ambient visual reactivity", () => {
  it("has an exact neutral state and reuses its output without frame allocations", () => {
    const response = new AmbientReactivity();
    const state = response.current;
    for (let step = 0; step < 50; step++)
      expect(response.update(0, 0, 0, 0.7, 0.05, false, false)).toBe(state);
    expect(state).toEqual({
      outputPulse: 0,
      inputPresence: 0,
      sustained: 0,
      onset: 0,
      particleSpread: 0,
      particleDrift: 0,
      particleOpacity: 0,
    });
  });

  it("smooths sustained energy and a brief onset, then settles without a jump", () => {
    const response = new AmbientReactivity();
    let previous = 0;
    for (let step = 0; step < 20; step++) {
      const frame = response.update(0.4, 0.5, step === 0 ? 1 : 0, 0.7, 0.05, false, false);
      expect(frame.sustained).toBeGreaterThanOrEqual(previous);
      previous = frame.sustained;
    }
    expect(response.current.sustained).toBeGreaterThan(0.2);
    expect(response.current.onset).toBeLessThan(0.03);
    const active = response.current.sustained;
    const firstRelease = response.update(0, 0, 0, 0.7, 0.05, false, false).sustained;
    expect(firstRelease).toBeGreaterThan(0);
    expect(firstRelease).toBeLessThan(active);
    for (let step = 0; step < 80; step++) response.update(0, 0, 0, 0.7, 0.05, false, false);
    expect(response.current.sustained).toBeLessThan(0.001);
    expect(response.current.particleSpread).toBeLessThan(0.001);
  });

  it("bounds malformed input and clamps long frame gaps to one safe update", () => {
    const short = new AmbientReactivity();
    const stalled = new AmbientReactivity();
    short.update(10, Number.POSITIVE_INFINITY, 10, 10, 0.05, false, false);
    stalled.update(10, Number.POSITIVE_INFINITY, 10, 10, 5, false, false);
    expect(stalled.current).toEqual(short.current);
    for (let step = 0; step < 100; step++) stalled.update(10, 10, 10, 10, 0.05, false, false);
    expect(stalled.current.sustained).toBeLessThanOrEqual(1);
    expect(stalled.current.onset).toBeLessThanOrEqual(1);
    expect(stalled.current.particleSpread).toBeLessThanOrEqual(0.14);
    expect(stalled.current.particleDrift).toBeLessThanOrEqual(0.3);
    expect(stalled.current.particleOpacity).toBeLessThanOrEqual(0.26);
    stalled.update(0, 0, 0, 1, 0.05, false, true);
    expect(stalled.current.sustained).toBe(0);
    expect(stalled.current.particleOpacity).toBe(0);
  });

  it("integrates the same sustained activity across 20 and 60 FPS schedules", () => {
    const slow = new AmbientReactivity();
    const fast = new AmbientReactivity();
    for (let frame = 0; frame < 20; frame++) slow.update(0.6, 0.4, 0.3, 0.7, 0.05, false, false);
    for (let frame = 0; frame < 60; frame++) fast.update(0.6, 0.4, 0.3, 0.7, 1 / 60, false, false);
    expect(slow.current.sustained).toBeCloseTo(fast.current.sustained, 6);
    expect(slow.current.onset).toBeCloseTo(fast.current.onset, 6);
    expect(slow.current.particleSpread).toBeCloseTo(fast.current.particleSpread, 6);
    expect(Math.abs(slow.current.outputPulse - fast.current.outputPulse)).toBeLessThan(0.005);
    expect(slow.current.inputPresence).toBeCloseTo(fast.current.inputPresence, 6);
  });

  it("separates output emphasis from receptive input at ordinary speech levels", () => {
    const steady = new AmbientReactivity();
    const syllables = new AmbientReactivity();
    const listening = new AmbientReactivity();
    for (let step = 0; step < 20; step++) {
      steady.update(0, 0.12, 0, 0.7, 0.02, false, false);
      syllables.update(0, step < 14 ? 0.12 : 0.65, 0, 0.7, 0.02, false, false);
      listening.update(0.12, 0, 0.3, 0.7, 0.02, false, false);
    }
    expect(steady.current.outputPulse).toBeGreaterThan(0.2);
    expect(syllables.current.outputPulse).toBeGreaterThan(steady.current.outputPulse + 0.2);
    expect(listening.current.inputPresence).toBeGreaterThan(0.2);
    expect(listening.current.outputPulse).toBe(0);
    expect(steady.current.inputPresence).toBe(0);
  });

  it("follows syllables, returns after cancellation, and leaves zero strength neutral", () => {
    const response = new AmbientReactivity();
    const muted = new AmbientReactivity();
    const pattern = [0, 0.15, 0.35, 0.1, 0.08, 0.72, 0.18, 0];
    const pulses: number[] = [];
    for (const sample of pattern) {
      for (let frame = 0; frame < 3; frame++) {
        response.update(0, sample, 0, 0.7, 0.02, false, false);
        muted.update(0.4, sample, 0.8, 0, 0.02, false, false);
      }
      pulses.push(response.current.outputPulse);
    }
    expect(pulses[5]).toBeGreaterThan(pulses[2]);
    expect(pulses[7]).toBeLessThan(pulses[5]);
    expect(muted.current.outputPulse).toBe(0);
    expect(muted.current.inputPresence).toBe(0);
    for (let frame = 0; frame < 30; frame++) response.update(0, 0, 0, 0.7, 0.02, true, false);
    expect(response.current.outputPulse).toBeLessThan(0.01);
    expect(response.current.inputPresence).toBe(0);
  });
});
