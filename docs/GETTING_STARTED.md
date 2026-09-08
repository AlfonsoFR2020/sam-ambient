# Getting started with Sam

Sam 0.1.2 runs as a Python application with a local browser UI. There is no
seamless installer yet. Install prerequisites yourself; Sam downloads no models.

## Prerequisites

- Python 3.12+ and [uv](https://docs.astral.sh/uv/), then a checkout of this repository.
- For answers: an installed local inference runtime with at least one **chat/instruct**
  model that fits your machine. An embedding model cannot answer conversations.
- LM Studio (including headless llmster) needs its `lms` CLI for automatic startup
  and loading. Ollama needs its `ollama` executable for automatic service startup.
  Already-running loopback OpenAI-compatible endpoints can also be configured.
- Windows is the current development/validated text platform. Linux is the primary
  deployment target, but full Linux voice/hardware acceptance remains pending.

Node/pnpm is needed only to rebuild the frontend; the checkout includes compiled
assets. Rust, Tauri and Windows MSVC Build Tools are not required to run Sam.

## Start and send a first request

From the repository directory:

```sh
uv sync --locked
uv run sam-ambient
```

The supervisor starts the core and static UI. Startup may take several tens of
seconds while an installed model loads. The browser opens once after readiness:
[http://127.0.0.1:8766](http://127.0.0.1:8766). Closing it does not stop Sam.
Use **Controls → Text request**, type a short question, and press **Send**.
Ask a follow-up: committed recent conversation context is retained locally.

Selection order: explicit CLI configuration → last successful local provider/model
→ Ollama → LM Studio → explicitly configured compatible endpoint. Deleted/stopped
saved preferences do not prevent fallback discovery; an explicit unavailable
choice is not silently replaced. No automatic cloud fallback occurs.

Installed stopped Ollama/LM Studio services receive a bounded startup attempt
(20 seconds per backend including readiness/loading). Sam reuses running services.
For LM Studio, if no chat model is loaded, it chooses the saved installed model
or the first sorted installed chat model, with 4096-token context and 600-second
idle TTL. It never evicts an existing loaded model. It cannot install missing
runtimes/models or manage authenticated servers automatically.

Explicit choices, when needed:

```sh
uv run sam-ambient --provider lm-studio --model YOUR_INSTALLED_MODEL_ID
uv run sam-ambient --provider ollama
uv run sam-ambient --provider openai-compatible --base-url http://127.0.0.1:8000/v1
```

## Voice prerequisites

Text can work without voice. Microphone and playback use system-default devices.
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

Expand the provider/model status to read why it was selected, whether Sam started
or reused it, and STT/TTS readiness. No model means the UI can operate but cannot answer.
`uv run sam doctor --root .` is read-only; `uv run sam-ambient --verbose` shows
startup decisions without prompts, audio or credentials.

Choose **Quit Sam → Confirm quit**, or Ctrl+Q. Cancel/Escape keeps Sam running.
The stopped screen means reconnection is off; close the remaining browser tab.
Ctrl+C also stops managed components. Existing model services remain running;
Sam-owned Ollama/Whisper child processes are cleaned up. LM Studio's shared
daemon/server is retained to avoid interrupting other users/apps.

If the browser fails, open the URL manually. If no model is usable, check your
runtime's installed chat models and the reported startup failure. If ports are
occupied, check for an earlier Sam instance. Restart Sam after correcting an
external service. See [Troubleshooting](TROUBLESHOOTING.md) and [User guide](USER_GUIDE.md).
