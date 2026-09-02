import { describe, expect, it } from "vitest";
import { ProtocolClient, VisualizationCoalescer } from "../src/state/client";
import type {
  ProtocolTransport,
  RuntimeScheduler,
  TransportObserver,
  TransportSession,
} from "../src/transport/transport";

class ManualScheduler implements RuntimeScheduler {
  frames: Array<() => void> = [];
  delays: Array<() => void> = [];

  frame(callback: () => void): () => void {
    this.frames.push(callback);
    return () => {
      this.frames = this.frames.filter((candidate) => candidate !== callback);
    };
  }

  delay(callback: () => void): () => void {
    this.delays.push(callback);
    return () => {
      this.delays = this.delays.filter((candidate) => candidate !== callback);
    };
  }

  runFrame(): void {
    this.frames.shift()?.();
  }

  runDelay(): void {
    this.delays.shift()?.();
  }
}

class ControlledTransport implements ProtocolTransport {
  readonly name = "controlled";
  observers: TransportObserver[] = [];
  sent: unknown[] = [];

  async connect(observer: TransportObserver): Promise<TransportSession> {
    this.observers.push(observer);
    return {
      send: (message) => {
        this.sent.push(message);
      },
      close() {},
    };
  }
}

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("protocol client", () => {
  it("coalesces a high-frequency visualization burst to the newest frame", () => {
    const coalescer = new VisualizationCoalescer();
    for (let index = 0; index < 100; index += 1) {
      coalescer.push({
        protocol: 1,
        type: "voice.level",
        monotonic_ms: index,
        payload: { rms: index / 100 },
      });
    }
    const [latest] = coalescer.flush();
    expect(latest?.monotonic_ms).toBe(99);
    expect(coalescer.dropped).toBe(99);
  });

  it("goes offline and reconnects without accepting callbacks from the old connection", async () => {
    const transport = new ControlledTransport();
    const scheduler = new ManualScheduler();
    const client = new ProtocolClient(transport, scheduler, 5);
    client.start();
    await flushPromises();
    expect(transport.observers).toHaveLength(1);
    expect(client.getSnapshot().connection).toBe("connected");

    transport.observers[0]?.onDisconnect("test");
    expect(client.getSnapshot().conversationalState).toBe("OFFLINE");
    scheduler.runDelay();
    await flushPromises();
    expect(transport.observers).toHaveLength(2);

    transport.observers[0]?.onEvent({
      protocol: 1,
      type: "voice.state_changed",
      monotonic_ms: 99,
      payload: { to: "ERROR" },
    });
    expect(client.getSnapshot().conversationalState).toBe("OFFLINE");
    transport.observers[1]?.onEvent({
      protocol: 1,
      type: "system.ready",
      monotonic_ms: 100,
      payload: { state: "IDLE" },
    });
    expect(client.getSnapshot().conversationalState).toBe("IDLE");
    client.stop();
  });

  it("flushes only the latest metric value on the next visual frame", async () => {
    const transport = new ControlledTransport();
    const scheduler = new ManualScheduler();
    const client = new ProtocolClient(transport, scheduler);
    client.start();
    await flushPromises();
    for (let index = 1; index <= 20; index += 1) {
      transport.observers[0]?.onEvent({
        protocol: 1,
        type: "voice.level",
        monotonic_ms: index,
        payload: { rms: index / 20, peak: 0.5, speech_probability: 0.2 },
      });
    }
    expect(scheduler.frames).toHaveLength(1);
    scheduler.runFrame();
    expect(client.getSnapshot().metrics.rms).toBe(1);
    expect(client.getSnapshot().droppedVisualizationEvents).toBe(19);
    client.stop();
  });

  it("sends emergency control through the active session and clears it on acknowledgement", async () => {
    const transport = new ControlledTransport();
    const scheduler = new ManualScheduler();
    const client = new ProtocolClient(transport, scheduler);
    client.start();
    await flushPromises();
    await client.sendControl({
      protocol: 1,
      type: "control.emergency_stop",
      command_id: "emergency",
      monotonic_ms: 10,
      payload: { targets: ["model_generation", "tts_queue", "playback"] },
    });
    expect(transport.sent).toHaveLength(1);
    expect(client.getSnapshot().pendingCommandIds).toEqual(["emergency"]);
    transport.observers[0]?.onEvent({
      protocol: 1,
      type: "control.acknowledged",
      monotonic_ms: 11,
      payload: { command_id: "emergency", status: "applied" },
    });
    expect(client.getSnapshot().pendingCommandIds).toHaveLength(0);
    client.stop();
  });
});
