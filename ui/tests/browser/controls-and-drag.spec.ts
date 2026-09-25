import { expect, type Page, test } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/?transport=demo");
  await page.getByRole("button", { name: "Continue in available mode" }).click();
}

async function dragSlider(page: Page, name: string) {
  const slider = page.getByRole("slider", { name });
  const box = await slider.boundingBox();
  if (!box) throw new Error(`${name} is not visible`);
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, y, { steps: 6 });
  await page.mouse.up();
}

async function openDiagnostics(page: Page) {
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await page.getByRole("button", { name: "Open status & diagnostics" }).click();
  await expect(
    page.getByRole("complementary", { name: "Sam status and diagnostics" }),
  ).toBeVisible();
}

const pitch = async (page: Page) => {
  const text = await page.getByTestId("orientation-q").textContent();
  return Number(text?.split("/")[0]);
};

test("startup has one status explanation and reports observed facts", async ({ page }) => {
  await page.goto("/?transport=demo");
  const card = page.getByRole("complementary", { name: "Sam startup" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Local service")).toBeVisible();
  await expect(card.getByText("Model", { exact: true })).toBeVisible();
  await expect(card.getByRole("listitem")).toHaveCount(0);
  await expect(page.locator(".status-notice")).toHaveCount(0);
  await expect(page.locator(".protocol-error")).toHaveCount(0);
});

test("fullscreen microphone and output sliders keep the interface and record control events", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openDemo(page);
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("button", { name: "Toggle fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole("button", { name: "Conversation" }).click();
  await dragSlider(page, "Microphone sensitivity");
  await dragSlider(page, "Output volume");
  const inputGain =
    Number(await page.getByRole("slider", { name: "Microphone sensitivity" }).inputValue()) / 100;
  const outputGain =
    Number(await page.getByRole("slider", { name: "Output volume" }).inputValue()) / 100;
  expect(inputGain).toBeGreaterThan(1);
  expect(outputGain).toBeGreaterThan(1);
  await expect(page.getByRole("region", { name: "Sam controls" })).toBeVisible();
  await openDiagnostics(page);
  await expect(page.getByRole("log")).toContainText(
    `control audio gain in/out ${inputGain} / ${outputGain}`,
  );
  await expect(page.getByRole("log")).not.toContainText("NaN");
  expect(errors).toEqual([]);
});

test("physical upward and downward gestures map to the visible Orb's vertical pitch", async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("slider", { name: "Motion speed" }).press("Home");
  await openDiagnostics(page);
  const interaction = page.locator(".ambient-scene__interaction");
  await expect(interaction).toBeVisible();
  const box = await interaction.boundingBox();
  if (!box) throw new Error("Orb pointer surface is not visible");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y + 45);
  await page.mouse.down();
  await page.mouse.move(x, y - 45, { steps: 8 });
  await expect.poll(() => pitch(page)).toBeLessThan(-0.05);
  await page.mouse.up();
  const afterUp = await pitch(page);
  await page.mouse.move(x, y - 45);
  await page.mouse.down();
  await page.mouse.move(x, y + 45, { steps: 8 });
  await expect.poll(() => pitch(page)).toBeGreaterThan(afterUp + 0.05);
  await page.mouse.up();
});

test("phone-sized diagnostics and Controls do not cover each other", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await openDemo(page);
  await page.getByRole("button", { name: "Controls" }).click();
  await openDiagnostics(page);
  const panel = page.getByRole("complementary", { name: "Sam status and diagnostics" });
  const box = await panel.boundingBox();
  if (!box) throw new Error("Diagnostics panel is not visible");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(700);
  await page.getByRole("button", { name: "Controls" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sam controls" })).toBeVisible();
});

test("an unexpected renderer exception leaves a visible reload path", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error("Synthetic renderer failure");
    };
  });
  await page.goto("/?transport=demo");
  await expect(page.getByRole("alert")).toContainText("Sam’s interface hit a problem");
  await expect(page.getByRole("button", { name: "Reload interface" })).toBeVisible();
  await page.getByText("Technical details").click();
  await expect(page.getByText("Synthetic renderer failure")).toBeVisible();
});
