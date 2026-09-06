import { decodeProtocolEvent, ProtocolDecodeError } from "../protocol/decode";
import {
  type ControlCommand,
  INITIAL_UI_STATE,
  isVisualizationEvent,
  type ProtocolEvent,
  type UiState,
} from "../protocol/types";
import type { ProtocolTransport, RuntimeScheduler, TransportSession } from "../transport/transport";
import { reduceProtocolEvent, withConnection } from "./reducer";

type Listener = () => void;

export class VisualizationCoalescer {
  private readonly pending = new Map<string, ProtocolEvent>();
  dropped = 0;

  push(event: ProtocolEvent): void {
    const prior = this.pending.get(event.type);
    if (prior) {
      this.dropped += 1;
      if (event.monotonic_ms <= prior.monotonic_ms) return;
    }
    this.pending.set(event.type, event);
  }

  flush(): ProtocolEvent[] {
    const events = [...this.pending.values()].sort(
      (left, right) => left.monotonic_ms - right.monotonic_ms,
    );
    this.pending.clear();
    return events;
  }
}

export class ProtocolClient {
  private state: UiState = INITIAL_UI_STATE;
  private readonly listeners = new Set<Listener>();
  private readonly coalescer = new VisualizationCoalescer();
  private session?: TransportSession;
  private cancelFrame?: () => void;
  private cancelReconnect?: () => void;
  private running = false;
  private epoch = 0;

  constructor(
    private readonly transport: ProtocolTransport,
    private readonly scheduler: RuntimeScheduler,
    private readonly reconnectDelayMs = 600,
  ) {}

  getSnapshot = (): UiState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async sendControl(command: ControlCommand): Promise<void> {
    if (!this.running || !this.session || this.state.connection !== "connected") {
      throw new Error("Sam core is offline");
    }
    this.setState({
      ...this.state,
      pendingCommandIds: [...this.state.pendingCommandIds, command.command_id],
      protocolError: undefined,
    });
    try {
      await this.session.send(command);
    } catch (error) {
      const message = error instanceof Error ? error.message : "control command failed";
      this.setState({
        ...this.state,
        pendingCommandIds: this.state.pendingCommandIds.filter(
          (commandId) => commandId !== command.command_id,
        ),
        protocolError: message,
      });
      throw error;
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.epoch += 1;
    this.cancelFrame?.();
    this.cancelReconnect?.();
    this.cancelFrame = undefined;
    this.cancelReconnect = undefined;
    void this.session?.close();
    this.session = undefined;
    this.setState(withConnection(this.state, "offline"));
  }

  private connect(): void {
    if (!this.running) return;
    const epoch = ++this.epoch;
    this.setState(withConnection(this.state, "connecting"));
    void this.transport
      .connect({
        onEvent: (raw) => {
          if (this.running && epoch === this.epoch) this.receive(raw);
        },
        onDisconnect: () => {
          if (this.running && epoch === this.epoch) this.disconnect(epoch);
        },
      })
      .then((session) => {
        if (!this.running || epoch !== this.epoch) {
          void session.close();
          return;
        }
        this.session = session;
        this.setState(withConnection(this.state, "connected"));
      })
      .catch((error: unknown) => {
        if (!this.running || epoch !== this.epoch) return;
        const message = error instanceof Error ? error.message : "transport connection failed";
        this.setState({ ...withConnection(this.state, "offline"), protocolError: message });
        this.scheduleReconnect();
      });
  }

  private disconnect(epoch: number): void {
    if (epoch !== this.epoch) return;
    this.epoch += 1;
    void this.session?.close();
    this.session = undefined;
    this.setState(withConnection(this.state, "offline"));
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.cancelReconnect?.();
    this.cancelReconnect = this.scheduler.delay(() => {
      this.cancelReconnect = undefined;
      this.connect();
    }, this.reconnectDelayMs);
  }

  private receive(raw: unknown): void {
    let event: ProtocolEvent;
    try {
      event = decodeProtocolEvent(raw);
    } catch (error) {
      const message =
        error instanceof ProtocolDecodeError ? error.message : "invalid protocol event";
      this.setState({ ...this.state, protocolError: message });
      return;
    }
    if (!isVisualizationEvent(event.type)) {
      this.setState(reduceProtocolEvent(this.state, event));
      if (this.state.applicationStopped) this.stop();
      return;
    }
    this.coalescer.push(event);
    if (!this.cancelFrame) {
      this.cancelFrame = this.scheduler.frame(() => {
        this.cancelFrame = undefined;
        let state = this.state;
        for (const pending of this.coalescer.flush()) state = reduceProtocolEvent(state, pending);
        this.setState({ ...state, droppedVisualizationEvents: this.coalescer.dropped });
      });
    }
  }

  private setState(state: UiState): void {
    if (state === this.state) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
