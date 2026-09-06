import {
  type ConnectionState,
  INITIAL_UI_STATE,
  isConversationalState,
  type ProtocolEvent,
  TOOL_EVENT_TYPES,
  type ToolActivity,
  type ToolApprovalRequest,
  type ToolEventType,
  type TranscriptEntry,
  type UiState,
  type UpdateActivity,
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
      (event.type.startsWith("model.") ||
        event.type.startsWith("tts.") ||
        event.type.startsWith("tool.")),
  );

const isToolEvent = (type: string): type is ToolEventType =>
  (TOOL_EVENT_TYPES as readonly string[]).includes(type);

const boundedText = (value: unknown, maximum = 240): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
};

const authorityEpoch = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const authoritativeCapabilityState = (
  active: boolean,
  epoch: number,
  incomingActive: unknown,
  incomingEpoch: number | null,
): { active: boolean; epoch: number } => {
  if (typeof incomingActive !== "boolean" || incomingEpoch === null || incomingEpoch < epoch) {
    return { active, epoch };
  }
  if (incomingEpoch === epoch) return { active: active && incomingActive, epoch };
  return { active: incomingActive, epoch: incomingEpoch };
};

const toolActivityFrom = (event: ProtocolEvent): ToolActivity => ({
  toolCallId: event.tool_call_id ?? "uncorrelated",
  toolId: boundedText(event.payload.tool_id, 80) ?? "unknown tool",
  eventType: event.type as ToolEventType,
  riskClass: boundedText(event.payload.risk_class, 40),
  detail: boundedText(event.payload.message) ?? boundedText(event.payload.error),
  monotonicMs: event.monotonic_ms,
});

const approvalDetails = (toolId: string, value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const arguments_ = value as Record<string, unknown>;
  const root = typeof arguments_.root === "string" ? arguments_.root : "?";
  if (toolId === "process.run" && typeof arguments_.executable === "string") {
    const args = Array.isArray(arguments_.args)
      ? arguments_.args.filter((item): item is string => typeof item === "string")
      : [];
    const command = [arguments_.executable, ...args].map((item) => JSON.stringify(item)).join(" ");
    const cwd = typeof arguments_.cwd === "string" ? arguments_.cwd : ".";
    return boundedText(`Command: ${command}\nWorking directory: ${root}:${cwd}`, 30_000);
  }
  if (toolId === "files.write" && typeof arguments_.path === "string") {
    const mode = arguments_.overwrite === true ? "replace or create" : "create only";
    return boundedText(`Target: ${root}:${arguments_.path}\nMode: ${mode}`, 5_000);
  }
  if (toolId === "app.open" && typeof arguments_.path === "string") {
    return boundedText(`Target: ${root}:${arguments_.path}`, 5_000);
  }
  return undefined;
};

const approvalFrom = (event: ProtocolEvent): ToolApprovalRequest | null => {
  if (!event.tool_call_id) return null;
  const toolId = boundedText(event.payload.tool_id, 80) ?? "unknown tool";
  return {
    toolCallId: event.tool_call_id,
    toolId,
    description:
      boundedText(event.payload.summary) ??
      boundedText(event.payload.description) ??
      `Allow Sam to use ${toolId}?`,
    details: approvalDetails(toolId, event.payload.arguments),
    riskClass: boundedText(event.payload.risk_class, 40),
    monotonicMs: event.monotonic_ms,
  };
};

const updateFrom = (event: ProtocolEvent): UpdateActivity | null => {
  const componentId = boundedText(event.payload.component_id, 64);
  const state = boundedText(event.payload.state, 40);
  if (!event.update_tx_id || !componentId || !state) return null;
  return {
    transactionId: event.update_tx_id,
    componentId,
    state,
    candidateVersion: boundedText(event.payload.candidate_version, 128),
    error: boundedText(event.payload.error, 240),
  };
};

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
      pendingToolApproval: null,
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
  if (
    event.type === "system.stopping" ||
    (event.type === "control.acknowledged" && event.payload.application_stopping === true)
  ) {
    return { ...withConnection(state, "offline"), applicationStopped: true };
  }

  const carriesConversationCorrelation =
    !event.type.startsWith("control.") && event.type !== "capability.authority_changed";
  const startsNewGeneration = Boolean(
    carriesConversationCorrelation &&
      event.generation_id &&
      event.generation_id !== state.generationId,
  );

  let next: UiState = {
    ...state,
    sessionId: event.session_id ?? state.sessionId,
    turnId: carriesConversationCorrelation ? (event.turn_id ?? state.turnId) : state.turnId,
    generationId: carriesConversationCorrelation
      ? (event.generation_id ?? state.generationId)
      : state.generationId,
    ...(startsNewGeneration ? { latestToolActivity: null, pendingToolApproval: null } : {}),
    lastMonotonicByType: {
      ...state.lastMonotonicByType,
      [event.type]: event.monotonic_ms,
    },
  };

  if (event.type === "system.ready") {
    const readyState = isConversationalState(event.payload.state) ? event.payload.state : "IDLE";
    const readyAuthorityEpoch = authorityEpoch(event.payload.capability_authority_epoch);
    const readyAuthority = startsNewSession
      ? {
          active:
            typeof event.payload.capability_authority_active === "boolean"
              ? event.payload.capability_authority_active
              : next.capabilityAuthorityActive,
          epoch: readyAuthorityEpoch ?? next.capabilityAuthorityEpoch,
        }
      : authoritativeCapabilityState(
          next.capabilityAuthorityActive,
          next.capabilityAuthorityEpoch,
          event.payload.capability_authority_active,
          readyAuthorityEpoch,
        );
    return {
      ...next,
      connection: "connected",
      applicationStopped: false,
      provider: boundedText(event.payload.provider),
      model: boundedText(event.payload.model),
      selectionReason: boundedText(event.payload.selection_reason, 500),
      conversationalState: readyState,
      microphoneEnabled:
        typeof event.payload.microphone_enabled === "boolean"
          ? event.payload.microphone_enabled
          : next.microphoneEnabled,
      ttsOutputEnabled:
        typeof event.payload.tts_output_enabled === "boolean"
          ? event.payload.tts_output_enabled
          : next.ttsOutputEnabled,
      capabilityAuthorityActive: readyAuthority.active,
      capabilityAuthorityEpoch: readyAuthority.epoch,
      latestToolActivity: readyAuthority.active ? next.latestToolActivity : null,
      pendingToolApproval: readyAuthority.active ? next.pendingToolApproval : null,
      ...(startsNewSession
        ? {
            sessionId: event.session_id,
            turnId: undefined,
            generationId: undefined,
            provisionalTranscript: null,
            lastMonotonicByType: { [event.type]: event.monotonic_ms },
            metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 },
            latestToolActivity: null,
            pendingToolApproval: null,
            capabilityAuthorityReason: undefined,
          }
        : {}),
    };
  }
  if (event.type === "capability.authority_changed") {
    const changedEpoch = authorityEpoch(event.payload.epoch);
    const applies =
      changedEpoch !== null &&
      changedEpoch >= next.capabilityAuthorityEpoch &&
      typeof event.payload.active === "boolean";
    if (applies) {
      const authority = authoritativeCapabilityState(
        next.capabilityAuthorityActive,
        next.capabilityAuthorityEpoch,
        event.payload.active,
        changedEpoch,
      );
      next = {
        ...next,
        capabilityAuthorityActive: authority.active,
        capabilityAuthorityEpoch: authority.epoch,
        capabilityAuthorityReason: authority.active
          ? undefined
          : boundedText(event.payload.reason, 120),
        latestToolActivity: authority.active ? next.latestToolActivity : null,
        pendingToolApproval: authority.active ? next.pendingToolApproval : null,
      };
    }
  } else if (isToolEvent(event.type)) {
    const latestToolActivity = toolActivityFrom(event);
    const terminal = new Set<ToolEventType>([
      "tool.started",
      "tool.completed",
      "tool.failed",
      "tool.cancelled",
      "tool.denied",
    ]);
    next = {
      ...next,
      latestToolActivity,
      pendingToolApproval:
        event.type === "tool.approval_requested"
          ? approvalFrom(event)
          : terminal.has(event.type) &&
              next.pendingToolApproval?.toolCallId === latestToolActivity.toolCallId
            ? null
            : next.pendingToolApproval,
    };
  } else if (event.type === "update.state_changed") {
    next = { ...next, updateActivity: updateFrom(event) ?? next.updateActivity };
  } else if (event.type === "voice.state_changed" && isConversationalState(event.payload.to)) {
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
    const acknowledgedAuthorityEpoch = authorityEpoch(event.payload.capability_authority_epoch);
    const updatesCapabilityAuthority =
      event.type === "control.acknowledged" &&
      acknowledgedAuthorityEpoch !== null &&
      acknowledgedAuthorityEpoch >= next.capabilityAuthorityEpoch &&
      typeof event.payload.capability_authority_active === "boolean";
    const acknowledgedAuthority = updatesCapabilityAuthority
      ? authoritativeCapabilityState(
          next.capabilityAuthorityActive,
          next.capabilityAuthorityEpoch,
          event.payload.capability_authority_active,
          acknowledgedAuthorityEpoch,
        )
      : null;
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
      capabilityAuthorityActive: acknowledgedAuthority?.active ?? next.capabilityAuthorityActive,
      capabilityAuthorityEpoch: acknowledgedAuthority?.epoch ?? next.capabilityAuthorityEpoch,
      latestToolActivity: acknowledgedAuthority?.active === false ? null : next.latestToolActivity,
      pendingToolApproval:
        acknowledgedAuthority?.active === false ? null : next.pendingToolApproval,
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
