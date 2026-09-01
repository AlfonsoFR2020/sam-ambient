"""Provider registry and privacy-preserving fallback policy."""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from enum import StrEnum

from sam_ambient.core.providers.models import (
    CloudRoutingBlocked,
    DataBoundary,
    LLMProvider,
    Message,
    ModelEvent,
    ProviderUnavailable,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken


class RoutingPolicy(StrEnum):
    LOCAL_ONLY = "local_only"
    LOCAL_PREFERRED = "local_preferred"
    CLOUD_PREFERRED = "cloud_preferred"
    EXPLICIT = "explicit"


class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, LLMProvider] = {}

    def register(self, provider: LLMProvider) -> None:
        if not provider.id.strip():
            raise ValueError("provider id must be non-blank")
        if provider.id in self._providers:
            raise ValueError(f"duplicate provider id: {provider.id}")
        self._providers[provider.id] = provider

    def get(self, provider_id: str) -> LLMProvider:
        try:
            return self._providers[provider_id]
        except KeyError as error:
            raise KeyError(f"unknown provider: {provider_id}") from error

    def values(self) -> tuple[LLMProvider, ...]:
        return tuple(self._providers.values())


class ProviderRouter:
    def __init__(self, registry: ProviderRegistry) -> None:
        self._registry = registry

    def candidates(
        self,
        *,
        policy: RoutingPolicy,
        explicit_provider: str | None = None,
        allow_cloud: bool = False,
        contains_private_context: bool = False,
        allow_private_context_to_cloud: bool = False,
    ) -> tuple[LLMProvider, ...]:
        if policy is RoutingPolicy.EXPLICIT:
            if explicit_provider is None:
                raise ValueError("explicit routing requires a provider id")
            providers = (self._registry.get(explicit_provider),)
        elif explicit_provider is not None:
            raise ValueError("explicit_provider is only valid with explicit routing")
        else:
            local = tuple(
                provider
                for provider in self._registry.values()
                if provider.data_boundary is DataBoundary.LOCAL
            )
            cloud = tuple(
                provider
                for provider in self._registry.values()
                if provider.data_boundary is DataBoundary.CLOUD
            )
            if policy is RoutingPolicy.LOCAL_ONLY:
                providers = local
            elif policy is RoutingPolicy.LOCAL_PREFERRED:
                providers = local + cloud
            else:
                providers = cloud + local

        permitted: list[LLMProvider] = []
        cloud_was_blocked = False
        for provider in providers:
            if provider.data_boundary is DataBoundary.CLOUD:
                if not allow_cloud or (
                    contains_private_context and not allow_private_context_to_cloud
                ):
                    cloud_was_blocked = True
                    continue
            permitted.append(provider)
        if not permitted and cloud_was_blocked:
            raise CloudRoutingBlocked("cloud route blocked by local-first privacy policy")
        return tuple(permitted)

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
        policy: RoutingPolicy = RoutingPolicy.LOCAL_PREFERRED,
        explicit_provider: str | None = None,
        allow_cloud: bool = False,
        contains_private_context: bool = False,
        allow_private_context_to_cloud: bool = False,
    ) -> AsyncIterator[ModelEvent]:
        candidates = self.candidates(
            policy=policy,
            explicit_provider=explicit_provider,
            allow_cloud=allow_cloud,
            contains_private_context=contains_private_context,
            allow_private_context_to_cloud=allow_private_context_to_cloud,
        )
        if not candidates:
            raise ProviderUnavailable("no provider matches the routing policy")

        failures: list[str] = []
        for provider in candidates:
            cancellation.raise_if_cancelled()
            health = await provider.health(cancellation)
            if not health.available:
                failures.append(f"{provider.id}: {health.detail}")
                continue
            output_started = False
            try:
                async for event in provider.stream_chat(
                    messages,
                    tools,
                    model=model,
                    cancellation=cancellation,
                ):
                    output_started = True
                    yield event
                return
            except ProviderUnavailable as error:
                if output_started:
                    raise
                failures.append(f"{provider.id}: {error}")

        detail = "; ".join(failures) or "no healthy providers"
        raise ProviderUnavailable(f"all permitted providers failed: {detail}")
