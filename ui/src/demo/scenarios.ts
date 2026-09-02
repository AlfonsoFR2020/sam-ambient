import type { ProtocolEvent } from "../protocol/types";
import type {
  ProtocolTransport,
  RuntimeScheduler,
  TransportObserver,
  TransportSession,
} from "../transport/transport";

type EventFields = Partial<
  Pick<ProtocolEvent, "session_id" | "turn_id" | "generation_id" | "cancellation_id">
>;

const event = (
  type: string,
  monotonic_ms: number,
  payload: Record<string, unknown> = {},
  fields: EventFields = {},
): ProtocolEvent => ({ protocol: 1, type, monotonic_ms, payload, session_id: "demo", ...fields });

export interface DemoStep {
  afterMs: number;
  event?: ProtocolEvent;
  disconnect?: true;
}

const firstConnection: DemoStep[] = [
  { afterMs: 0, event: event("system.ready", 0, { state: "IDLE" }) },
  { afterMs: 800, event: event("voice.state_changed", 800, { from: "IDLE", to: "LISTENING" }) },
  {
    afterMs: 1200,
    event: event("voice.level", 1200, { rms: 0.12, peak: 0.22, speech_probability: 0.08 }),
  },
  {
    afterMs: 1700,
    event: event(
      "voice.state_changed",
      1700,
      { from: "LISTENING", to: "USER_SPEAKING" },
      { turn_id: "turn-1" },
    ),
  },
  {
    afterMs: 1900,
    event: event(
      "transcript.partial",
      1900,
      { role: "user", text: "Tell me what" },
      { turn_id: "turn-1" },
    ),
  },
  {
    afterMs: 2300,
    event: event(
      "transcript.partial",
      2300,
      { role: "user", text: "Tell me what you notice" },
      { turn_id: "turn-1" },
    ),
  },
  {
    afterMs: 2700,
    event: event(
      "voice.state_changed",
      2700,
      { from: "USER_SPEAKING", to: "ENDPOINT_CANDIDATE" },
      { turn_id: "turn-1" },
    ),
  },
  {
    afterMs: 3050,
    event: event(
      "transcript.final",
      3050,
      { role: "user", text: "Tell me what you notice." },
      { turn_id: "turn-1" },
    ),
  },
  {
    afterMs: 3100,
    event: event(
      "voice.state_changed",
      3100,
      { from: "ENDPOINT_CANDIDATE", to: "THINKING" },
      { turn_id: "turn-1", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 4200,
    event: event(
      "transcript.partial",
      4200,
      { role: "assistant", text: "The room feels quiet" },
      { turn_id: "turn-1", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 4700,
    event: event(
      "transcript.final",
      4700,
      { role: "assistant", text: "The room feels quiet and focused." },
      { turn_id: "turn-1", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 4750,
    event: event(
      "voice.state_changed",
      4750,
      { from: "THINKING", to: "SPEAKING" },
      { turn_id: "turn-1", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 5000,
    event: event("tts.level", 5000, { envelope: 0.34 }, { generation_id: "gen-1" }),
  },
  {
    afterMs: 5400,
    event: event("tts.level", 5400, { envelope: 0.72 }, { generation_id: "gen-1" }),
  },
  {
    afterMs: 5900,
    event: event(
      "voice.state_changed",
      5900,
      { from: "SPEAKING", to: "INTERRUPTION_CANDIDATE" },
      { turn_id: "turn-2", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 6100,
    event: event(
      "voice.level",
      6100,
      { rms: 0.54, peak: 0.82, speech_probability: 0.91 },
      { turn_id: "turn-2" },
    ),
  },
  {
    afterMs: 6300,
    event: event(
      "tts.cancelled",
      6300,
      { interrupted: true },
      { generation_id: "gen-1", cancellation_id: "cancel-1" },
    ),
  },
  {
    afterMs: 6300,
    event: event(
      "voice.state_changed",
      6300,
      { from: "INTERRUPTION_CANDIDATE", to: "INTERRUPTED" },
      { turn_id: "turn-2", generation_id: "gen-1" },
    ),
  },
  {
    afterMs: 6900,
    event: event(
      "voice.state_changed",
      6900,
      { from: "INTERRUPTED", to: "LISTENING" },
      { turn_id: "turn-2" },
    ),
  },
  {
    afterMs: 7800,
    event: event(
      "voice.state_changed",
      7800,
      { from: "LISTENING", to: "SPEAKING" },
      { generation_id: "gen-2" },
    ),
  },
  {
    afterMs: 8400,
    event: event(
      "voice.state_changed",
      8400,
      { from: "SPEAKING", to: "INTERRUPTION_CANDIDATE" },
      { generation_id: "gen-2" },
    ),
  },
  {
    afterMs: 8650,
    event: event("voice.level", 8650, { rms: 0.08, peak: 0.18, speech_probability: 0.24 }),
  },
  {
    afterMs: 9300,
    event: event(
      "voice.state_changed",
      9300,
      { from: "INTERRUPTION_CANDIDATE", to: "RECOVERING" },
      { generation_id: "gen-2" },
    ),
  },
  {
    afterMs: 9900,
    event: event(
      "voice.state_changed",
      9900,
      { from: "RECOVERING", to: "SPEAKING" },
      { generation_id: "gen-2" },
    ),
  },
  ...Array.from(
    { length: 32 },
    (_, index): DemoStep => ({
      afterMs: 10_500 + index * 5,
      event: event("voice.level", 10_500 + index * 5, {
        rms: (index % 8) / 10,
        peak: (index % 10) / 10,
        speech_probability: (index % 6) / 6,
      }),
    }),
  ),
  { afterMs: 12_000, disconnect: true },
];

const reconnected: DemoStep[] = [
  { afterMs: 0, event: event("system.ready", 13_000, { state: "IDLE", reconnected: true }) },
  { afterMs: 700, event: event("voice.state_changed", 13_700, { from: "IDLE", to: "LISTENING" }) },
];

export const DEMO_SCENARIOS = { firstConnection, reconnected } as const;

export class DemoTransport implements ProtocolTransport {
  readonly name = "deterministic-demo";
  private connectionCount = 0;

  constructor(private readonly scheduler: RuntimeScheduler) {}

  async connect(observer: TransportObserver): Promise<TransportSession> {
    const steps = this.connectionCount++ === 0 ? firstConnection : reconnected;
    const cancel = steps.map((step) =>
      this.scheduler.delay(() => {
        if (step.event) observer.onEvent(step.event);
        if (step.disconnect) observer.onDisconnect("demo disconnect");
      }, step.afterMs),
    );
    return {
      close: () =>
        cancel.forEach((dispose) => {
          dispose();
        }),
    };
  }
}
