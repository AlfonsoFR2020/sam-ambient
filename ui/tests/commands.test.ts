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

const runtime = { nowMs: () => 123, nextId: () => "command-1" };

describe("control command protocol", () => {
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
