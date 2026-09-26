import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StartupCard } from "../src/App";
import type { ControlCommand, UiState } from "../src/protocol/types";
import { ProtocolClient } from "../src/state/client";
import type {
  ProtocolTransport,
  RuntimeScheduler,
  TransportObserver,
  TransportSession,
} from "../src/transport/transport";

class Scheduler implements RuntimeScheduler {
  delays: Array<() => void> = [];
  frame(): () => void {
    return () => undefined;
  }
  delay(callback: () => void): () => void {
    this.delays.push(callback);
    return () => {
      this.delays = this.delays.filter((item) => item !== callback);
    };
  }
  runDelay(): void {
    this.delays.shift()?.();
  }
}

class Transport implements ProtocolTransport {
  readonly name = "controlled";
  observers: TransportObserver[] = [];
  sent: unknown[] = [];
  async connect(observer: TransportObserver): Promise<TransportSession> {
    this.observers.push(observer);
    return {
      send: (command) => {
        this.sent.push(command);
      },
      close: () => undefined,
    };
  }
  emit(
    type: string,
    ms: number,
    payload: Record<string, unknown>,
    connection = this.observers.length - 1,
  ): void {
    this.observers[connection]?.onEvent({
      protocol: 1,
      type,
      monotonic_ms: ms,
      session_id: "session",
      payload,
    });
  }
}

class DelayedSendTransport extends Transport {
  rejectSend?: (error: Error) => void;
  override async connect(observer: TransportObserver): Promise<TransportSession> {
    const session = await super.connect(observer);
    return {
      ...session,
      send: () =>
        new Promise<void>((_resolve, reject) => {
          this.rejectSend = reject;
        }),
    };
  }
}

const catalog = (id = "lm-studio", models = ["gemma"]) => [
  { id, running: true, models, installed_models: models, detail: "ready" },
];
const command = (
  id: string,
  type: ControlCommand["type"] = "control.providers.rescan",
): ControlCommand => ({
  protocol: 1,
  type,
  command_id: id,
  monotonic_ms: 100,
  payload: {},
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

async function harness() {
  const transport = new Transport();
  const scheduler = new Scheduler();
  const client = new ProtocolClient(transport, scheduler, 5);
  client.start();
  await flush();
  transport.emit("system.ready", 1, {
    state: "IDLE",
    provider: "lm-studio",
    model: "gemma",
    provider_catalog: catalog(),
  });
  return { client, transport, scheduler };
}

function mounted(state: UiState): string {
  return renderToStaticMarkup(createElement(StartupCard, { state }));
}

describe("provider discovery lifecycle", () => {
  it("keeps a successful scan and the startup UI mounted", async () => {
    const { client, transport } = await harness();
    await client.sendControl(command("scan-1"));
    expect(client.getSnapshot().providerDiscovery).toMatchObject({
      status: "scanning",
      requestId: "scan-1",
    });
    transport.emit("provider.discovery", 2, {
      state: "scanning",
      request_id: "scan-1",
      catalog: catalog(),
    });
    transport.emit("provider.discovery", 3, {
      state: "ready",
      request_id: "scan-1",
      catalog: catalog(),
      provider: "lm-studio",
      model: "gemma",
    });
    expect(client.getSnapshot().providerDiscovery.status).toBe("available");
    expect(mounted(client.getSnapshot())).toContain("Sam startup");
    client.stop();
  });

  it("accepts an empty catalog and zero-model provider without resurrecting prior selection", async () => {
    const { client, transport } = await harness();
    await client.sendControl(command("empty"));
    transport.emit("provider.discovery", 2, {
      state: "blocked",
      request_id: "empty",
      catalog: [],
      reason: "No providers",
    });
    expect(client.getSnapshot()).toMatchObject({
      provider: undefined,
      model: undefined,
      providerCatalog: [],
      providerDiscovery: { status: "empty" },
    });
    expect(mounted(client.getSnapshot())).toContain("Rescan");
    await client.sendControl(command("zero"));
    transport.emit("provider.discovery", 3, {
      state: "blocked",
      request_id: "zero",
      catalog: catalog("ollama", []),
      reason: "No models",
    });
    expect(client.getSnapshot().providerCatalog[0]?.models).toEqual([]);
    expect(client.getSnapshot().providerDiscovery.status).toBe("empty");
    expect(mounted(client.getSnapshot())).toContain("ollama");
    client.stop();
  });

  it("rejects a late older scan after rapid rescans and preserves the newer provider", async () => {
    const { client, transport } = await harness();
    await client.sendControl(command("A"));
    await client.sendControl(command("B"));
    transport.emit("provider.discovery", 2, {
      state: "ready",
      request_id: "B",
      catalog: catalog("ollama", ["new"]),
      provider: "ollama",
      model: "new",
    });
    const current = client.getSnapshot();
    transport.emit("provider.discovery", 3, {
      state: "blocked",
      request_id: "A",
      catalog: [],
      reason: "old scan",
    });
    expect(client.getSnapshot()).toBe(current);
    expect(client.getSnapshot()).toMatchObject({ provider: "ollama", model: "new" });
    expect(client.getSnapshot().pendingCommandIds).toEqual([]);
    client.stop();
  });

  it("disconnects during a scan and ignores callbacks from the old connection", async () => {
    const { client, transport, scheduler } = await harness();
    await client.sendControl(command("A"));
    transport.observers[0]?.onDisconnect("closed");
    expect(client.getSnapshot().providerDiscovery.status).toBe("stale");
    scheduler.runDelay();
    await flush();
    transport.emit("system.ready", 4, {
      state: "IDLE",
      provider_catalog: catalog("ollama", []),
      model: null,
    });
    const current = client.getSnapshot();
    transport.emit(
      "provider.discovery",
      5,
      { state: "ready", request_id: "A", catalog: catalog(), provider: "lm-studio", model: "old" },
      0,
    );
    expect(client.getSnapshot()).toBe(current);
    expect(client.getSnapshot().model).toBeUndefined();
    client.stop();
  });

  it("adopts a core-reported scan still pending after reconnect", async () => {
    const { client, transport, scheduler } = await harness();
    await client.sendControl(command("ongoing"));
    transport.observers[0]?.onDisconnect("network pause");
    scheduler.runDelay();
    await flush();
    transport.emit("system.ready", 2, {
      state: "IDLE",
      provider_catalog: catalog(),
      provider_scan_active: true,
      pending_provider_request_id: "ongoing",
    });
    expect(client.getSnapshot().providerDiscovery).toMatchObject({
      status: "scanning",
      requestId: "ongoing",
    });
    transport.emit("provider.discovery", 3, {
      state: "ready",
      request_id: "ongoing",
      catalog: catalog(),
      provider: "lm-studio",
      model: "gemma",
    });
    expect(client.getSnapshot()).toMatchObject({ provider: "lm-studio", model: "gemma" });
    client.stop();
  });

  it("records a failed scan and permits a successful retry", async () => {
    const { client, transport, scheduler } = await harness();
    await client.sendControl(command("failed"));
    transport.emit("provider.discovery", 2, {
      state: "failed",
      request_id: "failed",
      catalog: catalog(),
      reason: "Probe failed",
    });
    expect(client.getSnapshot()).toMatchObject({
      model: undefined,
      providerDiscovery: { status: "failed" },
    });
    transport.observers[0]?.onDisconnect("closed after failed scan");
    scheduler.runDelay();
    await flush();
    transport.emit("system.ready", 3, { state: "IDLE", provider_catalog: catalog(), model: null });
    await client.sendControl(command("retry"));
    transport.emit("provider.discovery", 4, {
      state: "ready",
      request_id: "retry",
      catalog: catalog(),
      provider: "lm-studio",
      model: "gemma",
    });
    expect(client.getSnapshot()).toMatchObject({
      model: "gemma",
      providerDiscovery: { status: "available" },
    });
    client.stop();
  });

  it("invalidates a disappearing model and provider without selecting a replacement", async () => {
    const { client, transport } = await harness();
    await client.sendControl(command("model-gone"));
    transport.emit("provider.discovery", 2, {
      state: "blocked",
      request_id: "model-gone",
      catalog: catalog("lm-studio", ["qwen"]),
      reason: "Selected model disappeared",
    });
    expect(client.getSnapshot()).toMatchObject({ provider: undefined, model: undefined });
    expect(client.getSnapshot().providerCatalog[0]?.models).toEqual(["qwen"]);
    await client.sendControl(command("provider-gone"));
    transport.emit("provider.discovery", 3, {
      state: "blocked",
      request_id: "provider-gone",
      catalog: catalog("ollama", ["llama"]),
      reason: "Selected provider disappeared",
    });
    expect(client.getSnapshot()).toMatchObject({ provider: undefined, model: undefined });
    expect(client.getSnapshot().providerCatalog[0]?.id).toBe("ollama");
    client.stop();
  });

  it("times out an unacknowledged command and ignores a superseded rejection", async () => {
    const { client, transport, scheduler } = await harness();
    await client.sendControl(command("A"));
    scheduler.runDelay();
    expect(client.getSnapshot()).toMatchObject({
      pendingCommandIds: [],
      providerDiscovery: { status: "failed", requestId: "A" },
    });
    await client.sendControl(command("B"));
    transport.emit("control.rejected", 2, {
      command_id: "A",
      command_type: "control.providers.rescan",
      error: "old failure",
    });
    expect(client.getSnapshot().providerDiscovery).toMatchObject({
      status: "scanning",
      requestId: "B",
    });
    transport.emit("provider.discovery", 3, {
      state: "ready",
      request_id: "B",
      catalog: catalog(),
      provider: "lm-studio",
      model: "gemma",
    });
    expect(client.getSnapshot().pendingCommandIds).toEqual([]);
    client.stop();
  });

  it("does not surface a delayed send failure from a disconnected session", async () => {
    const transport = new DelayedSendTransport();
    const scheduler = new Scheduler();
    const client = new ProtocolClient(transport, scheduler, 5);
    client.start();
    await flush();
    transport.emit("system.ready", 1, { state: "IDLE", provider_catalog: catalog() });
    const send = client.sendControl(command("old-send"));
    transport.observers[0]?.onDisconnect("closed");
    scheduler.runDelay();
    await flush();
    transport.emit("system.ready", 2, { state: "IDLE", provider_catalog: catalog() });
    transport.rejectSend?.(new Error("old connection rejected send"));
    await expect(send).resolves.toBeUndefined();
    expect(client.getSnapshot().protocolError).toBeUndefined();
    client.stop();
  });

  it("treats a rejected or malformed scan result as recoverable state", async () => {
    const { client, transport } = await harness();
    await client.sendControl(command("bad"));
    transport.emit("provider.discovery", 2, {
      state: "ready",
      request_id: "bad",
      catalog: "wrong",
    });
    expect(client.getSnapshot().providerDiscovery.status).toBe("failed");
    expect(mounted(client.getSnapshot())).toContain("Sam startup");
    transport.emit("control.rejected", 3, {
      command_id: "bad",
      command_type: "control.providers.rescan",
      error: "Rejected",
    });
    expect(client.getSnapshot().providerDiscovery.status).toBe("failed");
    client.stop();
  });
});
