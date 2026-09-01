"""Versioned local protocol models and bounded event transport."""

from sam_ambient.core.protocol.bus import EventBus, EventSubscription, SubscriptionClosed
from sam_ambient.core.protocol.models import (
    LOSSY_EVENT_TYPES,
    PROTOCOL_VERSION,
    EventType,
    ProtocolError,
    ProtocolEvent,
)

__all__ = [
    "LOSSY_EVENT_TYPES",
    "PROTOCOL_VERSION",
    "EventBus",
    "EventSubscription",
    "EventType",
    "ProtocolError",
    "ProtocolEvent",
    "SubscriptionClosed",
]
