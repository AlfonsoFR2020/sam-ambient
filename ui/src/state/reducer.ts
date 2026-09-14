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
        event.type.startsWith("tool.") ||
        (event.type === "transcript.final" && event.payload.role === "assistant")),
  );

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
    const readyCatalog = providerCatalog(event.payload.provider_catalog);
    const readyModel = boundedText(event.payload.model);
    const readyPendingProvider = boundedText(event.payload.pending_provider);
    const readyPendingModel = boundedText(event.payload.pending_model);
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
      ttsBackend: boundedText(event.payload.tts_backend, 80),
      ttsSelection: speechSelection(event.payload.tts_selection),
      providerCatalog: readyCatalog,
      startupLifecycle: readyModel
        ? "ready_transition"
        : readyPendingModel
          ? "loading_model"
          : installedCount > 1
            ? "waiting_for_model_choice"
            : "blocked",
      diagnosticReason:
        boundedText(event.payload.model_unavailable_reason, 500) ?? next.diagnosticReason,
      cloudAllowed:
        typeof event.payload.cloud_allowed === "boolean"
          ? event.payload.cloud_allowed
          : next.cloudAllowed,
      visualSettings: visualSettings(event.payload.visual_settings) ?? next.visualSettings,
      audioSettings: audioSettings(event.payload.audio_settings) ?? next.audioSettings,
      lifecycleSettings:
        lifecycleSettings(event.payload.lifecycle_settings) ?? next.lifecycleSettings,
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
  if (event.type === "provider.discovery") {
    const phase = boundedText(event.payload.state, 40);
    const catalog = providerCatalog(event.payload.catalog);
    const provider = boundedText(event.payload.provider, 80);
    const model = boundedText(event.payload.model, 256);
    const reason = boundedText(event.payload.reason, 500);
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
      provider: phase === "ready" ? (provider ?? next.provider) : next.provider,
      model: phase === "ready" ? (model ?? next.model) : next.model,
      pendingProvider: phase === "loading_model" ? provider : undefined,
      pendingModel: phase === "loading_model" ? model : undefined,
      selectionReason: reason ?? next.selectionReason,
      diagnosticReason: phase === "ready" ? undefined : (reason ?? next.diagnosticReason),
      providerCatalog: catalog.length ? catalog : next.providerCatalog,
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
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState:
        event.payload.to === "ENDPOINT_CANDIDATE" && event.payload.reason === "stt_finalizing"
          ? "COMMITTING"
          : event.payload.to,
      diagnosticReason: event.payload.to === "LISTENING" ? undefined : next.diagnosticReason,
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
        turnId: event.turn_id,
        generationId: event.generation_id,
      };
      const duplicateIndex = next.transcript.findIndex(
        (item) =>
          item.role === role &&
          ((entry.generationId && item.generationId === entry.generationId) ||
            (!entry.generationId && entry.turnId && item.turnId === entry.turnId)),
      );
      const transcript = [...next.transcript];
      if (duplicateIndex >= 0) transcript[duplicateIndex] = entry;
      else transcript.push(entry);
      next = {
        ...next,
        provisionalTranscript: null,
        transcript: transcript.slice(-100),
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
    next = {
      ...next,
      priorConversationalState: next.conversationalState,
      conversationalState: "ERROR",
      diagnosticReason:
        boundedText(event.payload.reason, 500) ??
        boundedText(event.payload.error, 500) ??
        "A local component failed. Text controls may remain available.",
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
