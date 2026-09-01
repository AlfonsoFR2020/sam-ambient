#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
UV_CACHE_DIR="$SCRIPT_DIR/../.cache/uv"
export UV_CACHE_DIR

if ! command -v uv >/dev/null 2>&1; then
  echo "uv is required. Install it from https://docs.astral.sh/uv/." >&2
  exit 1
fi

uv --native-tls sync --python 3.12 --all-groups
