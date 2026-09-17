# Getting started with Sam

Development builds prefer a dedicated Sam window using installed Edge, Chrome or
Chromium, after UI readiness while the core continues starting. No browser installation is performed. Use
`uv run sam-ambient --ui-mode browser` for a normal browser/debug session; app
browser absence automatically falls back. Sam uses its own ignored `.sam/ui-profile`.
The window may initially say **Starting Sam** while the local core checks existing
providers and prepares speech. This is actual connection state, not a progress
percentage; readiness or a precise degraded explanation replaces it.
Quit Sam stops the runtime and requests closure of its Windows app window; if the
browser/platform refuses, close the stopped page manually. Closing the dedicated
window also stops Sam; closing a fallback browser tab does not. A second launch
for the same root reports the existing local UI instead of competing for ports.

Sam 0.2.1 alpha currently runs from source with a local app-window/browser UI.
There is no accepted installer yet. The integrated native shell is release-candidate
source, not an accepted package. Install prerequisites yourself; Sam downloads no
models.

## End-user runtime prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/), then a checkout of this repository.
- For answers: an installed local inference runtime with at least one **chat/instruct**
  model that fits your machine. An embedding model cannot answer conversations.
- [LM Studio](https://lmstudio.ai/) is the recommended currently validated Windows
  provider. Open it once after installation so its bundled `lms` CLI is available.
- Ollama support is covered by automated discovery/startup tests, but the current
  Windows release-candidate validation used LM Studio. Already-running loopback
  OpenAI-compatible endpoints can also be configured explicitly.
- Windows is the current development/validated text platform. Linux is the primary
  deployment target, but full Linux voice/hardware acceptance remains pending.

The source checkout includes compiled frontend assets. Node/pnpm is needed only to
rebuild them. Rust, Cargo, Tauri, WebView2, MSVC Build Tools, and the Windows SDK are
developer-native build prerequisites, not end-user runtime requirements. A future
packaged Windows Sam will carry its Python companion and will not require a checkout,
Python, uv, Node, Rust, or Build Tools from the user.

## Install a conversational model in LM Studio

1. Open LM Studio and use its model search/download view to choose a chat or instruct
   model whose size fits your available memory. Do not choose an embedding-only model.
2. Download the model in LM Studio. The equivalent CLI is `lms get MODEL_NAME`.
3. Verify disk inventory with `lms ls`. This means **installed**, not loaded.
4. `lms ps` lists models currently **loaded** in memory. An installed model may
   legitimately be unloaded; Sam can still discover it.

Sam never downloads a model. During normal startup it may start the installed LM
Studio server and load a valid explicit model, the last model that answered
successfully, or the sole installed conversational model. If several viable models
are installed, Sam waits for you to choose one rather than guessing.

### Native Windows development (unreleased)

The browser path remains supported. Tauri 2 is a thin native window and lifecycle
layer around the same React UI and Python runtime; it does not replace Sam's core.
Native contributors need Node/pnpm, Rust/Cargo, WebView2, and on Windows the MSVC
C++ Build Tools plus a Windows SDK:

```sh
cd ui
pnpm install --frozen-lockfile
pnpm native:dev
```

The development shell starts one trusted `sam-supervisor --no-ui` child and uses
the existing localhost protocol. A second launch focuses the existing window.
Closing the native window opens Sam's existing Quit confirmation, and acknowledged
shutdown closes the window. Normal browser and Chromium app-window launch paths
remain available.

The repository also contains guarded companion and NSIS packaging scripts for
later release work. They are intentionally outside this source-integration flow;
do not treat their presence as package, signing, antivirus, or release acceptance.

## First launch

From the repository directory:

```sh
uv sync --locked
uv run sam-ambient
```

`uv run sam-ambient` is the normal source launch command. The supervisor starts the
core and static UI. Startup may take several tens of seconds while an installed
model loads. The browser/app window opens once after UI readiness:
[http://127.0.0.1:8766](http://127.0.0.1:8766). Closing a fallback browser tab
does not stop Sam; closing the owned app window requests graceful shutdown.
The startup card reports provider discovery and model loading. If several models
are available, choose a provider/model and optionally remember it. After changing
LM Studio externally, use **Rescan**; **Continue in available mode** keeps diagnostics
and settings usable but cannot produce an answer without a model.

Open **Controls → Text request**, type a short question, and press **Send**. Ask a
follow-up: committed recent conversation context is retained locally. When the
separate voice prerequisites below are ready, enable **Microphone** to talk and
leave **Voice** enabled for spoken replies.

## Configuration

For a checkout, copy `config/sam.example.toml` to `config/sam.toml`. Sam also
looks for `%APPDATA%\Sam\sam.toml` on Windows and
`${XDG_CONFIG_HOME:-~/.config}/sam-ambient/sam.toml` on Linux. Precedence is:

1. built-in safe defaults;
2. user configuration;
3. workspace `config/sam.toml`;
4. `SAM_*` environment variables;
5. explicit CLI options.

Use `sam-ambient --config PATH` for a specific file. With the `sam` diagnostics
CLI, place the option before the command: `sam --config PATH doctor`. Existing
CLI flags remain supported and always win. The concise example documents the
supported keys for provider/model, local compatible endpoint, workspace/UI,
STT/languages, system voice, privacy, and approval-gated workspace writes.
Unknown keys, wrong types, and unsupported schema versions fail with a direct
message. `OPENAI_API_KEY` and other secrets stay in their dedicated environment
or service configuration, never ordinary TOML. Last-good provider/model state
continues to live in `.sam/state.db` and cannot rewrite user configuration.

Optional local MCP servers may be declared as `[[external.mcp_servers]]` only in
the per-user file or an explicit `--config` file. Each entry has a stable `id`,
structured `command` argv, optional absolute `working_directory`, bounded
`timeout_s`, and `result_limit_bytes`; see `config/sam.example.toml`. Workspace
configuration cannot introduce process-launch authority. Discovery grants no
permission: every external call still presents Sam's exact owner approval.

Selection order: a valid explicit provider/model → a valid last-successful local
provider/model → the sole installed local conversational model. If several viable
models remain, Sam asks you to choose instead of selecting by list order. A stale
saved preference does not prevent fallback discovery; an explicit unavailable
choice is not silently replaced. No automatic cloud fallback occurs.

Installed stopped Ollama/LM Studio services receive a bounded startup attempt.
Sam reuses running services. For LM Studio, if no chat model is loaded, Sam loads
an explicit/saved installed model, or the sole installed conversational model.
Several candidates require an explicit choice. Loading has its own cancellable
180-second bound, with 4096-token context and 600-second idle TTL. It never evicts
an existing loaded model. It cannot install missing
runtimes/models or manage authenticated servers automatically.

Explicit choices, when needed:

```sh
uv run sam-ambient --provider lm-studio --model YOUR_INSTALLED_MODEL_ID
uv run sam-ambient --provider ollama
uv run sam-ambient --provider openai-compatible --base-url http://127.0.0.1:8000/v1
```

## Everyday controls

- **Rescan providers/models** refreshes installed and loaded inventory without a
  full restart when recovery is safe.
- **Restart Sam** confirms, cancels active work, and restarts Sam's managed Python
  components. It does not apply provider/model exit cleanup.
- **Reload interface** reloads React and reconnects to the running core. It does
  not restart Sam or the provider.
- **Quit Sam** confirms and stops the application. Provider/model exit preferences
  default to **Keep**. Opt-in cleanup can affect only a service Sam started or an
  LM Studio model Sam loaded during the current application lifetime.
- **Microphone sensitivity** and **Output volume** are Sam input/output gains from
  0-200%; they do not change Windows mixer levels.
- **Display** contains quality, performance profile, reduced motion, visual
  intensity, motion, audio reactivity, particles, transcript, and fullscreen.

## Voice prerequisites

Text can work without voice. Microphone and playback use system-default devices.
For the most reliable 0.2.1 alpha experience, start in text mode; voice input is
experimental and has known physical and sustained-noise limitations.
Input needs a separately installed whisper.cpp server and multilingual model,
normally at `http://127.0.0.1:8080`.
On Windows Sam can automatically start the existing development layout:

```text
<root>/.sam/runtime/whisper-b4938/Release/whisper-server.exe
<root>/.sam/models/ggml-base.bin
```

It checks HTTP readiness and waits up to eight seconds; absent/invalid files
produce an exact diagnostic and leave text usable. No download is attempted.
Custom STT endpoints and Linux STT services must be started externally.
Output uses Windows System.Speech; Linux needs an external `espeak-ng` or `espeak`.
Physical speech accuracy, speaker echo and natural barge-in still require human
acceptance; automated tests are not a claim that every microphone setup works.
Use `--no-voice --no-tts` for text-only operation.

## Status, shutdown and common failures

The startup card shows discovery and long model-loading state. If action is needed,
choose an installed conversational model or use **Rescan** after changing an
external service; **Continue in available mode** leaves the non-model UI usable.
Controls can rescan later without restarting, and **Restart Sam** restarts managed
Sam components without stopping external provider services. Expand provider/model
status to read why it was selected, whether Sam started or reused it, and STT/TTS
readiness. No model means the UI can operate but cannot answer.
`uv run sam doctor --root .` is read-only and reports categorized readiness plus
actionable next steps. Add `--verbose` for bounded component inventories or
`--json` for automation. `uv run sam-ambient --verbose` shows startup decisions
without prompts, audio contents, or credentials.

Choose **Quit Sam → Confirm quit**, or Ctrl+Q. Cancel/Escape keeps Sam running.
The stopped screen means reconnection is off; close any remaining fallback tab.
Ctrl+C also stops managed components. By default local models and provider services
remain available. Application controls can opt into unloading a model Sam loaded or
stopping a service Sam started during graceful Quit. Existing/shared resources are
never claimed by discovery, and Restart keeps resources available.

If the browser fails, open the URL manually. If no model is usable, check your
runtime's installed chat models and the reported startup failure. If ports are
occupied, check for an earlier Sam instance. Rescan after correcting or externally
loading a model; restart Sam only when the reported recovery action requires it.
See [Troubleshooting](TROUBLESHOOTING.md) and [User guide](USER_GUIDE.md).
