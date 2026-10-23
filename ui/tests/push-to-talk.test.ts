import { describe, expect, it } from "vitest";
import { commandForAction } from "../src/controls/model";
import {
  bindPushToTalk,
  blocksPttTarget,
  PushToTalkKeyboard,
  pttLabel,
  voiceInputProjection,
} from "../src/controls/push-to-talk";
import { type ControlCommand, INITIAL_UI_STATE, type UiState } from "../src/protocol/types";
import { reduceProtocolEvent, withConnection } from "../src/state/reducer";

const identity = (number: number) => `00000000-0000-0000-0000-${String(number).padStart(12, "0")}`;
const press = { key: "F8", code: "F8" };
const settle = async () => {
  for (let n = 0; n < 8; n++) await Promise.resolve();
};

function setup(send?: (command: ControlCommand) => Promise<void>) {
  let state: UiState = {
    ...INITIAL_UI_STATE,
    connection: "connected",
    conversationalState: "IDLE",
    sessionId: "s1",
    voiceInput: { mode: "push_to_talk", state: "armed", sequence: 0 },
  };
  const commands: ControlCommand[] = [];
  let next = 0;
  const keyboard = new PushToTalkKeyboard(
    () => state,
    (command) => {
      commands.push(command);
      return send?.(command) ?? Promise.resolve();
    },
    () => identity(++next),
  );
  return {
    keyboard,
    commands,
    get state() {
      return state;
    },
    set: (patch: Partial<UiState>) => {
      state = { ...state, ...patch };
      keyboard.update();
    },
    captured: () => {
      state = {
        ...state,
        voiceInput: {
          mode: "push_to_talk",
          state: "capturing",
          sequence: ++next,
          gestureId: commands.at(-1)?.payload.gesture_id as string,
        },
      };
    },
  };
}

describe("deliberate keyboard PTT", () => {
  it("sends one start for a hold and exactly one confirmed finish, keeping the gesture/session", async () => {
    const c = setup();
    expect(c.keyboard.keyDown(press, true)).toBe(true);
    c.keyboard.keyDown({ ...press, repeat: true }, true);
    c.captured();
    expect(c.keyboard.keyUp(press, true)).toBe(true);
    c.keyboard.keyUp(press, true);
    await settle();
    expect(c.commands.map((x) => x.payload.action)).toEqual(["start", "finish"]);
    expect(c.commands[0].payload.gesture_id).toBe(c.commands[1].payload.gesture_id);
    expect(c.commands.map((x) => x.session_id)).toEqual(["s1", "s1"]);
  });

  it("fast release queues cancellation behind delayed transport admission, never finish", async () => {
    let resolve!: () => void;
    const gate = new Promise<void>((done) => {
      resolve = done;
    });
    const c = setup((cmd) => (cmd.payload.action === "start" ? gate : Promise.resolve()));
    c.keyboard.keyDown(press, true);
    c.keyboard.keyUp(press, true);
    await settle();
    expect(c.commands).toHaveLength(1);
    resolve();
    await settle();
    expect(c.commands.map((x) => x.payload.action)).toEqual(["start", "cancel"]);
  });

  it("a failed start retires its hold and requests only bounded cleanup", async () => {
    const c = setup((cmd) =>
      cmd.payload.action === "start" ? Promise.reject(new Error("offline")) : Promise.resolve(),
    );
    c.keyboard.keyDown(press, true);
    await settle();
    c.keyboard.keyUp(press, true);
    expect(c.commands.map((x) => x.payload.action)).toEqual(["start", "cancel"]);
  });

  it.each(["ordinary", "muted", "offline", "busy", "shutdown", "no-snapshot"])(
    "does not start in %s",
    (kind) => {
      const c = setup();
      if (kind === "ordinary")
        c.set({ voiceInput: { mode: "ordinary", state: "ordinary", sequence: 1 } });
      if (kind === "muted") c.set({ microphoneEnabled: false });
      if (kind === "offline") c.set({ connection: "offline" });
      if (kind === "busy") c.set({ generationId: "generation" });
      if (kind === "shutdown") c.set({ pendingShutdownId: "quit" });
      if (kind === "no-snapshot") c.set({ voiceInput: undefined });
      expect(c.keyboard.keyDown(press, true)).toBe(false);
      expect(c.commands).toEqual([]);
    },
  );

  it.each([
    { repeat: true },
    { isComposing: true },
    { ctrlKey: true },
    { altKey: true },
    { shiftKey: true },
    { metaKey: true },
  ])("ignores unsafe/repeated initial key %j", (flags) => {
    const c = setup();
    expect(c.keyboard.keyDown({ ...press, ...flags }, true)).toBe(false);
    expect(c.keyboard.keyDown({ key: " " }, true)).toBe(false);
    expect(c.keyboard.keyDown(press, false)).toBe(false);
    expect(c.commands).toEqual([]);
  });

  it("lost connection/session cancels local ownership and a repeat cannot resume it", async () => {
    const c = setup();
    c.keyboard.keyDown(press, true);
    c.set(withConnection(c.state, "offline"));
    c.set({
      connection: "connected",
      sessionId: "s2",
      voiceInput: { mode: "push_to_talk", state: "armed", sequence: 0 },
    });
    expect(c.keyboard.keyDown({ ...press, repeat: true }, true)).toBe(false);
    expect(c.keyboard.keyUp(press, true)).toBe(false);
    await settle();
    expect(c.commands).toHaveLength(1); // No cleanup is rebound to s2.
    c.keyboard.keyDown(press, true);
    expect(c.commands[1].session_id).toBe("s2");
  });

  it("mute or mode change discards held input and permits a later independent gesture", async () => {
    const c = setup();
    c.keyboard.keyDown(press, true);
    c.captured();
    c.set({ microphoneEnabled: false });
    c.keyboard.keyUp(press, true);
    await settle();
    expect(c.commands.at(-1)?.payload.action).toBe("cancel");
    c.set({
      microphoneEnabled: true,
      voiceInput: { mode: "push_to_talk", state: "armed", sequence: 9 },
    });
    c.keyboard.keyDown(press, true);
    expect(c.commands.at(-1)?.payload.gesture_id).not.toBe(c.commands[0].payload.gesture_id);
    c.set({ voiceInput: { mode: "ordinary", state: "ordinary", sequence: 10 } });
    await settle();
    expect(c.commands.at(-1)?.payload.action).toBe("cancel");
  });

  it("Escape can still discard pending recognition after key release", async () => {
    const c = setup();
    c.keyboard.keyDown(press, true);
    c.captured();
    const id = c.state.voiceInput?.gestureId;
    c.keyboard.keyUp(press, true);
    await settle();
    c.set({
      voiceInput: { mode: "push_to_talk", state: "finalizing", sequence: 9, gestureId: id },
    });
    c.keyboard.keyDown({ key: "Escape" }, true);
    c.keyboard.keyDown({ key: "Escape" }, true);
    await settle();
    expect(c.commands.map((x) => x.payload.action)).toEqual(["start", "finish", "cancel"]);
  });
});

class FocusDocument extends EventTarget {
  hidden = false;
  focused = true;
  hasFocus() {
    return this.focused;
  }
}
const keyEvent = (type: string, patch = {}) =>
  Object.assign(new Event(type, { cancelable: true }), press, patch);

describe("real listener wiring without a browser", () => {
  it("blur after finish transport acceptance still cancels before core finalizing", async () => {
    const c = setup(),
      host = new EventTarget(),
      doc = new FocusDocument();
    const dispose = bindPushToTalk(c.keyboard, host, doc, () => false);
    host.dispatchEvent(keyEvent("keydown"));
    c.captured();
    host.dispatchEvent(keyEvent("keyup"));
    await settle();
    expect(c.commands.map((command) => command.payload.action)).toEqual(["start", "finish"]);
    host.dispatchEvent(new Event("blur"));
    await settle();
    expect(c.commands.map((command) => command.payload.action)).toEqual([
      "start",
      "finish",
      "cancel",
    ]);
    dispose();
  });
  it("blur between release and core finalizing discards the queued finish", async () => {
    const c = setup(),
      host = new EventTarget(),
      doc = new FocusDocument();
    const dispose = bindPushToTalk(c.keyboard, host, doc, () => false);
    host.dispatchEvent(keyEvent("keydown"));
    c.captured();
    host.dispatchEvent(keyEvent("keyup"));
    host.dispatchEvent(new Event("blur"));
    await settle();
    expect(c.commands.map((command) => command.payload.action)).toEqual(["start", "cancel"]);
    dispose();
  });
  it.each(["blur", "pagehide", "hidden", "compositionstart", "focusin", "unmount"])(
    "%s discards input and keyup cannot finish it",
    async (kind) => {
      const c = setup(),
        host = new EventTarget(),
        doc = new FocusDocument();
      const dispose = bindPushToTalk(c.keyboard, host, doc, () => false);
      const down = keyEvent("keydown");
      host.dispatchEvent(down);
      c.captured();
      expect(down.defaultPrevented).toBe(true);
      if (kind === "hidden") {
        doc.hidden = true;
        doc.dispatchEvent(new Event("visibilitychange"));
      } else if (kind === "unmount") dispose();
      else (kind === "blur" || kind === "pagehide" ? host : doc).dispatchEvent(new Event(kind));
      host.dispatchEvent(keyEvent("keyup"));
      await settle();
      expect(c.commands.map((x) => x.payload.action)).toEqual(["start", "cancel"]);
      dispose();
    },
  );
  it("does not intercept unfocused/hidden/modal or ordinary keys", () => {
    const c = setup(),
      host = new EventTarget(),
      doc = new FocusDocument();
    let blocked = false;
    const dispose = bindPushToTalk(c.keyboard, host, doc, () => blocked);
    doc.focused = false;
    host.dispatchEvent(keyEvent("keydown"));
    doc.focused = true;
    doc.hidden = true;
    host.dispatchEvent(keyEvent("keydown"));
    doc.hidden = false;
    blocked = true;
    host.dispatchEvent(keyEvent("keydown"));
    blocked = false;
    const ordinary = keyEvent("keydown", { key: "a", code: "KeyA" });
    host.dispatchEvent(ordinary);
    expect(c.commands).toHaveLength(0);
    expect(ordinary.defaultPrevented).toBe(false);
    dispose();
  });
  it("checks editable and ARIA interaction ancestors rather than only direct input tags", () => {
    const target = {
      closest: (selector: string) => (selector.includes("role=textbox") ? {} : null),
    } as unknown as EventTarget;
    expect(blocksPttTarget(target)).toBe(true);
    expect(blocksPttTarget(new EventTarget())).toBe(false);
  });
});

describe("authoritative projection and status", () => {
  it("a rejected exact start retires the key without allowing repeat to restart capture", async () => {
    const c = setup();
    c.keyboard.keyDown(press, true);
    const id = c.commands[0].command_id;
    c.set({ pendingCommandIds: [id] });
    c.set({ pendingCommandIds: [], protocolError: "Capture busy" });
    expect(c.keyboard.keyUp(press, true)).toBe(false);
    expect(c.keyboard.keyDown({ ...press, repeat: true }, true)).toBe(false);
    await settle();
    expect(c.commands.map((command) => command.payload.action)).toEqual(["start", "cancel"]);
  });
  it("completed input releases pending ownership for a new distinct utterance", async () => {
    const c = setup();
    for (let sequence = 0; sequence < 2; sequence++) {
      expect(c.keyboard.keyDown(press, true)).toBe(true);
      c.captured();
      const id = c.state.voiceInput?.gestureId;
      c.keyboard.keyUp(press, true);
      await settle();
      c.set({
        voiceInput: {
          mode: "push_to_talk",
          state: "submitted",
          sequence: sequence + 20,
          gestureId: id,
        },
      });
    }
    expect(c.commands.map((command) => command.payload.action)).toEqual([
      "start",
      "finish",
      "start",
      "finish",
    ]);
    expect(c.commands[0].payload.gesture_id).not.toBe(c.commands[2].payload.gesture_id);
  });
  it("selects an authenticated typed command and never treats ACK as capture", () => {
    const c = setup();
    const cmd = commandForAction({ type: "voice_input_mode.set", mode: "push_to_talk" }, c.state, {
      nowMs: () => 1,
      nextId: () => "mode",
    });
    expect(cmd?.type).toBe("control.voice_input_mode.set");
    expect(cmd?.session_id).toBe("s1");
    const ack = reduceProtocolEvent(c.state, {
      protocol: 1,
      type: "control.acknowledged",
      session_id: "s1",
      monotonic_ms: 30,
      payload: {
        command_type: "control.push_to_talk",
        command_id: "old",
        voice_input: { state: "capturing" },
      },
    });
    expect(ack.voiceInput?.state).toBe("armed");
  });
  it("rejects stale/reordered/foreign input phases and resets a new session", () => {
    const c = setup();
    const event = (
      sequence: number,
      session = "s1",
      type = "voice.input_state",
      state = "capturing",
    ) => ({
      protocol: 1 as const,
      type,
      session_id: session,
      monotonic_ms: 20 + sequence,
      payload:
        type === "system.ready"
          ? { state: "IDLE", voice_input: { mode: "push_to_talk", state, sequence } }
          : { mode: "push_to_talk", state, sequence, gesture_id: identity(1) },
    });
    let s = reduceProtocolEvent(c.state, event(4));
    s = reduceProtocolEvent(s, { ...event(2), monotonic_ms: 50 });
    expect(s.voiceInput?.sequence).toBe(4);
    expect(reduceProtocolEvent(s, event(8, "foreign"))).toBe(s);
    s = withConnection(s, "offline");
    expect(s.voiceInput?.state).toBe("unavailable");
    s = reduceProtocolEvent(s, event(0, "s2", "system.ready", "armed"));
    expect(s.voiceInput?.sequence).toBe(0);
    expect(s.voiceInput?.state).toBe("armed");
  });
  it("rejects malformed phases and keeps readiness labels truthful", () => {
    const c = setup();
    const prior = c.state.voiceInput;
    expect(
      voiceInputProjection({ mode: "push_to_talk", state: "capturing", sequence: NaN }, prior),
    ).toBe(prior);
    expect(voiceInputProjection({ mode: "magic", state: "ready", sequence: 1 }, prior)).toBe(prior);
    c.set({ voiceInput: { mode: "push_to_talk", state: "starting", sequence: 1 } });
    expect(pttLabel(c.state)).toContain("not yet confirmed");
    c.set({ microphoneEnabled: false });
    expect(pttLabel(c.state)).toContain("muted");
    c.set({ connection: "offline" });
    expect(pttLabel(c.state)).toContain("reconnect");
  });
});
