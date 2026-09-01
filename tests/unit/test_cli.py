import asyncio
from collections.abc import AsyncIterator, Sequence

from sam_ambient.cli import select_model, stream_response
from sam_ambient.core.providers import (
    DataBoundary,
    LLMProvider,
    Message,
    MessageRole,
    ModelEvent,
    ModelEventKind,
    ModelInfo,
    ProviderHealth,
    ToolSchema,
)
from sam_ambient.core.turns import CancellationToken


class FakeProvider(LLMProvider):
    id = "fake"
    data_boundary = DataBoundary.LOCAL

    async def health(self, cancellation: CancellationToken) -> ProviderHealth:
        return ProviderHealth(True, "ready")

    async def list_models(self, cancellation: CancellationToken) -> list[ModelInfo]:
        return [ModelInfo("discovered-model", self.id)]

    async def stream_chat(
        self,
        messages: Sequence[Message],
        tools: Sequence[ToolSchema],
        *,
        model: str,
        cancellation: CancellationToken,
    ) -> AsyncIterator[ModelEvent]:
        del messages, tools, model, cancellation
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "Hello ")
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "Sam")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_cli_model_selection_and_stream_output_are_provider_neutral() -> None:
    async def scenario() -> None:
        provider = FakeProvider()
        cancellation = CancellationToken("cancel-cli")
        output: list[str] = []
        model = await select_model(provider, None, cancellation)
        response = await stream_response(
            provider,
            [Message(MessageRole.USER, "hello")],
            model=model,
            cancellation=cancellation,
            write=output.append,
        )

        assert model == "discovered-model"
        assert response == "Hello Sam"
        assert output == ["Hello ", "Sam"]

    asyncio.run(scenario())
