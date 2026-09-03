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
    """Reads auto-run; writes ask; optional external actions ask; higher risks deny."""

    def __init__(
        self,
        platform_id: str | None = None,
        *,
        allow_external_side_effects: bool = False,
    ) -> None:
        self.platform_id = platform_id or _current_platform_id()
        self.allow_external_side_effects = allow_external_side_effects

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
        if descriptor.risk is RiskClass.EXTERNAL_SIDE_EFFECT and self.allow_external_side_effects:
            return AuthorizationDecision(
                AuthorizationKind.REQUIRE_APPROVAL,
                "external process/application action requires owner approval",
            )
        return AuthorizationDecision(
            AuthorizationKind.DENY,
            f"{descriptor.risk} capability is disabled by runtime policy",
        )


def _current_platform_id() -> str:
    if sys.platform == "win32":
        return "windows"
    if sys.platform == "darwin":
        return "darwin"
    return "linux"
