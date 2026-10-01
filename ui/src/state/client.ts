import { type AgencyAction, projectAgencyEvent, TERMINAL_ACTION_STATES } from "../agency/state";
import { createControlCommand } from "../protocol/commands";
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
  private readonly commandTimeouts = new Map<string, () => void>();
  private running = false;
  private epoch = 0;
  private agency: readonly AgencyAction[] = [];
  private agencySequence = 0;

  constructor(
    private readonly transport: ProtocolTransport,
    private readonly scheduler: RuntimeScheduler,
    private readonly reconnectDelayMs = 600,
  ) {}

  getSnapshot = (): UiState => this.state;
  getAgencySnapshot = (): readonly AgencyAction[] => this.agency;

  async executeCapability(
    capability: string,
    args: Record<string, unknown>,
  ): Promise<string | undefined> {
    if (this.agency.filter((action) => !TERMINAL_ACTION_STATES.has(action.state)).length >= 4)
      return;
    const command = createControlCommand(
      "control.capability.execute",
      { capability, arguments: args, sequence: ++this.agencySequence },
      {},
    );
    const retained = [...this.agency];
    if (retained.length >= 64) {
      const oldestTerminal = retained.findIndex((action) =>
        TERMINAL_ACTION_STATES.has(action.state),
      );
      if (oldestTerminal >= 0) retained.splice(oldestTerminal, 1);
    }
    this.agency = [...retained, { id: command.command_id, capability, state: "queued" }];
    for (const listener of this.listeners) listener();
    try {
      await this.sendControl(command);
    } catch (error) {
      this.agency = this.agency.map((action) =>
        action.id === command.command_id
          ? {
              ...action,
              state: "failed",
              output: error instanceof Error ? error.message : "Action unavailable",
            }
          : action,
      );
      for (const listener of this.listeners) listener();
    }
    return command.command_id;
  }

  async cancelCapability(requestId: string): Promise<void> {
    try {
      await this.sendControl(
        createControlCommand("control.capability.cancel", { request_id: requestId }, {}),
      );
    } catch {
      this.agency = this.agency.map((action) =>
        action.id === requestId && !TERMINAL_ACTION_STATES.has(action.state)
          ? { ...action, output: "Cancellation could not be sent; reconnect or try again." }
          : action,
      );
      for (const listener of this.listeners) listener();
    }
  }

  private retireAgency(): void {
    this.agency = this.agency.map((action) =>
      TERMINAL_ACTION_STATES.has(action.state)
        ? action
        : { ...action, state: "cancelled", output: "Owner connection retired" },
    );
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async sendControl(command: ControlCommand): Promise<void> {
    if (!this.running || !this.session || this.state.connection !== "connected") {
      throw new Error("Sam core is offline");
    }
    if (this.state.pendingCommandIds.includes(command.command_id))
      throw new Error("Control command is already pending");
    const epoch = this.epoch;
    const discoveryCommand =
      command.type === "control.providers.rescan" || command.type === "control.model.select";
    const priorDiscoveryId = discoveryCommand ? this.state.providerDiscovery.requestId : undefined;
    if (priorDiscoveryId) {
      this.commandTimeouts.get(priorDiscoveryId)?.();
      this.commandTimeouts.delete(priorDiscoveryId);
    }
    this.setState({
      ...this.state,
      pendingCommandIds: [
        ...this.state.pendingCommandIds.filter((id) => id !== priorDiscoveryId),
        command.command_id,
      ],
      protocolError: undefined,
      ...(discoveryCommand
        ? {
            providerDiscovery: { status: "scanning" as const, requestId: command.command_id },
            startupLifecycle: "scanning" as const,
          }
        : {}),
    });
    this.commandTimeouts.set(
      command.command_id,
      this.scheduler.delay(() => {
        this.commandTimeouts.delete(command.command_id);
        if (
          !this.running ||
          epoch !== this.epoch ||
          !this.state.pendingCommandIds.includes(command.command_id)
        )
          return;
        if (command.type === "control.capability.execute") {
          this.agency = this.agency.map((action) =>
            action.id === command.command_id && !TERMINAL_ACTION_STATES.has(action.state)
              ? {
                  ...action,
                  state: "failed",
                  output: "Action admission was not confirmed; cancellation requested.",
                }
              : action,
          );
          void this.cancelCapability(command.command_id);
        }
        this.setState({
          ...this.state,
          pendingCommandIds: this.state.pendingCommandIds.filter((id) => id !== command.command_id),
          protocolError: "Sam did not confirm the control command in time.",
          ...(discoveryCommand
            ? {
                providerDiscovery: {
                  status: "failed" as const,
                  requestId: command.command_id,
                  reason: "The scan did not start in time.",
                },
                startupLifecycle: "blocked" as const,
              }
            : {}),
        });
      }, 30_000),
    );
    try {
      await this.session.send(command);
    } catch (error) {
      this.commandTimeouts.get(command.command_id)?.();
      this.commandTimeouts.delete(command.command_id);
      if (
        !this.running ||
        epoch !== this.epoch ||
        !this.state.pendingCommandIds.includes(command.command_id) ||
        (discoveryCommand && this.state.providerDiscovery.requestId !== command.command_id)
      )
        return;
      const message = error instanceof Error ? error.message : "control command failed";
      this.setState({
        ...this.state,
        pendingCommandIds: this.state.pendingCommandIds.filter(
          (commandId) => commandId !== command.command_id,
        ),
        protocolError: message,
        ...(discoveryCommand
          ? {
              providerDiscovery: {
                status: "failed" as const,
                requestId: command.command_id,
                reason: message,
              },
              startupLifecycle: "blocked" as const,
            }
          : {}),
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
    this.retireAgency();
    this.epoch += 1;
    this.cancelFrame?.();
    this.cancelReconnect?.();
    this.clearCommandTimeouts();
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
        this.setState({ ...withConnection(this.state, "connected"), protocolError: undefined });
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
    this.retireAgency();
    this.clearCommandTimeouts();
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
    if (event.type === "capability.state") {
      this.agency = projectAgencyEvent(this.agency, event);
      const id = event.payload.request_id;
      if (typeof id === "string" && TERMINAL_ACTION_STATES.has(String(event.payload.state))) {
        this.commandTimeouts.get(id)?.();
        this.commandTimeouts.delete(id);
        this.setState({
          ...this.state,
          pendingCommandIds: this.state.pendingCommandIds.filter((pending) => pending !== id),
        });
      } else for (const listener of this.listeners) listener();
      return;
    }
    if (event.type === "control.rejected") {
      const completedAction = this.agency.find((action) => action.id === event.payload.command_id);
      if (completedAction && TERMINAL_ACTION_STATES.has(completedAction.state)) return;
      this.agency = this.agency.map((action) =>
        action.id === event.payload.command_id && !TERMINAL_ACTION_STATES.has(action.state)
          ? {
              ...action,
              state: "denied",
              output: String(event.payload.error ?? "Request rejected").slice(0, 500),
            }
          : action,
      );
    }
    if (!isVisualizationEvent(event.type)) {
      const terminalDiscoveryId =
        event.type === "provider.discovery" &&
        ["ready", "blocked", "failed"].includes(String(event.payload.state)) &&
        typeof event.payload.request_id === "string" &&
        event.payload.request_id === this.state.providerDiscovery.requestId
          ? event.payload.request_id
          : undefined;
      const terminalTurnId =
        ((event.type === "transcript.final" &&
          event.payload.role === "user" &&
          event.payload.candidate !== true) ||
          event.type === "model.cancelled" ||
          event.type === "component.error") &&
        (!event.session_id || !this.state.sessionId || event.session_id === this.state.sessionId) &&
        typeof event.payload.command_id === "string" &&
        this.state.pendingCommandIds.includes(event.payload.command_id)
          ? event.payload.command_id
          : undefined;
      if (event.type === "control.acknowledged" || event.type === "control.rejected") {
        const id = event.payload.command_id;
        if (typeof id === "string") {
          this.commandTimeouts.get(id)?.();
          this.commandTimeouts.delete(id);
        }
      }
      const reduced = reduceProtocolEvent(this.state, event);
      // A superseded turn's event is stale for conversation display, but it
      // still retires the command that submitted that turn.
      const terminalCommandId = terminalDiscoveryId ?? terminalTurnId;
      if (terminalCommandId) {
        this.commandTimeouts.get(terminalCommandId)?.();
        this.commandTimeouts.delete(terminalCommandId);
      }
      this.setState(
        terminalCommandId
          ? {
              ...reduced,
              pendingCommandIds: reduced.pendingCommandIds.filter((id) => id !== terminalCommandId),
            }
          : reduced,
      );
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

  private clearCommandTimeouts(): void {
    for (const cancel of this.commandTimeouts.values()) cancel();
    this.commandTimeouts.clear();
  }

  private setState(state: UiState): void {
    if (state === this.state) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}
