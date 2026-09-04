#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$PROJECT_ROOT/ui"
if [ ! -x node_modules/.bin/tsc ] || [ ! -x node_modules/.bin/vite ]; then
  echo "Frontend dependencies are missing. Run scripts/bootstrap.sh first." >&2
  exit 1
fi
node_modules/.bin/tsc -b --pretty false
node_modules/.bin/vite build

cd "$PROJECT_ROOT"
uv --native-tls build
