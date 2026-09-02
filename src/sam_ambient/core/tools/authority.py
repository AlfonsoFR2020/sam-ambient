"""Process-local capability authority with immediate, epoch-based revocation."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from sam_ambient.core.tools.models import ToolInvocation

RevocationCallback = Callable[[str, int], None]


class CapabilityRevoked(RuntimeError):
    """Raised when an invocation has no currently valid capability authority."""


@dataclass(frozen=True, slots=True)
class CapabilityLease:
    epoch: int
    invocation_identity: tuple[
        str | None,
        str | None,
        str | None,
        str | None,
        str,
        str,
        str,
    ]


@dataclass(frozen=True, slots=True)
class CapabilityAuthoritySnapshot:
    active: bool
    epoch: int
    reason: str | None


class CapabilityAuthority:
    """Trusted runtime authority; it is deliberately absent from the tool registry."""

    def __init__(self) -> None:
        self._active = True
        self._epoch = 0
        self._reason: str | None = None
        self._callbacks: list[RevocationCallback] = []
        self._callback_errors: list[Exception] = []

    @property
    def snapshot(self) -> CapabilityAuthoritySnapshot:
        return CapabilityAuthoritySnapshot(self._active, self._epoch, self._reason)

    @property
    def callback_errors(self) -> tuple[Exception, ...]:
        return tuple(self._callback_errors)

    def issue_lease(self, invocation: ToolInvocation) -> CapabilityLease:
        if not self._active:
            raise CapabilityRevoked(self._reason or "capability authority is revoked")
        return CapabilityLease(self._epoch, invocation.authority_identity)

    def is_valid(self, lease: CapabilityLease, invocation: ToolInvocation) -> bool:
        return (
            self._active
            and lease.epoch == self._epoch
            and lease.invocation_identity == invocation.authority_identity
        )

    def require_valid(self, lease: CapabilityLease, invocation: ToolInvocation) -> None:
        if not self.is_valid(lease, invocation):
            raise CapabilityRevoked(self._reason or "capability authority lease is stale")

    def revoke(self, reason: str = "capability authority revoked") -> bool:
        if not self._active:
            return False
        self._active = False
        self._epoch += 1
        self._reason = reason.strip() or "capability authority revoked"
        for callback in tuple(self._callbacks):
            try:
                callback(self._reason, self._epoch)
            except Exception as error:
                # Revocation must remain fail-closed even if one adapter is faulty.
                self._callback_errors.append(error)
        return True

    def restore_trusted(self) -> bool:
        """Restore authority from trusted runtime control, never from a model tool."""

        if self._active:
            return False
        self._active = True
        self._epoch += 1
        self._reason = None
        return True

    def add_revocation_callback(self, callback: RevocationCallback) -> Callable[[], None]:
        self._callbacks.append(callback)

        def remove() -> None:
            try:
                self._callbacks.remove(callback)
            except ValueError:
                pass

        return remove
