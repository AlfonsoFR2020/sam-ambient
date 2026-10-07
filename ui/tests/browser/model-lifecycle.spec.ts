import { expect, test } from "@playwright/test";

test("owner unload and reload show confirmed state and reject stale outcome", async ({ page }) => {
  await page.addInitScript(() => {
    const store = window as Window & { commands?: { command_id: string; type: string }[] };
    store.commands = [];
    window.addEventListener("sam-control-command", (e) =>
      store.commands?.push((e as CustomEvent).detail),
    );
  });
  await page.goto("/?transport=browser");
  const emit = async (type: string, ms: number, payload: Record<string, unknown>) =>
    page.evaluate(
      ({ type, ms, payload }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: { protocol: 1, type, monotonic_ms: ms, session_id: "lifecycle", payload },
          }),
        ),
      { type, ms, payload },
    );
  const catalog = [
    {
      id: "lm-studio",
      running: true,
      models: ["gemma"],
      installed_models: ["gemma"],
      detail: "ready",
    },
  ];
  await emit("system.ready", 1, {
    state: "IDLE",
    provider: "lm-studio",
    model: "gemma",
    model_unload_supported: true,
    provider_catalog: catalog,
  });
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  await page.getByRole("button", { name: "Unload active model" }).click();
  const command = await page.evaluate(() =>
    (window as Window & { commands?: { command_id: string; type: string }[] }).commands?.at(-1),
  );
  expect(command?.type).toBe("control.model.unload");
  await emit("provider.discovery", 2, {
    state: "unloading_model",
    request_id: command?.command_id,
    provider: "lm-studio",
    model: "gemma",
    catalog,
  });
  await expect(page.getByRole("button", { name: "Unload active model" })).toBeDisabled();
  await emit("provider.discovery", 3, {
    state: "unloaded",
    request_id: command?.command_id,
    provider: "lm-studio",
    desired_provider: "lm-studio",
    desired_model: "gemma",
    reason: "Model unloaded. Load the selected model to continue.",
    catalog: [{ ...catalog[0], models: [] }],
  });
  const load = page.getByRole("button", { name: "Load selected model" });
  await expect(load).toBeEnabled();
  await load.click();
  const reload = await page.evaluate(() =>
    (window as Window & { commands?: { command_id: string; type: string }[] }).commands?.at(-1),
  );
  expect(reload?.type).toBe("control.model.select");
  await emit("provider.discovery", 4, {
    state: "loading_model",
    request_id: reload?.command_id,
    provider: "lm-studio",
    model: "gemma",
    catalog,
  });
  await emit("provider.discovery", 5, {
    state: "ready",
    request_id: reload?.command_id,
    provider: "lm-studio",
    model: "gemma",
    catalog,
  });
  await emit("provider.discovery", 6, {
    state: "unloaded",
    request_id: command?.command_id,
    catalog: [],
  });
  await expect(page.getByRole("button", { name: "Unload active model" })).toBeEnabled();
  await expect(page.locator(".ambient-scene canvas")).toHaveCount(1);
});
