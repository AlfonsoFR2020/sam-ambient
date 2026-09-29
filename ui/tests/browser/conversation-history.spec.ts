import { expect, test } from "@playwright/test";

test("committed history formats answers and follows only while reading newest", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?transport=browser");
  const emit = async (
    type: string,
    ms: number,
    payload: Record<string, unknown>,
    turnId: string,
    generationId?: string,
  ) => {
    await page.evaluate(
      ({ type, ms, payload, turnId, generationId }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: {
              protocol: 1,
              type,
              monotonic_ms: ms,
              session_id: "history-browser",
              turn_id: turnId,
              generation_id: generationId,
              payload,
            },
          }),
        ),
      { type, ms, payload, turnId, generationId },
    );
  };
  await emit(
    "transcript.final",
    1,
    { role: "user", source: "text", text: "Typed request" },
    "typed",
    "g1",
  );
  await emit(
    "transcript.final",
    2,
    { role: "user", text: "Echo candidate", candidate: true },
    "echo",
  );
  const history = page.getByRole("region", { name: "Conversation history" });
  await expect(history).toContainText("Typed request");
  await expect(history).not.toContainText("Echo candidate");
  await emit("stt.cancelled", 3, { reason: "playback_echo" }, "echo");
  await emit("transcript.final", 4, { role: "user", text: "Actual voice request" }, "voice");
  await expect(history).not.toContainText("Actual voice request");
  await emit("turn.committed", 5, { role: "user", text: "Actual voice request" }, "voice");
  await emit(
    "model.completed",
    6,
    { text: "**Definition:** Complete answer\n\n- First point\n- Second point" },
    "voice",
    "g2",
  );
  await emit("tts.cancelled", 7, { reason: "user_interruption" }, "voice", "g2");
  await expect(history.locator(".transcript__meta span")).toHaveText(["You", "You", "Sam"]);
  await expect(history.locator("strong")).toHaveText("Definition:");
  await expect(history.locator("li")).toHaveCount(2);
  await expect(history).not.toContainText("**Definition:**");
  await expect(history.locator(".transcript__line--assistant .transcript__content")).toContainText(
    "Second point",
  );
  await expect(history.locator(".transcript__delivery")).toHaveText("Speech stopped");
  await expect(
    history.locator(".transcript__line--assistant .transcript__content"),
  ).not.toContainText("Speech stopped");
  await emit("model.completed", 8, { text: "Late replacement" }, "typed", "g1");
  await expect(history).not.toContainText("Late replacement");

  for (let index = 0; index < 30; index += 1)
    await emit(
      "turn.committed",
      9 + index,
      { role: "user", text: `History item ${index}` },
      `turn-${index}`,
    );
  const measure = () =>
    history.evaluate((node) => ({
      top: node.scrollTop,
      maximum: node.scrollHeight - node.clientHeight,
      overflow: getComputedStyle(node).overflowY,
    }));
  await expect.poll(async () => (await measure()).maximum).toBeGreaterThan(100);
  await expect
    .poll(async () => {
      const { top, maximum } = await measure();
      return maximum - top;
    })
    .toBeLessThan(36);
  expect((await measure()).overflow).toBe("scroll");

  await history.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await emit("turn.committed", 50, { role: "user", text: "While reading older items" }, "turn-up");
  await expect(history).toContainText("While reading older items");
  expect((await measure()).top).toBeLessThan(36);

  await history.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await emit("turn.committed", 51, { role: "user", text: "Follow newest again" }, "turn-bottom");
  await expect(history).toContainText("Follow newest again");
  await expect
    .poll(async () => {
      const { top, maximum } = await measure();
      return maximum - top;
    })
    .toBeLessThan(36);
  expect(errors).toEqual([]);
});
