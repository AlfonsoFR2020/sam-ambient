import {
  type ConnectionState,
  INITIAL_UI_STATE,
  isConversationalState,
  type ProtocolEvent,
  type ProviderCatalogEntry,
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

const transcriptRole = (value: unknown): TranscriptEntry["role"] | null =>
  value === "assistant" || value === "user" ? value : null;

const transcriptText = (event: ProtocolEvent): string | null => {
  const text = event.payload.text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
};

const withCommittedTranscript = (
  state: UiState,
  event: ProtocolEvent,
  role: TranscriptEntry["role"],
  text: string,
  interrupted = false,
): UiState => {
  const entry: TranscriptEntry = {
    id: `${event.session_id ?? "session"}:${event.monotonic_ms}:${role}`,
    role,
    text,
    interrupted,
    monotonicMs: event.monotonic_ms,
    turnId: event.turn_id,
    generationId: event.generation_id,
  };
  const duplicateIndex = state.transcript.findIndex(
    (item) =>
      item.role === role &&
      ((entry.generationId && item.generationId === entry.generationId) ||
        (!entry.generationId && entry.turnId && item.turnId === entry.turnId)),
  );
  const transcript = [...state.transcript];
  if (duplicateIndex >= 0) {
    const committed = transcript[duplicateIndex];
    transcript[duplicateIndex] = interrupted ? { ...committed, interrupted: true } : committed;
  } else transcript.push(entry);
  return { ...state, provisionalTranscript: null, transcript };
};

const RETIRED_ID_LIMIT = 32;

const retireId = (ids: readonly string[], id?: string): readonly string[] =>
  id && !ids.includes(id) ? [...ids, id].slice(-RETIRED_ID_LIMIT) : ids;

const isConversationEvent = (type: string): boolean =>
  type.startsWith("voice.") ||
  type.startsWith("transcript.") ||
  type.startsWith("stt.") ||
  type.startsWith("model.") ||
  type.startsWith("tts.") ||
  type.startsWith("tool.") ||
  type === "turn.committed" ||
  type === "component.error";

const isCandidateEvent = (event: ProtocolEvent): boolean =>
  event.payload.candidate === true ||
  (event.type === "voice.state_changed" &&
    ["INTERRUPTION_CANDIDATE", "RECOVERING"].includes(String(event.payload.to)) &&
    !event.generation_id) ||
  (event.type === "stt.cancelled" && !event.generation_id);

const startsTurn = (event: ProtocolEvent): boolean =>
  (event.type === "voice.state_changed" &&
    ["LISTENING", "USER_SPEAKING", "COMMITTING", "THINKING"].includes(String(event.payload.to))) ||
  event.type === "turn.committed" ||
  (event.type === "transcript.final" &&
    (event.payload.role === "user" ||
      (event.payload.role === "assistant" && !event.generation_id)) &&
    event.payload.candidate !== true);

const isStaleConversationEvent = (state: UiState, event: ProtocolEvent): boolean => {
  if (!isConversationEvent(event.type)) return false;
  if (
    state.generationId &&
    (event.type.startsWith("model.") || event.type.startsWith("tts.")) &&
    !event.generation_id
  )
    return true;
  if (event.turn_id && state.retiredTurnIds.includes(event.turn_id)) return true;
  if (
    event.generation_id &&
    state.retiredGenerationIds.includes(event.generation_id) &&
    !(event.type === "tts.cancelled" && event.turn_id === state.turnId)
  )
    return true;
  if (isCandidateEvent(event)) return false;
  if (event.turn_id && state.turnId && event.turn_id !== state.turnId) return !startsTurn(event);
  if (event.generation_id && state.generationId && event.generation_id !== state.generationId)
    return !startsTurn(event);
  return false;
};

const isToolEvent = (type: string): type is ToolEventType =>
  (TOOL_EVENT_TYPES as readonly string[]).includes(type);

const boundedText = (value: unknown, maximum = 240): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

const providerCatalog = (value: unknown): ProviderCatalogEntry[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const id = boundedText(row.id, 80);
        if (!id) return [];
        return [
          {
            id,
            running: row.running === true,
            models: stringList(row.models),
            installedModels: stringList(row.installed_models ?? row.available_models),
            detail: boundedText(row.detail, 500) ?? "unavailable",
          },
        ];
      })
    : [];

const authorityEpoch = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

const visualSettings = (value: unknown): UiState["visualSettings"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const quality = item.quality;
  const deviceProfile = item.device_profile;
  const reducedMotion = item.reduced_motion;
  const unit = (name: string) => {
    const result = item[name];
    return typeof result === "number" && Number.isFinite(result) && result >= 0 && result <= 1
      ? result
      : undefined;
  };
  const intensity = unit("intensity");
  const motionIntensity = unit("motion_intensity");
  const audioReactivity = unit("audio_reactivity");
  const particleDensity = unit("particle_density");
  if (
    !["auto", "low", "medium", "high"].includes(String(quality)) ||
    !["auto", "mobile_2020", "low_power", "desktop", "high_end"].includes(String(deviceProfile)) ||
    !["system", "on", "off"].includes(String(reducedMotion)) ||
    intensity === undefined ||
    motionIntensity === undefined ||
    audioReactivity === undefined ||
    particleDensity === undefined
  )
    return undefined;
  return {
    quality: quality as NonNullable<UiState["visualSettings"]>["quality"],
    deviceProfile: deviceProfile as NonNullable<UiState["visualSettings"]>["deviceProfile"],
    intensity,
    motionIntensity,
    audioReactivity,
    particleDensity,
    reducedMotion: reducedMotion as NonNullable<UiState["visualSettings"]>["reducedMotion"],
  };
};

const audioSettings = (value: unknown): UiState["audioSettings"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  const inputGain = item.input_gain;
  const outputGain = item.output_gain;
  if (
    typeof inputGain !== "number" ||
    !Number.isFinite(inputGain) ||
    inputGain < 0 ||
    inputGain > 2 ||
    typeof outputGain !== "number" ||
    !Number.isFinite(outputGain) ||
    outputGain < 0 ||
    outputGain > 2
  )
    return undefined;
  return { inputGain, outputGain };
};

const lifecycleSettings = (value: unknown): UiState["lifecycleSettings"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const item = value as Record<string, unknown>;
  if (
    !["keep", "unload_if_sam_loaded"].includes(String(item.model_on_exit)) ||
    !["keep", "stop_if_sam_started"].includes(String(item.provider_on_exit))
  )
    return undefined;
  return {
    modelOnExit: item.model_on_exit as "keep" | "unload_if_sam_loaded",
    providerOnExit: item.provider_on_exit as "keep" | "stop_if_sam_started",
  };
};

function speechSelection(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || !("voice" in value)) return undefined;
  const voice = value.voice;
  if (!voice || typeof voice !== "object" || !("voice_id" in voice) || !("locale" in voice))
    return undefined;
  return (
    [
      boundedText(voice.voice_id, 120),
      boundedText(voice.locale, 32),
      "reason" in value ? boundedText(value.reason, 120) : undefined,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}

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
      providerDiscovery: {
        status: state.providerCatalog.length || state.model ? "stale" : "unavailable",
        reason: "The local service disconnected.",
      },
      priorConversationalState:
        state.conversationalState === "OFFLINE"
          ? state.priorConversationalState
          : state.conversationalState,
      conversationalState: "OFFLINE",
      voiceInputHealth: undefined,
      provisionalTranscript: null,
      candidateTurnId: undefined,
      retiredTurnIds: retireId(state.retiredTurnIds, state.turnId),
      retiredGenerationIds: retireId(state.retiredGenerationIds, state.generationId),
      turnId: undefined,
      generationId: undefined,
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
  if (isStaleConversationEvent(state, event)) return state;
  if (event.type === "voice.state_changed" && !isConversationalState(event.payload.to))
    return state;
  if (
    (event.type === "control.acknowledged" || event.type === "control.rejected") &&
    event.payload.command_type === "control.user_message.submit" &&
    typeof event.payload.command_id === "string" &&
    !state.pendingCommandIds.includes(event.payload.command_id)
  )
    return state;
  if (
    event.type === "system.stopping" ||
    (event.type === "control.acknowledged" && event.payload.application_stopping === true)
  ) {
    return { ...withConnection(state, "offline"), applicationStopped: true };
  }

  const conversationEvent = isConversationEvent(event.type);
  const candidateEvent = conversationEvent && isCandidateEvent(event);
  const newTurn = Boolean(
    conversationEvent &&
      !candidateEvent &&
      event.turn_id &&
      event.turn_id !== state.turnId &&
      startsTurn(event),
  );
  const newGeneration = Boolean(
    conversationEvent &&
      !candidateEvent &&
      event.generation_id &&
      event.generation_id !== state.generationId &&
      startsTurn(event),
  );
  const startsNewGeneration = newTurn || newGeneration;

  let next: UiState = {
    ...state,
    sessionId: event.session_id ?? state.sessionId,
    turnId: conversationEvent && !candidateEvent ? (event.turn_id ?? state.turnId) : state.turnId,
    generationId:
      conversationEvent && !candidateEvent
        ? newTurn
          ? event.generation_id
          : (event.generation_id ?? state.generationId)
        : state.generationId,
    candidateTurnId:
      event.type === "stt.cancelled" || newTurn
        ? undefined
        : candidateEvent
          ? (event.turn_id ?? state.candidateTurnId)
          : state.candidateTurnId,
    retiredTurnIds: newTurn ? retireId(state.retiredTurnIds, state.turnId) : state.retiredTurnIds,
    retiredGenerationIds: startsNewGeneration
      ? retireId(state.retiredGenerationIds, state.generationId)
      : state.retiredGenerationIds,
    ...(startsNewGeneration
      ? {
          latestToolActivity: null,
          pendingToolApproval: null,
          provisionalTranscript:
            state.candidateTurnId === event.turn_id && state.provisionalTranscript?.role === "user"
              ? state.provisionalTranscript
              : null,
        }
      : {}),
    lastMonotonicByType: {
      ...state.lastMonotonicByType,
      [event.type]: event.monotonic_ms,
    },
  };

  if (event.type === "system.ready") {
    const readyState = isConversationalState(event.payload.state) ? event.payload.state : "IDLE";
    const readyActive = !["IDLE", "ERROR", "OFFLINE"].includes(readyState);
    const readyTurnId = readyActive ? event.turn_id : undefined;
    const readyGenerationId = readyActive ? event.generation_id : undefined;
    const readyCatalog = providerCatalog(event.payload.provider_catalog);
    const readyModel = boundedText(event.payload.model);
    const readyPendingProvider = boundedText(event.payload.pending_provider);
    const readyPendingModel = boundedText(event.payload.pending_model);
    const readyScanning = event.payload.provider_scan_active === true;
    const readyRequestId = boundedText(event.payload.pending_provider_request_id, 120);
    const installedCount = readyCatalog.reduce(
      (count, provider) => count + provider.installedModels.length,
      0,
    );
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
      samVersion: boundedText(event.payload.sam_version, 32),
      samName: boundedText(event.payload.sam_name, 80) ?? "Sam",
      samAuthor: boundedText(event.payload.sam_author, 160),
      provider: boundedText(event.payload.provider),
      model: readyModel,
      pendingProvider: readyPendingProvider,
      pendingModel: readyPendingModel,
      selectionReason: boundedText(event.payload.selection_reason, 500),
      sttStatus: boundedText(event.payload.stt_status, 500),
      voiceInputHealth: startsNewSession ? undefined : next.voiceInputHealth,
      ttsBackend: boundedText(event.payload.tts_backend, 80),
      ttsSelection: speechSelection(event.payload.tts_selection),
      providerCatalog: readyCatalog,
      providerDiscovery: {
        status: readyScanning
          ? "scanning"
          : readyModel ||
              readyCatalog.some((item) => item.models.length || item.installedModels.length)
            ? "available"
            : "empty",
        ...(readyScanning && readyRequestId ? { requestId: readyRequestId } : {}),
      },
      startupLifecycle: readyScanning
        ? readyPendingModel
          ? "loading_model"
          : "scanning"
        : readyModel
          ? "ready_transition"
          : readyPendingModel
            ? "loading_model"
            : installedCount > 1
              ? "waiting_for_model_choice"
              : "blocked",
      diagnosticReason: boundedText(event.payload.model_unavailable_reason, 500),
      cloudAllowed:
        typeof event.payload.cloud_allowed === "boolean"
          ? event.payload.cloud_allowed
          : next.cloudAllowed,
      visualSettings: visualSettings(event.payload.visual_settings) ?? next.visualSettings,
      audioSettings: audioSettings(event.payload.audio_settings) ?? next.audioSettings,
      lifecycleSettings:
        lifecycleSettings(event.payload.lifecycle_settings) ?? next.lifecycleSettings,
      conversationalState: readyState,
      turnId: readyTurnId,
      generationId: readyGenerationId,
      candidateTurnId: undefined,
      retiredTurnIds: (startsNewSession
        ? []
        : retireId(
            state.retiredTurnIds,
            state.turnId && state.turnId !== readyTurnId ? state.turnId : undefined,
          )
      ).filter((id) => id !== readyTurnId),
      retiredGenerationIds: (startsNewSession
        ? []
        : retireId(
            state.retiredGenerationIds,
            state.generationId && state.generationId !== readyGenerationId
              ? state.generationId
              : undefined,
          )
      ).filter((id) => id !== readyGenerationId),
      provisionalTranscript: null,
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
            lastMonotonicByType: { [event.type]: event.monotonic_ms },
            metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 },
            latestToolActivity: null,
            pendingToolApproval: null,
            capabilityAuthorityReason: undefined,
          }
        : {}),
    };
  }
  if (event.type === "component.health" && event.payload.component === "voice_input") {
    const status = event.payload.state;
    if (status !== "healthy" && status !== "degraded") return state;
    const reason = boundedText(event.payload.reason, 500);
    const priorHealthReason = next.voiceInputHealth?.reason;
    next = {
      ...next,
      voiceInputHealth: { status, reason, retrying: event.payload.retrying === true },
      diagnosticReason:
        status === "degraded"
          ? `Speech input: ${reason ?? "capture unavailable"}`
          : priorHealthReason && next.diagnosticReason === `Speech input: ${priorHealthReason}`
            ? undefined
            : next.diagnosticReason,
    };
  } else if (event.type === "provider.discovery") {
    const phase = boundedText(event.payload.state, 40);
    const requestId = boundedText(event.payload.request_id, 120);
    if (next.providerDiscovery.requestId && requestId !== next.providerDiscovery.requestId)
      return state;
    if (
      !["scanning", "loading_model", "ready", "blocked", "failed"].includes(phase ?? "") ||
      (event.payload.catalog !== undefined && !Array.isArray(event.payload.catalog))
    ) {
      return {
        ...next,
        providerDiscovery: {
          status: "failed",
          requestId,
          reason: "Invalid provider discovery result.",
        },
        protocolError: "Invalid provider discovery result from Sam core",
      };
    }
    const catalog = providerCatalog(event.payload.catalog);
    const provider = boundedText(event.payload.provider, 80);
    const model = boundedText(event.payload.model, 256);
    const reason = boundedText(event.payload.reason, 500);
    const inProgress = phase === "scanning" || phase === "loading_model";
    const discoveryStatus = inProgress
      ? "scanning"
      : phase === "failed"
        ? "failed"
        : catalog.some((item) => item.models.length || item.installedModels.length) ||
            (phase === "ready" && model)
          ? "available"
          : "empty";
    const startupLifecycle =
      phase === "ready"
        ? "ready_transition"
        : phase === "loading_model"
          ? "loading_model"
          : phase === "scanning"
            ? "scanning"
            : phase === "blocked" &&
                catalog.reduce((count, item) => count + item.installedModels.length, 0) > 1
              ? "waiting_for_model_choice"
              : "blocked";
    next = {
      ...next,
      provider:
        phase === "ready"
          ? provider
          : phase === "blocked" || phase === "failed"
            ? undefined
            : next.provider,
      model:
        phase === "ready"
          ? model
          : phase === "blocked" || phase === "failed"
            ? undefined
            : next.model,
      pendingProvider: phase === "loading_model" ? provider : undefined,
      pendingModel: phase === "loading_model" ? model : undefined,
      selectionReason: reason ?? next.selectionReason,
      diagnosticReason: phase === "ready" ? undefined : (reason ?? next.diagnosticReason),
      providerCatalog: inProgress || phase === "failed" ? next.providerCatalog : catalog,
      providerDiscovery: { status: discoveryStatus, requestId, reason },
      startupLifecycle,
    };
  } else if (event.type === "capability.authority_changed") {
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
    const terminal = ["IDLE", "ERROR", "OFFLINE"].includes(event.payload.to);
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState:
        event.payload.to === "ENDPOINT_CANDIDATE" && event.payload.reason === "stt_finalizing"
          ? "COMMITTING"
          : event.payload.to,
      diagnosticReason: event.payload.to === "LISTENING" ? undefined : next.diagnosticReason,
      turnId: terminal ? undefined : next.turnId,
      generationId: terminal ? undefined : next.generationId,
      candidateTurnId: terminal ? undefined : next.candidateTurnId,
      retiredTurnIds: terminal ? retireId(next.retiredTurnIds, next.turnId) : next.retiredTurnIds,
      retiredGenerationIds: terminal
        ? retireId(next.retiredGenerationIds, next.generationId)
        : next.retiredGenerationIds,
      provisionalTranscript: terminal ? null : next.provisionalTranscript,
      metrics: terminal
        ? { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 }
        : next.metrics,
      latestToolActivity: terminal ? null : next.latestToolActivity,
      pendingToolApproval: terminal ? null : next.pendingToolApproval,
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
    const role = transcriptRole(event.payload.role);
    if (text && role) {
      next = {
        ...next,
        provisionalTranscript: {
          role,
          text,
          monotonicMs: event.monotonic_ms,
        },
      };
    } else if (text) {
      next = { ...next, protocolError: "Transcript event is missing a valid user/assistant role." };
    }
  } else if (event.type === "transcript.final") {
    const text = transcriptText(event);
    const role = transcriptRole(event.payload.role);
    const provisionalVoiceText =
      role === "user" &&
      !event.generation_id &&
      event.payload.source !== "text" &&
      !event.payload.command_id;
    if (text && role && (event.payload.candidate === true || provisionalVoiceText)) {
      next = {
        ...next,
        provisionalTranscript: { role, text, monotonicMs: event.monotonic_ms },
      };
    } else if (text && role) {
      next = withCommittedTranscript(next, event, role, text, Boolean(event.payload.interrupted));
    } else if (text) {
      next = { ...next, protocolError: "Transcript event is missing a valid user/assistant role." };
    }
  } else if (event.type === "turn.committed") {
    const text = transcriptText(event);
    if (text) next = withCommittedTranscript(next, event, "user", text);
  } else if (event.type === "tts.failed") {
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: "ERROR",
      provisionalTranscript: null,
      metrics: { ...next.metrics, playbackEnvelope: 0 },
      retiredTurnIds: retireId(next.retiredTurnIds, next.turnId),
      retiredGenerationIds: retireId(next.retiredGenerationIds, next.generationId),
      turnId: undefined,
      generationId: undefined,
      candidateTurnId: undefined,
      latestToolActivity: null,
      pendingToolApproval: null,
      diagnosticReason: `Speech output failed: ${boundedText(event.payload.reason, 500) ?? "playback unavailable"}`,
    };
  } else if (event.type === "tts.cancelled") {
    const transcript = [...next.transcript];
    let index = -1;
    for (let candidate = transcript.length - 1; candidate >= 0; candidate -= 1) {
      const entry = transcript[candidate];
      if (
        entry.role === "assistant" &&
        ((event.generation_id && entry.generationId === event.generation_id) ||
          (!event.generation_id && event.turn_id && entry.turnId === event.turn_id))
      ) {
        index = candidate;
        break;
      }
    }
    if (index >= 0) {
      transcript[index] = { ...transcript[index], interrupted: true };
    }
    next = { ...next, transcript };
  } else if (event.type === "stt.cancelled") {
    const reason = boundedText(event.payload.reason, 120);
    next = {
      ...next,
      provisionalTranscript:
        next.provisionalTranscript?.role === "user" ? null : next.provisionalTranscript,
      diagnosticReason:
        reason === "playback_echo"
          ? "Ignored speech that matched Sam's current playback."
          : reason === "candidate_not_credible"
            ? "The interruption was heard but could not be confirmed as a user turn."
            : next.diagnosticReason,
    };
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
  } else if (event.type === "model.completed") {
    const text = transcriptText(event);
    next = text
      ? withCommittedTranscript(next, event, "assistant", text)
      : { ...next, provisionalTranscript: null };
  } else if (event.type === "model.cancelled") {
    const superseded = event.payload.outcome === "superseded";
    const interrupted = next.conversationalState === "INTERRUPTED";
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: interrupted ? "INTERRUPTED" : "IDLE",
      provisionalTranscript: null,
      retiredGenerationIds: retireId(next.retiredGenerationIds, event.generation_id),
      retiredTurnIds: interrupted
        ? next.retiredTurnIds
        : retireId(next.retiredTurnIds, next.turnId),
      turnId: interrupted ? next.turnId : undefined,
      generationId: interrupted ? next.generationId : undefined,
      latestToolActivity: null,
      pendingToolApproval: null,
      diagnosticReason: superseded
        ? "The previous response was superseded by a newer request."
        : (boundedText(event.payload.reason, 500) ?? "The model response was cancelled."),
    };
  } else if (event.type === "control.acknowledged" || event.type === "control.rejected") {
    const commandId = event.payload.command_id;
    const discoveryResponse =
      event.payload.command_type === "control.providers.rescan" ||
      event.payload.command_type === "control.model.select";
    if (
      discoveryResponse &&
      next.providerDiscovery.requestId &&
      commandId !== next.providerDiscovery.requestId
    ) {
      return {
        ...next,
        pendingCommandIds: next.pendingCommandIds.filter((pending) => pending !== commandId),
      };
    }
    const rejectedDiscovery =
      event.type === "control.rejected" &&
      discoveryResponse &&
      commandId === next.providerDiscovery.requestId;
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
      ...(rejectedDiscovery
        ? {
            providerDiscovery: {
              status: "failed" as const,
              requestId: next.providerDiscovery.requestId,
              reason: boundedText(event.payload.error, 500) ?? "Provider discovery failed.",
            },
            startupLifecycle: next.model ? next.startupLifecycle : ("blocked" as const),
          }
        : {}),
      startupLifecycle:
        event.type === "control.acknowledged" && event.payload.application_restarting === true
          ? "starting"
          : next.startupLifecycle,
      visualSettings: visualSettings(event.payload.visual_settings) ?? next.visualSettings,
      audioSettings: audioSettings(event.payload.audio_settings) ?? next.audioSettings,
      lifecycleSettings:
        lifecycleSettings(event.payload.lifecycle_settings) ?? next.lifecycleSettings,
    };
  } else if (event.type === "component.error") {
    const stage = boundedText(event.payload.component, 80);
    const stageLabel =
      stage === "model"
        ? "Response failed"
        : stage === "tts"
          ? "Speech output failed"
          : stage === "turn"
            ? "Request failed"
            : stage === "audio" || stage === "voice_input"
              ? "Speech input failed"
              : "A local component failed";
    const reason =
      boundedText(event.payload.reason, 500) ??
      boundedText(event.payload.error, 500) ??
      "Text controls may remain available.";
    if (state.turnId && !event.turn_id && !event.generation_id)
      return { ...next, diagnosticReason: `${stageLabel}: ${reason}` };
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: "ERROR",
      provisionalTranscript: null,
      retiredTurnIds: retireId(next.retiredTurnIds, next.turnId),
      retiredGenerationIds: retireId(next.retiredGenerationIds, next.generationId),
      turnId: undefined,
      generationId: undefined,
      candidateTurnId: undefined,
      latestToolActivity: null,
      pendingToolApproval: null,
      diagnosticReason: `${stageLabel}: ${reason}`,
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
