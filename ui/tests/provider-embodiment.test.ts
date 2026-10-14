import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderStatus, waitingLabel } from "../src/ProviderStatus";
import { INITIAL_UI_STATE, type UiState } from "../src/protocol/types";
import { providerPresentation } from "../src/provider-lifecycle";
import { reduceProtocolEvent, withConnection } from "../src/state/reducer";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const initial = (): UiState => ({
  ...INITIAL_UI_STATE,
  connection: "connected",
  sessionId: "owner",
  conversationalState: "IDLE",
  startupLifecycle: "scanning",
  providerDiscovery: { status: "scanning", requestId: "A" },
});
const event = (state: UiState, phase: string, ms = 1, extra: Record<string, unknown> = {}) =>
  reduceProtocolEvent(state, {
    protocol: 1,
    type: "provider.discovery",
    session_id: "owner",
    monotonic_ms: ms,
    payload: {
      state: phase,
      request_id: "A",
      provider: "lm-studio",
      model: "google/gemma-4-e2b",
      ...extra,
    },
  });
const load = () => event(initial(), "loading_model");
const motion = (state: UiState, reduced = false) => {
  const adapter = new VisualInputAdapter(),
    evaluator = new MotionEvaluator(42);
  const settings = {
    ...DEFAULT_VISUAL_ENGINE_SETTINGS,
    reducedMotion: reduced ? ("on" as const) : ("off" as const),
  };
  const tick = (next: UiState, time: number) => ({
    ...evaluator.evaluate(adapter.ingest(next, time), time, settings, RENDER_BUDGETS.low),
  });
  for (let t = 0; t <= 1000; t += 20) tick(state, t);
  return { tick, evaluator };
};
describe("confirmed provider lifecycle presentation and embodiment", () => {
  it("shows discovery, exact loading identity and confirmed ready without a progress estimate", () => {
    expect(providerPresentation(initial()).phase).toBe("discovering");
    const loading = load(),
      view = providerPresentation(loading);
    expect(view.phase).toBe("loading");
    expect(view.label).toContain("google/gemma-4-e2b");
    expect(view.detail).toContain("LM Studio");
    expect(loading.model).toBeUndefined();
    const markup = renderToStaticMarkup(createElement(ProviderStatus, { state: loading }));
    expect(markup).toContain("minute or more");
    expect(markup).not.toContain("progressbar");
    expect(providerPresentation(event(loading, "ready", 2)).phase).toBe("ready");
    expect(waitingLabel(83.9)).toBe("1m 23s");
  });
  it("keeps one operation identity during delayed loading and unrelated meter updates", () => {
    const loading = load(),
      next = event(loading, "loading_model", 80000);
    expect(providerPresentation(next).key).toBe(providerPresentation(loading).key);
    expect(providerPresentation({ ...next, metrics: { ...next.metrics, rms: 0.4 } }).key).toBe(
      providerPresentation(loading).key,
    );
    const { tick } = motion(loading);
    const later = tick(next, 1020);
    expect(later.providerLoading).toBeGreaterThan(0.9);
    expect(later.reasoningCue).toBe(0);
    expect(later.outputEnvelope).toBe(0);
  });
  it("reports unloading until core confirmation, then the explicit unloaded choice", () => {
    const ready = event(load(), "ready", 2),
      unloading = event(ready, "unloading_model", 3);
    expect(providerPresentation(unloading).phase).toBe("unloading");
    expect(unloading.model).toBe("google/gemma-4-e2b");
    const unloaded = event(unloading, "unloaded", 4, { reason: "Provider confirmed operation" });
    expect(unloaded.model).toBeUndefined();
    expect(providerPresentation(unloaded).label).toBe("Model unloaded");
  });
  it("retains a confirmed old route on failed replacement and ignores stale success", () => {
    const ready = event(load(), "ready", 2);
    const requested = {
      ...ready,
      providerDiscovery: { status: "scanning" as const, requestId: "B" },
    };
    const replacing = event(requested, "loading_model", 3, {
      request_id: "B",
      model: "replacement",
    });
    expect(providerPresentation(replacing).phase).toBe("switching");
    const stale = event(replacing, "ready", 4);
    expect(stale).toBe(replacing);
    expect(providerPresentation(stale).label).toContain("replacement");
    const failed = event(replacing, "failed", 5, { request_id: "B", preserve_current: true });
    expect(providerPresentation(failed).phase).toBe("failed");
    expect(providerPresentation(failed).detail).toContain("confirmed model remains");
    const current = event(failed, "ready", 6, { request_id: "B", model: "replacement" });
    expect(current.model).toBe("replacement");
    expect(providerPresentation(current).phase).toBe("ready");
  });
  it("retires visual work on disconnect and shutdown rather than showing last-known readiness", () => {
    const loading = load(),
      { tick } = motion(loading);
    const offline = withConnection(loading, "offline");
    expect(providerPresentation(offline).phase).toBe("connecting");
    expect(tick(offline, 1020).providerLoading).toBe(0);
    const awaitingSnapshot = withConnection(
      withConnection(event(loading, "ready", 2), "offline"),
      "connected",
    );
    expect(providerPresentation(awaitingSnapshot).phase).toBe("connecting");
    expect(new VisualInputAdapter().ingest(awaitingSnapshot, 0).interaction.availability).toBe(
      "reconnecting",
    );

    const reconnected = reduceProtocolEvent(withConnection(offline, "connected"), {
      protocol: 1,
      type: "system.ready",
      session_id: "new-owner",
      monotonic_ms: 3,
      payload: {
        state: "IDLE",
        provider_scan_active: true,
        provider_discovery_state: "loading_model",
        pending_provider: "lm-studio",
        pending_model: "gemma",
        pending_provider_request_id: "B",
      },
    });
    expect(providerPresentation(reconnected).phase).toBe("loading");
    expect(providerPresentation(reconnected).label).toContain("gemma");
    expect(tick(reconnected, 1030).providerReady).toBe(0);

    const stopped = { ...loading, applicationStopped: true };
    expect(providerPresentation(stopped).phase).toBe("stopped");
    const final = tick(stopped, 1040);
    expect(final.providerLoading).toBe(0);
    expect(final.providerReady).toBe(0);
  });
  it("uses a brief ready transition once and no replay on the same confirmed route", () => {
    const loading = load(),
      { tick } = motion(loading),
      ready = event(loading, "ready", 2);
    expect(tick(ready, 1020).providerReady).toBe(1);
    let final = tick(ready, 1040);
    for (let t = 1060; t <= 6020; t += 20) final = tick(ready, t);
    expect(final.providerReady).toBeLessThan(0.001);
    expect(
      tick({ ...ready, metrics: { ...ready.metrics, rms: 0.5 } }, 6040).providerReady,
    ).toBeLessThan(0.001);
    expect(tick({ ...ready, sessionId: "new-owner" }, 6060).providerReady).toBe(0);
  });
  it("keeps Reduced Motion clocks fixed, transitions posture, and omits the ready pulse", () => {
    const loading = load(),
      { tick, evaluator } = motion(loading, true);
    const phase = evaluator.currentFrame.ripplePhase;
    const unloading = event(loading, "unloading_model", 2);
    let final = tick(unloading, 1020);
    for (let t = 1040; t <= 2020; t += 20) final = tick(unloading, t);
    expect(final.radius).toBeCloseTo(0.985, 4);
    expect(final.ripplePhase).toBe(phase);
    expect(tick(event(unloading, "ready", 3), 2040).providerReady).toBe(0);
  });
});
