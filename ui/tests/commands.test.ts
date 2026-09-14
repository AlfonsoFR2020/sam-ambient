import { describe, expect, it } from "vitest";
import {
  applyLocalPreference,
  commandForAction,
  DEFAULT_VISUAL_PREFERENCES,
} from "../src/controls/model";
import {
  createControlCommand,
  decodeControlCommand,
  EMERGENCY_STOP_TARGETS,
  serializeControlCommand,
} from "../src/protocol/commands";
import { INITIAL_UI_STATE } from "../src/protocol/types";
import { DEFAULT_VISUAL_ENGINE_SETTINGS } from "../src/visual-engine/types";

const runtime = { nowMs: () => 123, nextId: () => "command-1" };

describe("control command protocol", () => {
  it("serializes quit as a direct session-bound control with no tool authority", () => {
    const command = commandForAction(
      { type: "application.quit" },
      { ...INITIAL_UI_STATE, sessionId: "current" },
      runtime,
    );
    expect(command).toMatchObject({
      type: "control.application.quit",
      session_id: "current",
      payload: {},
    });
    expect(command?.tool_call_id).toBeUndefined();
    if (!command) throw new Error("Quit must produce a control command");
    expect(decodeControlCommand(JSON.parse(serializeControlCommand(command)))).toEqual(command);
  });
  it("serializes correlation and version fields deterministically", () => {
    const command = createControlCommand(
      "control.microphone.set",
      { enabled: false },
      { sessionId: "session", turnId: "turn", generationId: "generation" },
      runtime,
    );
    expect(decodeControlCommand(JSON.parse(serializeControlCommand(command)))).toEqual(command);
    expect(command).toMatchObject({
      protocol: 1,
      command_id: "command-1",
      monotonic_ms: 123,
      session_id: "session",
      payload: { enabled: false },
    });
  });

  it("rejects protocol mismatches", () => {
    expect(() =>
      decodeControlCommand({
        protocol: 2,
        type: "control.emergency_stop",
        command_id: "bad",
        monotonic_ms: 0,
        payload: {},
      }),
    ).toThrow("unsupported control protocol");
  });

  it("encodes emergency cancellation targets and authoritative toggles", () => {
    const emergency = commandForAction(
      { type: "emergency_stop" },
      { ...INITIAL_UI_STATE, connection: "connected" },
      runtime,
    );
    const microphone = commandForAction(
      { type: "microphone.set", enabled: false },
      INITIAL_UI_STATE,
      runtime,
    );
    const ttsOutput = commandForAction(
      { type: "tts_output.set", enabled: false },
      INITIAL_UI_STATE,
      runtime,
    );
    expect(emergency?.payload.targets).toEqual(EMERGENCY_STOP_TARGETS);
    expect(microphone?.type).toBe("control.microphone.set");
    expect(ttsOutput).toMatchObject({
      type: "control.tts_output.set",
      payload: { enabled: false },
    });
  });

  it("keeps visual preferences local instead of creating core commands", () => {
    const action = { type: "transcript.set", visible: false } as const;
    expect(commandForAction(action, INITIAL_UI_STATE, runtime)).toBeNull();
    expect(applyLocalPreference(DEFAULT_VISUAL_PREFERENCES, action).transcriptVisible).toBe(false);
    expect(
      commandForAction({ type: "reduced_motion.set", enabled: true }, INITIAL_UI_STATE, runtime),
    ).toBeNull();
  });

  it("serializes typed persistent visual settings through the owner control", () => {
    const command = commandForAction(
      {
        type: "visual_settings.set",
        settings: {
          ...DEFAULT_VISUAL_ENGINE_SETTINGS,
          quality: "high",
          deviceProfile: "mobile_2020",
          particleDensity: 0.25,
        },
      },
      INITIAL_UI_STATE,
      runtime,
    );
    expect(command).toMatchObject({
      type: "control.visual_settings.set",
      payload: {
        quality: "high",
        device_profile: "mobile_2020",
        particle_density: 0.25,
      },
    });
  });

  it("serializes application audio gains through one owner control", () => {
    expect(
      commandForAction(
        { type: "audio_settings.set", inputGain: 0.7, outputGain: 1.2 },
        INITIAL_UI_STATE,
        runtime,
      ),
    ).toMatchObject({
      type: "control.audio_settings.set",
      payload: { input_gain: 0.7, output_gain: 1.2 },
    });
  });

  it("serializes ownership-aware exit preferences through one owner control", () => {
    expect(
      commandForAction(
        {
          type: "lifecycle_settings.set",
          modelOnExit: "unload_if_sam_loaded",
          providerOnExit: "stop_if_sam_started",
        },
        INITIAL_UI_STATE,
        runtime,
      ),
    ).toMatchObject({
      type: "control.lifecycle_settings.set",
      payload: {
        model_on_exit: "unload_if_sam_loaded",
        provider_on_exit: "stop_if_sam_started",
      },
    });
  });

  it("serializes text requests and correlated tool approval decisions", () => {
    const request = commandForAction(
      { type: "user_message.submit", text: "List the project files" },
      { ...INITIAL_UI_STATE, sessionId: "session", turnId: "turn" },
      runtime,
    );
    const approval = commandForAction(
      { type: "tool.approve", toolCallId: "tool-call-1" },
      { ...INITIAL_UI_STATE, sessionId: "session", generationId: "generation" },
      runtime,
    );
    const denial = commandForAction(
      { type: "tool.deny", toolCallId: "tool-call-2" },
      INITIAL_UI_STATE,
      runtime,
    );

    expect(request).toMatchObject({
      type: "control.user_message.submit",
      payload: { text: "List the project files" },
    });
    expect(approval).toMatchObject({
      type: "control.tool.approve",
      tool_call_id: "tool-call-1",
      generation_id: "generation",
    });
    expect(denial).toMatchObject({
      type: "control.tool.deny",
      tool_call_id: "tool-call-2",
    });
    if (!approval) throw new Error("expected approval command");
    expect(decodeControlCommand(JSON.parse(serializeControlCommand(approval)))).toEqual(approval);
  });

  it("serializes owner-only provider and restart controls", () => {
    const state = { ...INITIAL_UI_STATE, sessionId: "session" };
    expect(commandForAction({ type: "providers.rescan" }, state, runtime)?.type).toBe(
      "control.providers.rescan",
    );
    expect(
      commandForAction(
        { type: "model.select", provider: "lm-studio", model: "gemma", remember: true },
        state,
        runtime,
      ),
    ).toMatchObject({
      type: "control.model.select",
      payload: { provider: "lm-studio", model: "gemma", remember: true },
    });
    expect(commandForAction({ type: "application.restart" }, state, runtime)?.type).toBe(
      "control.application.restart",
    );
  });

  it("rejects a blank tool correlation id", () => {
    expect(() =>
      decodeControlCommand({
        protocol: 1,
        type: "control.tool.approve",
        command_id: "approval",
        monotonic_ms: 1,
        payload: {},
        tool_call_id: " ",
      }),
    ).toThrow("tool_call_id must be a non-blank string");
  });

  it("encodes the trusted global capability kill switch without model-selected targets", () => {
    expect(
      commandForAction({ type: "capabilities.revoke_all" }, INITIAL_UI_STATE, runtime),
    ).toEqual({
      protocol: 1,
      type: "control.capabilities.revoke_all",
      command_id: "command-1",
      monotonic_ms: 123,
      payload: {},
    });
  });
});
