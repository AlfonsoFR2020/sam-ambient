import { expect, test } from "@playwright/test";

test("integrated probe visual selectors match the current implicit UI labels", async ({ page }) => {
  await page.goto("/?transport=demo");
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const controls = page.getByRole("region", { name: "Sam controls" });
  const select = (label: string) =>
    page
      .locator("label.visual-setting")
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator("select");
  await controls.getByRole("button", { name: "Device", exact: true }).click();
  expect(await page.getByLabel("Performance profile", { exact: true }).count()).toBe(0);
  await select("Performance profile").selectOption("high_end");
  await expect(select("Performance profile")).toHaveValue("high_end");
  for (const quality of ["low", "medium", "high"]) {
    await select("Quality").selectOption(quality);
    await expect(select("Quality")).toHaveValue(quality);
  }
  await controls.getByRole("button", { name: "Appearance", exact: true }).click();
  await select("Reduced motion").selectOption("on");
  await expect(select("Reduced motion")).toHaveValue("on");
});

test("colored membrane hierarchy across orientation and curl phases", async ({ page }, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const path = "/tests/fixtures/visual-identity-II.ts";
    const { fixture, frameAt } = (await import(
      path
    )) as typeof import("../fixtures/visual-identity-II");
    const base = frameAt(0),
      shots: { name: string; image: string }[] = [];
    for (const [name, opts] of [
      ["body", { bodyOnly: true }],
      ["full", {}],
      ["coat-only", { contact: false }],
      ["neutral", { neutralMaterial: true }],
    ] as const) {
      const f = fixture("high", opts);
      for (const [orientation, yaw] of [0, 0.75, 1.6].entries())
        for (const time of [0, 6, 12]) {
          const image = f.draw({ ...base, peelTravel: base.peelTravel + time * 0.3 }, yaw);
          shots.push({ name: `${name}-${orientation}-${time}`, image });
        }
      f.close();
    }
    return {
      shots,
      seed: "0x5a17",
      size: 720,
      dpr: 1,
      orientations: [0, 0.75, 1.6],
      seconds: [0, 6, 12],
      held: "body, light and material clocks",
    };
  });
  const path = "node:fs";
  const fs = (await import(path)) as {
    mkdirSync(path: string, options: { recursive: boolean }): void;
    writeFileSync(path: string, data: string | Uint8Array): void;
  };
  fs.mkdirSync(info.outputDir, { recursive: true });
  for (const shot of result.shots)
    fs.writeFileSync(
      info.outputPath(`${shot.name}.png`),
      Uint8Array.from(atob(shot.image.split(",")[1]), (c) => c.charCodeAt(0)),
    );
  const { shots, ...metadata } = result;
  fs.writeFileSync(info.outputPath("optics.json"), JSON.stringify(metadata, null, 2));
  expect(shots).toHaveLength(36);
});
