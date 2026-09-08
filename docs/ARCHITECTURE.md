# Architecture

Sam is a supervised modular monolith with a separate ambient presentation client.
The installed `sam-ambient` command starts `sam-supervisor`, the authoritative
`sam-core`, and an optional static `sam-ui` server. The supervisor opens the UI
after its HTTP readiness, while core startup continues visibly in the window.
Presentation failure never becomes a core crash/restart condition.

## Trusted lifecycle

The supervisor contains no LLM/provider logic. Trusted argv specifications launch
components, whose instance-correlated readiness records distinguish initialization
from health. Crashes trigger bounded backoff; three failures within 60 seconds
enter crash-loop handling/safe mode. Capability authority is revoked before
critical restart. Child stdin carries only a graceful stop request; the core can
relay a direct UI quit over its instance-bound stdout lifecycle channel. Quit is
not a tool and cannot launch a process or restore authority.
On Windows the version launcher runs the resolved entry point in its existing
child process; POSIX uses `exec`. This keeps lifecycle pipes and process identity
attached to the component the supervisor actually monitors.

## Core and UI

The supervisor's small `AppWindow` adapter launches installed Chromium-family
application mode with structured argv and a separate `.sam/ui-profile`, not the
owner's browsing profile. Windows shutdown posts WM_CLOSE only to the launched
process's windows; there is no browser process killing. Linux currently retains
the stopped window for manual closure. App-window exit requests orderly shutdown
but is never interpreted as a component crash or restart condition.
`--ui-mode browser` bypasses this adapter; missing app browsers fall back to the
default browser. The existing native transport seam remains available for Tauri.
An OS-released per-root lock prevents competing supervisors. The dedicated app
process exiting requests the same idempotent graceful shutdown as Ctrl+C; normal
browser tabs remain independent because their lifetime is not a reliable signal.

`SamRuntime` owns conversation state, the event bus, cancellation registry, voice
adapters, provider router, tool executor, and session persistence. React/TypeScript
consumes versioned events over the localhost WebSocket bridge. Its reducer rejects
stale events and coalesces high-frequency visualization updates. Text, approvals,
provider/model selection, and connection status stay secondary to the ambient
field. Visual preferences remain local to the UI.

The ambient scene is Canvas 2D: five bounded ribbon paths and 64 lights, fed by
the existing reducer's normalized input/output metrics. A ref-driven loop avoids
per-frame React updates, draws at most 30 fps, caps device scale at 1.5/four million
pixels, and pauses while hidden. Reduced motion redraws only on state/metric/resize
changes without ongoing geometry motion; shutdown unmounts the canvas. No animation
dependency, worker, WebGL stack or rejected-branch composition is reused.
Vite-only `dev/preview.html?transport=browser` exercises the real event decoder and
reducer with explicit state/energy controls and CPU draw timing. It is not packaged.

## Voice and providers

Bounded PCM frames connect sounddevice, WebRTC VAD, the loopback whisper.cpp
final-STT adapter, the turn state machine, and system TTS. Interruption first
becomes a candidate; duration/transcript heuristics decide whether to cancel or
recover. Shared cancellation IDs reach model/TTS/tools. A delivery ledger records
generated, queued, and spoken chunks. Real hardware AEC remains future work.

TTS keeps the existing `synthesize(text, voice, language, cancellation)` PCM-frame
iterator. Each frame carries format/sample-rate metadata; synthesis may buffer
internally (System.Speech) or stream, while playback remains a separate adapter.
Optional immutable `SpeechCapabilities`, `SpeechVoice`, `VoiceSelection` and
`list_voices()` expose provider identity/selection without vendor concepts in core.
Response-language detection runs locally off the event loop; short/ambiguous text
uses confirmed STT or recent response/configured language. Installed Windows voices
resolve exact locale, same language, then configured/system fallback. eSpeak
receives a language selector and resolves installed voices externally.
Network speech is currently refused by the runtime even when cloud LLM routing is
enabled. A future network speech adapter requires separate explicit trusted
opt-in and external credential configuration. Rich prosody/style can later extend
adapter options when a real backend needs it; no vendor SDK or unused emotion
schema is present. New adapters must retain cancellation and PCM-format contracts.

At startup, bounded discovery checks explicit local configuration, Ollama's
configured/default endpoint, LM Studio's conventional or CLI-reported local port,
and an additional explicitly configured compatible endpoint. Selection uses that
priority and sorted model IDs, preferring the last successful local provider/model
stored in existing SQLite runtime metadata. Explicit choices are never silently replaced.
LM Studio uses its published [status CLI](https://lmstudio.ai/docs/cli/serve/server-status)
and [model APIs](https://lmstudio.ai/docs/developer/rest/endpoints); loaded models
are preferred when native metadata exists. Compatible-only servers supply their
advertised model IDs, excluding declared/named embeddings; Ollama models must
declare completion capability. Diagnostics stay read-only. Application startup
can run structured `ollama serve` / `lms server start` and load an installed LM
model, with a 20-second per-backend deadline and no downloads. Existing services
are never stopped or restarted. Only direct Sam-owned Ollama children are reaped;
the shared LM daemon/server is retained and Sam-loaded models have a 600-second
idle TTL. No authority or settings are granted by model-generated content.
Ollama and OpenAI-compatible adapters retain the existing provider interface.
Endpoint protocol support, not a conventional port, determines compatibility;
discovery names describe probe routes rather than authenticated vendor identity.
Transparent local inference routers such as NVIDIA PAIR are a future compatible
backend direction through these endpoints, not an implemented PAIR integration.

## Capability policy

An explicit immutable registry declares schema, risk, platform, timeout, and
side effects. Runtime code validates scope and invocation-specific approvals.
Authorized paths reject traversal and resolved symlink/junction escapes.
Bounded process argv uses `shell=False`; execution still has owner OS permissions.
Global revoke advances the authority epoch, invalidates approvals/leases, and
cancels compatible work. The model cannot authorize itself or restore authority.

## Persistence and updates

SQLite stores committed text, security epoch, component state, a bounded crash
journal, and update transactions. Raw audio and in-flight work are not restored.
Versioned artifacts remain separate from live code; trusted validation precedes
atomic `active.json` replacement. The stable launcher resolves and re-hashes the
active core's fixed entry point on each restart. Candidates become last-known-good
only after health observation. Failure restores the previous version; double
failure enters safe mode. Supervisor self-update requires a later trusted bootstrap.

## External adapters

Models, STT, TTS, and platform capabilities are replaceable adapters. Native Tauri,
MCP/deskwright capability providers, and delegated coding workers are future
integrations. They are not implemented, and none owns supervisor/update authority.
