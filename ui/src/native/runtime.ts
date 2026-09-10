import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface NativeShellRuntime {
  onCloseRequested(listener: () => void): Promise<UnlistenFn>;
  closeAfterShutdown(): Promise<void>;
}

interface NativeApi {
  listen(event: string, listener: () => void): Promise<UnlistenFn>;
  invoke(command: string): Promise<unknown>;
}

const tauriApi: NativeApi = {
  listen: (event, listener) => listen(event, listener),
  invoke: (command) => invoke(command),
};

export const isNativeShell = (): boolean => "__TAURI_INTERNALS__" in window;

export const createNativeShellRuntime = (api: NativeApi = tauriApi): NativeShellRuntime => ({
  onCloseRequested: (listener) => api.listen("sam://native-close-requested", listener),
  closeAfterShutdown: async () => {
    await api.invoke("close_after_shutdown");
  },
});

export const nativeShellRuntime = createNativeShellRuntime();
