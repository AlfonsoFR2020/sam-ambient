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

