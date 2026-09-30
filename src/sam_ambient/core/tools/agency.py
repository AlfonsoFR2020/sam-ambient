"""Owner-scoped manual actions using the same registry, policy and executor as models."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sam_ambient.core.owner import OwnerAuthorityError, OwnerConnection, OwnerSession
from sam_ambient.core.tools.executor import ToolExecutor
from sam_ambient.core.tools.models import ToolInvocation
from sam_ambient.core.turns import CancellationToken


class CapabilityKind(StrEnum):
    FILES_LIST = "files.list"
    FILES_READ = "files.read"
    SYSTEM_INFO = "system.info"
    BROWSER_NAVIGATE = "browser.navigate"
    BROWSER_READ = "browser.read"
    BROWSER_CLOSE = "browser.close"


@dataclass(slots=True)
class OwnerAction:
    connection: OwnerConnection
    invocation: ToolInvocation
    token: CancellationToken
    task: asyncio.Task | None = None


class OwnerActions:
    """Bounded manual action admission. A socket proof is not a tool-policy bypass."""

    def __init__(
        self,
        owner: OwnerSession,
        executor: ToolExecutor,
        terminal: Callable[[OwnerAction, object], Awaitable[None]],
        *,
        supported: frozenset[CapabilityKind] = frozenset(),
    ) -> None:
        self.owner, self.executor, self.terminal = owner, executor, terminal
        self.supported = supported
        self.active: dict[str, OwnerAction] = {}
        self._sequences: dict[str, int] = {}
        self._tasks: set[asyncio.Task] = set()

    def start(
        self,
        connection: OwnerConnection,
        request_id: str,
        sequence: int,
        kind: str,
        arguments: Mapping[str, Any],
    ) -> OwnerAction:
        if connection.owner is not self.owner or not connection.active:
            raise OwnerAuthorityError("Owner connection unavailable")
        if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 1:
            raise ValueError("action sequence must be a positive integer")
        if sequence <= self._sequences.get(connection.connection_id, 0):
            raise ValueError("action request replay rejected")
        capability = CapabilityKind(kind)
        if capability not in self.supported:
            raise ValueError("capability unsupported on this surface")
        if len(self._tasks) >= 4:
            raise ValueError("too many active owner actions")
        invocation = ToolInvocation(
            request_id,
            capability.value,
            arguments,
            session_id=connection.session_id,
            generation_id=f"owner-{connection.connection_id}-{sequence}",
            cancellation_id=f"action-{request_id}",
        )
        if request_id in self.active:
            raise ValueError("action request already active")
        self.executor.registry.validate(self.executor.registry.get(kind), invocation.arguments)
        action = OwnerAction(connection, invocation, CancellationToken(invocation.cancellation_id))
        self._sequences[connection.connection_id] = sequence
        self.active[request_id] = action
        action.task = asyncio.create_task(self._run(action))
        self._tasks.add(action.task)
        action.task.add_done_callback(self._tasks.discard)
        return action

    async def _run(self, action: OwnerAction) -> None:
        try:
            result = await self.executor.execute(action.invocation, action.token)
            if action.connection.active:
                await self.terminal(action, result)
        finally:
            if self.active.get(action.invocation.tool_call_id) is action:
                del self.active[action.invocation.tool_call_id]

    def is_current(self, invocation: ToolInvocation) -> bool:
        action = self.active.get(invocation.tool_call_id)
        return bool(action and action.connection.active and action.invocation == invocation)

    def cancel(self, connection: OwnerConnection, request_id: str) -> bool:
        action = self.active.get(request_id)
        if action is None or action.connection is not connection:
            return False
        action.token.cancel("owner_action_cancelled")
        return True

    async def detach(self, connection: OwnerConnection) -> None:
        connection.retire()
        self._sequences.pop(connection.connection_id, None)
        tasks = []
        for action in tuple(self.active.values()):
            if action.connection is connection:
                action.token.cancel("owner_connection_retired")
                if action.task is not None:
                    tasks.append(action.task)
        if tasks:
            # Do not strand conversation behind a backend that fails to acknowledge cancellation.
            done, _ = await asyncio.wait(tasks, timeout=1)
            for task in done:
                task.exception() if not task.cancelled() else None
        for request_id, action in tuple(self.active.items()):
            if action.connection is connection:
                del self.active[request_id]

    async def close(self) -> None:
        connections = {id(action.connection): action.connection for action in self.active.values()}
        for connection in connections.values():
            await self.detach(connection)
