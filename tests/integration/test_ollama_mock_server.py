import asyncio
import json
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from sam_ambient.adapters.ollama import OllamaProvider
from sam_ambient.cli import main
from sam_ambient.core.providers import Message, MessageRole, ModelEventKind
from sam_ambient.core.turns import CancellationToken


class OllamaMockHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        del format, args

    def do_GET(self) -> None:
        if self.path == "/api/version":
            self._json({"version": "mock-1.0"})
        elif self.path == "/api/tags":
            self._json(
                {
                    "models": [
                        {
                            "name": "mock-model",
                            "digest": "sha256:mock",
                            "details": {"family": "mock"},
                        }
                    ]
                }
            )
        else:
            self.send_error(404)

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        if self.path == "/api/show" and body.get("model") == "mock-model":
            self._json(
                {
                    "license": "MIT",
                    "capabilities": ["completion"],
                    "model_info": {"mock.context_length": 4096},
                }
            )
        elif self.path == "/api/chat" and body.get("model") == "mock-model":
            chunks = (
                {"message": {"content": "Hello "}, "done": False},
                {"message": {"content": "from mock Ollama."}, "done": False},
                {"done": True, "prompt_eval_count": 2, "eval_count": 4},
            )
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.end_headers()
            for chunk in chunks:
                self.wfile.write(json.dumps(chunk).encode() + b"\n")
                self.wfile.flush()
        else:
            self.send_error(404)

    def _json(self, body: dict[str, object]) -> None:
        encoded = json.dumps(body).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


@contextmanager
def ollama_mock_server() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), OllamaMockHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    try:
        yield f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_real_transport_discovers_and_streams_mock_ollama() -> None:
    async def scenario(base_url: str) -> None:
        provider = OllamaProvider(base_url=base_url)
        cancellation = CancellationToken("cancel-mock")
        health = await provider.health(cancellation)
        models = await provider.list_models(cancellation)
        events = [
            event
            async for event in provider.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model=models[0].id,
                cancellation=cancellation,
            )
        ]

        assert health.available
        assert health.version == "mock-1.0"
        assert models[0].license == "MIT"
        assert models[0].context_window == 4096
        assert "".join(event.text for event in events) == "Hello from mock Ollama."
        assert events[-1].kind is ModelEventKind.COMPLETED
        await provider.aclose()

    with ollama_mock_server() as base_url:
        asyncio.run(scenario(base_url))


def test_cli_streams_prompt_against_mock_ollama(capsys: object) -> None:
    with ollama_mock_server() as base_url:
        result = main(
            [
                "chat",
                "--base-url",
                base_url,
                "--model",
                "mock-model",
                "hello",
            ]
        )

    assert result == 0
    assert "Hello from mock Ollama." in capsys.readouterr().out  # type: ignore[attr-defined]
