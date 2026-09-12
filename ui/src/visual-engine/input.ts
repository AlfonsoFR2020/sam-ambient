import type { ConversationalState, UiState } from "../protocol/types";
import type { AudioFeatures, VisualForeground, VisualInputV1, VisualInteraction } from "./types";

const EXPIRY_START_MS = 250;
const EXPIRY_END_MS = 1000;
const RELEASE_MS = 180;

const unit = (value: number): number | undefined =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;

const foreground = (state: ConversationalState, prior: ConversationalState): VisualForeground => {
  if (state === "COMMITTING") return "transcribing";
  if (state === "THINKING") return "thinking";
  if (state === "SPEAKING") return "speaking";
  if (state === "INTERRUPTED") return "interrupted";
  if (state === "RECOVERING" && prior === "SPEAKING") return "resuming";
  if (["LISTENING", "USER_SPEAKING", "ENDPOINT_CANDIDATE"].includes(state)) return "listening";
  if (state === "INTERRUPTION_CANDIDATE") {
    return prior === "SPEAKING" ? "speaking" : "listening";
  }
  return "idle";
};

const interactionFrom = (state: UiState, interruptSerial: number): VisualInteraction => {
  const tentativeDuplex =
    state.conversationalState === "INTERRUPTION_CANDIDATE" &&
    state.priorConversationalState === "SPEAKING";
  const listening =
    state.microphoneEnabled &&
    (["LISTENING", "USER_SPEAKING", "ENDPOINT_CANDIDATE"].includes(state.conversationalState) ||
      state.conversationalState === "INTERRUPTION_CANDIDATE");
  const speaking =
    state.ttsOutputEnabled &&
    (state.conversationalState === "SPEAKING" ||
      tentativeDuplex ||
      (state.conversationalState === "RECOVERING" &&
        state.priorConversationalState === "SPEAKING"));
  const availability = state.applicationStopped
    ? "stopped"
    : state.connection === "connecting"
      ? "starting"
      : state.connection === "offline"
        ? "reconnecting"
        : state.protocolError || !state.provider || !state.model
          ? "degraded"
          : "ready";
  const toolType = state.latestToolActivity?.eventType;
  return {
    foreground: foreground(state.conversationalState, state.priorConversationalState),
    listening,
    speaking,
    floor: listening && speaking ? "shared" : speaking ? "sam" : listening ? "user" : "none",
    acknowledgement: false,
    userPause: state.conversationalState === "ENDPOINT_CANDIDATE",
    reasoning: state.conversationalState === "THINKING",
    delegatedWork: toolType === "tool.started" || toolType === "tool.authorizing",
    responseReady: false,
    interruptSerial,
    availability,
  };
};

const ageFeature = (feature: AudioFeatures | undefined, now: number): AudioFeatures | undefined => {
  if (!feature) return undefined;
  const age = Math.max(0, now - feature.receivedMs);
  if (age >= EXPIRY_END_MS) return undefined;
  if (age <= EXPIRY_START_MS) return feature;
  const scale = Math.exp(-(age - EXPIRY_START_MS) / RELEASE_MS);
  const scaled = (value: number | undefined) => (value === undefined ? undefined : value * scale);
  return {
    ...feature,
    envelope: feature.envelope * scale,
    peak: scaled(feature.peak),
    transient: scaled(feature.transient),
    bands: feature.bands?.map((value) => value * scale) as
      | readonly [number, number, number]
      | undefined,
    shape: feature.shape?.map((value) => value * scale) as
      | readonly [number, number, number, number]
      | undefined,
    activity: scaled(feature.activity),
  };
};

export interface VisualAdapterUpdate {
  readonly sourceSequence?: number;
  readonly generationId?: string;
}

/** Converts already-validated UI state into renderer-only data; it grants no authority. */
export class VisualInputAdapter {
  private sequence = 0;
  private sourceSequence = -1;
  private streamKey = "unbound";
  private generationId?: string;
  private voiceStamp?: number;
  private outputStamp?: number;
  private input?: AudioFeatures;
  private output?: AudioFeatures;
  private interruptSerial = 0;
  private wasInterrupted = false;
  private current?: VisualInputV1;

  ingest(state: UiState, now: number, update: VisualAdapterUpdate = {}): VisualInputV1 {
    if (!Number.isFinite(now)) throw new TypeError("visual input receipt time must be finite");
    if (update.generationId && state.generationId && update.generationId !== state.generationId)
      return this.snapshot(now);
    if (update.sourceSequence !== undefined) {
      if (
        !Number.isSafeInteger(update.sourceSequence) ||
        update.sourceSequence <= this.sourceSequence
      )
        return this.snapshot(now);
      this.sourceSequence = update.sourceSequence;
    }
    const nextStream = state.sessionId ?? "unbound";
    if (nextStream !== this.streamKey) {
      this.streamKey = nextStream;
      this.input = undefined;
      this.output = undefined;
      this.voiceStamp = undefined;
      this.outputStamp = undefined;
      this.generationId = state.generationId;
    }
    if (state.generationId !== this.generationId) {
      this.generationId = state.generationId;
      this.output = undefined;
      this.outputStamp = state.lastMonotonicByType["tts.level"];
    }

    const voiceStamp = state.lastMonotonicByType["voice.level"];
    if (state.microphoneEnabled && voiceStamp !== undefined && voiceStamp !== this.voiceStamp) {
      this.voiceStamp = voiceStamp;
      const envelope = unit(state.metrics.rms);
      if (envelope !== undefined) {
        this.input = {
          receivedMs: now,
          envelope,
          peak: unit(state.metrics.peak),
          activity: unit(state.metrics.speechProbability),
        };
      }
    } else if (!state.microphoneEnabled) this.input = undefined;

    const interaction = interactionFrom(state, this.interruptSerial);
    const interrupted = state.conversationalState === "INTERRUPTED";
    if (interrupted && !this.wasInterrupted) this.interruptSerial++;
    this.wasInterrupted = interrupted;
    const confirmedStop = interrupted || state.applicationStopped || !interaction.speaking;
    const outputStamp = state.lastMonotonicByType["tts.level"];
    if (confirmedStop || !state.ttsOutputEnabled) {
      this.output = undefined;
      this.outputStamp = outputStamp;
    } else if (outputStamp !== undefined && outputStamp !== this.outputStamp) {
      this.outputStamp = outputStamp;
      const envelope = unit(state.metrics.playbackEnvelope);
      if (envelope !== undefined) this.output = { receivedMs: now, envelope };
    }

    const finalInteraction = interactionFrom(state, this.interruptSerial);
    this.current = {
      version: 1,
      streamKey: this.streamKey,
      sequence: ++this.sequence,
      receivedMs: now,
      audio: { input: this.input, output: this.output },
      interaction: finalInteraction,
    };
    return this.snapshot(now);
  }

  snapshot(now: number): VisualInputV1 {
    const current = this.current ?? {
      version: 1 as const,
      streamKey: this.streamKey,
      sequence: this.sequence,
      receivedMs: now,
      audio: {},
      interaction: {
        foreground: "idle" as const,
        listening: false,
        speaking: false,
        floor: "none" as const,
        acknowledgement: false,
        userPause: false,
        reasoning: false,
        delegatedWork: false,
        responseReady: false,
        interruptSerial: this.interruptSerial,
        availability: "reconnecting" as const,
      },
    };
    return {
      ...current,
      receivedMs: now,
      audio: { input: ageFeature(this.input, now), output: ageFeature(this.output, now) },
    };
  }
}
