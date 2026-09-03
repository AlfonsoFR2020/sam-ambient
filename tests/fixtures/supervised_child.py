"""Harmless readiness/crash child used by supervisor integration tests."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--mode", choices=("crash-once", "always-crash"), required=True)
parser.add_argument("--counter", required=True)
parser.add_argument("--runtime-instance-id", required=True)
args, _unknown = parser.parse_known_args()

counter_path = Path(args.counter)
count = int(counter_path.read_text(encoding="utf-8")) + 1 if counter_path.exists() else 1
counter_path.write_text(str(count), encoding="utf-8")
print(
    "SAM_READY "
    + json.dumps(
        {
            "health": "HEALTHY",
            "instance_id": args.runtime_instance_id,
            "detail": "fixture ready",
        }
    ),
    flush=True,
)
if args.mode == "always-crash" or count == 1:
    time.sleep(0.05)
    raise SystemExit(7)
time.sleep(60)
