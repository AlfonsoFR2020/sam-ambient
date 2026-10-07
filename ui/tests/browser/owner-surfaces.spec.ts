import { expect, test } from "@playwright/test";

test("narrow Controls and committed history have separate scroll regions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?transport=browser");
  await page.evaluate(() => {
    for (let index = 0; index < 20; index++)
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "turn.committed",
            monotonic_ms: index + 1,
            session_id: "surfaces",
            turn_id: `turn-${index}`,
            payload: { role: "user", text: `Owner committed history ${index}` },
          },
        }),
      );
  });
  const history = page.getByRole("region", { name: "Conversation history" });
  await expect(history).toBeVisible();
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const controls = page.getByRole("region", { name: "Sam controls" });
  const historyBox = await history.boundingBox(),
    controlsBox = await controls.boundingBox();
  expect(historyBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  if (!historyBox || !controlsBox) throw new Error("Owner surfaces are not mounted");
  expect(historyBox.y + historyBox.height).toBeLessThanOrEqual(controlsBox.y);
  expect(await history.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  expect(await controls.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
  await history.evaluate((node) => {
    node.scrollTop = 40;
    node.dispatchEvent(new Event("scroll"));
  });
  await controls.evaluate((node) => {
    node.scrollTop = 60;
  });
  expect(await history.evaluate((node) => node.scrollTop)).toBe(40);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(controls).toHaveCount(0);
  await expect(history).toBeVisible();
  expect(await history.evaluate((node) => node.scrollTop)).toBe(40);
});
