import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { exitCleanupSummary } from "../src/controls/exit";
import type { ProtocolEvent } from "../src/protocol/types";
import { QuitDialog } from "../src/QuitDialog";
import { reduceProtocolEvent, resetUiState } from "../src/state/reducer";

const stateFor = (startedBySam: boolean, selectedModelLoadedBySam: boolean) => {
  const ready: ProtocolEvent = {
    protocol: 1,
    type: "system.ready",
    monotonic_ms: 1,
    session_id: "exit-test",
    payload: {
      state: "IDLE",
      provider: "lm-studio",
      model: "gemma",
      provider_catalog: [
        {
          id: "lm-studio",
          running: true,
          models: ["gemma"],
          started_by_sam: startedBySam,
          selected_model_loaded_by_sam: selectedModelLoadedBySam,
        },
      ],
    },
  };
  return reduceProtocolEvent(resetUiState(), ready);
};

describe("exit cleanup presentation", () => {
  const enabled = {
    modelOnExit: "unload_if_sam_loaded" as const,
    providerOnExit: "stop_if_sam_started" as const,
  };

  it("does not promise to stop a reused service or unload its preloaded model", () => {
    const state = stateFor(false, false);
    expect(exitCleanupSummary(state, { modelOnExit: "keep", providerOnExit: "keep" })).toBeNull();
    const summary = exitCleanupSummary(state, enabled);
    expect(summary).toContain("already loaded");
    expect(summary).toContain("already running");
    const html = renderToStaticMarkup(
      createElement(QuitDialog, {
        open: true,
        onCancel: () => undefined,
        onConfirm: () => undefined,
        exitSummary: summary,
      }),
    );
    expect(html).toContain("already running");
  });

  it("describes requests, not guaranteed success, for Sam-owned resources", () => {
    const summary = exitCleanupSummary(stateFor(true, true), enabled);
    expect(summary).toContain("request unload");
    expect(summary).toContain("request a stop");
  });

  it("takes effective exit settings from core acknowledgement, not a rejected choice", () => {
    const ready = stateFor(false, false);
    const pending = { ...ready, pendingCommandIds: ["exit-settings"] };
    const acknowledged = reduceProtocolEvent(pending, {
      protocol: 1,
      type: "control.acknowledged",
      monotonic_ms: 2,
      session_id: "exit-test",
      payload: {
        command_id: "exit-settings",
        command_type: "control.lifecycle_settings.set",
        lifecycle_settings: {
          model_on_exit: enabled.modelOnExit,
          provider_on_exit: enabled.providerOnExit,
        },
      },
    });
    expect(acknowledged.lifecycleSettings).toEqual(enabled);
    const rejected = reduceProtocolEvent(
      { ...acknowledged, pendingCommandIds: ["rejected-settings"] },
      {
        protocol: 1,
        type: "control.rejected",
        monotonic_ms: 3,
        session_id: "exit-test",
        payload: {
          command_id: "rejected-settings",
          command_type: "control.lifecycle_settings.set",
          error: "fixture rejection",
        },
      },
    );
    expect(rejected.lifecycleSettings).toEqual(enabled);
    expect(rejected.protocolError).toBe("fixture rejection");
  });
});
