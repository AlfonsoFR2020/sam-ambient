export const PROTOCOL_VERSION = 1 as const;

export const CONVERSATIONAL_STATES = [
  "IDLE",
  "LISTENING",
  "USER_SPEAKING",
  "ENDPOINT_CANDIDATE",
  "COMMITTING",
  "THINKING",
  "SPEAKING",
  "INTERRUPTION_CANDIDATE",
  "INTERRUPTED",
  "RECOVERING",
  "ERROR",
  "OFFLINE",
] as const;

export type ConversationalState = (typeof CONVERSATIONAL_STATES)[number];
export type ConnectionState = "connecting" | "connected" | "offline";

export interface ProtocolEvent {
  protocol: typeof PROTOCOL_VERSION;
  type: string;
  monotonic_ms: number;
  payload: Record<string, unknown>;
  session_id?: string;
  turn_id?: string;
  generation_id?: string;
  cancellation_id?: string;
  tool_call_id?: string;
  update_tx_id?: string;
}

export const CONTROL_COMMAND_TYPES = [
  "control.microphone.set",
  "control.tts_output.set",
  "control.stop_speaking",
  "control.emergency_stop",
  "control.user_message.submit",
  "control.tool.approve",
  "control.tool.deny",
  "control.capabilities.revoke_all",
  "control.application.quit",
] as const;

export type ControlCommandType = (typeof CONTROL_COMMAND_TYPES)[number];

export interface ControlCommand {
  protocol: typeof PROTOCOL_VERSION;
  type: ControlCommandType;
  command_id: string;
  monotonic_ms: number;
  payload: Record<string, unknown>;
  session_id?: string;
  turn_id?: string;
  generation_id?: string;
  cancellation_id?: string;
  tool_call_id?: string;
}

export const TOOL_EVENT_TYPES = [
  "tool.requested",
  "tool.authorizing",
  "tool.approval_requested",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "tool.cancelled",
  "tool.denied",
] as const;

export type ToolEventType = (typeof TOOL_EVENT_TYPES)[number];

export interface ToolActivity {
  toolCallId: string;
  toolId: string;
  eventType: ToolEventType;
  riskClass?: string;
  detail?: string;
  monotonicMs: number;
}

export interface ToolApprovalRequest {
  toolCallId: string;
  toolId: string;
  description: string;
  details?: string;
  riskClass?: string;
  monotonicMs: number;
}

export interface UpdateActivity {
  transactionId: string;
  componentId: string;
  state: string;
  candidateVersion?: string;
  error?: string;
}

export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  interrupted: boolean;
  monotonicMs: number;
}

export interface VoiceMetrics {
  rms: number;
  peak: number;
  speechProbability: number;
  playbackEnvelope: number;
}

export interface UiState {
  applicationStopped?: boolean;
  provider?: string;
  model?: string;
  selectionReason?: string;
  sttStatus?: string;
  ttsBackend?: string;
  ttsSelection?: string;
  cloudAllowed?: boolean;
  connection: ConnectionState;
  conversationalState: ConversationalState;
  priorConversationalState: ConversationalState;
  metrics: VoiceMetrics;
  provisionalTranscript: Omit<TranscriptEntry, "id" | "interrupted"> | null;
  transcript: readonly TranscriptEntry[];
  sessionId?: string;
  turnId?: string;
  generationId?: string;
  lastMonotonicByType: Readonly<Record<string, number>>;
  droppedVisualizationEvents: number;
  microphoneEnabled: boolean;
  ttsOutputEnabled: boolean;
  capabilityAuthorityActive: boolean;
  capabilityAuthorityEpoch: number;
  capabilityAuthorityReason?: string;
  pendingCommandIds: readonly string[];
  latestToolActivity: ToolActivity | null;
  pendingToolApproval: ToolApprovalRequest | null;
  updateActivity: UpdateActivity | null;
  protocolError?: string;
}

export const INITIAL_UI_STATE: UiState = {
  connection: "offline",
  conversationalState: "OFFLINE",
  priorConversationalState: "IDLE",
  metrics: { rms: 0, peak: 0, speechProbability: 0, playbackEnvelope: 0 },
  provisionalTranscript: null,
  transcript: [],
  lastMonotonicByType: {},
  droppedVisualizationEvents: 0,
  microphoneEnabled: true,
  ttsOutputEnabled: true,
  capabilityAuthorityActive: true,
  capabilityAuthorityEpoch: 0,
  pendingCommandIds: [],
  latestToolActivity: null,
  pendingToolApproval: null,
  updateActivity: null,
};

export const isConversationalState = (value: unknown): value is ConversationalState =>
  typeof value === "string" && (CONVERSATIONAL_STATES as readonly string[]).includes(value);

export const isVisualizationEvent = (type: string): boolean =>
  type === "voice.level" || type === "tts.level";
