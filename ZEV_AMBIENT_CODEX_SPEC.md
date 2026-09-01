# ZEV AMBIENT — Codex Engineering Specification
Version: 1.0
Status: MVP implementation specification
Primary target: Linux desktop
Future targets: Windows, macOS, Android, iOS
Owner role: Executive product owner
Implementation agent: OpenAI Codex
License intent: Commercial-use-friendly project; default project license Apache-2.0 OR MIT, subject to final owner choice
Source of truth: This file

---

## 0. How Codex must use this document

This specification is deliberately written as an implementation contract, not as a conversational prompt.

Codex MUST:

1. Treat explicit MUST / MUST NOT / SHOULD / MAY statements as normative.
2. Work autonomously where requirements are sufficiently specified.
3. Ask the owner only for decisions that are irreversible, commercially material, security-sensitive, or genuinely impossible to infer.
4. Prefer simple, proven implementations over novel infrastructure.
5. Reuse permissively licensed dependencies and reference implementations instead of recreating solved plumbing.
6. Never copy code from a repository until its current license and file provenance have been checked.
7. Preserve a small dependency surface and clear replacement boundaries.
8. Implement in vertical slices that compile, test, and run.
9. Keep a short `docs/STATE.md` updated after each meaningful milestone so future Codex sessions do not need to reread the entire repository.
10. Read this whole specification once at project bootstrap; thereafter retrieve only the relevant sections unless architecture changes require a full reread.
11. Maintain `docs/DECISIONS.md` for deviations from this specification, with rationale and consequences.
12. Maintain `THIRD_PARTY.md` with dependency name, version/commit, license, source URL, purpose, whether linked/embedded/copied, and required notices.
13. Never silently weaken tests, safety boundaries, rollback behavior, or licensing checks merely to make a build pass.

Token-economy rule for Codex:
- Do not repeatedly summarize this document.
- Do not generate large speculative design documents before implementation.
- Use `docs/STATE.md` as the compact cross-session memory.
- Inspect only files relevant to the current task.
- Prefer patching existing modules to whole-file rewrites.
- Run targeted tests first, full test suites at milestone boundaries.
- Avoid verbose progress prose.
- Reuse stable libraries where doing so removes custom code without compromising portability or licensing.

---

# 1. Executive product definition

## 1.1 Product

Zev Ambient is an ambient, voice-first AI computer interface.

The user should feel that they are speaking **to the computer itself**, not to a conventional chat window.

The visual surface behaves as the agent's embodiment:
- alive but unobtrusive when idle,
- attentive while listening,
- cognitively active while reasoning,
- expressive while speaking,
- immediately responsive when interrupted,
- informative without becoming a dashboard.

The first MVP is a Linux desktop application built around the earlier Zev concept: a lightweight Python CLI/LLM orchestrator with Ollama support. Historical Zev repository: `https://github.com/marqbritt/zev`.

Earlier Zev implementation facts to preserve when useful:
- Python CLI repository.
- Known files included:
  - `src/zev/main.py`
  - `src/zev/utils.py`
  - `src/zev/constants.py`
  - `src/zev/llms/ollama/provider.py`
  - `ollama/setup.py`
- Prior Ollama integration used `shutil.which()` for detection.
- The integration resolved a default Ollama OpenAI-compatible base URL around `http://localhost:11434/v1`.
- Prior design goals included model discovery, streaming chat, provider fallback, diagnostics, `doctor`, local preference and richer interactive UI.

Codex SHOULD inspect the current public Zev repository before deciding whether to fork, vendor, port, or extract only its provider logic. The project is not required to preserve Zev internals if a cleaner architecture results.

## 1.2 Core value proposition

A user can:
1. speak naturally,
2. see and hear immediate multimodal feedback,
3. interrupt the agent naturally,
4. ask questions,
5. ask the computer to operate on local files and applications,
6. select local or cloud AI models,
7. later ask the system to improve or patch parts of itself,
8. recover safely from failed components or failed upgrades.

The system must remain useful if all cloud AI services are unavailable, assuming an adequate local model is installed.

## 1.3 Product personality

The UI should evoke the calm, intimate quality of an ambient cinematic interface rather than copy any copyrighted film design.

Design attributes:
- minimal,
- fluid,
- elegant,
- dark-background-friendly,
- non-game-like,
- non-dashboard-like,
- non-anthropomorphic by default,
- no fake "AI thinking" theatrics when the system is simply waiting on I/O,
- reactive animation must be driven by real state/audio data.

No copyrighted visual assets, voices, logos, or direct reproduction of the user interface from *Her* or any other film.

---

# 2. MVP boundaries

## 2.1 MVP MUST contain

A. Ambient visual shell
- Borderless/fullscreen-capable desktop window.
- Optional normal window mode.
- Reactive visual field.
- Real-time microphone input visualization.
- Real-time synthesized speech visualization.
- State transitions for idle/listening/committing/thinking/speaking/interrupted/error/offline.
- Minimal transcript overlay that can be hidden.

B. Full conversational loop
- microphone capture,
- voice activity detection,
- speech-to-text,
- end-of-turn decision,
- model request,
- streaming model output,
- streaming/chunked text-to-speech,
- barge-in/interruption,
- cancellation propagation,
- recovery from false interruption.

C. Model routing
- Ollama as first-class local backend.
- OpenAI-compatible provider interface.
- provider registry.
- model discovery where supported.
- streaming.
- timeout/cancellation.
- fallback policy configurable by the user.

D. Minimal computer capabilities
- safe local file read/list/search,
- explicit file write/edit,
- shell execution with safety gating,
- open/focus applications where feasible,
- clipboard,
- basic system information,
- capability registry.

E. Resilience
- supervisor/watchdog,
- component health checks,
- crash restart,
- durable state for conversation/session metadata,
- graceful loss and reconnection of Ollama/audio/UI,
- structured logs.

F. Update foundation
- component version registry,
- staged update mechanism,
- atomic component activation where practical,
- health-check validation,
- rollback,
- self-update architecture capable of later supporting agent-written patches.

G. Developer/agent ergonomics
- reproducible bootstrap,
- one-command dev launch,
- one-command tests,
- lint/format,
- AGENTS.md,
- concise STATE.md,
- architecture docs generated only where necessary.

## 2.2 Explicitly NOT required for MVP

Do not delay MVP for:
- autonomous multi-agent swarms,
- long-term semantic memory,
- biometric user identification,
- camera/vision understanding,
- full desktop vision control,
- wake-word detection,
- always-on remote access,
- cloud account sync,
- plugin marketplace,
- advanced RAG,
- autonomous background browsing,
- mobile build,
- automatic unsupervised self-rewriting,
- elaborate avatar,
- dozens of tools,
- custom model training.

Architectural seams MUST allow these later.

---

# 3. System architecture

## 3.1 Architectural principle

Use a **small supervised modular monolith** for MVP, not microservices.

The process topology should separate only failure domains that benefit materially from separation.

Recommended topology:

```text
                   ┌────────────────────────────┐
                   │       Ambient UI           │
                   │ Tauri 2 + Web frontend     │
                   │ visuals + transcript       │
                   └─────────────┬──────────────┘
                                 │ typed local IPC
                                 ▼
┌────────────────────────────────────────────────────────────┐
│                    Zev Core Runtime                         │
│                                                            │
│ Session  Turn Manager  Provider Router  Tool Registry      │
│ Voice Pipeline  Event Bus  Policy Engine  State Store      │
│                                                            │
└──────────────┬────────────────┬─────────────────┬───────────┘
               │                │                 │
               ▼                ▼                 ▼
        local inference     OS adapters       Update agent
        Ollama/STT/TTS      Linux first       staged only
               │
               ▼
       local/cloud models

      ┌─────────────────────────────────────────────────┐
      │ Supervisor / launcher / watchdog               │
      │ health · restart · versions · rollback         │
      └─────────────────────────────────────────────────┘
```

## 3.2 Process boundaries

MVP preferred processes:

1. `zev-supervisor`
   - tiny,
   - stable,
   - no model reasoning,
   - starts components,
   - watches liveness,
   - performs safe update activation/rollback,
   - owns last-known-good version metadata.

2. `zev-core`
   - conversational state machine,
   - voice orchestration,
   - provider routing,
   - tools,
   - policy,
   - durable state,
   - update proposals but not unconditional activation.

3. `zev-ui`
   - Tauri application/webview,
   - presentation only,
   - never owns authoritative conversation state.

STT/TTS/Ollama SHOULD initially be external libraries/processes behind adapters rather than separately reinvented daemons.

## 3.3 Why this topology

It achieves:
- fewer IPC boundaries than microservices,
- restartable UI,
- restartable core,
- independent update supervisor,
- clear mobile migration path,
- safe future self-patching,
- straightforward testing.

---

# 4. Recommended technology stack

Codex MAY substitute only with a documented reason.

## 4.1 Desktop shell and UI

Preferred:
- Tauri 2
- TypeScript
- React
- Vite
- Three.js only where GPU visual effects warrant it
- CSS/Web Animations for simple transitions

Rationale:
- Tauri is designed for desktop and mobile applications.
- Rust host gives small, robust native boundary.
- Web UI maximizes design iteration speed.
- TypeScript supports typed event contracts.
- Later Android/iOS work can preserve much of the frontend and shared Rust code.

Tauri licensing is MIT/Apache-2.0 compatible with commercial use.

Avoid Electron unless a blocker makes Tauri impractical.

## 4.2 Core runtime

Preferred MVP:
- Python 3.12+ for Zev-derived orchestration and AI integration.
- `asyncio` for cancellation-aware concurrency.
- Pydantic/dataclasses for event/config schemas.
- SQLite for small durable state.
- JSONL or structured logging.

Reason:
- maximizes reuse of Zev and Python AI ecosystem,
- lowest implementation cost,
- easiest provider/STT/TTS integration.

Portability strategy:
- keep core domain interfaces language-neutral,
- communicate over typed JSON messages,
- move latency-critical/platform-neutral pieces to Rust only when profiling justifies it.

Do NOT rewrite Zev in Rust merely for aesthetic architectural purity.

## 4.3 IPC

Preferred:
- local WebSocket or Unix-domain-socket transport using versioned JSON messages.
- transport abstraction MUST permit TCP/WebSocket on mobile or remote client later.

All messages MUST carry:
- protocol version,
- event type,
- session/turn ID where relevant,
- monotonic timestamp where relevant,
- payload.

Cancellation IDs MUST propagate end-to-end.

## 4.4 Local LLM

First-class:
- Ollama HTTP API.
- OpenAI-compatible adapter when appropriate.

Optional future:
- llama.cpp direct adapter.

Ollama project license is MIT, but individual model licenses vary. Model metadata MUST expose model/license provenance where discoverable.

## 4.5 STT

Preferred evaluation order:
1. whisper.cpp (MIT) for portable native local inference, OR
2. faster-whisper (MIT) if Python integration materially reduces MVP complexity.

Do not permanently couple the domain layer to either.

Interface:

```python
class SpeechToText:
    async def start_stream(...)
    async def push_audio(...)
    async def partial_transcript(...)
    async def finalize(...)
    async def cancel(...)
```

## 4.6 VAD / turn detection

Use WebRTC VAD, Silero VAD, or another permissively licensed proven VAD after license verification.

Do not implement neural VAD from scratch.

Turn detection MUST combine signals; VAD alone is insufficient.

## 4.7 TTS

TTS MUST be adapter-based.

Initial implementation MAY use a local Piper-compatible engine, Kokoro implementation, OS TTS, or another permissively usable engine after dependency/model license audit.

Important licensing note:
- the historical `rhasspy/piper` repository advertises MIT but is archived and development moved elsewhere; its dependency/licensing chain has had GPL-related questions.
- therefore do NOT blindly vendor Piper source.
- prefer invoking a separately installed engine or choose a clearly license-audited replacement.
- voice/model licenses MUST be checked independently from runtime code.

## 4.8 Voice framework reuse

LiveKit Agents is Apache-2.0 for the framework and contains mature concepts for:
- interruption handling,
- false-interruption recovery,
- endpointing,
- AEC warm-up,
- turn handling,
- preemptive generation.

However:
- some LiveKit turn-detection models use a separate LiveKit Model License.
- do not import restricted model assets by assumption.
- for MVP, reuse architecture/concepts and permissively licensed framework code only if it reduces code and dependency burden.

---

# 5. Voice interaction specification

This is a core product differentiator.

## 5.1 Voice pipeline

```text
PCM input
  ↓
AEC / noise handling where available
  ↓
VAD
  ↓
streaming STT
  ↓
Turn Manager
  ├── continue listening
  ├── tentative end
  ├── commit user turn
  └── false interruption / backchannel
  ↓
LLM generation
  ↓
sentence/semantic chunker
  ↓
TTS queue
  ↓
audio output
```

## 5.2 Required conversational states

Use a state machine, not scattered booleans.

Minimum states:

- `IDLE`
- `LISTENING`
- `USER_SPEAKING`
- `ENDPOINT_CANDIDATE`
- `COMMITTING`
- `THINKING`
- `SPEAKING`
- `INTERRUPTION_CANDIDATE`
- `INTERRUPTED`
- `RECOVERING`
- `ERROR`
- `OFFLINE`

Transitions MUST be logged as structured events.

## 5.3 End-of-turn decision

Do not issue a model prompt on every silence.

The turn manager should combine:
- VAD speech/silence,
- minimum speech duration,
- trailing silence duration,
- STT finality/confidence if available,
- punctuation/linguistic completeness,
- optional semantic endpoint classifier later,
- maximum wait bound.

Suggested starting parameters, configuration not constants:
- `min_speech_ms`: 180
- `tentative_endpoint_silence_ms`: 350
- `normal_endpoint_silence_ms`: 650
- `uncertain_endpoint_silence_ms`: 1100
- `max_endpoint_wait_ms`: 1800
- `min_interrupt_speech_ms`: 180
- `false_interrupt_recovery_ms`: 800–1200

Tune empirically.

## 5.4 Barge-in / interruption

When the agent is speaking:

1. microphone remains active.
2. AEC/noise processing tries to suppress speaker output.
3. VAD detects candidate user speech.
4. Do NOT instantly destroy the current response on a single noisy frame.
5. Enter `INTERRUPTION_CANDIDATE`.
6. If speech persists past threshold or STT yields credible user content:
   - fade/cancel TTS rapidly,
   - cancel queued speech,
   - cancel LLM generation if still active,
   - preserve already-spoken assistant text separately from unspoken generated text,
   - transition to `USER_SPEAKING`.
7. If candidate is classified as false:
   - resume remaining TTS when possible,
   - avoid duplicating already-played audio.

Latency target from confirmed user speech to perceptible TTS stop:
- ideal <150 ms,
- acceptable MVP <250 ms on normal hardware.

## 5.5 Backchannels

Short utterances such as "mm-hm", laughter, coughs, or ambient voices should not necessarily interrupt.

MVP heuristic:
- short low-confidence STT + duration below threshold + no clear imperative/question -> probable backchannel.
- user configuration MUST offer:
  - interrupt aggressively,
  - balanced (default),
  - interrupt conservatively.

## 5.6 Polling vs event-driven

Audio acquisition is continuous, but command commitment is event-driven.

Use fixed audio frames (e.g. 10–30 ms) for DSP/VAD. Do not poll application-level state with arbitrary sleep loops.

All higher-level pipeline stages communicate through bounded async queues/events.

Backpressure policy:
- audio input must never grow unbounded.
- stale intermediate visualization frames may be dropped.
- committed transcript/model/tool events must not be silently dropped.

## 5.7 Cancellation semantics

A `turn_id` and `generation_id` MUST bind:
- user audio,
- STT,
- model generation,
- TTS chunks,
- tool calls.

Cancellation must be idempotent.

Tool calls already causing external side effects cannot always be cancelled; the UI/core must distinguish:
- cancelled before execution,
- cancellation requested,
- completed,
- failed,
- indeterminate.

---

# 6. Ambient visual interface

## 6.1 Product goal

The screen should communicate system state before the user reads text.

## 6.2 Visual grammar

Base visual layer:
- dark or adaptive background,
- low-frequency breathing field when idle,
- center/field intensity rises with attention,
- microphone waveform/spectral energy influences geometry while listening,
- speech output drives distinct but related motion while speaking,
- thinking state is subtle and based on actual processing status,
- tool activity can introduce localized secondary motion,
- errors should degrade elegantly rather than flash alarming red by default.

## 6.3 Audio-reactive data

UI receives normalized:
- RMS,
- peak,
- 8–32 band spectral energy or simplified FFT bins,
- speech probability,
- state,
- output playback envelope,
- optional speech phoneme/word timing later.

Render loop can interpolate at display refresh rate.

Do not transmit raw microphone audio to UI solely for visualization if core/native layer can send derived metrics.

## 6.4 Accessibility / performance

MUST provide:
- reduced motion mode,
- brightness/intensity control,
- high-contrast transcript,
- keyboard push-to-talk fallback,
- mute,
- stop speaking,
- escape from fullscreen.

GPU use MUST be bounded.
Idle mode should materially lower render activity.

## 6.5 MVP UI controls

Hidden/revealable minimal controls:
- microphone on/off,
- output voice on/off,
- provider/model,
- fullscreen/windowed,
- transcript,
- settings,
- emergency stop.

No dense settings dashboard in the primary ambient view.

---

# 7. Model/provider architecture

## 7.1 Provider interface

```python
class LLMProvider:
    id: str

    async def health(self) -> ProviderHealth: ...
    async def list_models(self) -> list[ModelInfo]: ...
    async def stream_chat(
        self,
        messages: list[Message],
        tools: list[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]: ...
```

## 7.2 Initial providers

Required:
- Ollama.
- Generic OpenAI-compatible HTTP provider.

Optional:
- OpenAI native adapter if needed for provider-specific features.

Never hard-code model names into business logic.

## 7.3 Routing policy

Configuration examples:
- local only,
- local preferred,
- cloud preferred,
- explicit provider/model.

Fallback MUST NOT silently send local/private context to a cloud provider unless the user has permitted that route.

## 7.4 Context construction

For MVP:
- compact system policy,
- recent conversation,
- relevant tool results,
- explicit selected files/context.

Do not build elaborate long-term memory before measurement shows need.

The runtime should expose approximate input/output token counts when provider metadata permits.

---

# 8. Tool and computer-control architecture

## 8.1 Capability model

Every tool declares:

```text
id
description
input schema
risk class
platform support
requires confirmation?
supports cancellation?
side effect category
timeout
```

Risk classes:
- `READ_ONLY`
- `REVERSIBLE_WRITE`
- `EXTERNAL_SIDE_EFFECT`
- `PRIVILEGED`
- `DESTRUCTIVE`

## 8.2 MVP tools

1. files.list
2. files.read
3. files.search
4. files.write / patch
5. shell.run
6. clipboard.read/write
7. app.open
8. system.info

Linux adapters SHOULD use:
- XDG portals where suitable,
- DBus/MPRIS for app/media integration later,
- desktop-environment-specific automation only behind adapters.

Avoid making X11-specific `xdotool` a core architectural dependency.

## 8.3 Tool policy

Default behavior:
- read-only local operations may execute without confirmation within configured roots.
- writes outside project/user-authorized roots need approval.
- destructive/privileged commands need explicit approval.
- command allow/deny patterns are defense in depth, not the sole security model.

Tool output MUST be bounded and summarized before feeding huge outputs to the model.

---

# 9. Self-maintenance and update architecture

## 9.1 Principle

The system may eventually change itself, but **runtime authority and update authority are separated**.

The LLM never directly overwrites the running supervisor binary or replaces arbitrary installed code in place.

## 9.2 Component model

Every updatable component has:

```text
component_id
current_version
candidate_version
source
artifact hash
dependencies
health command/check
rollback target
activation strategy
```

Components:
- supervisor,
- core,
- UI,
- adapters/plugins,
- optional external runtimes.

## 9.3 Safe update transaction

```text
DISCOVER
  ↓
FETCH
  ↓
VERIFY provenance/license/hash
  ↓
STAGE in isolated directory/worktree
  ↓
BUILD
  ↓
TEST
  ↓
SMOKE TEST
  ↓
MARK CANDIDATE
  ↓
ACTIVATE atomically
  ↓
RESTART affected component only
  ↓
HEALTH WINDOW
  ├── healthy → COMMIT last-known-good
  └── unhealthy → ROLLBACK + restart
```

Never update in-place when an atomic versioned-directory/symlink strategy is feasible.

## 9.4 Self-authored patches

Future command example:
> "Your interruption handling is too eager. Fix it."

Permitted flow:

1. core creates a change request with goal and observed behavior.
2. update/development agent creates Git branch/worktree.
3. coding model modifies scoped files.
4. static checks + unit tests.
5. targeted integration simulation.
6. diff/risk summary.
7. approval according to policy.
8. candidate build.
9. supervisor activation.
10. health observation.
11. automatic rollback on failure.

For MVP, implement infrastructure through step 6/7 and manual activation; autonomous activation MAY come later.

## 9.5 Supervisor invariants

Supervisor MUST:
- have minimal dependencies,
- not depend on LLM availability,
- not depend on UI,
- preserve last-known-good metadata,
- detect crash loops,
- enter safe mode after configurable repeated failures,
- be independently reinstallable,
- never accept arbitrary shell commands from the core.

Crash-loop example:
- 3 failures within 60 seconds -> stop restart loop, restore last-known-good candidate if relevant, launch safe mode/status UI.

## 9.6 Source dependency updates

Do not automatically `git pull` arbitrary upstream repositories into production.

For each upstream component:
- pin version/commit,
- periodically discover updates,
- stage update,
- read release notes/diff where practical,
- rebuild/tests,
- activate only through transaction above.

If using Git submodules, never track floating branches in production.

Prefer normal package dependencies or vendored adapters over many git submodules; submodules add operational friction.

---

# 10. Crash resilience and recovery

## 10.1 Failure domains

UI crash:
- supervisor restarts UI,
- core/session continues,
- audio may continue only if core owns it; otherwise pause gracefully.

Core crash:
- stop output audio,
- persist crash marker,
- supervisor restarts core,
- restore most recent safe session metadata,
- UI displays reconnecting state.

Ollama/provider crash:
- retain session,
- mark provider unhealthy,
- retry according to bounded policy,
- optionally offer configured fallback.

STT/TTS failure:
- degrade to text mode independently where possible.

Audio device disappearance:
- detect,
- transition to degraded state,
- rescan devices,
- restore automatically if device returns.

## 10.2 Persistence

SQLite recommended tables:
- sessions,
- turns,
- messages,
- tool_executions,
- component_versions,
- update_transactions,
- settings.

Do not persist raw microphone audio by default.

Store:
- committed transcript,
- assistant text,
- timestamps,
- execution metadata.

## 10.3 Event journal

Maintain bounded diagnostic event journal with structured records.

Use correlation IDs:
- session_id
- turn_id
- generation_id
- tool_call_id
- update_tx_id

---

# 11. Security and privacy

## 11.1 Local-first default

Default:
- microphone audio stays local,
- local model uses Ollama,
- cloud calls happen only when provider is configured,
- raw audio is not recorded.

## 11.2 Secrets

Use OS credential store where feasible.
Never store API keys in repository.
`.env` only for local development and MUST be gitignored.

## 11.3 Shell

No direct string concatenation into shell commands from untrusted data where structured subprocess arguments suffice.

High-risk commands require confirmation.

## 11.4 Prompt injection

Content retrieved from files/web is data, not authority.

Tool policy is enforced outside the model.

The model cannot grant itself additional capabilities merely by emitting text.

---

# 12. Portability strategy

## 12.1 Layering

Platform-neutral:
- protocol schemas,
- turn state machine,
- provider API,
- tool schema,
- session model,
- update transaction model.

Platform-specific:
- audio device backend,
- window integration,
- app control,
- clipboard,
- notifications,
- keychain,
- filesystem permission UX.

## 12.2 Mobile

Do not implement Android/iOS in MVP.

MUST avoid desktop-only assumptions in core APIs.

Desired future topology:
- same Tauri/web frontend where practical,
- shared Rust/native shell,
- core either embedded, local sidecar where supported, or remote companion mode,
- Android/iOS capability adapters,
- mobile-specific permission lifecycle.

---

# 13. Open-source reuse policy

Goal: minimize custom code while keeping commercial-use options clean.

## 13.1 Reuse hierarchy

Prefer, in order:

1. stable package dependency with permissive license,
2. thin adapter around installed executable/service,
3. small copied implementation with preserved attribution and provenance,
4. adapted reference code,
5. custom implementation only when necessary.

## 13.2 Mandatory license gate

Before any source copy:
- inspect repository LICENSE,
- inspect file headers,
- inspect dependency/model license if bundled,
- record provenance in `THIRD_PARTY.md`,
- preserve required notices,
- reject incompatible copyleft code unless owner explicitly approves the obligations.

## 13.3 Current reference shortlist

### Safe/default candidates, subject to version-level audit

**Ollama**
- URL: https://github.com/ollama/ollama
- Code license: MIT.
- Use: local model service/API.
- Strategy: dependency/external service; do not fork unless necessary.

**Tauri**
- URL: https://github.com/tauri-apps/tauri
- License: MIT OR Apache-2.0.
- Use: desktop/mobile application shell.

**whisper.cpp**
- URL: https://github.com/ggml-org/whisper.cpp
- License: MIT.
- Use: local portable STT candidate.

**faster-whisper**
- URL: https://github.com/SYSTRAN/faster-whisper
- License: MIT.
- Use: Python STT candidate.

**ONNX Runtime**
- URL: https://github.com/microsoft/onnxruntime
- License: MIT.
- Use: inference runtime if needed.

**LiveKit Agents framework**
- URL: https://github.com/livekit/agents
- Framework license: Apache-2.0.
- Use: reference/reuse for voice turn-taking and interruption.
- Caveat: turn-detection model assets use separate licensing; audit before bundling.

**qartex/jarvis-desktop**
- URL: https://github.com/qartex/jarvis-desktop
- Repository currently states MIT.
- Use: visual/voice/desktop reference; selective reuse after provenance audit.
- Caveat: relatively immature project; do not depend on its architecture blindly.

### Reference-only unless licensing strategy changes

**Open Interpreter / 01**
- URL: https://github.com/openinterpreter/01
- License: AGPL-3.0.
- Excellent conceptual/reference material for voice computer interfaces.
- Do not copy AGPL code into a permissively licensed/commercial closed-source-capable core without owner approval of AGPL obligations.

**Adelie desktop assistant**
- URL: https://github.com/adelie-ai/desktop-assistant
- License: AGPL-3.0-or-later.
- Architecture reference only by default.

**Resro30/Jarvis**
- URL: https://github.com/Resro30/Jarvis
- Useful Linux/KDE/Wayland architecture reference.
- License MUST be verified before any code copying.

### Piper warning

Historical:
- https://github.com/rhasspy/piper
- repository license text says MIT,
- archived in 2025,
- development moved,
- dependency chain has raised GPL questions.
Treat runtime and voice assets as license-sensitive.
Do not vendor blindly.

## 13.4 No "license laundering"

Rewriting or translating nonpermissive source code does not automatically remove its licensing obligations.

Codex may learn architectural ideas from reference projects but must create an independently structured implementation unless direct reuse is compatible.

---

# 14. Repository structure

Codex should create approximately:

```text
zev-ambient/
├── AGENTS.md
├── README.md
├── LICENSE
├── THIRD_PARTY.md
├── pyproject.toml
├── package.json / pnpm-workspace.yaml (if needed)
├── Cargo.toml
├── src/
│   ├── core/
│   │   ├── session/
│   │   ├── turns/
│   │   ├── voice/
│   │   ├── providers/
│   │   ├── tools/
│   │   ├── policy/
│   │   ├── storage/
│   │   └── protocol/
│   ├── supervisor/
│   └── adapters/
│       ├── linux/
│       ├── ollama/
│       ├── stt/
│       └── tts/
├── ui/
│   ├── src/
│   │   ├── ambient/
│   │   ├── audio-viz/
│   │   ├── state/
│   │   └── settings/
│   └── src-tauri/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── voice_sim/
│   └── update_sim/
├── scripts/
│   ├── bootstrap.*
│   ├── dev.*
│   ├── test.*
│   └── package.*
└── docs/
    ├── STATE.md
    ├── DECISIONS.md
    ├── PROTOCOL.md
    └── architecture/
```

Codex may simplify this structure if the repository becomes needlessly fragmented.

---

# 15. Protocol/events

Use versioned events.

Example:

```json
{
  "protocol": 1,
  "type": "voice.state_changed",
  "session_id": "uuid",
  "turn_id": "uuid",
  "monotonic_ms": 12345678,
  "payload": {
    "from": "LISTENING",
    "to": "USER_SPEAKING"
  }
}
```

Minimum event families:

- system.ready
- component.health
- component.error
- voice.level
- voice.vad
- voice.state_changed
- transcript.partial
- transcript.final
- turn.committed
- model.delta
- model.completed
- tts.started
- tts.level
- tts.completed
- tts.cancelled
- tool.requested
- tool.started
- tool.completed
- tool.failed
- update.state_changed

Backward compatibility:
- protocol version increment for breaking changes.
- UI should gracefully reject unsupported protocol versions.

---

# 16. Testing strategy

Do not depend mainly on manual microphone testing.

## 16.1 Unit tests

Must cover:
- turn-state transitions,
- interruption thresholds,
- false-interruption recovery,
- cancellation idempotency,
- provider fallback rules,
- cloud privacy routing,
- tool risk policies,
- update transaction state machine,
- crash-loop detection.

## 16.2 Deterministic voice simulation

Create fixtures/events simulating:
- normal sentence + silence,
- pause mid-sentence,
- user interrupts agent,
- cough/noise during agent speech,
- "mm-hm" backchannel,
- echo spike,
- user resumes after false endpoint,
- STT partial revision,
- audio device loss.

Tests should feed timestamps/VAD/STT events without requiring real-time waiting.

## 16.3 Integration

- Ollama mocked adapter.
- optional live Ollama test marked separately.
- STT/TTS adapters mocked.
- UI protocol contract tests.
- supervisor child-process crash/restart test.
- update candidate success/rollback test.

## 16.4 Performance targets

Measure:
- audio frame processing lag,
- speech-stop latency,
- first partial transcript latency,
- committed-turn to first model token,
- first model token to first audible TTS,
- UI frame rate,
- idle CPU.

Do not optimize before measuring.

---

# 17. Observability

Structured logs in development.

Levels:
- ERROR
- WARN
- INFO
- DEBUG
- TRACE optional

Never log:
- API keys,
- raw microphone buffers,
- full sensitive file contents by default.

Provide a `zev doctor` equivalent:
- version,
- supervisor health,
- audio devices,
- Ollama reachability,
- installed models,
- STT/TTS availability,
- filesystem permissions,
- provider health,
- recent crash/update status.

---

# 18. Configuration

Single user config with documented schema.

Example conceptual structure:

```toml
[voice]
mode = "balanced"
input_device = "default"
output_device = "default"

[llm]
routing = "local_preferred"
default_provider = "ollama"
default_model = "..."

[providers.ollama]
base_url = "http://127.0.0.1:11434"

[privacy]
allow_cloud_fallback = false
store_audio = false

[ui]
fullscreen = true
reduced_motion = false

[updates]
channel = "stable"
automatic_download = true
automatic_activate = false
```

Secrets separate from general config.

---

# 19. Codex implementation plan

Codex should execute these phases without asking the owner to perform setup steps that Codex can do itself.

## Phase 0 — bootstrap

Codex:
1. inspect environment,
2. install only missing development dependencies that are safe and user-writable,
3. create Git repository,
4. create initial branch,
5. create AGENTS.md,
6. create project skeleton,
7. create `docs/STATE.md`,
8. record toolchain versions,
9. produce first green test.

If system package installation requires privilege, ask once with exact command and reason rather than making the owner manually investigate.

## Phase 1 — core state machine

Deliver:
- protocol models,
- turn state machine,
- deterministic tests,
- cancellation framework,
- event bus.

No real microphone required yet.

Acceptance:
- all simulated turn tests green.

## Phase 2 — Ollama conversational text loop

Deliver:
- provider interface,
- Ollama discovery/health/list/stream,
- CLI/dev harness,
- cancellation,
- mock tests.

Reuse prior Zev logic where clean and license-compatible.

Acceptance:
- user can type a prompt and stream a local response.

## Phase 3 — audio/STT/TTS

Deliver:
- audio capture,
- VAD,
- local STT adapter,
- local TTS adapter,
- sentence chunking,
- voice state events.

Acceptance:
- natural voice question produces spoken answer.

## Phase 4 — barge-in

Deliver:
- interruption candidate logic,
- false-interruption recovery,
- TTS/model cancellation,
- deterministic tests.

Acceptance:
- user interrupts agent naturally and response stops quickly without corrupting the next turn.

## Phase 5 — ambient UI

Deliver:
- Tauri window,
- typed IPC,
- reactive visual field,
- transcript overlay,
- settings essentials.

Acceptance:
- visuals correspond to actual state/audio metrics.

## Phase 6 — basic tools

Deliver:
- file tools,
- shell policy,
- clipboard,
- app open,
- risk classification.

Acceptance:
- user can verbally ask for a safe local file operation and see result.

## Phase 7 — supervisor/resilience

Deliver:
- supervisor,
- health probes,
- restart logic,
- crash-loop safe mode,
- session recovery.

Acceptance:
- intentionally kill UI/core and system recovers without manual repair.

## Phase 8 — staged updates

Deliver:
- component manifest,
- staged candidate,
- tests,
- atomic activation,
- health window,
- rollback.

Acceptance:
- deliberately broken candidate rolls back automatically.

## Phase 9 — package MVP

Deliver:
- one-command dev launch,
- distributable Linux package/app bundle,
- README,
- third-party notices,
- doctor command,
- smoke test.

---

# 20. Definition of Done for MVP

MVP is done when all are true:

1. Fresh Linux installation can be bootstrapped with documented minimal steps.
2. User can launch Zev Ambient.
3. User sees ambient responsive interface.
4. User can talk without push-to-talk.
5. Normal pauses do not frequently prematurely commit.
6. User can interrupt spoken agent response.
7. False interruptions recover acceptably.
8. Ollama works as default model backend.
9. Text-only degraded mode works if voice fails.
10. Basic file/tool operations work.
11. Core and UI can crash and restart gracefully.
12. Update simulator proves rollback.
13. No known incompatible copied source is present.
14. THIRD_PARTY.md is complete.
15. Automated tests pass.
16. No API key or sensitive audio is stored accidentally.
17. `docs/STATE.md` accurately describes current status in under ~200 lines.
18. Owner can inspect any component without needing to understand every other component.

---

# 21. Token/cost minimization for Codex

This is a project requirement.

## 21.1 Context discipline

Codex must:
- begin each subsequent session by reading `AGENTS.md` + `docs/STATE.md`,
- inspect this full spec only when needed,
- reference section numbers rather than restating them,
- avoid loading generated build artifacts,
- avoid scanning entire dependency trees,
- use targeted search/ripgrep,
- keep logs/output bounded,
- summarize huge compiler/test output before reinserting it into model context.

## 21.2 Work granularity

One milestone should normally touch a small coherent set of files.

Prefer:
- small interfaces,
- tests next to behavior,
- commits after green vertical slices.

Do not ask Codex for repeated architectural re-evaluation unless evidence invalidates a decision.

## 21.3 Reuse discipline

Before implementing a nontrivial subsystem:
1. search existing dependency already in stack,
2. check permissively licensed reference,
3. adopt a small dependency/adapter if lower maintenance,
4. custom-build only remaining product-specific logic.

## 21.4 Expensive model use

At runtime, local Ollama is default.

During development:
- use Codex for repository reasoning and changes,
- use deterministic scripts/tests rather than asking Codex to manually reason through repeated runtime outputs,
- encode solved lessons in tests/STATE rather than reprompting.

---

# 22. Owner interaction policy

The owner is the executive customer.

Codex should present:
- milestone reached,
- what materially changed,
- notable decision/deviation,
- current risk/blocker,
- next milestone.

Do not burden owner with:
- package boilerplate,
- directory creation,
- routine git commands,
- routine dependency resolution,
- lint formatting,
- test invocation,
- minor implementation choices.

Ask owner only for:
- visual/product preference that cannot be inferred,
- irreversible data/security permission,
- license/business-model decision,
- purchase/API expenditure,
- destructive system change,
- choice among materially different product behaviors.

---

# 23. First-run experience

Target:

```text
$ codex
> Read ZEV_AMBIENT_CODEX_SPEC.md and build the project autonomously.
```

Codex should then:
- inspect environment,
- create repository if absent,
- bootstrap project,
- implement Phase 0 and proceed into Phase 1,
- stop only for a genuine permission/blocker or after a meaningful green milestone if interaction is required.

For the actual end user after packaging:

```text
zev-ambient
```

Expected:
- supervisor starts,
- core health checks,
- Ollama discovered,
- model selection sensible,
- audio devices detected,
- UI appears,
- user begins speaking.

---

# 24. Decision record — major choices

**D1. Local-first.**
Reason: privacy, zero marginal inference cost, offline operation.

**D2. Ollama first-class, provider-neutral core.**
Reason: preserve Zev heritage without lock-in.

**D3. Python core + Tauri/TypeScript UI for MVP.**
Reason: maximum reuse and lowest implementation effort while retaining future portability.

**D4. Small supervised modular monolith.**
Reason: simpler than microservices while isolating critical crash/update domains.

**D5. Separate supervisor from conversational agent.**
Reason: self-update cannot be resilient if the only updater can overwrite itself while executing.

**D6. Event-driven voice state machine.**
Reason: speech interaction is continuous at signal level but discrete at conversational commitment level.

**D7. Multi-signal endpointing and interruption.**
Reason: pure VAD thresholds are too brittle for natural interaction.

**D8. Staged, versioned, rollback-capable updates.**
Reason: live self-modification without recovery is operationally unacceptable.

**D9. Tauri rather than Electron.**
Reason: smaller native shell, Rust boundary, cross-platform/mobile trajectory.

**D10. Permissive-dependency preference.**
Reason: preserve commercial-use flexibility.

**D11. AGPL projects as reference by default, not copied code.**
Reason: avoid accidental reciprocal licensing obligations.

**D12. No premature mobile or vision implementation.**
Reason: keep MVP tractable while preserving seams.

---

# 25. Research/reference links

Codex should prefer current primary sources when implementation begins.

OpenAI Codex:
- https://github.com/openai/codex
- Codex supports repository-level `AGENTS.md`; scoped AGENTS files may apply by directory.
- Current Codex CLI can be used by signing in with a ChatGPT plan.

Tauri:
- https://github.com/tauri-apps/tauri

Ollama:
- https://github.com/ollama/ollama

whisper.cpp:
- https://github.com/ggml-org/whisper.cpp

faster-whisper:
- https://github.com/SYSTRAN/faster-whisper

LiveKit Agents:
- https://github.com/livekit/agents

Open Interpreter / 01:
- https://github.com/openinterpreter/01

Jarvis Desktop:
- https://github.com/qartex/jarvis-desktop

Resro30/Jarvis:
- https://github.com/Resro30/Jarvis

Adelie:
- https://github.com/adelie-ai/desktop-assistant

ONNX Runtime:
- https://github.com/microsoft/onnxruntime

Historical Zev:
- https://github.com/marqbritt/zev

---

# 26. Bootstrap instruction to Codex

When this file is first supplied, Codex should interpret the following as the execution order:

1. Read Sections 0, 1, 2, 3, 13, 19, 20, 21 and 22 first.
2. Inspect the current machine and the current Zev repository/source if available.
3. Verify current licenses of any code intended for direct reuse.
4. Create the repository and AGENTS.md itself.
5. Implement Phase 0.
6. Implement Phase 1 with deterministic tests.
7. Continue phase-by-phase autonomously while keeping the tree green.
8. Do not ask the owner to run commands Codex can run.
9. Do not consume context producing long reports; write compact durable state into `docs/STATE.md`.
10. Never sacrifice rollback, cancellation correctness or licensing for speed.

The desired outcome is not the largest codebase. It is the **smallest coherent system that already feels like speaking naturally to an intelligent computer and is structurally capable of becoming much more powerful without being rebuilt.**
