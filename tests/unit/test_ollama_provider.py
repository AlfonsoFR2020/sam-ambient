import asyncio
import json
from collections.abc import AsyncIterator, Mapping
from typing import Any

import pytest

from sam_ambient.adapters.http import HttpTransportError
from sam_ambient.adapters.ollama import OllamaProvider, normalize_ollama_base_url
from sam_ambient.core.providers import (
    DataBoundary,
    Message,
    MessageRole,
    ModelEventKind,
    ProviderResponseError,
)
from sam_ambient.core.turns import CancellationToken, OperationCancelled


class FakeTransport:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, Mapping[str, Any] | None]] = []
        self.fail_requests = False
        self.stream: list[str] = []

    async def request_json(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any] | None,
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> dict[str, Any]:
        del headers, timeout_s
        cancellation.raise_if_cancelled()
        self.calls.append((method, url, body))
        if self.fail_requests:
            raise HttpTransportError("not reachable")
        if url.endswith("/api/version"):
            return {"version": "0.12.3"}
        if url.endswith("/api/tags"):
            return {
                "models": [
                    {
                        "name": "sam-model:latest",
                        "digest": "sha256:abc",
                        "size": 42,
                        "details": {
                            "family": "test",
                            "parameter_size": "1B",
                            "quantization_level": "Q4",
                        },
                    }
                ]
            }
        if url.endswith("/api/show"):
            return {
                "license": "Apache-2.0",
                "capabilities": ["completion", "tools"],
                "model_info": {"test.context_length": 8192},
            }
        raise AssertionError(f"unexpected URL: {url}")

    async def stream_lines(
        self,
        method: str,
        url: str,
        *,
        body: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_s: float,
        cancellation: CancellationToken,
    ) -> AsyncIterator[str]:
        del headers, timeout_s
        self.calls.append((method, url, body))
        for line in self.stream:
            cancellation.raise_if_cancelled()
            yield line


def test_normalizes_historical_openai_compatible_ollama_url() -> None:
    assert normalize_ollama_base_url("localhost:11434/v1/") == "http://localhost:11434"


def test_only_loopback_ollama_is_classified_as_local() -> None:
    transport = FakeTransport()

    local_provider = OllamaProvider(base_url="127.0.0.1:11434", transport=transport)
    remote_provider = OllamaProvider(base_url="https://models.example", transport=transport)

    assert local_provider.data_boundary is DataBoundary.LOCAL
    assert remote_provider.data_boundary is DataBoundary.CLOUD


def test_health_and_model_discovery_include_provenance_and_license() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        provider = OllamaProvider(transport=transport)
        cancellation = CancellationToken("cancel-discovery")

        health = await provider.health(cancellation)
        models = await provider.list_models(cancellation)

        assert health.available
        assert health.version == "0.12.3"
        assert len(models) == 1
        assert models[0].id == "sam-model:latest"
        assert models[0].license == "Apache-2.0"
        assert models[0].context_window == 8192
        assert models[0].capabilities == ("completion", "tools")
        assert models[0].provenance["digest"] == "sha256:abc"

    asyncio.run(scenario())


def test_unavailable_health_is_reported_without_throwing() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        transport.fail_requests = True
        provider = OllamaProvider(transport=transport)

        health = await provider.health(CancellationToken("cancel-health"))

        assert not health.available
        assert "not reachable" in health.detail

    asyncio.run(scenario())


def test_native_chat_stream_emits_text_tool_and_completion_events() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        transport.stream = [
            json.dumps({"message": {"content": "Hello "}, "done": False}),
            json.dumps(
                {
                    "message": {
                        "content": "Sam",
                        "tool_calls": [{"function": {"name": "system.info", "arguments": {}}}],
                    },
                    "done": False,
                }
            ),
            json.dumps({"done": True, "prompt_eval_count": 4, "eval_count": 2}),
        ]
        provider = OllamaProvider(transport=transport)

        events = [
            event
            async for event in provider.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model="sam-model:latest",
                cancellation=CancellationToken("cancel-chat"),
            )
        ]

        assert [event.kind for event in events] == [
            ModelEventKind.TEXT_DELTA,
            ModelEventKind.TEXT_DELTA,
            ModelEventKind.TOOL_CALL,
            ModelEventKind.COMPLETED,
        ]
        assert "".join(event.text for event in events) == "Hello Sam"
        assert events[-1].payload["eval_count"] == 2
        request_body = transport.calls[-1][2]
        assert request_body is not None
        assert request_body["model"] == "sam-model:latest"

    asyncio.run(scenario())


def test_truncated_native_stream_is_rejected() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        transport.stream = [json.dumps({"message": {"content": "partial"}, "done": False})]
        provider = OllamaProvider(transport=transport)

        with pytest.raises(ProviderResponseError, match="completion marker"):
            async for _event in provider.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model="sam-model:latest",
                cancellation=CancellationToken("cancel-truncated"),
            ):
                pass

    asyncio.run(scenario())


def test_pre_cancelled_stream_never_emits() -> None:
    async def scenario() -> None:
        transport = FakeTransport()
        transport.stream = [json.dumps({"done": True})]
        provider = OllamaProvider(transport=transport)
        cancellation = CancellationToken("cancel-before")
        cancellation.cancel("barge-in")

        with pytest.raises(OperationCancelled):
            async for _event in provider.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model="sam-model:latest",
                cancellation=cancellation,
            ):
                pass

    asyncio.run(scenario())
