import asyncio
import json

from sam_ambient.conversation_diagnostics import ConversationTrace
from sam_ambient.core.protocol import (
    ControlCommand,
    ControlDispatcher,
    CoreControlBindings,
    EventBus,
    EventType,
    ProtocolEvent,
)


def test_elapsed_nonterminal_bounds_and_late_terminality():
    now = [100]
    trace = ConversationTrace(now=lambda: now[0], limit=4)
    trace.begin("inference", "old", generation_id="old")
    now[0] = 2100
    assert trace.snapshot()["longest_inference_ms"] == 2000
    trace.event(ProtocolEvent(EventType.MODEL_CANCELLED, 2, generation_id="old"))
    trace.begin("inference", "new", generation_id="new")
    trace.event(ProtocolEvent(EventType.MODEL_COMPLETED, 3, generation_id="old"))
    assert trace.snapshot()["nonterminal"] == 1
    for n in range(300):
        trace.begin("command", str(n), command_id=str(n))
        trace.record("fixture.progress", count=n)
    assert len(trace.pending) == 4 and len(trace.history) == 256
    assert trace.dropped > 0


def test_projection_drops_payload_and_stt_wait_is_distinct():
    now = [10]
    trace = ConversationTrace(now=lambda: now[0])
    trace.event(
        ProtocolEvent(
            EventType.VOICE_STATE_CHANGED,
            1,
            turn_id="private-turn-identifier",
            payload={
                "from": "USER_SPEAKING",
                "to": "ENDPOINT_CANDIDATE",
                "reason": "stt_finalizing",
            },
        )
    )
    now[0] = 500
    trace.event(
        ProtocolEvent(
            EventType.TRANSCRIPT_FINAL,
            2,
            turn_id="private-turn-identifier",
            payload={
                "text": "private owner utterance",
                "proof": "private proof",
                "pcm": "private audio",
            },
        )
    )
    assert trace.snapshot()["longest_stt_ms"] == 490
    contents = json.dumps(list(trace.history))
    assert not any(
        value in contents
        for value in (
            "private owner utterance",
            "private proof",
            "private audio",
            "private-turn-identifier",
        )
    )


def test_ack_wait_and_rejected_request_do_not_remain_pending():
    now = [0]
    trace = ConversationTrace(now=lambda: now[0])
    command = ControlCommand(
        "control.user_message.submit", "private-command", 1, payload={"text": "private text"}
    )
    trace.command(command, "queued")
    now[0] = 400
    trace.command(command, "dispatch")
    trace.command(command, "rejected")
    assert trace.snapshot()["longest_command_ms"] == 400
    assert not trace.pending
    assert "private" not in json.dumps(list(trace.history))


def test_projection_failure_never_prevents_event_delivery():
    async def scenario():
        bus = EventBus()

        def bad(_event):
            raise RuntimeError("private exception")

        bus.add_observer(bad)
        subscription = await bus.subscribe()
        event = ProtocolEvent(EventType.MODEL_COMPLETED, 1)
        await bus.publish(event)
        assert await subscription.get() == event
        await bus.close()

    asyncio.run(scenario())


def test_queued_command_wait_and_cancelled_dispatch_are_visible():
    async def scenario():
        now = [0]
        trace = ConversationTrace(now=lambda: now[0])
        entered, release = asyncio.Event(), asyncio.Event()

        async def enabled(_enabled):
            entered.set()
            await release.wait()

        async def cancel(_targets, _reason):
            pass

        dispatcher = ControlDispatcher(
            CoreControlBindings(enabled, enabled, cancel), observer=trace.command
        )
        first = asyncio.create_task(
            dispatcher.dispatch(
                ControlCommand("control.microphone.set", "first", 1, payload={"enabled": True})
            )
        )
        await entered.wait()
        second = asyncio.create_task(
            dispatcher.dispatch(
                ControlCommand("control.microphone.set", "second", 2, payload={"enabled": False})
            )
        )
        await asyncio.sleep(0)
        now[0] = 2000
        assert trace.snapshot()["longest_command_ms"] == 2000
        first.cancel()
        await asyncio.gather(first, return_exceptions=True)
        release.set()
        await second
        assert not trace.pending
        assert any(r["stage"] == "command.cancelled" for r in trace.history)

    asyncio.run(scenario())
