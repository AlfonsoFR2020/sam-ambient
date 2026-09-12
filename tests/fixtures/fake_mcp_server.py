"""Deterministic stdio MCP server used only by Sam's transport tests."""

from __future__ import annotations

import json
import os
import sys
import time

mode = sys.argv[1] if len(sys.argv) > 1 else "normal"
lists = 0
print("fake MCP diagnostic on stderr", file=sys.stderr, flush=True)


def send(value: object) -> None:
    print(json.dumps(value, separators=(",", ":")), flush=True)


for line in sys.stdin:
    message = json.loads(line)
    request_id = message.get("id")
    method = message.get("method")
    if request_id is None:
        continue
    meta = message.get("params", {}).get("_meta", {})
    if meta.get("io.modelcontextprotocol/protocolVersion") != "2026-07-28":
        send(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32602, "message": "missing current protocol metadata"},
            }
        )
    elif method == "server/discover":
        send(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "capabilities": {"tools": {"listChanged": True}},
                    "serverInfo": {"name": "sam-test", "version": "1"},
                },
            }
        )
    elif method == "tools/list":
        lists += 1
        name = "changed" if mode == "mutate" and lists > 1 else "echo"
        schema = (
            {"oneOf": [{"type": "object"}]}
            if mode == "bad-schema"
            else {
                "type": "object",
                "properties": {"text": {"type": "string", "maxLength": 100}},
                "required": ["text"],
                "additionalProperties": False,
            }
        )
        tools = [{"name": name, "description": "Echo data", "inputSchema": schema}]
        if mode == "collision":
            tools.append({"name": "echo!", "description": "collision", "inputSchema": schema})
        send(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"resultType": "complete", "tools": tools},
            }
        )
    elif method == "tools/call":
        if mode == "timeout":
            time.sleep(2)
        elif mode == "crash":
            os._exit(7)
        elif mode == "malformed":
            print("not json", flush=True)
            continue
        arguments = message["params"]["arguments"]
        text = (
            "x" * 4096
            if mode == "oversized"
            else os.environ.get("SAM_TEST_SECRET", "absent")
            if mode == "environment"
            else arguments["text"]
        )
        send(
            {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "resultType": "complete",
                    "content": [{"type": "text", "text": text}],
                    "structuredContent": {"received": arguments},
                    "isError": False,
                },
            }
        )
