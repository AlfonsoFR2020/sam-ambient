import { expect, test } from "@playwright/test";

test("synthetic workspace tools, focus and quiet loading presentation", async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === "http://127.0.0.1:1436"
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/?transport=browser");
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("sam-protocol-event", {
        detail: {
          protocol: 1,
          type: "system.ready",
          session_id: "browser-test",
          monotonic_ms: 1,
          payload: {
            state: "IDLE",
            startup_lifecycle: "loading_model",
            pending_provider: "synthetic-local",
            pending_model: "Synthetic model",
            provider_catalog: [],
          },
        },
      }),
    );
    window.addEventListener("sam-control-command", (event) => {
      const command = (event as CustomEvent).detail;
      if (command.type !== "control.capability.execute") return;
      const capability = command.payload.capability;
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "capability.state",
            monotonic_ms: 10,
            payload: {
              request_id: command.command_id,
              capability,
              state: "completed",
              result:
                capability === "memory.list"
                  ? { records: [], has_more: false }
                  : { text: "Synthetic file listing · no owner data or filesystem service" },
            },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "control.acknowledged",
            monotonic_ms: 11,
            payload: {
              command_id: command.command_id,
              command_type: command.type,
              status: "applied",
            },
          },
        }),
      );
    });
  });
  const startup = page.getByRole("complementary", { name: "Sam startup" });
  await expect(startup).toBeVisible();
  await expect(startup).toContainText(/loading|preparing/i);
  expect((await startup.boundingBox())?.width).toBeLessThanOrEqual(305);
  await page.screenshot({ path: info.outputPath("ui-loading.png") });
  const consoleButton = page.getByRole("button", { name: "Console", exact: true });
  await consoleButton.click();
  const consolePanel = page.getByRole("region", { name: "Sam Console", exact: true });
  await consolePanel.getByRole("button", { name: "Run action" }).click();
  await expect(consolePanel.getByText("completed", { exact: true })).toBeVisible();
  await expect(consolePanel.locator("pre")).toContainText("Synthetic file listing");
  await page.screenshot({ path: info.outputPath("ui-console.png") });
  await consolePanel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(consoleButton).toBeFocused();
  const memoryButton = page.getByRole("button", { name: "Memory", exact: true });
  await memoryButton.click();
  const memoryPanel = page.getByRole("region", { name: "Sam Memory", exact: true });
  await expect(memoryPanel.getByText("No memories on this page.")).toBeVisible();
  await page.screenshot({ path: info.outputPath("ui-memory.png") });
  await memoryPanel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(memoryButton).toBeFocused();
  await expect(page.getByRole("region", { name: "Sam Console", exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 760 });
  await memoryButton.click();
  const box = await memoryPanel.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath("ui-memory-narrow.png") });
  expect(errors).toEqual([]);
});
