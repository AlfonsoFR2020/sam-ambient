#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
UV_CACHE_DIR="$SCRIPT_DIR/../.cache/uv"
export UV_CACHE_DIR

uv run ruff check .
uv run ruff format --check .
uv run pytest
