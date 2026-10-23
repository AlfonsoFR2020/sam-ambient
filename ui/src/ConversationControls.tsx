import { useId, useState } from "react";
import type { ControlAction } from "./controls/model";
import type { UiState } from "./protocol/types";
import { conversationBlockReason } from "./state/conversations";

export function ConversationControls({
  state,
  act,
}: {
  state: UiState;
  act: (action: ControlAction) => void;
}) {
  const identity = useId();
  const [target, setTarget] = useState("");
  const reason = conversationBlockReason(state);
  const retained = state.conversation?.retained ?? [];
  return (
    <fieldset className="controls__sessions" aria-describedby={`${identity}-help`}>
      <legend>Conversation</legend>
      <output aria-live="polite">
        {state.sessionId
          ? `Active conversation ${state.sessionId.slice(0, 8)}`
          : "Waiting for the current conversation…"}
      </output>
      <button
        type="button"
        disabled={Boolean(reason)}
        onClick={() => act({ type: "conversation.new" })}
      >
        New conversation
      </button>
      <label htmlFor={`${identity}-retained`}>Retained conversations</label>
      <select
        id={`${identity}-retained`}
        value={
          target !== state.sessionId && retained.some((item) => item.id === target) ? target : ""
        }
        disabled={Boolean(reason)}
        onChange={(event) => setTarget(event.currentTarget.value)}
      >
        <option value="">Choose a retained conversation…</option>
        {retained
          .filter((item) => item.id !== state.sessionId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.id.slice(0, 8)} · {item.messageCount} saved messages
            </option>
          ))}
      </select>
      <button
        type="button"
        disabled={
          Boolean(reason) ||
          !target ||
          target === state.sessionId ||
          !retained.some((item) => item.id === target)
        }
        onClick={() => act({ type: "conversation.resume", sessionId: target })}
      >
        Resume selected conversation
      </button>
      <label htmlFor={`${identity}-launch`}>On a new Sam launch</label>
      <select
        id={`${identity}-launch`}
        value={state.conversation?.launchPolicy ?? "resume"}
        disabled={Boolean(reason)}
        onChange={(event) =>
          act({
            type: "conversation.launch_policy.set",
            policy: event.currentTarget.value as "resume" | "new",
          })
        }
      >
        <option value="resume">Resume previous conversation</option>
        <option value="new">Begin a new conversation</option>
      </select>
      <p id={`${identity}-help`}>
        {reason ??
          "New keeps prior saved text. Resume keeps the selected model. Reload and core recovery reattach."}
      </p>
      <small>
        Up to 32 recent conversations and 50 recent messages per snapshot. Saved text follows the
        existing 500-message storage bound; Personal Memory is separate.
      </small>
      {Boolean(state.conversation?.incompleteTurns) && (
        <p>
          {state.conversation?.incompleteTurns} saved request(s) have no completed saved answer.
          They will not run again automatically.
        </p>
      )}
    </fieldset>
  );
}
