#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
export UV_CACHE_DIR="$PROJECT_ROOT/.cache/uv"
export VITE_SAM_TRANSPORT=core

cd "$PROJECT_ROOT"
uv run sam runtime --root "$PROJECT_ROOT" &
BRIDGE_PID=$!
trap 'kill "$BRIDGE_PID" 2>/dev/null || true; wait "$BRIDGE_PID" 2>/dev/null || true' EXIT INT TERM

cd "$PROJECT_ROOT/ui"
if [ -x "node_modules/.bin/vite" ]; then
    node_modules/.bin/vite
else
    pnpm dev
fi
