"""Runtime-owned authorization decisions for registered capabilities."""

from __future__ import annotations

import sys
from dataclasses import dataclass
from enum import StrEnum

from sam_ambient.core.tools.models import RiskClass, ToolDescriptor


class AuthorizationKind(StrEnum):
    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    DENY = "deny"


@dataclass(frozen=True, slots=True)
class AuthorizationDecision:
    kind: AuthorizationKind
    reason: str


class CapabilityPolicy:
    """Phase 6A policy: reads auto-run; writes ask; higher risks are denied."""

    def __init__(self, platform_id: str | None = None) -> None:
        self.platform_id = platform_id or _current_platform_id()

    def authorize(self, descriptor: ToolDescriptor) -> AuthorizationDecision:
        if self.platform_id not in descriptor.platforms:
            return AuthorizationDecision(
                AuthorizationKind.DENY,
                f"{descriptor.id} is unsupported on {self.platform_id}",
            )
        if descriptor.risk is RiskClass.READ_ONLY:
            if descriptor.requires_confirmation:
                return AuthorizationDecision(
                    AuthorizationKind.REQUIRE_APPROVAL,
                    "registered read contains potentially sensitive local data",
                )
            return AuthorizationDecision(AuthorizationKind.ALLOW, "registered read-only tool")
        if descriptor.risk is RiskClass.REVERSIBLE_WRITE:
            return AuthorizationDecision(
                AuthorizationKind.REQUIRE_APPROVAL,
                "reversible local write requires owner approval",
            )
        return AuthorizationDecision(
            AuthorizationKind.DENY,
            f"{descriptor.risk} capabilities are disabled in Phase 6A",
        )


def _current_platform_id() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "darwin"
    return "linux"
