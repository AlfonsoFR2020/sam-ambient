import { describe, expect, it } from "vitest";
import { resetUiState } from "../src/state/reducer";
import { statusPresentation } from "../src/status";

describe("plain-language runtime status", () => {
  it("describes truthful startup and reconnect states", () => {
    expect(statusPresentation({ ...resetUiState(), connection: "connecting" })).toMatchObject({
      label: "Starting Sam",
    });
    expect(
      statusPresentation({ ...resetUiState(), connection: "offline", sessionId: "prior" }),
    ).toMatchObject({ label: "Reconnecting" });
  });

  it("explains precisely what remains usable when local services degrade", () => {
    const status = statusPresentation({
      ...resetUiState(),
      connection: "connected",
      sessionId: "session",
      selectionReason: "LM Studio startup timed out",
      sttStatus: "missing whisper model",
      ttsBackend: "disabled/unavailable",
    });
    expect(status.limitations).toEqual([
      "Local model unavailable: LM Studio startup timed out",
      "Voice input is unavailable; text input remains available.",
      "Spoken output is unavailable; responses remain readable.",
    ]);
  });

  it.each([
    ["No supported local provider is installed", undefined, "ready", "windows-system-speech"],
    ["LM Studio startup failed", undefined, "ready", "windows-system-speech"],
    ["No conversational model is installed", undefined, "ready", "windows-system-speech"],
    ["local service startup timed out", undefined, "ready", "windows-system-speech"],
    ["local provider ready", "chat", "STT unavailable", "windows-system-speech"],
    ["local provider ready", "chat", "ready", "TTS unavailable"],
  ])("keeps a useful, actionable state for %s", (reason, model, sttStatus, ttsBackend) => {
    const status = statusPresentation({
      ...resetUiState(),
      connection: "connected",
      sessionId: "session",
      selectionReason: reason,
      model,
      sttStatus,
      ttsBackend,
    });
    expect(status.notice).toBeTruthy();
    expect(status.limitations.join(" ")).toMatch(/local|text|readable/i);
  });

  it("does not show degradation when all local conversation paths are ready", () => {
    expect(
      statusPresentation({
        ...resetUiState(),
        connection: "connected",
        sessionId: "session",
        model: "chat",
        sttStatus: "ready at localhost",
        ttsBackend: "windows-system-speech",
      }).limitations,
    ).toHaveLength(0);
  });
});
