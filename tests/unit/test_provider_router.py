import asyncio
from collections.abc import AsyncIterator, Sequence

import pytest

from sam_ambient.core.providers import (
    CloudRoutingBlocked,
    DataBoundary,
    LLMProvider,
    Message,
    MessageRole,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ProviderRegistry,
    ProviderRouter,
    ProviderUnavailable,
    RoutingPolicy,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken


class FakeProvider(LLMProvider):
    def __init__(
        self,
        provider_id: str,
        boundary: DataBoundary,
        *,
        healthy: bool = True,
        fail_before_output: bool = False,
        fail_after_output: bool = False,
    ) -> None:
        self.id = provider_id
        self.data_boundary = boundary
        self.healthy = healthy
        self.fail_before_output = fail_before_output
        self.fail_after_output = fail_after_output
        self.health_calls = 0
        self.stream_calls = 0

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        cancellation.raise_if_cancelled()
        self.health_calls += 1
        return ProviderHealth(self.healthy, "ready" if self.healthy else "offline")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        cancellation.raise_if_cancelled()
        return [ModelInfo("model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model
        cancellation.raise_if_cancelled()
        self.stream_calls += 1
        if self.fail_before_output:
            raise ProviderUnavailable("failed before output")
        yield ModelEvent(ModelEventKind.TEXT_DELTA, text=self.id)
        if self.fail_after_output:
            raise ProviderUnavailable("failed after output")
        yield ModelEvent(ModelEventKind.COMPLETED)


def registry_with(*providers: LLMProvider) -> ProviderRegistry:
    registry = ProviderRegistry()
    for provider in providers:
        registry.register(provider)
    return registry


def collect(router: ProviderRouter, **options: object) -> list[ModelEvent]:
    async def scenario() -> list[ModelEvent]:
        return [
            event
            async for event in router.stream_chat(
                [Message(MessageRole.USER, "hello")],
                (),
                model="model",
                cancellation=CancellationToken("cancel-route"),
                **options,  # type: ignore[arg-type]
            )
        ]

    return asyncio.run(scenario())


def test_local_failure_falls_back_to_cloud_only_when_allowed() -> None:
    local = FakeProvider("local", DataBoundary.LOCAL, healthy=False)
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(local, cloud))

    events = collect(router, allow_cloud=True)

    assert events[0].text == "cloud"
    assert cloud.stream_calls == 1


def test_cloud_fallback_is_not_silently_used_by_default() -> None:
    local = FakeProvider("local", DataBoundary.LOCAL, healthy=False)
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(local, cloud))

    with pytest.raises(ProviderUnavailable):
        collect(router)

    assert cloud.health_calls == 0
    assert cloud.stream_calls == 0


def test_cloud_only_route_reports_privacy_block() -> None:
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(cloud))

    with pytest.raises(CloudRoutingBlocked):
        collect(router, policy=RoutingPolicy.CLOUD_PREFERRED)


def test_private_context_requires_separate_cloud_permission() -> None:
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(cloud))

    with pytest.raises(CloudRoutingBlocked):
        collect(
            router,
            policy=RoutingPolicy.CLOUD_PREFERRED,
            allow_cloud=True,
            contains_private_context=True,
        )

    events = collect(
        router,
        policy=RoutingPolicy.CLOUD_PREFERRED,
        allow_cloud=True,
        contains_private_context=True,
        allow_private_context_to_cloud=True,
    )
    assert events[0].text == "cloud"


def test_router_never_falls_back_after_partial_output() -> None:
    local = FakeProvider("local", DataBoundary.LOCAL, fail_after_output=True)
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(local, cloud))

    with pytest.raises(ProviderUnavailable, match="after output"):
        collect(router, allow_cloud=True)

    assert cloud.stream_calls == 0


def test_explicit_cloud_provider_still_respects_cloud_permission() -> None:
    cloud = FakeProvider("cloud", DataBoundary.CLOUD)
    router = ProviderRouter(registry_with(cloud))

    with pytest.raises(CloudRoutingBlocked):
        collect(
            router,
            policy=RoutingPolicy.EXPLICIT,
            explicit_provider="cloud",
        )
