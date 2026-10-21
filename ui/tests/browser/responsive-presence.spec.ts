import { expect, test } from "@playwright/test";

test("capture deterministic responsive-presence compositions", async ({ page }, info) => {
  await page.goto("/tests/fixtures/visual-identity.html");
  const result = await page.evaluate(async () => {
    const path = "/tests/fixtures/responsive-presence.ts";
    const api = (await import(path)) as typeof import("../fixtures/responsive-presence");
    return api.captureResponsivePresence();
  });
  const fsPath = "node:fs/promises";
  const bufferPath = "node:buffer";
  const { Buffer } = (await import(bufferPath)) as {
    Buffer: { from(value: string, encoding: "base64"): Uint8Array };
  };
  const fs = (await import(fsPath)) as {
    mkdir(path: string, options: { recursive: boolean }): Promise<unknown>;
    writeFile(path: string, value: string | Uint8Array): Promise<void>;
  };
  await fs.mkdir(info.outputDir, { recursive: true });
  for (const shot of result.shots)
    await fs.writeFile(
      info.outputPath(`${shot.name}.png`),
      Buffer.from(shot.image.split(",")[1], "base64"),
    );
  await fs.writeFile(
    info.outputPath("presence-metadata.json"),
    JSON.stringify(result.metadata, null, 2),
  );
  expect(result.shots).toHaveLength(27);
});

test("startup, Memory, Console and Quit remain accessible with reduced motion", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?transport=browser");
  await expect(page.getByLabel("Sam startup")).toHaveAttribute("data-expanded", "false");
  const emit = (type: string, ms: number, payload: Record<string, unknown>) =>
    page.evaluate(
      ({ type, ms, payload }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: {
              protocol: 1,
              type,
              monotonic_ms: ms,
              session_id: "fixture",
              payload,
            },
          }),
        ),
      { type, ms, payload },
    );
  await emit("system.ready", 1, {
    state: "IDLE",
    provider: "local",
    model: "fixture-chat",
    capability_authority_active: true,
    capability_authority_epoch: 1,
  });
  await page.getByRole("button", { name: "Console", exact: true }).click();
  await expect(page.getByLabel("Sam Console")).toBeVisible();
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  await expect(page.getByLabel("Sam Memory")).toBeVisible();
  await expect(page.getByLabel("Sam Console")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Memory", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Quit Ctrl Q", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: info.outputPath("quit-guidance.png") });
});
