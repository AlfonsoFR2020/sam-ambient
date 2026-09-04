# Sam 0.1.0 MVP

Sam is a local-first ambient voice computer interface. Its trusted supervisor
starts the conversational core and packaged browser UI, while model, tool,
update, and capability authority remain behind explicit runtime boundaries.

## Install and run

Prerequisites are Python 3.12+, [uv](https://docs.astral.sh/uv/), and Ollama
with at least one local model. Bootstrap, validate readiness, then launch:

```powershell
./scripts/bootstrap.ps1
uv run sam doctor --root .
uv run sam-ambient
```

On Linux or macOS:

```sh
./scripts/bootstrap.sh
uv run sam doctor --root .
uv run sam-ambient
```

`sam-ambient` is the end-user command. It supervises `sam-core` and the static
ambient UI, opens `http://127.0.0.1:8766`, and connects that UI to the core at
`ws://127.0.0.1:8765`. Both listeners are loopback-only. Use `Ctrl+C` for a
bounded clean shutdown. Runtime state lives under `.sam/` by default.

Voice input uses PortAudio + WebRTC VAD and a separately managed loopback
whisper.cpp server (default `http://127.0.0.1:8080`). Spoken output uses Windows
System.Speech on Windows; Linux resolves a separately installed `espeak-ng` or
`espeak` command. If audio, STT, TTS, or Ollama is unavailable, the static UI
still provides text interaction and diagnostics. Use `--no-voice` or `--no-tts`
to select an explicit degraded mode.

`config/sam.example.toml` documents the intended settings schema; the 0.1.0
launcher currently accepts the equivalent explicit command-line options.

## Build a release artifact

The offline MVP artifact is a Python wheel containing the compiled frontend,
launchers, notices, and runtime code:

```powershell
./scripts/package.ps1
uv tool install ./dist/sam_ambient-0.1.0-py3-none-any.whl
sam-ambient --root C:\path\to\authorized\workspace
```

On Linux, run `./scripts/package.sh`, install the resulting wheel with
`uv tool install`, and install `espeak-ng` plus a whisper.cpp server separately
when voice is desired. No native Tauri/Rust/MSVC build is required for this MVP.

## Development and tests

Run `./scripts/test.ps1` or `./scripts/test.sh` for the complete deterministic
gate. The browser/Vite development path remains `./scripts/ui-dev.ps1` or
`./scripts/ui-dev.sh`. The core can also be started directly:

```powershell
uv run sam runtime --root . --allow-workspace-write
```

The write flag exposes approval-gated atomic `files.write` only for that root.
Structured `process.run` and `app.open` also require explicit owner approval;
process execution never enables shell parsing or privilege elevation.

Provider diagnostics and text-only use remain available independently:

```powershell
uv run sam doctor --root .
uv run sam models
uv run sam chat --model <installed-model> "Hello Sam"
```

A generic OpenAI-compatible endpoint can be selected explicitly with
`--provider openai-compatible --base-url <url>`. Its key is read from the
environment variable named by `--api-key-env`, never from a command-line value
or repository file.

## Architecture boundaries

- `sam_ambient.core` owns provider-neutral conversation, policy, and protocol.
- `sam_ambient.adapters` owns platform and service integrations.
- `sam_ambient.supervisor` is a separate authority boundary and never depends
  on model reasoning.
- `ui` is presentation-only behind a replaceable transport and remains ready
  for the deferred Tauri native shell.

The project license is temporarily reserved pending the owner's specified
MIT-vs-Apache-2.0 selection. See `LICENSE` and `THIRD_PARTY.md`.
