import { describe, expect, it, vi } from "vitest";
import { createNativeShellRuntime } from "../src/native/runtime";

describe("native shell runtime boundary", () => {
  it("exposes only close coordination and uses the fixed trusted command", async () => {
    const dispose = vi.fn();
    const listen = vi.fn(async () => dispose);
    const invoke = vi.fn(async () => undefined);
    const runtime = createNativeShellRuntime({ listen, invoke });
    const closeRequested = vi.fn();

    const unlisten = await runtime.onCloseRequested(closeRequested);
    await runtime.closeAfterShutdown();
    unlisten();

    expect(listen).toHaveBeenCalledWith("sam://native-close-requested", closeRequested);
    expect(invoke).toHaveBeenCalledWith("close_after_shutdown");
    expect(dispose).toHaveBeenCalledOnce();
    expect(Object.keys(runtime).sort()).toEqual(["closeAfterShutdown", "onCloseRequested"]);
  });
});
