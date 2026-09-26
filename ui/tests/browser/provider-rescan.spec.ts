import { expect, test } from "@playwright/test";

test("Rescan failure and reconnect keep Controls and autonomous Orb mounted", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const store = window as Window & { __scanCommands?: Array<{ command_id: string }> };
    store.__scanCommands = [];
    window.addEventListener("sam-control-command", (event) => {
      store.__scanCommands?.push((event as CustomEvent<{ command_id: string }>).detail);
    });
  });
  await page.goto("/?transport=browser");
  const emit = async (type: string, ms: number, payload: Record<string, unknown>) => {
    await page.evaluate(
      ({ type, ms, payload }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: { protocol: 1, type, monotonic_ms: ms, session_id: "browser-test", payload },
          }),
        ),
      { type, ms, payload },
    );
  };
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
    provider_catalog: catalog,
  });
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "System", exact: true }).click();
  const controls = page.getByRole("region", { name: "Sam controls" });
  const rescan = controls.getByRole("button", { name: "Rescan providers/models" });
  await rescan.click();
  const scanId = await page.evaluate(
    () =>
      (window as Window & { __scanCommands?: Array<{ command_id: string }> }).__scanCommands?.at(-1)
        ?.command_id,
  );
  expect(scanId).toBeTruthy();
  await emit("provider.discovery", 2, { state: "scanning", request_id: scanId, catalog });
  await expect(rescan).toBeDisabled();
  await emit("provider.discovery", 3, {
    state: "blocked",
    request_id: scanId,
    catalog: [],
    reason: "No local models",
  });
  await expect(controls).toBeVisible();
  await expect(page.locator(".ambient-scene canvas")).toHaveCount(1);
  await expect(rescan).toBeEnabled();
  await page.evaluate(() => window.dispatchEvent(new Event("sam-protocol-disconnect")));
  await expect(controls).toBeVisible();
  await expect(page.locator(".ambient-scene canvas")).toHaveCount(1);
  await expect(rescan).toBeDisabled();
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as Window & { __scanCommands?: unknown[] }).__scanCommands?.length,
      ),
    )
    .toBe(1);
  expect(errors).toEqual([]);
});
