# Sam

Sam is a local-first, voice-first computer interface. The implementation follows
`SAM_AMBIENT_CODEX_SPEC.md`.

## Development

Prerequisites are Git, Python 3.12 or newer, and
[uv](https://docs.astral.sh/uv/). Bootstrap and test with:

```powershell
./scripts/bootstrap.ps1
./scripts/test.ps1
```

On Linux or macOS:

```sh
./scripts/bootstrap.sh
./scripts/test.sh
```

Run the current development harness with `./scripts/dev.ps1` or
`./scripts/dev.sh`.

Phase 2 text mode uses Ollama's native local API and never requires an API key:

```powershell
uv run sam doctor
uv run sam models
uv run sam chat --model <installed-model> "Hello Sam"
```

Omit the prompt for an interactive session. A generic OpenAI-compatible
endpoint can be selected explicitly with `--provider openai-compatible
--base-url <url>`; its key is read from the environment variable named by
`--api-key-env`, never from a command-line value or repository file.

## Architecture boundaries

- `sam_ambient.core` owns provider-neutral conversational state and protocol.
- `sam_ambient.adapters` owns platform and service integrations.
- `sam_ambient.supervisor` is a separate authority boundary and never depends
  on model reasoning.
- `ui` is presentation-only and will become the Tauri shell in Phase 5.

The project license is temporarily reserved pending the owner's specified
MIT-vs-Apache-2.0 selection. See `LICENSE`.
