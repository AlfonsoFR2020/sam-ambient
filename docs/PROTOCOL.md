# Local protocol

Unreleased V-E adds authenticated `control.conversation.select`: exact `action`
(`new`, or `resume` with `target_session_id`) plus `expected_revision`; and
`control.conversation.launch_policy.set`: exact `policy` (`resume`/`new`) plus
`expected_revision`. Both bind the current `session_id`; the core rejects busy or
stale operations. `system.ready` includes the private bounded `conversation` object.
`conversation.changed` carries a full ready snapshot, `previous_session_id` and
originating `command_id` after durable selection. ACK is not context authority.
See [session identity, limits and recovery](CONVERSATION_SESSIONS.md). These are
additive v1 fields/events, not released v0.2.5 functionality.

Unreleased V-D adds `control.voice_input_mode.set` (`mode`: `ordinary` or
`push_to_talk`) and `control.push_to_talk` (exact `action`: `start`/`finish`/`cancel`,
canonical UUID `gesture_id`). These are additive v1 commands, require a live
authenticated owner context and current runtime session, and never commit input
from an ACK. `voice.input_state` and the ready snapshot's `voice_input` contain
`mode`, `state`, `sequence`, `gesture_id` and a bounded content-free `reason`.
Only increasing core projections establish input state; a new session resets the
sequence. Gestures and unfinished finals are retired on owner loss. See
[PTT ownership and limits](KEYBOARD_PTT.md); v0.2.5 does not support these commands.

Protocol version 1 uses JSON objects with these required fields:

- `protocol`: integer protocol version, currently `1`;
- `type`: namespaced event type;
- `monotonic_ms`: non-negative monotonic timestamp;
- `payload`: JSON object.

Correlation fields are present when relevant: `session_id`, `turn_id`,
`generation_id`, `cancellation_id`, `tool_call_id`, and `update_tx_id`.
Breaking changes increment `protocol`. A receiver must reject unsupported
versions cleanly rather than guessing.

Audio visualization events (`voice.level`, `tts.level`) are lossy under
backpressure. Conversation, model, tool, health, and update events are durable
within the local bounded transport and apply backpressure instead of silently
dropping.

`tts.level` reports post-gain PCM **after** the output accepts a bounded write:
`envelope`/`rms`, `peak`, per-delivery `sequence`, `duration_ms`, and
`source: "playback_write"`. It contains no PCM or text. Device/driver buffering
means this is submission evidence, not a physical acoustic measurement.
`model.completed` commits text independently of delivery. `tts.completed` follows
output drain; cancellation/failure retire delivery. `system.ready` additionally
projects `playback_generation_id` for reconnects. Older optional fields remain
compatible with protocol 1; missing levels must expire, never be synthesized.

UI control commands use the same protocol version and correlation IDs, with
required `command_id`, `monotonic_ms`, `type`, and `payload` fields. Version 1
defines microphone and TTS-output toggles, stop-speaking, emergency-stop, text
submission, per-invocation tool approve/deny, and global capability revocation.
Emergency stop cancels model generation, queued TTS, and playback; global
revocation instead invalidates computer-action authority, pending approvals,
and cancellable active tool work. There is no model/tool command that restores
authority. The core acknowledges or rejects every deduplicated command.

Tool events use `tool.requested`, `tool.authorizing`,
`tool.approval_requested`, `tool.started`, and one applicable terminal event
(`completed`, `failed`, `cancelled`, or `denied`). Approval responses must match
the pending session, turn, generation, and tool-call correlation. The
`capability.authority_changed` event and ready/ack payloads expose the trusted
authority epoch so stale messages cannot win.
Approval requests include a bounded human summary and structured review fields;
process argv and write/open targets remain visible before the owner decides.

The development bridge uses subprotocol `sam.protocol.v1` over a bounded
WebSocket bound to `127.0.0.1` by default. It checks browser origins, refuses
non-loopback bindings, limits message and queue sizes, and carries EventBus
events rather than maintaining a second conversation state. The Tauri
adapter may replace this transport without changing presentation or core
protocol semantics.
