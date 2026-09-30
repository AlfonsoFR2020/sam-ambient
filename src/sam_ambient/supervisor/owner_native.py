"""Private native-parent proof RPC. No TCP endpoint, root secret or control dispatch."""

import json
import re
import sys
import threading
from collections.abc import Callable

from sam_ambient.core.owner import OwnerAuthorityError, OwnerSession


def start_native_owner_channel(
    owner: OwnerSession, current_session: Callable[[], str | None]
) -> None:
    def serve() -> None:
        while owner.active:
            line = sys.stdin.readline(2048)
            if not line or not line.endswith("\n"):
                return
            request_id = None
            try:
                request = json.loads(line)
                if not isinstance(request, dict) or set(request) != {"id", "challenge"}:
                    raise OwnerAuthorityError("Owner proof unavailable")
                request_id = request["id"]
                if not isinstance(request_id, str) or not re.fullmatch(r"[0-9a-f]{64}", request_id):
                    raise OwnerAuthorityError("Owner proof unavailable")
                challenge = request["challenge"]
                if not isinstance(challenge, dict) or challenge.get("session") != current_session():
                    raise OwnerAuthorityError("Owner proof unavailable")
                response = {"id": request_id, "proof": owner.proof(challenge)}
            except (ValueError, OwnerAuthorityError, TypeError):
                response = {"id": request_id, "error": "Owner proof unavailable"}
            try:
                sys.stdout.write(json.dumps(response) + "\n")
                sys.stdout.flush()
            except (BrokenPipeError, OSError):
                return

    threading.Thread(target=serve, name="sam-native-owner", daemon=True).start()
