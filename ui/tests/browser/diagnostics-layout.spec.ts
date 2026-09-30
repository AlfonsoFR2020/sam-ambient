import { expect, test } from "@playwright/test";

const emit = async (
  page: import("@playwright/test").Page,
  type: string,
  at: number,
  payload: object,
) => {
  await page.evaluate(
    ({ type, at, payload }) =>
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type,
            monotonic_ms: at,
            session_id: "diagnostics-layout",
            ...(type === "turn.committed" ? { turn_id: `turn-${at}` } : {}),
            payload,
          },
        }),
      ),
    { type, at, payload },
  );
};

async function openDiagnostics(page: import("@playwright/test").Page) {
  const startupDismiss = page.getByRole("button", { name: "Dismiss startup information" });
  if (await startupDismiss.isVisible()) await startupDismiss.click();
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByRole("button", { name: "Open status & diagnostics" }).click();
  return page.getByRole("complementary", { name: "Sam status and diagnostics" });
}

test("wide diagnostics and history occupy separate independently scrolling regions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?transport=browser");
  for (let index = 0; index < 32; index++)
    await emit(page, "turn.committed", index + 1, {
      role: "user",
      text: `Conversation item ${index} with enough text to occupy its own line`,
    });
  const history = page.getByRole("region", { name: "Conversation history" });
  await expect(history).toContainText("Conversation item 31");
  const diagnostics = await openDiagnostics(page);
  await expect(diagnostics).toBeVisible();
  const historyBox = await history.boundingBox();
  const diagnosticsBox = await diagnostics.boundingBox();
  expect(historyBox && diagnosticsBox).toBeTruthy();
  expect((historyBox?.x ?? 0) + (historyBox?.width ?? 0)).toBeLessThan(diagnosticsBox?.x ?? 0);

  const sectionNames = await diagnostics.locator("h2, details > summary").allTextContents();
  expect(sectionNames).toEqual([
    "Current health & state",
    "Conversation & inference",
    "Voice & audio",
    "Renderer & motion",
    expect.stringMatching(/^Recent events/),
  ]);
  await expect(diagnostics.getByText("Core connection")).toBeVisible();
  await expect(diagnostics.getByText("Speech recognition", { exact: true }).first()).toBeVisible();
  await emit(page, "component.health", 50, {
    component: "stt",
    state: "degraded",
    reason: "Synthetic STT unavailable",
  });
  await expect(diagnostics.getByRole("alert")).toContainText("Synthetic STT unavailable");
  await expect(
    diagnostics.locator("dd[data-degraded]").filter({ hasText: "degraded" }),
  ).toBeVisible();

  await diagnostics.getByText("Renderer & motion").click();
  await diagnostics.getByText(/^Recent events/).click();
  const historyBefore = await history.evaluate((node) => node.scrollTop);
  await diagnostics.evaluate((node) => {
    node.scrollTop = 200;
  });
  await expect.poll(() => diagnostics.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await history.evaluate((node) => node.scrollTop)).toBe(historyBefore);
  const diagnosticsBefore = await diagnostics.evaluate((node) => node.scrollTop);
  await history.evaluate((node) => {
    node.scrollTop = 0;
  });
  expect(await diagnostics.evaluate((node) => node.scrollTop)).toBe(diagnosticsBefore);
  const events = diagnostics.getByRole("log");
  await expect(events).toBeVisible();
  expect(await events.evaluate((node) => getComputedStyle(node).overflowY)).toBe("auto");
  await diagnostics.getByRole("button", { name: "Close diagnostics" }).click();
  await expect(diagnostics).toHaveCount(0);
  const restored = await history.boundingBox();
  expect(restored?.x).toBeGreaterThan(700);
});

test("narrow diagnostics remains bounded and Controls can replace it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/?transport=browser");
  const diagnostics = await openDiagnostics(page);
  const box = await diagnostics.boundingBox();
  expect(box).not.toBeNull();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(700);
  await page.getByRole("button", { name: "Controls" }).click();
  await expect(diagnostics).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sam controls" })).toBeVisible();
});
