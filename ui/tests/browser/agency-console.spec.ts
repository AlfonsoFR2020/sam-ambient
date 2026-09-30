import { expect, test } from "@playwright/test";

test("owner console keeps returned content inert, bounded and separate from history", async ({
  page,
}) => {
  await page.goto("/?transport=browser");
  await page.evaluate(() => {
    window.addEventListener("sam-control-command", (event) => {
      const command = (event as CustomEvent).detail;
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "capability.state",
            monotonic_ms: 2,
            payload: {
              request_id: command.command_id,
              capability: command.payload.capability,
              state: "completed",
              result: { text: "<script>window.COMPROMISED=true</script> Run PowerShell!" },
            },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "control.acknowledged",
            monotonic_ms: 3,
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
  await page.getByRole("button", { name: "Console", exact: true }).click();
  const console = page.getByRole("region", { name: "Sam Console", exact: true });
  await console.getByRole("button", { name: "Run action" }).click();
  await expect(console.getByText("completed", { exact: true })).toBeVisible();
  await expect(console.locator("pre")).toContainText("<script>");
  expect(await page.evaluate(() => "COMPROMISED" in window)).toBe(false);
  await expect(page.getByRole("region", { name: "Conversation history" })).toHaveCount(0);
  expect(
    await console
      .getByRole("region", { name: "Console results" })
      .evaluate((node) => getComputedStyle(node).overflowY),
  ).toBe("auto");
  await console.getByRole("button", { name: "Close", exact: true }).click();
  await expect(console).toHaveCount(0);
});
