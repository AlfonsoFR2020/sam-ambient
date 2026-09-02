# Local protocol

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

The development bridge uses subprotocol `sam.protocol.v1` over a bounded
WebSocket bound to `127.0.0.1` by default. It checks browser origins, refuses
non-loopback bindings, limits message and queue sizes, and carries EventBus
events rather than maintaining a second conversation state. The future Tauri
adapter may replace this transport without changing presentation or core
protocol semantics.
