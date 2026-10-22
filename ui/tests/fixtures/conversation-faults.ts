/** In-memory protocol and virtual time only; no app, browser or service process. */
import type { ControlCommand, ProtocolEvent } from "../../src/protocol/types";
import { ProtocolClient } from "../../src/state/client";
import type {
  ProtocolTransport,
  RuntimeScheduler,
  TransportObserver,
} from "../../src/transport/transport";

export class FaultClock implements RuntimeScheduler {
  now = 0;
  private jobs: { at: number; run: () => void }[] = [];
  frame(run: () => void): () => void {
    return this.delay(run, 16);
  }
  delay(run: () => void, ms: number): () => void {
    const job = { at: this.now + ms, run };
    this.jobs.push(job);
    return () => {
      this.jobs = this.jobs.filter((item) => item !== job);
    };
  }
  advance(ms: number): void {
    const end = this.now + ms;
    let count = 0;
    while (true) {
      this.jobs.sort((a, b) => a.at - b.at);
      if (!this.jobs.length || this.jobs[0].at > end) break;
      if (++count > 100) throw new Error("Unbounded fixture scheduling");
      const job = this.jobs.shift();
      if (!job) break;
      this.now = job.at;
      job.run();
    }
    this.now = end;
  }
}

export class FaultTransport implements ProtocolTransport {
  readonly name = "conversation-fault";
  readonly observers: TransportObserver[] = [];
  readonly sent: ControlCommand[] = [];
  async connect(observer: TransportObserver) {
    this.observers.push(observer);
    return {
      send: (command: ControlCommand) => {
        this.sent.push(command);
      },
      close() {},
    };
  }
  emit(
    type: string,
    ms: number,
    payload: Record<string, unknown> = {},
    ids: Partial<ProtocolEvent> = {},
  ): void {
    this.observers
      .at(-1)
      ?.onEvent({ protocol: 1, type, monotonic_ms: ms, session_id: "session", payload, ...ids });
  }
}

export const typedCommand = (id: string): ControlCommand => ({
  protocol: 1,
  type: "control.user_message.submit",
  command_id: id,
  monotonic_ms: 1,
  session_id: "session",
  payload: { text: `Synthetic ${id}` },
});

export async function faultClient() {
  const transport = new FaultTransport(),
    clock = new FaultClock();
  const client = new ProtocolClient(transport, clock);
  client.start();
  await Promise.resolve();
  await Promise.resolve();
  transport.emit("system.ready", 0, { state: "IDLE", provider: "local", model: "exact-model" });
  return { client, transport, clock };
}
