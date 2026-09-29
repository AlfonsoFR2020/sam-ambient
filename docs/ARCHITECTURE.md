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
field. Visual preferences use the typed runtime-settings boundary and persisted
preference store; adaptive resolved quality remains renderer-local and is not
persisted as user intent.

Provider discovery is an explicit frontend operation beside the transport state.
Rescan/model-select commands have unique ids; core discovery events echo the id,
and the client retains the latest id across completion to reject late older scans.
The transport epoch separately rejects events from earlier WebSocket connections.
Core discovery serializes replacement scans and publishes scanning, ready,
blocked or failed results. A definitive empty result clears active model
availability; persisted last-good model preference remains separate. Disconnected
catalog and selection data are last-known only, and a new `system.ready` is the
authoritative reconnect snapshot. Command acknowledgements have a bounded wait,
while a terminal discovery event can itself release the command's pending UI state.

`TurnManager` is the core authority for voice lifecycle transitions. A text turn
is committed by the runtime (through `accept_text_turn` when voice is active);
an uncommitted voice turn enters through
capture, VAD and STT, then both use the same model generation, delivery ledger,
cancellation token and speech path. Voice STT `transcript.final` is evidence,
not commitment: only `turn.committed` adds the user utterance to the committed
UI transcript. Typed `transcript.final` carries `source=text` and may commit at
acceptance. The frontend reducer is a single correlated projection of core
state, not a second independent conversation controller. It keeps a tentative
candidate ID separate from the active turn, retires superseded/terminal IDs,
and rejects late turn/generation events. An input pipeline that stops before
commit publishes `stt.cancelled` and IDLE; this is idempotent and does not
cancel an already committed model response. Capture health is reported apart
from generation failure, so speech input loss cannot make a healthy output
turn disappear. Model completion and speech delivery have separate terminal
outcomes: a later synthesis/playback exception emits `tts.failed`, preserving
the committed text and the model's completed result.

Connection epochs reject callbacks from old sockets. A fresh `system.ready`
snapshot carries the core's current turn/generation IDs when a turn is active;
the frontend reattaches only that identity. Core text commands echo their
originating command ID on acceptance or pre-acceptance terminal events. A
correlated lifecycle event can release the pending UI command before its ACK;
even a terminal event discarded as stale for conversation display releases its
own pending command. Late ACK/rejection cannot reopen it. Pending Controls do
not gate a fresh typed request while the core connection and model route remain
available. Rescan changes availability for future
turns but never silently replaces the model already chosen for an active
generation. The UI disables new text submission when no model is active.

On supersession, `SamRuntime` captures the predecessor's generation, turn,
cancellation, terminal, delivery and command identities. It cancels the token
and running task, retires the model terminal and queued speech, then admits the
successor without waiting for a provider or playback adapter to finish. A
pre-start queued generation observes its cancelled token so its terminal path
still runs. The old task may finish later, but its token and generation checks
discard late model output and cannot clear the new generation's active state.
Committed voice handoff checks a monotonic generation epoch after its await;
if typed input arrived meanwhile, the older handoff cannot reclaim authority.
`response_done` signals released conversation ownership; an adapter that
ignores cancellation may still have a detached request until it returns. The
HTTP transport itself binds token cancellation to the request task and closes
its response stream on unwind. Generation and speech-delivery completion remain
separate so interrupted playback does not delete committed assistant text.

Capture endpoint waits are owned by `TurnManager`/`VoiceInputPipeline`, including
the bounded candidate-duration path. Provider adapters own model stream and
first-useful-content deadlines; the frontend owns a 30-second command ACK
bound. There is no new universal STT/TTS/playback deadline in this pass.
Deterministic tests prove state and correlation behavior; physical devices,
actual provider timing, and real speech latency remain integration gates.

Post-0.2.3 physical beta exposed a playback/listening ownership gap. Playback
PCM is available after output gain, and capture PCM is available before VAD/STT,
but independent PortAudio streams do not supply aligned render/capture timing
or AEC. The current text-reference echo guard cannot make a prompt acoustic
human-origin decision. On `dev`, TTS completion no longer promotes an
unverified candidate, and a candidate monitor retains its playback generation
for later text-reference screening after the active pointer clears. Rejection
after playback returns to IDLE; monitor teardown retires unresolved candidates
against the monitor's original turn manager. These are safety/identity
corrections, not
acoustic source separation. The proposed audio boundary and remaining
candidate rules are in [post-0.2.3 beta diagnosis](POST_0.2.3_BETA_PLAN.md).
No acoustic processor or early barge-in claim is implemented yet.

[Sam Visual Engine v1](VISUAL_ENGINE_V1.md) remains the authoritative shell-neutral
renderer, audio/state and visual-settings specification. `dev` implements its
Stages A-D: a typed envelope-only adapter and isolated WebGL2 spheroid with bounded
continuous state/audio motion, batched lifted membrane fragments, analytic lights
and sparse environmental particles, with Canvas/CSS fallback. It also implements direct pointer/touch rotation,
damped inertia, persisted typed visual settings, profile-capped mobile emulation and
measured quality adaptation. Spectral extraction, prosodic mapping and human visual
acceptance remain pending. The WebGL body and membrane share a deterministic
object-space field. Engine-owned elapsed-time clocks separately advance orientation,
relief, material shears, palette evolution, lighting and particles; pointer ownership
temporarily reduces the material rate without resetting phase. The existing quality
tiers retain the same broad field, with optional fine samples only on higher tiers.
A visual-only AmbientReactivity layer smooths existing reported envelopes into
bounded perturbations of those autonomous systems; it carries no microphone,
speech or conversational authority. [Sam Orb visual direction](VISUAL_DIRECTION.md)
records remaining artistic work. The compiled static bundle uses the real event decoder
and reducer.

## Native shell boundary

The thin Tauri 2 executable owns only a native window, single-instance focus,
native identity, one trusted supervisor child, and close coordination. React still
owns presentation and speaks protocol-v1 over the localhost WebSocket. The Python
companion still owns supervision, core/runtime behavior, models, voice, policy,
tools, persistence, and updates. Tauri exposes no general filesystem, shell, or
process capability to the frontend.

```mermaid
flowchart TD
    Tauri[Tauri executable] --> React[React UI]
    Browser[Browser / app-window fallback] --> React
    React <--> WS[localhost WebSocket]
    WS <--> Companion[Python companion]
    Companion --> Supervisor[Supervisor]
    Supervisor --> Core[Core runtime]
    Core --> Models[Models]
    Core --> Voice[Voice]
    Core --> Policy[Policy and tools]
```

Development mode starts the trusted checkout command with `--no-ui`; release-mode
source resolves only `companion/sam-supervisor[.exe]` under Tauri's resource
directory and passes a writable per-user application-data root. A frozen supervisor
may launch only fixed sibling `sam-core` and `sam-ui` executables. Normal native
close emits a fixed event into React, which opens Sam's existing Quit confirmation;
only acknowledged runtime shutdown enables the window to close. A bounded native
exit fallback terminates only the supervisor child it created.

The source tree includes the companion/resource layout and guarded Windows NSIS
assembly path, but packaging, signing, antivirus review, and installer acceptance
are separate release gates. Browser and Chromium app-window modes remain supported.

## Configuration and readiness

`SamSettings` is the validated, versioned user-intent boundary. Standard-library
TOML loading merges safe defaults, per-user and workspace files, bounded `SAM_*`
environment overrides, then options explicitly present on the CLI. The same
resolved values feed supervisor launch specifications and direct runtime/doctor
commands. Unknown fields fail closed. Credentials are adapter environment/service
configuration, and learned last-good provider/model data remains operational
SQLite state; neither is written into user TOML.

Doctor probes existing adapters and produces bounded facts. A pure readiness
classifier maps them to stable user/action categories, providing the shared seam
for a future installer without giving installer logic separate dependency rules.
It does not install applications or download models.

## Voice and providers

### Inference route and future spoken controls

The configured provider/model pair is currently spread across `ProviderSettings`,
CLI discovery arguments, `SamRuntime.provider`/`_model`, and the selected provider
adapter. `ProviderSettings.base_url` and `local_compatible_url` identify at most
one configured endpoint each; there is no named connection/server/API profile
catalog. The runtime's immutable `CommittedInferenceTarget` is a per-turn snapshot
of the provider instance, router, model and availability reason. Both text and
committed voice turns capture it before asynchronous generation. Every model and
tool round routes explicitly through that snapshot. The selected provider/model
may change only for later turns. Discovery adopts provider/router/model together
without yielding; a scan completing during an active turn rejects the new route
and preserves the current one. A blocked or unavailable explicit selection cannot
fall back to another provider/model. Startup's existing sole-model auto-selection
is separate from an explicit switch.

Future routing identity needs `(configured profile id, provider id, model id)`.
The profile should resolve a preconfigured endpoint and credential reference
outside conversation text. URLs may be configuration values, but secrets, API
keys and authorization headers must never be route identity, protocol payload or
diagnostic data. A trusted atomic switch must validate a complete target against
its own catalog, then publish accepted, unavailable, ambiguous, discovery-needed
or failed status. It must not show a newly selected route before the next turn
can actually use it. An ordinary switch requested during generation or speech
is blocked and never mutates a committed generation's route. A recognized
control from ordinary STT can execute before model commitment. Active-response
barge-in control policy is deferred.

Voice-controlled switching is explicit product direction, alongside other future
voice-operable controls. Core now has a small typed `LocalControlIntent` and
`LocalControlResult` boundary for exact provider/model selection and Stop speaking.
The UI's existing control commands enter this boundary. A model-selection command
acknowledges that discovery started without holding the command dispatcher; the
terminal `provider.discovery` and `local.control` events report the final result.
An active response blocks selection. Explicit unavailable or failed selections
keep the previous valid provider/model, and a returned provider/model that does
not match the exact request is rejected. Provider, router and model are adopted
together before any later turn can snapshot them; no silent fallback occurs.
The ordinary `VoiceInputPipeline` has an optional synchronous typed recognizer
injected by trusted core code. After final STT and before `turn.committed`, it
executes recognized controls locally and retires the uncommitted input; other
transcripts follow the existing commitment path. Tests use synthetic typed
intents, not phrase parsing. The separate active-response barge-in path has no
control interception yet. Natural-language recognition, spoken acknowledgement
and real provider switching remain deferred. Bounded diagnostics record kind,
outcome and route IDs without credentials or the full utterance.

### Audio ownership checkpoint

Core owns operational audio health at the operation that observes it. Capture
reports `voice_input` on the first frame or capture failure; STT reports `stt`
after stream creation or on a typed recognition failure; synthesis reports
`synthesis` on first PCM or producer failure; output reports `playback` after
playback or on consumer failure. Each `component.health` update changes only
that subsystem's frontend health fact. Configured STT/TTS backend names and
microphone/output enable switches remain separate from attempted-operation
health; an unattempted path is not claimed healthy. The frontend projects these
facts into status and bounded diagnostics without inferring another subsystem's
health. Failure retires the matching input/output activity source. Capture/STT
failure does not change model eligibility, while synthesis/playback failure
preserves committed answer text and ends only delivery with `tts.failed`.
Recoverable capture retries remain bounded; a terminal input failure can be
restarted by enabling the microphone again. A later successful operation clears
its own degraded health. This behavior is covered with fake failures; real
device absence, permissions, service startup, output loss and recovery timing
still require physical integration validation.

The audio producer/consumer boundary is deliberately pull-based. One
`SoundDeviceCapture.frames` iterator reads a fixed 20 ms PortAudio block only
after `VoiceInputPipeline` has finished processing/pushing the preceding block.
Its 10-frame pre-roll is a bounded 200 ms deque; older pre-roll frames are
discarded only before a speech candidate opens. Once STT opens, each frame is
awaited at `push_audio`, so a slow STT consumer stalls capture rather than
growing a Python frame queue. Real-time PortAudio input may then overflow; the
adapter raises `AudioInputOverflow` and aborts that utterance, never silently
submits discontinuous speech. The whisper.cpp adapter copies PCM into one
per-stream bytearray capped at 120 seconds, clears it on successful finalization
or cancellation, and caps the HTTP result. This adapter does not stream partial
STT results yet. `AudioFrame` holds immutable bytes copied from the input
stream; gain creates a new frame except at unity.

System TTS currently synthesizes one bounded WAV (32 MiB maximum) before
yielding immutable PCM frames; it is not a live streaming synthesizer. The
runtime meters and scales one yielded frame at a time, and playback awaits each
PortAudio write before requesting the next. There is no PCM-frame queue between
synthesis and playback. Playback failure or cancellation now explicitly closes
the metering iterator and nested TTS iterator, releasing any retained WAV/PCM
buffer. PortAudio output underflow is counted and playback continues; cancelled
output aborts and closes its stream. The separate `BoundedSpeechQueue` holds at
most eight text chunks, not PCM frames. `enqueue` backpressures; the delivery
ledger separately caps generations, chunks and generated characters. Cancelling
a generation removes its queued/in-flight chunks; no old text or PCM is eligible
for a newer generation. The event bus caps each subscriber at 64 by default,
coalesces/drops lossy audio level events, and backpressures durable events.

For visual reactivity, the capture pipeline and barge-in monitor measure input
RMS/peak (and VAD probability) from gained PCM as `voice.level`. The runtime
measures output RMS/peak from volume-scaled PCM immediately before handing it
to playback as `tts.level`; it is scheduled output, not proof of sound emitted
by a physical speaker. These are source-specific protocol events, not a new
semantic or shader channel. The frontend reducer rejects stale turn/generation
events; `VisualInputAdapter` carries separate input/output samples, retires
them on cancellation/failure, and expires them after missing updates or a long
suspension. It owns freshness, while `AmbientReactivity` owns the visual
attack/release and bounded modulation. No audio-side visual smoothing was added.
Physical queue timing, device behavior, acoustic output and waveform feature
quality remain unverified.

`SamRuntime._voice_loop` creates a `VoiceInputPipeline` for ordinary capture;
`_monitor_barge_in` independently creates a capture iterator while a response
is active. `SoundDeviceCapture.frames` opens a PortAudio input stream per iterator,
binds its cancellation token to abort, yields copied PCM frames, and closes the
stream in `finally`. The ordinary pipeline owns its STT stream from VAD opening
through finalization/cancellation; an interruption candidate has its own token,
turn ID and STT stream. The whisper.cpp stream checks its original token and
context cancellation ID, stops accepting frames after finalization, bounds its
audio buffer and cancels the HTTP task on token cancellation. Retired candidate
finals are checked against current turn/candidate identity before publication.

`_deliver_assistant` owns one generation's speech queue entry, TTS iterator and
`AudioOutput.play` call. System TTS owns its synthesis subprocess and PCM buffer
until its iterator finishes or cancels; it kills/waits for subprocesses in
`finally`. Playback owns a separate PortAudio output stream and closes it on
completion/failure/cancellation. Generation/cancellation IDs guard delivery
events and cancellation, while the speech queue/ledger track generated, queued
and spoken text. These stages have separate resources but synthesis and playback
share one generation token and run in one delivery task. The source audit found
no demonstrated late audio callback that can revive a retired turn; device and
real timing behavior remain unverified.

`audio_settings.input_gain` is applied to `SoundDeviceCapture.set_gain` and read
per yielded capture frame, so a setting change affects the active stream's next
frame. `output_gain` is read when each synthesized PCM frame passes through
`_metered_tts_frames`, before metering and playback, so it affects later frames
in active playback. Both are bounded to 0–2 and persisted. Neither changes the
OS device gain. The later full audio pass owns queue/backpressure and PCM buffer
lifetime, device availability/shutdown/reconnect, audio-derived visual features,
and real STT/TTS timing; this checkpoint does not validate those paths.

Bounded PCM frames connect sounddevice, WebRTC VAD, the loopback whisper.cpp
final-STT adapter, the turn state machine, and system TTS. Interruption first
becomes a candidate. During playback, VAD alone cannot commit it: final candidate
text must be credible and probable overlap with current assistant output is rejected
before it becomes a user turn. Shared cancellation IDs reach model/TTS/tools. A delivery ledger records
generated, queued, and spoken chunks. Real hardware AEC remains future work.

Each interruption candidate owns one STT stream. Finalization removes that stream
from the capture path before awaiting its result; final/rejected/cancelled streams
cannot receive further frames. Confirmations pass through the interruption controller
before event publication. Capture, STT, synthesis and playback operational health
use distinct `component.health` identities, independently of model state. Input failure disposes only
tentative candidates; it cannot force a healthy response's playback OFFLINE.

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
and an additional explicitly configured compatible endpoint. Selection requires,
in order, a valid explicit model, a valid last-successful local model stored in
SQLite, or exactly one installed local conversational model. Several candidates
remain blocked for owner choice; explicit choices are never silently replaced.
LM Studio uses its published [status CLI](https://lmstudio.ai/docs/cli/serve/server-status)
and model inventory/API boundaries: `lms ls` identifies installed models while
serving/native metadata identifies models actually loaded. Compatible-only servers supply their
advertised model IDs, excluding declared/named embeddings; Ollama models must
declare completion capability. Diagnostics stay read-only. Application startup
can run structured `ollama serve` / `lms server start` with short readiness bounds.
LM model loading is a separate cancellable 180-second phase; only an explicit,
remembered, or sole installed chat model is auto-loaded. Multiple candidates
require owner selection, and no downloads occur. The UI connects before this
potentially long load, receives truthful lifecycle events, and can request a
fresh bounded discovery through the trusted control boundary. Existing services
are never claimed merely because discovery finds them. Successful Sam start/load
actions establish independent service/model provenance; model selection alone
establishes neither. Direct Ollama process handles remain process-local. LM Studio
service/model provenance may cross a managed core Restart only under the supervisor's
random application-lifetime identity; the same SQLite record is inert for a later Sam launch.
Graceful Quit defaults to keeping both. An explicit owner preference may first unload
a Sam-loaded LM Studio model through bounded structured `lms` argv, then stop a
service only when Sam started it.
Ollama has no model-unload claim in this layer; compatible/remote providers report
unsupported. Restart, Emergency Stop, rescans, and future launches do not acquire or
apply exit-cleanup authority. Cleanup failures are logged and cannot block shutdown.
Because provider APIs do not expose a universal resource-incarnation token, Sam never
reconstructs service ownership from a PID. If the external world replaces a same-ID
LM Studio model within one supervisor lifetime, Sam can verify only its current ID,
not an unavailable incarnation token; this is a documented adapter limitation. No
authority or settings are granted by model-generated content.
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
cancels compatible work. Tool schemas and invocation arguments are recursively
immutable after trusted construction. The model cannot authorize itself or restore
authority.

## Persistence and updates

SQLite stores committed text, security epoch, component state, a bounded crash
journal, and update transactions. Raw audio and in-flight work are not restored.
Versioned artifacts remain separate from live code; trusted validation precedes
atomic `active.json` replacement. The stable launcher resolves and re-hashes the
active core's fixed entry point on each restart. Candidates become last-known-good
only after health observation. Failure restores the previous version; double
failure enters safe mode. Candidate content is re-hashed after observation and the
rollback target must retain its persisted trusted hash. Supervisor self-update
requires a later trusted bootstrap.

## External adapters

Models, STT, TTS, and platform capabilities are replaceable adapters. Sam now has
a bounded MCP stdio client for trusted configured local capability servers. It
implements current per-request metadata/server discovery, paginated tools/list,
tools/call, cancellation, and stdio
shutdown without a new SDK dependency. Streamable HTTP is a future transport;
legacy SSE is intentionally excluded.

```mermaid
flowchart TD
    Model[Model / planner] --> Policy[Sam policy + exact approval]
    Policy --> Adapter[External capability adapter]
    Adapter --> MCP[MCP client / stdio transport]
    MCP --> Server[Configured local MCP server]
    Server --> Backend[OS / application backend]
```

Discovery creates recursively immutable, collision-safe Sam descriptors. All
external tools are approval-required external side effects. Sam checks a catalog
fingerprint again before execution; results remain untrusted bounded data. Existing
lease epochs, Emergency Stop, cancellation, stale-generation, and audit rules stay
authoritative. Models and workspace config cannot supply server launch details.

Deskwright remains a future Linux GNOME/Wayland server launched as a trusted local
command below this boundary. Semantic actions and headless/private desktop sessions
are backend behavior, never a policy bypass. Delegated workers are also future;
none owns supervisor/update authority.

## Release assurance

Local scripts remain authoritative for development. GitHub Actions repeats the
deterministic Python and frontend quality gates on Windows/Linux, then builds the
wheel/source distribution and installs the wheel for a CLI/metadata smoke check.
Live provider/audio checks and publishing are deliberately human-controlled.
