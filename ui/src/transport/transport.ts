export interface TransportObserver {
  onEvent(raw: unknown): void;
  onDisconnect(reason?: string): void;
}

export interface TransportSession {
  close(): void | Promise<void>;
}

export interface ProtocolTransport {
  readonly name: string;
  connect(observer: TransportObserver): Promise<TransportSession>;
}

export interface RuntimeScheduler {
  frame(callback: () => void): () => void;
  delay(callback: () => void, milliseconds: number): () => void;
}

export const browserScheduler: RuntimeScheduler = {
  frame(callback) {
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  },
  delay(callback, milliseconds) {
    const id = window.setTimeout(callback, milliseconds);
    return () => window.clearTimeout(id);
  },
};
