# Contributing

The repository is initially private; coordinate contributions with the owner.
Original Sam contributions are covered by the Apache-2.0 license in LICENSE.

Use Python 3.12+ and uv. Run `scripts/bootstrap.sh` (PowerShell:
`scripts/bootstrap.ps1`). For frontend work, install Node 22.12+ and the pnpm
version in `ui/package.json`, then run `pnpm install --frozen-lockfile` in `ui/`.

Before submitting a change:

```sh
uv run ruff check .
uv run ruff format --check .
uv run pytest
# From ui/ when frontend code changes:
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Before packaging or when changing version metadata:
uv run python scripts/check_release.py
```

Use small changes, typed boundaries, Ruff/Biome formatting, and focused tests
for behavioral or security changes. Tests normally use fakes and temporary
directories; live Ollama checks are opt-in via `SAM_RUN_LIVE_OLLAMA=1`.

Keep model policy separate from trusted runtime policy. Preserve cancellation,
privacy, bounded queues/output, and rollback. Do not commit credentials, runtime
databases, models, logs, or audio. Verify licenses before reuse; GPL/AGPL code
requires explicit owner approval. Update the changelog and relevant user docs,
and THIRD_PARTY.md for dependency/license changes. See AGENTS.md for project rules.
The Windows/Linux GitHub workflow runs the same deterministic checks and a
packaged-wheel smoke test. Changes to configuration keys must include validation
tests and update `config/sam.example.toml` plus the relevant setup/user docs.
CI validates releases but never publishes them.
