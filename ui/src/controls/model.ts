import {
  type CommandRuntime,
  createControlCommand,
  EMERGENCY_STOP_TARGETS,
} from "../protocol/commands";
import type { ControlCommand, UiState } from "../protocol/types";

export interface VisualPreferences {
  transcriptVisible: boolean;
  reducedMotion: boolean;
  brightness: number;
}

export const DEFAULT_VISUAL_PREFERENCES: VisualPreferences = {
  transcriptVisible: true,
  reducedMotion: false,
  brightness: 82,
};

export type ControlAction =
  | { type: "microphone.set"; enabled: boolean }
  | { type: "tts_output.set"; enabled: boolean }
  | { type: "stop_speaking" }
  | { type: "emergency_stop" }
  | { type: "application.quit" }
  | { type: "user_message.submit"; text: string }
  | { type: "tool.approve"; toolCallId: string }
  | { type: "tool.deny"; toolCallId: string }
  | { type: "capabilities.revoke_all" }
  | { type: "transcript.set"; visible: boolean }
  | { type: "reduced_motion.set"; enabled: boolean }
  | { type: "brightness.set"; value: number };

export function commandForAction(
  action: ControlAction,
  state: UiState,
  runtime?: CommandRuntime,
): ControlCommand | null {
  if (action.type === "microphone.set") {
    return createControlCommand(
      "control.microphone.set",
      { enabled: action.enabled },
      state,
      runtime,
    );
  }
  if (action.type === "tts_output.set") {
    return createControlCommand(
      "control.tts_output.set",
      { enabled: action.enabled },
      state,
      runtime,
    );
  }
  if (action.type === "stop_speaking") {
    return createControlCommand("control.stop_speaking", {}, state, runtime);
  }
  if (action.type === "application.quit") {
    return createControlCommand("control.application.quit", {}, state, runtime);
  }
  if (action.type === "emergency_stop") {
    return createControlCommand(
      "control.emergency_stop",
      { targets: EMERGENCY_STOP_TARGETS },
      state,
      runtime,
    );
  }
  if (action.type === "user_message.submit") {
    return createControlCommand(
      "control.user_message.submit",
      { text: action.text },
      state,
      runtime,
    );
  }
  if (action.type === "tool.approve" || action.type === "tool.deny") {
    return createControlCommand(
      action.type === "tool.approve" ? "control.tool.approve" : "control.tool.deny",
      {},
      state,
      runtime,
      action.toolCallId,
    );
  }
  if (action.type === "capabilities.revoke_all") {
    return createControlCommand("control.capabilities.revoke_all", {}, state, runtime);
  }
  return null;
}

export function applyLocalPreference(
  preferences: VisualPreferences,
  action: ControlAction,
): VisualPreferences {
  if (action.type === "transcript.set") {
    return { ...preferences, transcriptVisible: action.visible };
  }
  if (action.type === "reduced_motion.set") {
    return { ...preferences, reducedMotion: action.enabled };
  }
  if (action.type === "brightness.set") {
    return { ...preferences, brightness: Math.min(100, Math.max(25, action.value)) };
  }
  return preferences;
}
