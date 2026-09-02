import {
  type ConnectionState,
  INITIAL_UI_STATE,
  isConversationalState,
  type ProtocolEvent,
  type TranscriptEntry,
  type UiState,
} from "../protocol/types";

const clamp = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

const transcriptRole = (value: unknown): TranscriptEntry["role"] =>
  value === "assistant" ? "assistant" : "user";

const transcriptText = (event: ProtocolEvent): string | null => {
  const text = event.payload.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

const isStaleGeneration = (state: UiState, event: ProtocolEvent): boolean =>
  Boolean(
    state.generationId &&
      event.generation_id &&
      event.generation_id !== state.generationId &&
      (event.type.startsWith("model.") || event.type.startsWith("tts.")),
  );

export function withConnection(state: UiState, connection: ConnectionState): UiState {
  if (
    connection === state.connection &&
    !(connection === "offline" && state.conversationalState !== "OFFLINE")
  ) {
    return state;
  }
  if (connection === "offline") {
    return {
      ...state,
      connection,
      priorConversationalState:
        state.conversationalState === "OFFLINE"
          ? state.priorConversationalState
          : state.conversationalState,
      conversationalState: "OFFLINE",
      metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 },
      pendingCommandIds: [],
    };
  }
  return { ...state, connection };
}

export function reduceProtocolEvent(state: UiState, event: ProtocolEvent): UiState {
  const startsNewSession = Boolean(
    event.type === "system.ready" &&
      event.session_id &&
      state.sessionId &&
      event.session_id !== state.sessionId,
  );
  const previousMs = state.lastMonotonicByType[event.type];
  if (!startsNewSession && previousMs !== undefined && event.monotonic_ms <= previousMs)
    return state;
  if (
    !startsNewSession &&
    state.sessionId &&
    event.session_id &&
    event.session_id !== state.sessionId
  ) {
    return state;
  }
  if (isStaleGeneration(state, event)) return state;

  let next: UiState = {
    ...state,
    sessionId: event.session_id ?? state.sessionId,
    turnId: event.turn_id ?? state.turnId,
    generationId: event.generation_id ?? state.generationId,
    lastMonotonicByType: {
      ...state.lastMonotonicByType,
      [event.type]: event.monotonic_ms,
    },
  };

  if (event.type === "system.ready") {
    const readyState = isConversationalState(event.payload.state) ? event.payload.state : "IDLE";
    return {
      ...next,
      connection: "connected",
      conversationalState: readyState,
      microphoneEnabled:
        typeof event.payload.microphone_enabled === "boolean"
          ? event.payload.microphone_enabled
          : next.microphoneEnabled,
      ttsOutputEnabled:
        typeof event.payload.tts_output_enabled === "boolean"
          ? event.payload.tts_output_enabled
          : next.ttsOutputEnabled,
      ...(startsNewSession
        ? {
            sessionId: event.session_id,
            turnId: undefined,
            generationId: undefined,
            provisionalTranscript: null,
            lastMonotonicByType: { [event.type]: event.monotonic_ms },
            metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 },
          }
        : {}),
    };
  }
  if (event.type === "voice.state_changed" && isConversationalState(event.payload.to)) {
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: event.payload.to,
    };
  } else if (event.type === "voice.level") {
    next = {
      ...next,
      metrics: {
        ...next.metrics,
        rms: clamp(event.payload.rms),
        peak: clamp(event.payload.peak),
        speechProbability: clamp(event.payload.speech_probability),
      },
    };
  } else if (event.type === "tts.level") {
    next = {
      ...next,
      metrics: { ...next.metrics, playbackEnvelope: clamp(event.payload.envelope) },
    };
  } else if (event.type === "transcript.partial") {
    const text = transcriptText(event);
    if (text) {
      next = {
        ...next,
        provisionalTranscript: {
          role: transcriptRole(event.payload.role),
          text,
          monotonicMs: event.monotonic_ms,
        },
      };
    }
  } else if (event.type === "transcript.final") {
    const text = transcriptText(event);
    if (text) {
      const role = transcriptRole(event.payload.role);
      const entry: TranscriptEntry = {
        id: `${event.session_id ?? "session"}:${event.monotonic_ms}:${role}`,
        role,
        text,
        interrupted: Boolean(event.payload.interrupted),
        monotonicMs: event.monotonic_ms,
      };
      next = {
        ...next,
        provisionalTranscript: null,
        transcript: [...next.transcript.slice(-11), entry],
      };
    }
  } else if (event.type === "tts.cancelled") {
    const transcript = [...next.transcript];
    const last = transcript.at(-1);
    if (last?.role === "assistant") {
      const spokenText = event.payload.spoken_text;
      if (typeof spokenText === "string" && !spokenText.trim()) transcript.pop();
      else {
        transcript[transcript.length - 1] = {
          ...last,
          text: typeof spokenText === "string" ? spokenText.trim() : last.text,
          interrupted: true,
        };
      }
    }
    next = { ...next, transcript };
  } else if (event.type === "model.delta" && typeof event.payload.text === "string") {
    const current = next.provisionalTranscript;
    next = {
      ...next,
      provisionalTranscript: {
        role: "assistant",
        text: `${current?.role === "assistant" ? current.text : ""}${event.payload.text}`,
        monotonicMs: event.monotonic_ms,
      },
    };
  } else if (event.type === "control.acknowledged" || event.type === "control.rejected") {
    const commandId = event.payload.command_id;
    next = {
      ...next,
      pendingCommandIds:
        typeof commandId === "string"
          ? next.pendingCommandIds.filter((pending) => pending !== commandId)
          : next.pendingCommandIds,
      microphoneEnabled:
        typeof event.payload.microphone_enabled === "boolean"
          ? event.payload.microphone_enabled
          : next.microphoneEnabled,
      ttsOutputEnabled:
        typeof event.payload.tts_output_enabled === "boolean"
          ? event.payload.tts_output_enabled
          : next.ttsOutputEnabled,
      protocolError:
        event.type === "control.rejected" && typeof event.payload.error === "string"
          ? event.payload.error
          : next.protocolError,
    };
  } else if (event.type === "component.error") {
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: "ERROR",
    };
  }
  return next;
}

export const resetUiState = (): UiState => ({
  ...INITIAL_UI_STATE,
  metrics: { ...INITIAL_UI_STATE.metrics },
  transcript: [],
  lastMonotonicByType: {},
});
