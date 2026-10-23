import { createControlCommand } from "../protocol/commands";
import type { ControlCommand, UiState, VoiceInputStatus } from "../protocol/types";

const phases = new Set([
  "disabled",
  "ordinary",
  "armed",
  "starting",
  "capturing",
  "finalizing",
  "submitted",
  "cancelled",
  "failed",
  "unavailable",
]);

export function voiceInputProjection(
  value: unknown,
  prior?: VoiceInputStatus,
): VoiceInputStatus | undefined {
  if (!value || typeof value !== "object") return prior;
  const data = value as Record<string, unknown>;
  if (
    (data.mode !== "ordinary" && data.mode !== "push_to_talk") ||
    typeof data.state !== "string" ||
    !phases.has(data.state) ||
    typeof data.sequence !== "number" ||
    !Number.isSafeInteger(data.sequence) ||
    data.sequence < 0 ||
    (prior && data.sequence < prior.sequence)
  )
    return prior;
  const gestureId =
    typeof data.gesture_id === "string" &&
    /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/.test(data.gesture_id)
      ? data.gesture_id
      : undefined;
  if (["starting", "capturing", "finalizing"].includes(data.state) && !gestureId) return prior;
  return {
    mode: data.mode,
    state: data.state as VoiceInputStatus["state"],
    sequence: data.sequence,
    gestureId,
    reason: typeof data.reason === "string" ? data.reason.slice(0, 120) : undefined,
  };
}

export function pttLabel(state: UiState): string {
  if (state.connection !== "connected" || !state.voiceInput)
    return "PTT unavailable · reconnect to Sam";
  if (!state.microphoneEnabled) return "Microphone muted · PTT cannot capture";
  const phase = state.voiceInput.state;
  if (phase === "starting") return "PTT starting · capture not yet confirmed";
  if (phase === "capturing") return "PTT capturing · release F8 to finish · Escape cancels";
  if (phase === "finalizing") return "PTT finalizing recognition · Escape cancels";
  if (phase === "failed") return "PTT failed · text remains available; retry deliberately";
  if (phase === "unavailable") return "PTT unavailable · text remains available";
  if (
    state.pendingUserMessageId ||
    state.generationId ||
    state.playbackGenerationId ||
    state.pendingShutdownId ||
    state.applicationStopped
  )
    return "PTT waiting · finish or stop the current response first";
  return phase === "cancelled"
    ? "PTT cancelled · hold F8 for a new input"
    : "PTT armed · hold F8 outside fields; release to finish";
}

export function blocksPttTarget(target: EventTarget | null): boolean {
  // Structural access keeps keyboard tests independent of DOM globals.
  const element = target as (EventTarget & { closest?: (selector: string) => unknown }) | null;
  return Boolean(
    element?.closest?.(
      "input, textarea, select, button, a, [contenteditable]:not([contenteditable=false]), [role=textbox], [role=combobox], [role=slider], [role=spinbutton], [role=button], [role=dialog]",
    ),
  );
}

interface KeyInput {
  key: string;
  code?: string;
  repeat?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}
interface HeldKey {
  id: string;
  session: string;
  sent: Promise<void>;
  cancelled?: boolean;
  startCommandId?: string;
  sawStartPending?: boolean;
}

/** Local key lifetime only. Core state and ACKs cannot acquire a keyboard hold. */
export class PushToTalkKeyboard {
  private held?: HeldKey;
  private pending?: HeldKey;
  private lastCancelled?: string;
  constructor(
    private readonly snapshot: () => UiState,
    private readonly send: (command: ControlCommand) => Promise<void>,
    private readonly nextId: () => string = () => crypto.randomUUID(),
  ) {}

  private request(action: "start" | "finish" | "cancel", held: HeldKey): Promise<void> {
    const command = createControlCommand(
      "control.push_to_talk",
      { action, gesture_id: held.id },
      { sessionId: held.session },
    );
    if (action === "start") held.startCommandId = command.command_id;
    return this.send(command);
  }
  keyDown(input: KeyInput, allowed: boolean): boolean {
    if (input.key === "Escape") {
      this.cancel();
      return false;
    }
    if (input.key !== "F8" && input.code !== "F8") return false;
    if (this.held) {
      if (!allowed || input.isComposing) {
        this.cancel();
        return false;
      }
      return true;
    }
    if (this.pending) return false;
    const state = this.snapshot();
    if (
      !allowed ||
      input.repeat ||
      input.isComposing ||
      input.ctrlKey ||
      input.altKey ||
      input.shiftKey ||
      input.metaKey ||
      state.connection !== "connected" ||
      !state.sessionId ||
      !state.microphoneEnabled ||
      state.voiceInput?.mode !== "push_to_talk" ||
      !["armed", "cancelled", "failed", "submitted"].includes(state.voiceInput.state) ||
      state.generationId ||
      state.playbackGenerationId ||
      state.pendingUserMessageId ||
      state.pendingShutdownId ||
      state.applicationStopped
    )
      return false;
    const held: HeldKey = { id: this.nextId(), session: state.sessionId, sent: Promise.resolve() };
    this.held = held;
    held.sent = this.request("start", held);
    void held.sent.catch(() => {
      if (this.held === held || this.pending === held) {
        this.cancel();
        this.held = this.pending = undefined;
      }
    });
    return true;
  }
  keyUp(input: KeyInput, allowed: boolean): boolean {
    if ((input.key !== "F8" && input.code !== "F8") || !this.held) return false;
    const held = this.held;
    this.held = undefined;
    this.pending = held;
    const state = this.snapshot();
    const confirmed =
      allowed &&
      !input.isComposing &&
      state.connection === "connected" &&
      state.sessionId === held.session &&
      state.microphoneEnabled &&
      state.voiceInput?.mode === "push_to_talk" &&
      state.voiceInput.gestureId === held.id &&
      state.voiceInput.state === "capturing";
    this.end(held, confirmed ? "finish" : "cancel");
    return true;
  }
  private end(held: HeldKey, action: "finish" | "cancel"): void {
    if (action === "cancel") {
      const identity = `${held.session}:${held.id}`;
      if (this.lastCancelled === identity) return;
      this.lastCancelled = identity;
      held.cancelled = true; // Revoke a queued finish before transport acceptance.
    }
    // Serialize behind start transport acceptance. A failed start gets one
    // best-effort cancel; core retirement/lease remains the backstop.
    void held.sent
      .catch(() => {})
      .then(() => {
        const state = this.snapshot();
        if (
          state.connection !== "connected" ||
          state.sessionId !== held.session ||
          (action === "finish" && held.cancelled)
        )
          return;
        return this.request(action, held);
      })
      .catch(() => {});
  }
  cancel(): void {
    const held = this.held ?? this.pending;
    this.held = undefined;
    if (held) {
      this.pending = held;
      this.end(held, "cancel");
    } else {
      const state = this.snapshot();
      // Release already happened; unfinished final recognition is still cancelable.
      if (
        state.connection === "connected" &&
        state.sessionId &&
        state.voiceInput?.state === "finalizing" &&
        state.voiceInput.gestureId
      )
        this.end(
          { id: state.voiceInput.gestureId, session: state.sessionId, sent: Promise.resolve() },
          "cancel",
        );
    }
  }
  update(): void {
    const state = this.snapshot();
    const held = this.held ?? this.pending;
    if (!held) return;
    if (held.startCommandId && state.pendingCommandIds.includes(held.startCommandId))
      held.sawStartPending = true;
    if (
      state.connection !== "connected" ||
      state.sessionId !== held.session ||
      !state.microphoneEnabled ||
      state.voiceInput?.mode !== "push_to_talk" ||
      state.voiceInput.state === "unavailable" ||
      state.voiceInput.state === "disabled" ||
      state.pendingShutdownId ||
      state.applicationStopped
    ) {
      this.cancel();
      this.held = this.pending = undefined;
    } else if (
      state.voiceInput?.gestureId === held.id &&
      ["cancelled", "failed", "submitted", "armed"].includes(state.voiceInput.state)
    )
      this.held = this.pending = undefined;
    else if (
      held.sawStartPending &&
      held.startCommandId &&
      !state.pendingCommandIds.includes(held.startCommandId) &&
      state.protocolError &&
      state.voiceInput?.gestureId !== held.id
    ) {
      // Reject/timeout retires this exact admission; an old ACK cannot clear a new hold.
      this.cancel();
      this.held = this.pending = undefined;
    }
  }
}

/** Actual event wiring, exercised with in-memory EventTargets in Node. */
export function bindPushToTalk(
  keyboard: PushToTalkKeyboard,
  window: EventTarget,
  document: EventTarget & { hidden: boolean; hasFocus(): boolean },
  blocked: () => boolean,
): () => void {
  const allowed = (event: Event) =>
    !document.hidden && document.hasFocus() && !blocked() && !blocksPttTarget(event.target);
  const down = (event: Event) => {
    if (keyboard.keyDown(event as unknown as KeyInput, allowed(event))) event.preventDefault();
  };
  const up = (event: Event) => {
    if (keyboard.keyUp(event as unknown as KeyInput, allowed(event))) event.preventDefault();
  };
  const cancel = () => keyboard.cancel();
  const visibility = () => {
    if (document.hidden) cancel();
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", cancel);
  window.addEventListener("pagehide", cancel);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("compositionstart", cancel);
  document.addEventListener("focusin", cancel);
  return () => {
    cancel();
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", cancel);
    window.removeEventListener("pagehide", cancel);
    document.removeEventListener("visibilitychange", visibility);
    document.removeEventListener("compositionstart", cancel);
    document.removeEventListener("focusin", cancel);
  };
}
