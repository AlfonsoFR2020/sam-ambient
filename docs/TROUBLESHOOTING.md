# First-run troubleshooting

Start with `uv run sam doctor --root .` (or `sam doctor` after wheel installation).
For safe lifecycle detail, run `uv run sam-ambient --verbose`. JSON diagnostics:
`uv run sam doctor --root . --json`. DEBUG adds Sam diagnostics without HTTP bodies,
prompts, file contents, credentials, or microphone audio.

## Configuration error

Sam names malformed TOML, unknown keys, wrong types, and unsupported
`schema_version` values before runtime startup. Compare the file with
`config/sam.example.toml`. Precedence is CLI, environment, workspace config,
user config, then defaults (highest first). Use `sam --config PATH doctor` to
validate a specific file. Do not put API keys in TOML; runtime last-good state in
`.sam/state.db` is intentionally separate and may be stale without blocking
fallback discovery.

## Browser or UI does not open

Open **http://127.0.0.1:8766** manually. A failed browser handoff does not stop Sam.
The browser is opened once per launch; reconnecting or restarting the core does
not open another window. Look for `sam-ui ready` and the UI URL in the console.
If the port is already occupied, close the earlier Sam instance. If packaged
assets are missing, run the frontend build or reinstall the wheel. Vite is not
required to run the compiled UI. Keep the default 8765/8766 ports for the packaged UI.

Quit through **Quit Sam** or Ctrl+Q; confirm once. The page shows that Sam has
stopped and can be closed. Ctrl+C in the launch console also stops the managed
components. Merely closing the browser leaves Sam running.

## Native shell does not build

The unreleased shell requires Rust/Cargo and Tauri's platform compiler
prerequisites. On Windows, `link.exe` missing from `pnpm native:dev` means the
MSVC C++ Build Tools or Windows SDK are absent, or the terminal has not picked up
the completed installation. Open a fresh terminal or a Developer PowerShell and
run `pnpm exec tauri info`; Visual Studio IDE is not required. WebView2 is the
runtime renderer. These are build dependencies, not intended end-user
prerequisites. Use the browser launch path meanwhile.

Native release packaging additionally requires a self-contained sibling
`sam-supervisor.exe`; the shell fails clearly instead of launching an arbitrary
executable. That companion is intentionally not built yet.
Confirmation is an in-app **Confirm quit / Cancel** dialog with keyboard focus;
Escape cancels it. After acknowledgement, reconnection is disabled.

If uv reports a certificate-chain error behind a trusted corporate proxy, try
`uv --native-tls sync --locked` to use the OS trust store; do not disable TLS verification.

## No local model selected

The UI can load without an inference service, but Sam cannot respond without a
usable model. Doctor shows each service and the selected model/reason. Start your
existing model service if automatic startup fails, then restart Sam. Sam never downloads models.
Automatic priority is last successful local selection, Ollama, LM Studio, then `--local-compatible-url`; explicit
`--provider` / `--base-url` / `--model` selections take precedence and do not fall back.

## Ollama is installed but unavailable

Check your existing Ollama app/service and `ollama list`. Its usual endpoint is
`http://127.0.0.1:11434`; `OLLAMA_HOST` or `--base-url` can point to another loopback
endpoint. Installed models are listed by doctor. An installed executable alone
does not mean a service or model is ready.

## LM Studio / lms / llmster is unavailable

Check `lms daemon status --json --quiet` and `lms server status --json --quiet`.
Application startup attempts `lms server start` on loopback and loads an existing
conversational model if none is loaded (20-second combined deadline). A missing
`lms` CLI, no installed chat model, or startup/load failure is reported. If it
fails, check the same installation using its UI/CLI and restart Sam. The default API endpoint is
`http://127.0.0.1:1234/v1`; a running port reported by `lms` is also recognized.
Use `--provider lm-studio --base-url http://127.0.0.1:PORT/v1` for an explicit port.
When the server is stopped, downloaded model inventory may be unknown: `lms ps`
and `lms ls` can wake the service, so passive discovery does not invoke them.
Local servers requiring API authentication are not selected by automatic discovery.

## No microphone or STT

Doctor lists audio devices and the configured STT endpoint's TCP reachability.
Check OS microphone permissions/default input, then your separately installed
whisper.cpp server/model. Reachability does not prove model transcription works.
On Windows, voice startup checks HTTP health and can start the existing
`<workspace>/.sam/runtime/whisper-b4938/Release/whisper-server.exe` using
`<workspace>/.sam/models/ggml-base.bin` at the default localhost:8080 endpoint.
No assets are downloaded. Missing/invalid assets and startup failures report
their expected paths. Custom endpoints must already be running. Sam stops only
the STT process it started; after correcting an unavailable service, restart Sam.
Text requests remain available; `--no-voice` disables microphone capture.

## TTS unavailable

On the development line, INFO logs report requested speech language, installed
voice/locale and fallback reason. If a language has no installed voice, Windows
falls back to a configured/system voice; recognition of a language does not imply
that its matching speech voice is installed. Brief ambiguous replies retain recent
language context. No voice or cloud service is installed/enabled automatically.

Output underruns now log a recovery warning rather than dropping the remainder of
an utterance. Persistent gaps still need device/load investigation; acoustic echo
and physical interruption quality remain separate hardware validation tasks.

Windows uses installed System.Speech voices; Linux needs an external `espeak-ng`
or `espeak` executable. Check the default output device. Doctor probes synthesis;
successful synthesis does not prove the speakers are audible. `--no-tts` keeps
responses text-only. Speech quality and physical echo handling are MVP limitations.

## Safe mode or a crash loop

Inspect `uv run sam-supervisor --root . --status` and doctor. Fix the reported
component/dependency issue before restarting; unavailable model services normally
degrade the core rather than causing a restart loop. Do not delete the state
database to bypass revoked capabilities. After reviewing the cause, the trusted
console option `--restore-capabilities` explicitly leaves persisted safe mode;
then start Sam again. No model or UI tool can restore this authority.
