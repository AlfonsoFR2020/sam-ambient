"""Provider-neutral model, message, and streaming contracts."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from sam_ambient.core.turns import CancellationToken


class DataBoundary(StrEnum):
    LOCAL = "local"
    CLOUD = "cloud"


class MessageRole(StrEnum):
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


@dataclass(frozen=True, slots=True)
class Message:
    role: MessageRole
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: tuple[Mapping[str, Any], ...] = ()

    def to_wire(self) -> dict[str, Any]:
        result: dict[str, Any] = {"role": self.role, "content": self.content}
        if self.name is not None:
            result["name"] = self.name
        if self.tool_call_id is not None:
            result["tool_call_id"] = self.tool_call_id
        if self.tool_calls:
            result["tool_calls"] = [dict(tool_call) for tool_call in self.tool_calls]
        return result


@dataclass(frozen=True, slots=True)
class ToolSchema:
    name: str
    description: str
    parameters: Mapping[str, Any]

    def to_openai_wire(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": dict(self.parameters),
            },
        }


@dataclass(frozen=True, slots=True)
class ProviderHealth:
    available: bool
    detail: str
    version: str | None = None


@dataclass(frozen=True, slots=True)
class ModelInfo:
    id: str
    provider_id: str
    display_name: str | None = None
    context_window: int | None = None
    capabilities: tuple[str, ...] = ()
    license: str | None = None
    provenance: Mapping[str, Any] = field(default_factory=dict)


class ModelEventKind(StrEnum):
    TEXT_DELTA = "text_delta"
    TOOL_CALL = "tool_call"
    COMPLETED = "completed"


@dataclass(frozen=True, slots=True)
class ModelEvent:
    kind: ModelEventKind
    text: str = ""
    payload: Mapping[str, Any] = field(default_factory=dict)


class ProviderError(RuntimeError):
    """Base class for provider failures safe to show without secret data."""


class ProviderUnavailable(ProviderError):
    """A retryable provider reachability or availability failure."""


class ProviderTimeout(ProviderUnavailable):
    """A retryable provider timeout."""


class ProviderResponseError(ProviderError):
    """A non-retryable provider response or protocol failure."""


class CloudRoutingBlocked(ProviderError):
    """A configured privacy boundary blocked cloud routing."""


class LLMProvider(ABC):
    id: str
    data_boundary: DataBoundary

    @abstractmethod
    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        raise NotImplementedError

    @abstractmethod
    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        raise NotImplementedError

    @abstractmethod
    def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        raise NotImplementedError

    async def aclose(self) -> None:
        """Release provider connections during component shutdown."""

        return None
