export const PROTOCOL_VERSION = 1 as const;

export const CONVERSATIONAL_STATES = [
  "IDLE",
  "LISTENING",
  "USER_SPEAKING",
  "ENDPOINT_CANDIDATE",
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
  pendingCommandIds: readonly string[];
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
  pendingCommandIds: [],
};

export const isConversationalState = (value: unknown): value is ConversationalState =>
  typeof value === "string" && (CONVERSATIONAL_STATES as readonly string[]).includes(value);

export const isVisualizationEvent = (type: string): boolean =>
  type === "voice.level" || type === "tts.level";
