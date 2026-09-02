import type { ProtocolTransport, TransportObserver, TransportSession } from "./transport";

export const BROWSER_PROTOCOL_EVENT = "sam-protocol-event";
export const BROWSER_DISCONNECT_EVENT = "sam-protocol-disconnect";
export const BROWSER_CONTROL_EVENT = "sam-control-command";

/** Browser/dev seam for harnesses that dispatch protocol messages as CustomEvents. */
export class BrowserEventTransport implements ProtocolTransport {
  readonly name = "browser-event";

  async connect(observer: TransportObserver): Promise<TransportSession> {
    const onEvent = (event: Event) => observer.onEvent((event as CustomEvent<unknown>).detail);
    const onDisconnect = () => observer.onDisconnect("browser event source disconnected");
    window.addEventListener(BROWSER_PROTOCOL_EVENT, onEvent);
    window.addEventListener(BROWSER_DISCONNECT_EVENT, onDisconnect);
    return {
      send: (message) => {
        window.dispatchEvent(new CustomEvent(BROWSER_CONTROL_EVENT, { detail: message }));
      },
      close: () => {
        window.removeEventListener(BROWSER_PROTOCOL_EVENT, onEvent);
        window.removeEventListener(BROWSER_DISCONNECT_EVENT, onDisconnect);
      },
    };
  }
}
