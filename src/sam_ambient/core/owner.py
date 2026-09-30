"""Ephemeral owner proof, independent from model content and tool policy leases."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sys
from dataclasses import dataclass, field
from uuid import uuid4

_HEX = re.compile(r"[0-9a-f]{64}\Z")
_SESSION = re.compile(r"[a-zA-Z0-9_-]{1,80}\Z")
OWNER_CHALLENGE = "sam.owner.challenge"
OWNER_AUTHENTICATE = "sam.owner.authenticate"
OWNER_ACCEPTED = "sam.owner.accepted"


class OwnerAuthorityError(RuntimeError):
    """Always a fixed safe detail; never include a supplied proof or secret."""


def validate_challenge(value: object) -> dict[str, str]:
    if not isinstance(value, dict) or set(value) != {"type", "session", "nonce", "server_proof"}:
        raise OwnerAuthorityError("Invalid owner challenge")
    if (
        value["type"] != OWNER_CHALLENGE
        or not isinstance(value["session"], str)
        or not _SESSION.fullmatch(value["session"])
        or not isinstance(value["nonce"], str)
        or not _HEX.fullmatch(value["nonce"])
        or not isinstance(value["server_proof"], str)
        or not _HEX.fullmatch(value["server_proof"])
    ):
        raise OwnerAuthorityError("Invalid owner challenge")
    return value


@dataclass(slots=True, repr=False)
class OwnerSession:
    """32 random bytes held by trusted processes; never serialized as application state.

    This authenticates possession, not OS isolation against host memory/code tampering.
    The bootstrap line is only for a supervisor-created child's private stdin pipe.
    """

    _secret: bytes = field(default_factory=lambda: secrets.token_bytes(32), repr=False)
    _revoked: bool = field(default=False, init=False, repr=False)

    def __post_init__(self) -> None:
        if not isinstance(self._secret, bytes) or len(self._secret) != 32:
            raise OwnerAuthorityError("Invalid owner session")

    @property
    def active(self) -> bool:
        return not self._revoked

    def challenge(self, session: str) -> dict[str, str]:
        if self._revoked:
            raise OwnerAuthorityError("Owner session revoked")
        value = {"type": OWNER_CHALLENGE, "session": session, "nonce": secrets.token_hex(32)}
        value["server_proof"] = self._mac(value, b"server")
        return validate_challenge(value)

    def _mac(self, value: dict[str, str], purpose: bytes) -> str:
        message = json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")
        return hmac.new(
            self._secret, b"sam.owner.v1/" + purpose + b"\0" + message, hashlib.sha256
        ).hexdigest()

    def proof(self, challenge: object) -> str:
        if self._revoked:
            raise OwnerAuthorityError("Owner session revoked")
        validated = validate_challenge(challenge)
        unsigned = {k: v for k, v in validated.items() if k != "server_proof"}
        if not hmac.compare_digest(self._mac(unsigned, b"server"), validated["server_proof"]):
            raise OwnerAuthorityError("Untrusted core challenge")
        return self._mac(validated, b"client")

    def verify(self, challenge: object, proof: object) -> bool:
        if self._revoked or not isinstance(proof, str) or not _HEX.fullmatch(proof):
            return False
        try:
            return hmac.compare_digest(self.proof(challenge), proof)
        except OwnerAuthorityError:
            return False

    def bootstrap_line(self) -> bytes:
        if self._revoked:
            raise OwnerAuthorityError("Owner session revoked")
        return b"SAM_OWNER " + self._secret.hex().encode("ascii") + b"\n"

    def revoke(self) -> None:
        self._revoked = True
        self._secret = bytes(32)


def read_owner_bootstrap() -> OwnerSession:
    """Consume exactly the supervisor's initial private-pipe record, before stop reader."""
    line = sys.stdin.buffer.readline(128)
    if len(line) != 75 or not line.startswith(b"SAM_OWNER ") or not line.endswith(b"\n"):
        raise OwnerAuthorityError("Owner bootstrap unavailable")
    try:
        encoded = line[10:-1].decode("ascii")
        if not _HEX.fullmatch(encoded):
            raise ValueError
        return OwnerSession(bytes.fromhex(encoded))
    except (ValueError, UnicodeError) as error:
        raise OwnerAuthorityError("Owner bootstrap unavailable") from error


@dataclass(slots=True, repr=False)
class OwnerConnection:
    """Server-created authority context, never accepted from protocol JSON."""

    owner: OwnerSession
    session_id: str
    connection_id: str = field(default_factory=lambda: uuid4().hex)
    retired: bool = False

    @property
    def active(self) -> bool:
        return self.owner.active and not self.retired

    def retire(self) -> None:
        self.retired = True
