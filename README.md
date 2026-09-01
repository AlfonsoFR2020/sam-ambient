# Sam

Sam is the product name for Zev Ambient, a local-first, voice-first computer
interface. The implementation follows `ZEV_AMBIENT_CODEX_SPEC.md`.

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

## Architecture boundaries

- `zev_ambient.core` owns provider-neutral conversational state and protocol.
- `zev_ambient.adapters` owns platform and service integrations.
- `zev_ambient.supervisor` is a separate authority boundary and never depends
  on model reasoning.
- `ui` is presentation-only and will become the Tauri shell in Phase 5.

The project license is temporarily reserved pending the owner's specified
MIT-vs-Apache-2.0 selection. See `LICENSE`.

