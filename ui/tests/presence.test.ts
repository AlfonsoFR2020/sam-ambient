import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartupCard } from "../src/App";
import { AgencyConsole, consoleArguments } from "../src/agency/Console";
import { MemoryManager } from "../src/memory/Manager";
import { presencePresentation } from "../src/presence";
import { INITIAL_UI_STATE, type ProtocolEvent, type UiState } from "../src/protocol/types";
import { ProtocolClient } from "../src/state/client";
import { reduceProtocolEvent, withConnection } from "../src/state/reducer";
import { VisualInputAdapter } from "../src/visual-engine/input";
import { MotionEvaluator } from "../src/visual-engine/motion";
import { RENDER_BUDGETS } from "../src/visual-engine/quality";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const ready = (extra: Partial<UiState> = {}): UiState => ({
  ...INITIAL_UI_STATE,
  connection: "connected",
  sessionId: "owner",
  provider: "local",
  model: "chat",
  startupLifecycle: "ready_transition",
  providerDiscovery: { status: "available" },
  ...extra,
});
const event = (
  type: string,
  monotonic_ms: number,
  payload: Record<string, unknown> = {},
): ProtocolEvent => ({
  protocol: 1,
  type,
  monotonic_ms,
  payload,
  session_id: "owner",
  turn_id: "typed",
  generation_id: "response",
});

describe("authoritative responsive presence", () => {
  it("distinguishes typed sending, commitment, inference and actual response production", () => {
    let state = ready({ pendingUserMessageId: "request" });
    expect(presencePresentation(state).phase).toBe("submitting");
    state = reduceProtocolEvent(
      state,
      event("turn.committed", 1, { text: "Hello", command_id: "request" }),
    );
    expect(state.pendingUserMessageId).toBeUndefined();
    expect(presencePresentation(state).phase).toBe("submitted");
    expect(new VisualInputAdapter().ingest(state, 0).interaction.foreground).toBe("thinking");
    state = reduceProtocolEvent(state, event("voice.state_changed", 2, { to: "THINKING" }));
    expect(presencePresentation(state).phase).toBe("thinking");
    state = reduceProtocolEvent(state, event("model.delta", 3, { text: "Hello" }));
    expect(presencePresentation(state).phase).toBe("responding");
    state = reduceProtocolEvent(state, event("model.completed", 4, { text: "Hello" }));
    state = reduceProtocolEvent(state, event("tts.started", 5));
    expect(presencePresentation(state).phase).toBe("preparing_speech");
    state = reduceProtocolEvent(state, event("tts.level", 6, { envelope: 0.04 }));
    expect(presencePresentation(state).phase).toBe("speaking");
    const key = presencePresentation(state).key;
    state = reduceProtocolEvent(state, event("tts.level", 7, { envelope: 0 }));
    expect(presencePresentation(state).key).toBe(key);
  });

  it("clears rejected, failed, superseded and disconnected pending requests", () => {
    const pending = ready({ pendingUserMessageId: "request", pendingCommandIds: ["request"] });
    expect(
      presencePresentation(
        reduceProtocolEvent(
          pending,
          event("control.rejected", 1, {
            command_id: "request",
            command_type: "control.user_message.submit",
            error: "not ready",
          }),
        ),
      ).phase,
    ).not.toBe("submitting");
    expect(withConnection(pending, "offline").pendingUserMessageId).toBeUndefined();
    expect(
      reduceProtocolEvent(
        pending,
        event("component.error", 2, { command_id: "request", component: "turn" }),
      ).pendingUserMessageId,
    ).toBeUndefined();
  });

  it("keeps loading indefinite and unloaded explicit, with no invented progress or acoustic energy", () => {
    const state = ready({
      model: undefined,
      pendingModel: "chat",
      startupLifecycle: "loading_model",
      providerDiscovery: { status: "scanning" },
    });
    const evaluator = new MotionEvaluator(0x5a17),
      adapter = new VisualInputAdapter();
    let frame = evaluator.evaluate(
      adapter.ingest(state, 0),
      0,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    for (let now = 20; now <= 6000; now += 20)
      frame = evaluator.evaluate(
        adapter.ingest(state, now),
        now,
        DEFAULT_VISUAL_ENGINE_SETTINGS,
        RENDER_BUDGETS.low,
      );
    const before = frame.peelTravel;
    evaluator.evaluate(
      adapter.ingest(state, 6020),
      6020,
      DEFAULT_VISUAL_ENGINE_SETTINGS,
      RENDER_BUDGETS.low,
    );
    expect(frame.providerLoading).toBeGreaterThan(0.99);
    expect(frame.peelTravel).not.toBe(before);
    expect(frame.radius).toBeLessThan(0.96);
    expect(frame.outputEnvelope).toBe(0);
    expect(frame.reactivity.outputPulse).toBe(0);
    expect(presencePresentation(state)).toMatchObject({ phase: "loading", busy: true });
    expect(
      presencePresentation(
        ready({
          model: undefined,
          startupLifecycle: "blocked",
          providerDiscovery: { status: "available", modelUnloaded: true },
        }),
      ).phase,
    ).toBe("unloaded");
  });

  it("forms compactly and retires without expanding speech gains or changing clocks", () => {
    const evaluator = new MotionEvaluator(0x5a17),
      adapter = new VisualInputAdapter();
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, audioReactivity: 0, surfaceFlow: 0 };
    const initial = { ...INITIAL_UI_STATE };
    const start = {
      ...evaluator.evaluate(adapter.ingest(initial, 0), 0, settings, RENDER_BUDGETS.low),
    };
    for (let now = 20; now <= 1800; now += 20)
      evaluator.evaluate(adapter.ingest(initial, now), now, settings, RENDER_BUDGETS.low);
    const formed = {
      ...evaluator.evaluate(adapter.ingest(initial, 1820), 1820, settings, RENDER_BUDGETS.low),
    };
    expect(start.radius).toBeLessThan(0.55);
    expect(formed.radius).toBeGreaterThan(0.95);
    expect(formed.spin).toBe(start.spin);
    for (let now = 1840; now <= 3000; now += 20)
      evaluator.evaluate(
        adapter.ingest(ready({ applicationStopped: true }), now),
        now,
        settings,
        RENDER_BUDGETS.low,
      );
    const departed = evaluator.evaluate(adapter.snapshot(3020), 3020, settings, RENDER_BUDGETS.low);
    expect(departed.radius).toBeLessThan(0.55);
    expect(departed.fieldPhase1).toBe(start.fieldPhase1);
    expect(departed.reactivity.outputPulse).toBe(0);
  });

  it("uses settled poses with reduced motion and expires suspended audio", () => {
    const adapter = new VisualInputAdapter(),
      evaluator = new MotionEvaluator(12);
    const settings = { ...DEFAULT_VISUAL_ENGINE_SETTINGS, reducedMotion: "on" as const };
    const state = ready({ pendingShutdownId: "quit" });
    const first = {
      ...evaluator.evaluate(adapter.ingest(state, 0), 0, settings, RENDER_BUDGETS.low),
    };
    const later = evaluator.evaluate(
      adapter.ingest(state, 30000),
      30000,
      settings,
      RENDER_BUDGETS.low,
    );
    expect(later.radius).toBe(first.radius);
    expect(later.spin).toBe(first.spin);
    expect(later.fieldPhase1).toBe(first.fieldPhase1);
    expect(later.outputEnvelope).toBe(0);
  });
});

describe("quiet operational surfaces", () => {
  it("collapses ordinary startup facts but exposes genuine model choices", () => {
    const loading = ready({
      model: undefined,
      pendingModel: "chat",
      startupLifecycle: "loading_model",
      providerDiscovery: { status: "scanning" },
    });
    const markup = renderToStaticMarkup(createElement(StartupCard, { state: loading }));
    expect(markup).toContain('data-expanded="false"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain("Loading chat");
    const blocked = ready({
      model: undefined,
      startupLifecycle: "waiting_for_model_choice",
      providerCatalog: [
        { id: "local", running: true, models: [], installedModels: ["a", "b"], detail: "ready" },
      ],
    });
    expect(renderToStaticMarkup(createElement(StartupCard, { state: blocked }))).toContain(
      'data-expanded="true"',
    );
  });

  it("retains functional Console argument bounds, results, cancellation and Memory controls", () => {
    const client = new ProtocolClient(
      {
        name: "unused",
        connect: async () => {
          throw new Error("no execution");
        },
      },
      { frame: () => () => {}, delay: () => () => {} },
    );
    expect(consoleArguments("files.read", "a.txt")).toEqual({
      root: "workspace",
      path: "a.txt",
      max_bytes: 8192,
      max_lines: 200,
    });
    expect(consoleArguments("files.list", ".")).toEqual({
      root: "workspace",
      path: ".",
      max_entries: 100,
      depth: 0,
    });
    expect(consoleArguments("browser.navigate", "https://example.test/")).toEqual({
      url: "https://example.test/",
    });
    expect(consoleArguments("system.info", "ignored")).toEqual({});
    const consoleMarkup = renderToStaticMarkup(
      createElement(AgencyConsole, { client, connected: true, open: true }),
    );
    expect(consoleMarkup).toContain("Run action");
    expect(consoleMarkup).toContain("Console results");
    expect(consoleMarkup).toContain("aria-controls");
    expect(
      renderToStaticMarkup(createElement(MemoryManager, { client, connected: true, open: true })),
    ).toContain("Sam Memory");
  });
});
