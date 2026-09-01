import json

import pytest

from sam_ambient.core.protocol import EventType, ProtocolError, ProtocolEvent


def test_protocol_event_round_trip_preserves_correlations() -> None:
    event = ProtocolEvent(
        type=EventType.MODEL_DELTA,
        monotonic_ms=123,
        session_id="session-1",
        turn_id="turn-1",
        generation_id="generation-1",
        cancellation_id="cancel-1",
        payload={"text": "hello"},
    )

    decoded = ProtocolEvent.from_json(event.to_json())

    assert decoded == event
    assert json.loads(event.to_json())["type"] == "model.delta"


@pytest.mark.parametrize(
    "changes",
    [
        {"protocol": 2},
        {"type": "blank"},
        {"monotonic_ms": -1},
        {"payload": {"bad": float("nan")}},
        {"turn_id": ""},
    ],
)
def test_protocol_rejects_invalid_messages(changes: dict[str, object]) -> None:
    values: dict[str, object] = {
        "protocol": 1,
        "type": "system.ready",
        "monotonic_ms": 0,
        "payload": {},
    }
    values.update(changes)

    with pytest.raises(ProtocolError):
        ProtocolEvent.from_dict(values)


def test_protocol_rejects_unknown_top_level_fields() -> None:
    with pytest.raises(ProtocolError, match="unexpected fields"):
        ProtocolEvent.from_dict(
            {
                "protocol": 1,
                "type": "system.ready",
                "monotonic_ms": 0,
                "payload": {},
                "surprise": True,
            }
        )
