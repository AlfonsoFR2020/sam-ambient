import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageContent } from "../src/MessageContent";
import type { ProtocolEvent } from "../src/protocol/types";
import { reduceProtocolEvent, resetUiState } from "../src/state/reducer";

const event = (
  type: string,
  ms: number,
  payload: Record<string, unknown>,
  turnId: string,
  generationId?: string,
): ProtocolEvent => ({
  protocol: 1,
  type,
  monotonic_ms: ms,
  session_id: "history-test",
  turn_id: turnId,
  generation_id: generationId,
  payload,
});

describe("committed conversation history", () => {
  it("keeps typed and voice content separate from provisional candidates", () => {
    const events = [
      event("transcript.final", 1, { role: "user", text: "typed", source: "text" }, "typed", "g1"),
      event("transcript.final", 2, { role: "user", text: "Sam's echo", candidate: true }, "echo"),
      event("stt.cancelled", 3, { reason: "playback_echo" }, "echo"),
      event("transcript.final", 4, { role: "user", text: "recognized voice" }, "voice"),
      event("turn.committed", 5, { role: "user", text: "recognized voice" }, "voice"),
      event("model.completed", 6, { text: "A complete answer" }, "voice", "g2"),
      event("tts.cancelled", 7, { reason: "user_interruption" }, "voice", "g2"),
      event("model.completed", 8, { text: "late changed answer" }, "typed", "g1"),
    ];
    const state = events.reduce(reduceProtocolEvent, resetUiState());
    expect(
      state.transcript.map(({ role, text, interrupted }) => ({ role, text, interrupted })),
    ).toEqual([
      { role: "user", text: "typed", interrupted: false },
      { role: "user", text: "recognized voice", interrupted: false },
      { role: "assistant", text: "A complete answer", interrupted: true },
    ]);
    expect(state.provisionalTranscript).toBeNull();
  });

  it("renders common assistant formatting as escaped prose", () => {
    const html = renderToStaticMarkup(
      createElement(MessageContent, {
        text: "**Definition:** safe <script>alert(1)</script>\n\n- First *point*\n- Second point",
      }),
    );
    expect(html).toContain("<strong>Definition:</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<em>point</em>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("**Definition:**");
  });
});
