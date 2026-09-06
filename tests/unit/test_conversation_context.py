import asyncio

from sam_ambient.core.providers import MessageRole, ModelEvent, ModelEventKind
from sam_ambient.runtime import RuntimeConfig, SamRuntime
from tests.unit.test_cli import FakeProvider


class ConversationProvider(FakeProvider):
    def __init__(self):
        super().__init__()
        self.contexts = []

    async def stream_chat(self, messages, tools, *, model, cancellation):
        self.contexts.append(list(messages))
        yield ModelEvent(ModelEventKind.TEXT_DELTA, "Your color is green.")
        yield ModelEvent(ModelEventKind.COMPLETED)


def test_two_turn_context_and_restart_use_committed_session(tmp_path):
    async def scenario():
        config = RuntimeConfig(tmp_path, port=0, state_db=tmp_path / "state.db")
        provider = ConversationProvider()
        runtime = SamRuntime(provider, config)
        await runtime.start()
        try:
            runtime.submit_user_message("My color is green.")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            runtime.submit_user_message("What is my color?")
            await asyncio.wait_for(runtime._active_done.wait(), 2)
            assert [(m.role, m.content) for m in provider.contexts[1][1:]] == [
                (MessageRole.USER, "My color is green."),
                (MessageRole.ASSISTANT, "Your color is green."),
                (MessageRole.USER, "What is my color?"),
            ]
        finally:
            await runtime.close()
        recovered = SamRuntime(ConversationProvider(), config)
        try:
            context = await recovered._conversation_context(recovered.session_id, "new")
            assert len(context) == 4
        finally:
            await recovered.close()

    asyncio.run(scenario())


def test_context_is_bounded_excludes_foreign_and_current_turn(tmp_path):
    runtime = SamRuntime(FakeProvider(), RuntimeConfig(tmp_path, state_db=tmp_path / "state.db"))
    for index, (session, turn, content) in enumerate(
        [
            (runtime.session_id, "old", "x" * 6_001),
            (runtime.session_id, "prior", "heard sentence"),
            ("foreign", "other", "private foreign session"),
            (runtime.session_id, "current", "current request"),
        ]
    ):
        runtime.state.append(
            session_id=session, turn_id=turn, role="user", content=content, committed_at_ms=index
        )

    async def scenario():
        try:
            context = await runtime._conversation_context(runtime.session_id, "current")
            assert [m.content for m in context] == ["heard sentence"]
        finally:
            await runtime.close()

    asyncio.run(scenario())
