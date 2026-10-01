import { expect, test } from "@playwright/test";

test("Conversation shows confirmed speech health and current voice independently of model state", async ({
  page,
}) => {
  await page.goto("/?transport=browser");
  const emit = async (
    type: string,
    ms: number,
    payload: Record<string, unknown>,
    generation?: string,
  ) => {
    await page.evaluate(
      ({ type, ms, payload, generation }) =>
        window.dispatchEvent(
          new CustomEvent("sam-protocol-event", {
            detail: {
              protocol: 1,
              type,
              monotonic_ms: ms,
              session_id: "speech-test",
              turn_id: generation ? "turn" : undefined,
              generation_id: generation,
              payload,
            },
          }),
        ),
      { type, ms, payload, generation },
    );
  };
  await emit("system.ready", 1, {
    state: "IDLE",
    provider: "local",
    model: "chat",
    stt_status: "ready; recognition language: es",
    tts_backend: "windows-system-speech",
  });
  await page.getByRole("button", { name: "Controls", exact: true }).click();
  const status = page
    .getByRole("region", { name: "Sam controls" })
    .locator(".controls__speech-status");
  await expect(status).toContainText("recognition language: es");
  await expect(status).toContainText("Not selected yet");
  await emit("voice.state_changed", 2, { to: "THINKING" }, "delivery");
  await emit("voice.state_changed", 3, { to: "SPEAKING" }, "delivery");
  await emit(
    "component.health",
    4,
    {
      component: "synthesis",
      state: "healthy",
      reason: "ready",
      tts_selection: { voice: { voice_id: "Helena", locale: "es-ES" }, reason: "female persona" },
    },
    "delivery",
  );
  await expect(status).toContainText("Helena");
  await emit("component.health", 5, {
    component: "stt",
    state: "degraded",
    reason: "Recognizer failed",
  });
  await expect(status).toContainText("Recognizer failed");
  await emit("voice.state_changed", 6, { to: "IDLE" }, "delivery");
  await page.getByPlaceholder("Ask Sam…").fill("Text recovery remains usable");
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
});
