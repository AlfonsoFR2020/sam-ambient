import type { ProtocolTransport, TransportObserver, TransportSession } from "./transport";

export type NativeUnlisten = () => void | Promise<void>;

/** Tiny bridge implemented by the future Tauri host; presentation imports no Tauri API. */
export interface NativeEventSource {
  listen(
    topic: "sam://protocol-event",
    listener: (payload: unknown) => void,
  ): Promise<NativeUnlisten>;
  listen(
    topic: "sam://core-disconnected",
    listener: (payload: unknown) => void,
  ): Promise<NativeUnlisten>;
}

export class TauriLocalTransport implements ProtocolTransport {
  readonly name = "tauri-local";

  constructor(private readonly source: NativeEventSource) {}

  async connect(observer: TransportObserver): Promise<TransportSession> {
    const unlistenEvent = await this.source.listen("sam://protocol-event", observer.onEvent);
    const unlistenDisconnect = await this.source.listen("sam://core-disconnected", (reason) =>
      observer.onDisconnect(typeof reason === "string" ? reason : "core disconnected"),
    );
    return {
      close: async () => {
        await unlistenEvent();
        await unlistenDisconnect();
      },
    };
  }
}
