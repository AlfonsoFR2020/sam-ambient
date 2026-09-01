import asyncio
import os

import pytest

from sam_ambient.adapters.ollama import OllamaProvider
from sam_ambient.core.turns import CancellationToken


@pytest.mark.live_ollama
@pytest.mark.skipif(
    os.environ.get("SAM_RUN_LIVE_OLLAMA") != "1",
    reason="set SAM_RUN_LIVE_OLLAMA=1 to probe a separately installed Ollama service",
)
def test_live_ollama_health_and_models() -> None:
    async def scenario() -> None:
        provider = OllamaProvider(base_url=os.environ.get("OLLAMA_HOST", "127.0.0.1:11434"))
        cancellation = CancellationToken("cancel-live")
        health = await provider.health(cancellation)
        assert health.available, health.detail
        assert await provider.list_models(cancellation)
        await provider.aclose()

    asyncio.run(scenario())
