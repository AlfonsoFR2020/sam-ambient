import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartupCard, shortcutIntent } from "../src/App";
import { QuitDialog, ShutdownStatus } from "../src/QuitDialog";
import { RuntimeStatus } from "../src/RuntimeStatus";
import { reduceProtocolEvent, resetUiState } from "../src/state/reducer";

describe("startup and shutdown presentation", () => {
  it("renders selected model, lifecycle reason and actual voice readiness", () => {
    const state = reduceProtocolEvent(resetUiState(), {
      protocol: 1,
      type: "system.ready",
      monotonic_ms: 1,
      payload: {
        sam_version: "0.1.2",
        provider: "lm-studio",
        model: "chat",
        selection_reason: "started by Sam",
        stt_status: "missing model; text remains available",
        tts_backend: "windows-system-speech",
        tts_selection: {
          voice: { voice_id: "Installed Spanish", locale: "es-ES" },
          reason: "exact locale",
        },
      },
    });
    const html = renderToStaticMarkup(createElement(RuntimeStatus, { state }));
    for (const value of [
      "lm-studio",
      "chat",
      "started by Sam",
      "missing model",
      "windows-system-speech",
      "Installed Spanish",
      "es-ES",
      "exact locale",
    ]) {
      expect(html).toContain(value);
    }
    const startup = renderToStaticMarkup(
      createElement(StartupCard, { state: { ...state, model: undefined } }),
    );
    expect(startup).toContain("0.1.2");
  });

  it("shows actionable degradation instead of a vague model placeholder", () => {
    const state = {
      ...resetUiState(),
      selectionReason: "No usable local chat model. lm-studio: startup timed out",
    };
    const html = renderToStaticMarkup(createElement(RuntimeStatus, { state }));
    expect(html).toContain("startup timed out");
    expect(html).not.toContain("No model selected");
  });

  it("shows available providers and distinguishes installed from loaded models", () => {
    const state = {
      ...resetUiState(),
      startupLifecycle: "waiting_for_model_choice" as const,
      providerCatalog: [
        {
          id: "lm-studio",
          running: true,
          models: ["loaded-chat"],
          installedModels: ["loaded-chat", "installed-chat"],
          detail: "ready",
        },
      ],
    };
    const html = renderToStaticMarkup(createElement(StartupCard, { state }));
    expect(html).toContain("Automatic / recommended");
    expect(html).toContain("loaded-chat · Loaded");
    expect(html).toContain("installed-chat · Installed");
    expect(html).toContain("Remember this choice");
    expect(html).toContain("Continue in available mode");
    expect(html).toContain("Dismiss startup information");
    expect(html).toContain("does not make a conversational model ready");
  });

  it("keeps text-entry shortcuts safe while retaining the global emergency stop", () => {
    const key = (value: string, shiftKey = false) => ({
      key: value,
      ctrlKey: true,
      shiftKey,
      metaKey: false,
    });
    expect(shortcutIntent(key("m"), false)).toBe("microphone");
    expect(shortcutIntent(key("m"), true)).toBeNull();
    expect(shortcutIntent(key("q"), false)).toBe("quit");
    expect(shortcutIntent(key("q"), true)).toBeNull();
    expect(shortcutIntent(key("x", true), true)).toBe("emergency_stop");
    expect(shortcutIntent({ ...key("Escape"), ctrlKey: false }, true)).toBe("close_surface");
  });

  it("provides native modal semantics, distinct confirmation and cancellation", () => {
    const html = renderToStaticMarkup(
      createElement(QuitDialog, { open: false, onCancel() {}, onConfirm() {} }),
    );
    expect(html).toContain("<dialog");
    expect(html).toContain("aria-labelledby");
    expect(html).toContain("Confirm quit");
    expect(html).toContain("Cancel");
  });

  it("distinguishes pending shutdown from acknowledged stopped state", () => {
    const pending = renderToStaticMarkup(createElement(ShutdownStatus, { stopped: false }));
    const stopped = renderToStaticMarkup(createElement(ShutdownStatus, { stopped: true }));
    expect(pending).toContain("acknowledgement");
    expect(pending).not.toContain("Sam has stopped");
    expect(stopped).toContain("Sam has stopped");
    expect(stopped).toContain("Reconnection is off");
  });
});
