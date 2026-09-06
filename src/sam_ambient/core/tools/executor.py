"""Bounded tool lifecycle, approval, timeout, and cancellation orchestration."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import OrderedDict
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from typing import Any

from sam_ambient.core.protocol import EventType, ProtocolEvent
from sam_ambient.core.tools.authority import (
    CapabilityAuthority,
    CapabilityLease,
    CapabilityRevoked,
)
from sam_ambient.core.tools.models import (
    ToolDescriptor,
    ToolExecution,
    ToolInvocation,
    ToolResult,
    ToolStatus,
)
from sam_ambient.core.tools.policy import AuthorizationKind, CapabilityPolicy
from sam_ambient.core.tools.registry import ToolRegistry
from sam_ambient.core.turns import CancellationToken

EventPublisher = Callable[[ProtocolEvent], Awaitable[None]]
CurrentInvocation = Callable[[ToolInvocation], bool]
InvocationKey = tuple[
    str | None,
    str | None,
    str | None,
    str | None,
    str,
    str,
    str,
]


class ApprovalBroker:
    """Resolve explicit owner decisions; no response is never approval."""

    def __init__(self) -> None:
        self._pending: dict[str, tuple[ApprovalCorrelation, asyncio.Future[bool]]] = {}

    def open(self, correlation: ApprovalCorrelation) -> asyncio.Future[bool]:
        if correlation.tool_call_id in self._pending:
            raise RuntimeError(f"approval already pending: {correlation.tool_call_id}")
        future = asyncio.get_running_loop().create_future()
        self._pending[correlation.tool_call_id] = (correlation, future)
        return future

    def resolve(self, correlation: ApprovalCorrelation, *, approved: bool) -> bool:
        record = self._pending.get(correlation.tool_call_id)
        if record is None:
            return False
        expected, future = record
        if expected != correlation or future.done():
            return False
        future.set_result(approved)
        return True

    def abandon(self, tool_call_id: str) -> None:
        record = self._pending.pop(tool_call_id, None)
        if record is None:
            return
        _correlation, future = record
        if not future.done():
            future.cancel()

    def revoke_all(self) -> None:
        for _correlation, future in tuple(self._pending.values()):
            if not future.done():
                future.set_result(False)

    @property
    def pending(self) -> tuple[str, ...]:
        return tuple(self._pending)


@dataclass(frozen=True, slots=True)
class ApprovalCorrelation:
    session_id: str | None
    turn_id: str | None
    generation_id: str | None
    tool_call_id: str

    @classmethod
    def from_invocation(cls, invocation: ToolInvocation) -> ApprovalCorrelation:
        return cls(
            invocation.session_id,
            invocation.turn_id,
            invocation.generation_id,
            invocation.tool_call_id,
        )


@dataclass(frozen=True, slots=True)
class ToolExecutorConfig:
    approval_timeout_s: float = 60.0
    max_history: int = 256

    def __post_init__(self) -> None:
        if self.approval_timeout_s <= 0:
            raise ValueError("approval timeout must be positive")
        if self.max_history < 1:
            raise ValueError("tool history must be positive")


class ToolExecutor:
    def __init__(
        self,
        registry: ToolRegistry,
        policy: CapabilityPolicy,
        approvals: ApprovalBroker,
        publish: EventPublisher,
        *,
        config: ToolExecutorConfig | None = None,
        is_current: CurrentInvocation | None = None,
        clock_ms: Callable[[], int] | None = None,
        authority: CapabilityAuthority | None = None,
    ) -> None:
        self.registry = registry
        self.policy = policy
        self.approvals = approvals
        self.config = config or ToolExecutorConfig()
        self._publish_event = publish
        self._is_current = is_current or (lambda _invocation: True)
        self._clock_ms = clock_ms or (lambda: time.monotonic_ns() // 1_000_000)
        self.authority = authority or CapabilityAuthority()
        self._history: OrderedDict[InvocationKey, ToolExecution] = OrderedDict()
        self._inflight: dict[InvocationKey, asyncio.Future[ToolExecution]] = {}
        self._active_cancellable: dict[InvocationKey, CancellationToken] = {}
        self._lock = asyncio.Lock()
        self._last_event_ms = -1
        self.authority.add_revocation_callback(self._on_authority_revoked)

    async def execute(
        self,
        invocation: ToolInvocation,
        cancellation: CancellationToken,
    ) -> ToolExecution:
        key = _invocation_key(invocation)
        leader = False
        async with self._lock:
            prior = self._history.get(key)
            if prior is not None:
                return prior
            future = self._inflight.get(key)
            if future is None:
                future = asyncio.get_running_loop().create_future()
                self._inflight[key] = future
                leader = True
        if not leader:
            return await asyncio.shield(future)

        try:
            execution = await self._execute_once(invocation, cancellation)
        except BaseException as error:
            async with self._lock:
                waiting = self._inflight.pop(key)
                if not waiting.done():
                    waiting.set_exception(error)
                    waiting.exception()
            raise
        async with self._lock:
            waiting = self._inflight.pop(key)
            self._history[key] = execution
            while len(self._history) > self.config.max_history:
                self._history.popitem(last=False)
            if not waiting.done():
                waiting.set_result(execution)
        return execution

    async def _execute_once(
        self,
        invocation: ToolInvocation,
        cancellation: CancellationToken,
    ) -> ToolExecution:
        current_task = asyncio.current_task()
        if current_task is None:
            raise RuntimeError("tool execution requires an asyncio task")
        loop = asyncio.get_running_loop()
        remove_callback = cancellation.add_callback(
            lambda _reason: loop.call_soon_threadsafe(current_task.cancel)
        )
        await self._publish(EventType.TOOL_REQUESTED, invocation, {"tool_id": invocation.tool_id})
        lease: CapabilityLease | None = None
        active_key: InvocationKey | None = None
        try:
            try:
                lease = self.authority.issue_lease(invocation)
            except CapabilityRevoked as error:
                return await self._finish(
                    invocation,
                    ToolStatus.DENIED,
                    EventType.TOOL_DENIED,
                    error=str(error),
                )
            tool = self.registry.get(invocation.tool_id)
            self.registry.validate(tool, invocation.arguments)
            descriptor = tool.descriptor
            decision = self.policy.authorize(descriptor)
            await self._publish(
                EventType.TOOL_AUTHORIZING,
                invocation,
                {
                    "tool_id": descriptor.id,
                    "risk_class": descriptor.risk,
                    "decision": decision.kind,
                },
            )
            if decision.kind is AuthorizationKind.DENY:
                return await self._finish(
                    invocation,
                    ToolStatus.DENIED,
                    EventType.TOOL_DENIED,
                    error=decision.reason,
                )
            if decision.kind is AuthorizationKind.REQUIRE_APPROVAL:
                approved = await self._request_approval(invocation, descriptor)
                if not approved:
                    return await self._finish(
                        invocation,
                        ToolStatus.DENIED,
                        EventType.TOOL_DENIED,
                        error="owner approval was denied or not received",
                    )

            self.authority.require_valid(lease, invocation)
            cancellation.raise_if_cancelled()
            if descriptor.supports_cancellation:
                active_key = _invocation_key(invocation)
                self._active_cancellable[active_key] = cancellation
            await self._publish(
                EventType.TOOL_STARTED,
                invocation,
                {"tool_id": descriptor.id, "timeout_s": descriptor.timeout_s},
            )
            self.authority.require_valid(lease, invocation)
            cancellation.raise_if_cancelled()
            try:
                async with asyncio.timeout(descriptor.timeout_s):
                    result = await tool.execute(invocation.arguments, cancellation)
            except TimeoutError:
                return await self._finish(
                    invocation,
                    ToolStatus.FAILED,
                    EventType.TOOL_FAILED,
                    error=f"tool timed out after {descriptor.timeout_s:g}s",
                )
            cancellation.raise_if_cancelled()
            if not self.authority.is_valid(lease, invocation):
                return await self._finish(
                    invocation,
                    ToolStatus.CANCELLED,
                    EventType.TOOL_CANCELLED,
                    error=self.authority.snapshot.reason or "capability authority revoked",
                )
            if not self._is_current(invocation):
                return ToolExecution(invocation, ToolStatus.STALE, result=result)
            return await self._finish(
                invocation,
                ToolStatus.COMPLETED,
                EventType.TOOL_COMPLETED,
                result=result,
            )
        except CapabilityRevoked as error:
            if active_key is not None:
                return await self._finish(
                    invocation,
                    ToolStatus.CANCELLED,
                    EventType.TOOL_CANCELLED,
                    error=str(error),
                )
            return await self._finish(
                invocation,
                ToolStatus.DENIED,
                EventType.TOOL_DENIED,
                error=str(error),
            )
        except asyncio.CancelledError:
            if not cancellation.is_cancelled:
                raise
            return await self._finish(
                invocation,
                ToolStatus.CANCELLED,
                EventType.TOOL_CANCELLED,
                error=cancellation.reason or "cancelled",
            )
        except Exception as error:
            return await self._finish(
                invocation,
                ToolStatus.FAILED,
                EventType.TOOL_FAILED,
                error=str(error)[:500],
            )
        finally:
            if active_key is not None:
                self._active_cancellable.pop(active_key, None)
            remove_callback()
            self.approvals.abandon(invocation.tool_call_id)

    async def _request_approval(
        self,
        invocation: ToolInvocation,
        descriptor: ToolDescriptor,
    ) -> bool:
        future = self.approvals.open(ApprovalCorrelation.from_invocation(invocation))
        await self._publish(
            EventType.TOOL_APPROVAL_REQUESTED,
            invocation,
            {
                "tool_id": invocation.tool_id,
                "description": descriptor.description,
                "summary": _approval_summary(invocation),
                "risk_class": descriptor.risk,
                "arguments": _approval_arguments(invocation),
            },
        )
        try:
            async with asyncio.timeout(self.config.approval_timeout_s):
                return await future
        except TimeoutError:
            return False

    async def _finish(
        self,
        invocation: ToolInvocation,
        status: ToolStatus,
        event_type: EventType,
        *,
        result: ToolResult | None = None,
        error: str | None = None,
    ) -> ToolExecution:
        if not self._is_current(invocation):
            return ToolExecution(invocation, ToolStatus.STALE, result=result, error=error)
        payload: dict[str, Any] = {
            "tool_id": invocation.tool_id,
            "status": status,
            "content_trust": "untrusted_data",
        }
        if result is not None:
            payload["result"] = dict(result.data)
            payload["truncated"] = result.truncated
        if error is not None:
            payload["error"] = error
        await self._publish(event_type, invocation, payload)
        return ToolExecution(invocation, status, result=result, error=error)

    async def _publish(
        self,
        event_type: EventType,
        invocation: ToolInvocation,
        payload: dict[str, Any],
    ) -> None:
        if not self._is_current(invocation):
            return
        if event_type in {
            EventType.TOOL_STARTED,
            EventType.TOOL_COMPLETED,
            EventType.TOOL_FAILED,
            EventType.TOOL_DENIED,
            EventType.TOOL_CANCELLED,
        }:
            # No arguments, file contents, prompts, process output, or approval text.
            logging.getLogger(__name__).info("Tool lifecycle: %s", event_type)
        await self._publish_event(
            ProtocolEvent(
                type=event_type,
                monotonic_ms=self._next_event_ms(),
                session_id=invocation.session_id,
                turn_id=invocation.turn_id,
                generation_id=invocation.generation_id,
                cancellation_id=invocation.cancellation_id,
                tool_call_id=invocation.tool_call_id,
                payload=payload,
            )
        )

    def _next_event_ms(self) -> int:
        current = self._clock_ms()
        self._last_event_ms = max(current, self._last_event_ms + 1)
        return self._last_event_ms

    def _on_authority_revoked(self, reason: str, _epoch: int) -> None:
        self.approvals.revoke_all()
        for token in tuple(self._active_cancellable.values()):
            token.cancel(reason)


def _bounded_arguments(arguments: Mapping[str, Any]) -> dict[str, Any]:
    summary: dict[str, Any] = {}
    for index, (name, value) in enumerate(arguments.items()):
        if index >= 16:
            summary["_truncated"] = True
            break
        if name in {"content", "text"} and isinstance(value, str):
            summary[name] = f"<{len(value)} characters>"
        elif isinstance(value, str):
            summary[name] = value if len(value) <= 160 else f"{value[:157]}..."
        elif isinstance(value, list) and all(isinstance(item, str) for item in value):
            summary[name] = [item if len(item) <= 80 else f"{item[:77]}..." for item in value[:8]]
            if len(value) > 8:
                summary[f"{name}_truncated"] = True
        elif isinstance(value, (bool, int, float)) or value is None:
            summary[name] = value
        else:
            summary[name] = f"<{type(value).__name__}>"
    return summary


def _approval_arguments(invocation: ToolInvocation) -> dict[str, Any]:
    arguments = invocation.arguments
    if invocation.tool_id == "process.run":
        return {
            name: value
            for name, value in arguments.items()
            if name
            in {
                "executable",
                "args",
                "root",
                "cwd",
                "timeout_s",
                "stdout_limit",
                "stderr_limit",
            }
        }
    if invocation.tool_id == "files.write":
        content = arguments.get("content", "")
        return {
            "root": arguments.get("root"),
            "path": arguments.get("path"),
            "overwrite": arguments.get("overwrite", False),
            "content": f"<{len(content)} characters>" if isinstance(content, str) else "<invalid>",
        }
    return _bounded_arguments(arguments)


def _approval_summary(invocation: ToolInvocation) -> str:
    arguments = invocation.arguments
    root = str(arguments.get("root", "?"))
    if invocation.tool_id == "process.run":
        executable = str(arguments.get("executable", "?"))
        raw_args = arguments.get("args", ())
        argv = raw_args if isinstance(raw_args, list) else ()
        preview = " ".join(
            json.dumps(item if len(item) <= 80 else f"{item[:77]}...")
            for item in argv[:6]
            if isinstance(item, str)
        )
        if len(argv) > 6:
            preview = f"{preview} …"
        command = f"{executable} {preview}".strip()
        cwd = str(arguments.get("cwd", "."))
        return f"Run {command} in {root}:{cwd}"[:400]
    if invocation.tool_id == "files.write":
        action = "Replace" if arguments.get("overwrite") is True else "Create"
        return f"{action} {root}:{arguments.get('path', '?')}"[:400]
    if invocation.tool_id == "app.open":
        return f"Open {root}:{arguments.get('path', '?')}"[:400]
    if invocation.tool_id == "clipboard.write":
        text = arguments.get("text", "")
        length = len(text) if isinstance(text, str) else 0
        return f"Replace the clipboard with {length} characters"
    if invocation.tool_id == "clipboard.read":
        return "Read the current clipboard text"
    return f"Allow {invocation.tool_id}"[:400]


def _invocation_key(invocation: ToolInvocation) -> InvocationKey:
    return invocation.authority_identity
