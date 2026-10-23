"""Bounded private presentation of committed history; runtime owns session changes."""

from __future__ import annotations

from uuid import uuid4

from sam_ambient.core.protocol.models import EventType, ProtocolEvent
from sam_ambient.core.storage.sqlite import ConversationSelection, StoredMessage


class ConversationView:
    def __init__(self, session_id: str, selection: ConversationSelection | None = None):
        self.runtime_id = str(uuid4())
        self.session_id = session_id
        self.revision = 0
        self.launch_policy = "resume"
        self.persistent = selection is not None
        self.history: list[StoredMessage] = []
        self.retained: list[dict[str, object]] = []
        self.draft: dict[str, object] | None = None
        if selection is not None:
            self.restore(selection)

    def restore(self, selection: ConversationSelection) -> None:
        self.session_id = selection.session_id
        self.revision = selection.revision
        self.launch_policy = selection.launch_policy
        self.history = list(selection.history)
        self.retained = [dict(item) for item in selection.retained]
        self.draft = None

    def remember(self, item: StoredMessage) -> None:
        if item.session_id != self.session_id:
            return  # Late durable completion cannot populate a different live session.
        key = item.turn_id, item.role
        index = next(
            (i for i, old in enumerate(self.history) if (old.turn_id, old.role) == key), None
        )
        if index is None:
            self.history.append(item)
            self.history = self.history[-50:]
            for retained in self.retained:
                if retained["session_id"] == self.session_id:
                    retained["message_count"] = int(retained["message_count"]) + 1
                    retained["updated_at_ms"] = item.committed_at_ms
        if self.draft and self.draft["turn_id"] == item.turn_id and item.role == "assistant":
            self.draft = None

    def observe(self, event: ProtocolEvent) -> None:
        if event.session_id != self.session_id:
            return
        if event.type == EventType.MODEL_DELTA and event.turn_id and event.generation_id:
            text = event.payload.get("text")
            if not isinstance(text, str):
                return
            if self.draft is None or self.draft["generation_id"] != event.generation_id:
                self.draft = {
                    "turn_id": event.turn_id,
                    "generation_id": event.generation_id,
                    "text": "",
                    "interrupted": False,
                    "complete": False,
                }
            self.draft["text"] = (str(self.draft["text"]) + text)[:16_384]
        elif self.draft and self.draft["generation_id"] == event.generation_id:
            if event.type == EventType.MODEL_COMPLETED:
                self.draft["complete"] = True
            elif event.type in {EventType.MODEL_CANCELLED, EventType.COMPONENT_ERROR}:
                self.draft["interrupted"] = True

    def snapshot(self, *, active_turn_id: str | None = None) -> dict[str, object]:
        budget = 48_000
        history = []
        for item in reversed(self.history):
            if budget <= 0:
                break
            text = item.content[:budget]
            budget -= len(text)
            history.append(
                {
                    "turn_id": item.turn_id,
                    "role": item.role,
                    "text": text,
                    "truncated": item.truncated or len(text) != len(item.content),
                }
            )
        history.reverse()
        answered = {item.turn_id for item in self.history if item.role == "assistant"}
        incomplete = [
            item.turn_id
            for item in self.history
            if item.role == "user"
            and item.turn_id not in answered
            and item.turn_id != active_turn_id
        ]
        return {
            "runtime_id": self.runtime_id,
            "session_id": self.session_id,
            "revision": self.revision,
            "persistent": self.persistent,
            "launch_policy": self.launch_policy,
            "history": history,
            "history_limited": len(history) < len(self.history) or len(self.history) == 50,
            "incomplete_turns": incomplete,
            "retained": self.retained,
            "draft": dict(self.draft) if self.draft else None,
        }
