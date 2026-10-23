/** Private authenticated snapshot projection; no persistence or session authority in React. */
import type { ConversationState, ProtocolEvent, TranscriptEntry, UiState } from "../protocol/types";

const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
const id = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128 && value.trim() === value;

// Python bounds Unicode code points; JS string.length counts UTF-16 units.
const characterCount = (value: string): number => {
  let count = 0;
  const points = value[Symbol.iterator]();
  while (!points.next().done) count++;
  return count;
};

export function conversationSnapshot(event: ProtocolEvent):
  | {
      conversation: ConversationState;
      transcript: readonly TranscriptEntry[];
      provisionalTranscript: UiState["provisionalTranscript"];
    }
  | undefined {
  const data = object(event.payload.conversation);
  if (
    !data ||
    !id(event.session_id) ||
    !id(data.runtime_id) ||
    data.session_id !== event.session_id ||
    !Number.isSafeInteger(data.revision) ||
    typeof data.revision !== "number" ||
    data.revision < 0 ||
    (data.launch_policy !== "resume" && data.launch_policy !== "new") ||
    !Array.isArray(data.history) ||
    data.history.length > 50 ||
    !Array.isArray(data.retained) ||
    data.retained.length > 32 ||
    !Array.isArray(data.incomplete_turns) ||
    data.incomplete_turns.length > 50
  )
    return;
  const transcript: TranscriptEntry[] = [];
  const seen = new Set<string>();
  let budget = 48_000;
  for (const raw of data.history) {
    const item = object(raw);
    if (
      !item ||
      !id(item.turn_id) ||
      (item.role !== "user" && item.role !== "assistant") ||
      typeof item.text !== "string" ||
      characterCount(item.text) > 16_384
    )
      return;
    budget -= characterCount(item.text);
    const identity = `${event.session_id}:${item.turn_id}:${item.role}`;
    if (budget < 0 || seen.has(identity)) return;
    seen.add(identity);
    transcript.push({
      id: identity,
      turnId: item.turn_id,
      role: item.role,
      text: item.text,
      monotonicMs: event.monotonic_ms,
      interrupted: false,
      recovered: true,
      truncated: item.truncated === true,
    });
  }
  const retained: { id: string; messageCount: number }[] = [];
  const retainedIds = new Set<string>();
  for (const raw of data.retained) {
    const item = object(raw);
    if (
      !item ||
      !id(item.session_id) ||
      retainedIds.has(item.session_id) ||
      typeof item.message_count !== "number" ||
      !Number.isSafeInteger(item.message_count) ||
      item.message_count < 0
    )
      return;
    retainedIds.add(item.session_id);
    retained.push({ id: item.session_id, messageCount: item.message_count });
  }
  if (!data.incomplete_turns.every(id)) return;
  let provisionalTranscript: UiState["provisionalTranscript"] = null;
  const draft = object(data.draft);
  if (
    draft &&
    id(draft.turn_id) &&
    id(draft.generation_id) &&
    typeof draft.text === "string" &&
    characterCount(draft.text) <= 16_384 &&
    draft.text
  ) {
    const partial = {
      role: "assistant" as const,
      turnId: draft.turn_id,
      generationId: draft.generation_id,
      text: draft.text,
      monotonicMs: event.monotonic_ms,
    };
    if (draft.complete === true || draft.interrupted === true)
      transcript.push({
        ...partial,
        id: `${event.session_id}:${draft.turn_id}:draft`,
        interrupted: draft.interrupted === true,
      });
    else provisionalTranscript = partial;
  }
  return {
    conversation: {
      runtimeId: data.runtime_id,
      revision: data.revision,
      persistent: data.persistent === true,
      launchPolicy: data.launch_policy,
      retained,
      incompleteTurns: data.incomplete_turns.length,
      historyLimited: data.history_limited === true,
    },
    transcript,
    provisionalTranscript,
  };
}

export function acceptsConversationChange(state: UiState, event: ProtocolEvent): boolean {
  const snapshot = conversationSnapshot(event);
  return Boolean(
    snapshot &&
      state.conversation &&
      snapshot.conversation.runtimeId === state.conversation.runtimeId &&
      snapshot.conversation.revision > state.conversation.revision &&
      event.payload.previous_session_id === state.sessionId,
  );
}

export function conversationBlockReason(state: UiState): string | undefined {
  if (state.connection !== "connected") return "Reconnect before changing conversations.";
  if (!state.conversation?.persistent) return "Retained conversations require operational storage.";
  if (
    state.pendingCommandIds.length ||
    state.pendingUserMessageId ||
    state.generationId ||
    state.playbackGenerationId ||
    state.pendingShutdownId ||
    state.applicationStopped ||
    state.pendingToolApproval ||
    state.conversationalState === "THINKING" ||
    state.conversationalState === "SPEAKING"
  )
    return "Finish or stop current work before switching.";
  if (state.microphoneEnabled && state.voiceInput?.mode !== "push_to_talk")
    return "Mute ordinary microphone input before switching.";
  if (
    state.voiceInput &&
    ["starting", "capturing", "finalizing", "unavailable"].includes(state.voiceInput.state)
  )
    return "Wait for input and capture cleanup to finish.";
  return;
}
