import { expect, test } from "@playwright/test";

test("owner memory surface keeps provenance, edits and deletion outside chat", async ({ page }) => {
  await page.goto("/?transport=browser");
  await page.evaluate(() => {
    let time = 1;
    let rows: Record<string, unknown>[] = [];
    window.addEventListener("sam-control-command", (event) => {
      const command = (event as CustomEvent).detail;
      const { capability, arguments: args } = command.payload;
      if (typeof capability !== "string" || !capability.startsWith("memory.")) return;
      let result: Record<string, unknown> = {};
      if (capability === "memory.create") {
        const record = {
          id: "memory-1",
          content: args.content,
          kind: args.kind,
          scope: args.scope,
          source_kind: "owner",
          source_ref: command.command_id,
          review: "reviewed",
          revision: 1,
        };
        rows.push(record);
        result = { record };
      } else if (capability === "memory.list") result = { records: rows, has_more: false };
      else if (capability === "memory.get") result = { record: rows[0] };
      else if (capability === "memory.correct") {
        rows[0] = { ...rows[0], content: args.content, revision: 2 };
        result = { record: rows[0] };
      } else if (capability === "memory.delete") {
        rows = [];
        result = { deleted: args.id };
      }
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "capability.state",
            monotonic_ms: ++time,
            payload: { request_id: command.command_id, capability, state: "completed", result },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "control.acknowledged",
            monotonic_ms: ++time,
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
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  const memory = page.getByRole("region", { name: "Sam Memory", exact: true });
  await expect(memory.getByText("No memories on this page.")).toBeVisible();
  await memory
    .getByLabel("New memory")
    .fill("<script>window.COMPROMISED=true</script> I prefer Spanish");
  await memory.getByRole("button", { name: "Remember explicitly" }).click();
  await expect(memory.locator("article")).toContainText("reviewed");
  await expect(memory.locator("article")).toContainText("Source: owner");
  expect(await page.evaluate(() => "COMPROMISED" in window)).toBe(false);
  await memory.getByRole("button", { name: "Inspect / correct" }).click();
  await memory.getByLabel("Correct memory").fill("I prefer concise Spanish answers");
  await memory.getByRole("button", { name: "Save correction" }).click();
  await expect(memory.locator("article")).toContainText("revision 2");
  await memory.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(memory.locator("article")).toHaveCount(1);
  await memory.getByRole("button", { name: "Confirm permanent delete" }).click();
  await expect(memory.locator("article")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Conversation history" })).toHaveCount(0);
  expect(
    await memory
      .getByRole("region", { name: "Memory entries" })
      .evaluate((node) => getComputedStyle(node).overflowY),
  ).toBe("auto");
});

test("memory follows variable page offsets and restores previous pages", async ({ page }) => {
  await page.goto("/?transport=browser");
  await page.evaluate(() => {
    let time = 1;
    window.addEventListener("sam-control-command", (event) => {
      const command = (event as CustomEvent).detail;
      if (command.payload.capability !== "memory.list") return;
      const offset = Number(command.payload.arguments.offset ?? 0);
      const rows = Array.from({ length: 5 }, (_, i) => ({
        id: `memory-${i}`,
        content: `Claim number ${i}`,
        kind: "fact",
        scope: "personal",
        source_kind: "owner",
        source_ref: "owner",
        review: "reviewed",
        revision: 1,
      })).slice(offset, offset + 2);
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "capability.state",
            monotonic_ms: ++time,
            payload: {
              request_id: command.command_id,
              capability: "memory.list",
              state: "completed",
              result: {
                records: rows,
                next_offset: offset + rows.length,
                has_more: offset + rows.length < 5,
              },
            },
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("sam-protocol-event", {
          detail: {
            protocol: 1,
            type: "control.acknowledged",
            monotonic_ms: ++time,
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
  await page.getByRole("button", { name: "Memory", exact: true }).click();
  const memory = page.getByRole("region", { name: "Sam Memory", exact: true });
  await expect(memory.locator("article").first()).toContainText("Claim number 0");
  await memory.getByRole("button", { name: "Next", exact: true }).click();
  await expect(memory.locator("article").first()).toContainText("Claim number 2");
  await memory.getByRole("button", { name: "Next", exact: true }).click();
  await expect(memory.locator("article")).toHaveCount(1);
  await expect(memory.locator("article")).toContainText("Claim number 4");
  await expect(memory.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await memory.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(memory.locator("article").first()).toContainText("Claim number 2");
  await memory.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(memory.locator("article").first()).toContainText("Claim number 0");
});
