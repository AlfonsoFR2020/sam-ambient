import { expect, test } from "@playwright/test";

test("cold inventory retry remains mounted, allows Rescan and confirms only the latest route", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.addEventListener("sam-control-command", (event) => {
      (window as Window & { __coldCommand?: { command_id: string } }).__coldCommand = (
        event as CustomEvent<{ command_id: string }>
      ).detail;
    });
  });
  await page.goto("/?transport=browser");
  const emit = (type: string, ms: number, payload: Record<string, unknown>) =>
    page.evaluate(
      ({ type, ms, payload }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: { protocol: 1, type, monotonic_ms: ms, session_id: "browser-test", payload },
          }),
        ),
      { type, ms, payload },
    );
  const waiting = [
    {
      id: "lm-studio",
      running: true,
      models: [],
      installed_models: [],
      inventory_status: "timeout",
      inventory_retryable: true,
      detail: "inventory temporarily unavailable",
    },
  ];
  await emit("system.ready", 1, {
    state: "IDLE",
    provider_catalog: waiting,
    pending_provider: "lm-studio",
    pending_model: "gemma",
    model_unavailable_reason: "inventory temporarily unavailable",
  });
  await emit("provider.discovery", 2, {
    state: "scanning",
    catalog: waiting,
    provider: "lm-studio",
    model: "gemma",
    reason: "LM Studio is running; waiting for its model inventory",
    retry_attempt: 1,
  });
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  const controls = page.getByRole("region", { name: "Sam controls" });
  const status = controls.locator(".runtime-status");
  await status.locator("summary").click();
  await expect(status).toContainText("Sam is waiting for its model inventory");
  await expect(status).not.toContainText("lm-studio · gemma");
  await expect(page.locator(".ambient-scene canvas")).toHaveCount(1);
  const rescan = controls.getByRole("button", { name: "Rescan providers/models" });
  await expect(rescan).toBeEnabled();
  await expect(controls.getByRole("button", { name: "Quit Sam", exact: true })).toBeEnabled();
  await rescan.click();
  const requestId = await page.evaluate(
    () => (window as Window & { __coldCommand?: { command_id: string } }).__coldCommand?.command_id,
  );
  expect(requestId).toBeTruthy();
  await emit("provider.discovery", 3, {
    state: "ready",
    request_id: "old",
    catalog: [],
    provider: "lm-studio",
    model: "wrong",
  });
  await expect(status).not.toContainText("wrong");
  const catalog = [
    {
      id: "lm-studio",
      running: true,
      models: [],
      installed_models: ["gemma"],
      detail: "installed",
    },
  ];
  await emit("provider.discovery", 4, {
    state: "loading_model",
    request_id: requestId,
    catalog,
    provider: "lm-studio",
    model: "gemma",
  });
  await expect(status).not.toContainText("lm-studio · gemma");
  await emit("provider.discovery", 5, {
    state: "ready",
    request_id: requestId,
    catalog: [{ ...catalog[0], models: ["gemma"] }],
    provider: "lm-studio",
    model: "gemma",
  });
  await expect(status.locator("summary")).toContainText("lm-studio · gemma");
  await expect(rescan).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event("sam-protocol-disconnect")));
  await expect(status.locator("summary")).toContainText("last known");
  await expect(rescan).toBeDisabled();
  await expect(page.locator(".ambient-scene canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});
