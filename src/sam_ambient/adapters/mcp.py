"""Bounded MCP stdio client below Sam's capability authority boundary."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import signal
import subprocess
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol

from sam_ambient import __version__
from sam_ambient.configuration import McpServerSettings
from sam_ambient.core.tools import RiskClass, SideEffect, ToolDescriptor, ToolError, ToolResult
from sam_ambient.core.turns import CancellationToken, OperationCancelled

PROTOCOL_VERSION = "2026-07-28"
_TOOL_SEGMENT = re.compile(r"[^a-z0-9_]+")
_SCHEMA_KEYS = frozenset(
    {
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "enum",
        "description",
        "minimum",
        "maximum",
        "minLength",
        "maxLength",
        "maxItems",
        "title",
        "default",
    }
)
_SAFE_ENV = (
    "PATH",
    "PATHEXT",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
)


class McpError(ToolError):
    pass


class McpTransport(Protocol):
    async def start(self) -> None: ...
    async def request(self, method: str, params: Mapping[str, Any], timeout_s: float) -> Any: ...
    async def notify(self, method: str, params: Mapping[str, Any] | None = None) -> None: ...
    async def close(self) -> None: ...


class StdioMcpTransport:
    """Newline-delimited JSON-RPC over one trusted, owned subprocess."""

    def __init__(self, settings: McpServerSettings, *, line_limit: int = 524_288) -> None:
        self.settings = settings
        self.line_limit = line_limit
        self._process: asyncio.subprocess.Process | None = None
        self._reader: asyncio.Task[None] | None = None
        self._stderr: asyncio.Task[None] | None = None
        self._pending: dict[int, asyncio.Future[Any]] = {}
        self._next_id = 0
        self._write_lock = asyncio.Lock()

    async def start(self) -> None:
        if self._process is not None:
            return
        cwd = self.settings.working_directory
        if cwd is not None:
            cwd = cwd.expanduser().resolve(strict=True)
            if not cwd.is_dir():
                raise McpError("configured MCP working directory is not a directory")
        environment = {key: value for key, value in os.environ.items() if key.upper() in _SAFE_ENV}
        platform_options: dict[str, object] = {}
        if os.name == "nt":
            platform_options["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            platform_options["start_new_session"] = True
        try:
            self._process = await asyncio.create_subprocess_exec(
                *self.settings.command,
                cwd=cwd,
                env=environment,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                limit=self.line_limit + 1,
                **platform_options,
            )
        except (OSError, ValueError) as error:
            raise McpError(f"cannot start configured MCP server: {type(error).__name__}") from error
        self._reader = asyncio.create_task(self._read_responses())
        self._stderr = asyncio.create_task(self._drain_stderr())

    async def request(self, method: str, params: Mapping[str, Any], timeout_s: float) -> Any:
        process = self._require_process()
        self._next_id += 1
        request_id = self._next_id
        future = asyncio.get_running_loop().create_future()
        self._pending[request_id] = future
        await self._send(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": dict(params)}
        )
        try:
            async with asyncio.timeout(timeout_s):
                return await future
        except TimeoutError as error:
            await self.notify(
                "notifications/cancelled",
                _params(requestId=request_id, reason="timeout"),
            )
            raise McpError(f"MCP request timed out: {method}") from error
        except asyncio.CancelledError:
            if process.returncode is None:
                await self.notify(
                    "notifications/cancelled",
                    _params(requestId=request_id, reason="cancelled"),
                )
            raise
        finally:
            self._pending.pop(request_id, None)

    async def notify(self, method: str, params: Mapping[str, Any] | None = None) -> None:
        message: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            message["params"] = dict(params)
        await self._send(message)

    async def _send(self, message: Mapping[str, Any]) -> None:
        process = self._require_process()
        if process.stdin is None or process.returncode is not None:
            raise McpError("MCP server is not running")
        payload = json.dumps(message, allow_nan=False, separators=(",", ":")).encode() + b"\n"
        async with self._write_lock:
            process.stdin.write(payload)
            try:
                await process.stdin.drain()
            except (BrokenPipeError, ConnectionResetError) as error:
                raise McpError("MCP server closed its input") from error

    async def _read_responses(self) -> None:
        process = self._require_process()
        assert process.stdout is not None
        try:
            while line := await process.stdout.readline():
                if len(line) > self.line_limit:
                    raise McpError("MCP response exceeds configured framing limit")
                try:
                    message = json.loads(line)
                except (UnicodeDecodeError, json.JSONDecodeError) as error:
                    raise McpError("MCP server emitted malformed stdout protocol data") from error
                if not isinstance(message, Mapping) or message.get("jsonrpc") != "2.0":
                    raise McpError("MCP server emitted an invalid JSON-RPC message")
                request_id = message.get("id")
                future = self._pending.get(request_id) if type(request_id) is int else None
                if future is None or future.done():
                    continue
                if "error" in message:
                    error = message["error"]
                    detail = (
                        error.get("message", "server error")
                        if isinstance(error, Mapping)
                        else "server error"
                    )
                    future.set_exception(McpError(f"MCP server error: {str(detail)[:300]}"))
                elif "result" in message:
                    future.set_result(message["result"])
                else:
                    future.set_exception(McpError("MCP response has neither result nor error"))
            if not self._pending:
                return
            raise McpError(f"MCP server exited unexpectedly ({await process.wait()})")
        except BaseException as error:
            for future in tuple(self._pending.values()):
                if not future.done():
                    future.set_exception(
                        error if isinstance(error, McpError) else McpError("MCP transport failed")
                    )

    async def _drain_stderr(self) -> None:
        process = self._require_process()
        assert process.stderr is not None
        while await process.stderr.read(4096):
            pass

    def _require_process(self) -> asyncio.subprocess.Process:
        if self._process is None:
            raise McpError("MCP transport has not started")
        return self._process

    async def close(self) -> None:
        process, self._process = self._process, None
        if process is None:
            return
        if process.stdin is not None:
            process.stdin.close()
        try:
            async with asyncio.timeout(2):
                await process.wait()
        except TimeoutError:
            _terminate_owned_process(process)
            try:
                async with asyncio.timeout(2):
                    await process.wait()
            except TimeoutError:
                _kill_owned_process(process)
                await process.wait()
        for task in (self._reader, self._stderr):
            if task is not None and not task.done():
                task.cancel()
        await asyncio.gather(
            *(task for task in (self._reader, self._stderr) if task), return_exceptions=True
        )


@dataclass(frozen=True, slots=True)
class McpDiscoveredTool:
    external_name: str
    descriptor: ToolDescriptor
    toolset_hash: str


class McpClient:
    def __init__(self, settings: McpServerSettings, transport: McpTransport | None = None) -> None:
        self.settings = settings
        self.transport = transport or StdioMcpTransport(settings)
        self._tools: tuple[Mapping[str, Any], ...] = ()
        self._toolset_hash = ""

    async def start(self) -> tuple[McpTool, ...]:
        await self.transport.start()
        discovered_server = await self.transport.request(
            "server/discover",
            _params(),
            self.settings.timeout_s,
        )
        if not isinstance(discovered_server, Mapping):
            raise McpError("MCP server returned an invalid discovery result")
        capabilities = discovered_server.get("capabilities", {})
        if not isinstance(capabilities, Mapping) or "tools" not in capabilities:
            raise McpError("MCP server does not advertise tools capability")
        tools = await self._list_tools()
        self._tools = tools
        self._toolset_hash = _digest(tools)
        discovered: list[McpTool] = []
        ids: set[str] = set()
        for raw in tools:
            item = _convert_tool(self.settings.server_id, raw, self._toolset_hash, self)
            if item.descriptor.id in ids:
                raise McpError(f"MCP tool identity collision: {item.descriptor.id}")
            ids.add(item.descriptor.id)
            discovered.append(item)
        return tuple(discovered)

    async def _list_tools(self) -> tuple[Mapping[str, Any], ...]:
        tools: list[Mapping[str, Any]] = []
        cursor: str | None = None
        seen: set[str] = set()
        while True:
            params = _params(**({} if cursor is None else {"cursor": cursor}))
            result = await self.transport.request("tools/list", params, self.settings.timeout_s)
            if not isinstance(result, Mapping) or not isinstance(result.get("tools"), list):
                raise McpError("MCP tools/list returned malformed data")
            if result.get("resultType") not in {None, "complete"}:
                raise McpError("MCP tools/list returned an unsupported result type")
            page = result["tools"]
            if not all(isinstance(item, Mapping) for item in page):
                raise McpError("MCP tool list is malformed")
            tools.extend(dict(item) for item in page)
            if len(tools) > 128:
                raise McpError("MCP tool list exceeds 128 tools")
            next_cursor = result.get("nextCursor")
            if next_cursor is None:
                return tuple(tools)
            if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen:
                raise McpError("MCP tool list returned an invalid pagination cursor")
            seen.add(next_cursor)
            cursor = next_cursor

    async def call(
        self, tool: McpDiscoveredTool, arguments: Mapping[str, Any], cancellation: CancellationToken
    ) -> ToolResult:
        cancellation.raise_if_cancelled()
        if _digest(await self._list_tools()) != tool.toolset_hash:
            raise McpError("MCP tool list changed; rediscovery and fresh authority are required")
        exact_arguments = json.loads(
            json.dumps(dict(arguments), allow_nan=False, separators=(",", ":"))
        )
        request = asyncio.create_task(
            self.transport.request(
                "tools/call",
                _params(name=tool.external_name, arguments=exact_arguments),
                self.settings.timeout_s,
            )
        )
        cancelled = asyncio.create_task(cancellation.wait())
        done, _ = await asyncio.wait((request, cancelled), return_when=asyncio.FIRST_COMPLETED)
        if cancelled in done:
            request.cancel()
            await asyncio.gather(request, return_exceptions=True)
            raise OperationCancelled(
                cancellation.cancellation_id,
                cancellation.reason or "MCP tool call cancelled",
            )
        cancelled.cancel()
        await asyncio.gather(cancelled, return_exceptions=True)
        result = await request
        if not isinstance(result, Mapping):
            raise McpError("MCP tools/call returned malformed data")
        if result.get("resultType") not in {None, "complete"}:
            raise McpError("MCP tool returned an unsupported multi-round-trip result")
        payload = {
            "content_trust": "untrusted_data",
            "provider": self.settings.server_id,
            "tool": tool.external_name,
            "is_error": bool(result.get("isError", False)),
            "content": result.get("content", []),
            "structured_content": result.get("structuredContent"),
        }
        encoded = json.dumps(payload, allow_nan=False, separators=(",", ":"))
        if len(encoded.encode()) > self.settings.result_limit_bytes:
            raise McpError("MCP tool result exceeds configured size limit")
        return ToolResult(payload)

    async def close(self) -> None:
        await self.transport.close()


class McpTool(McpDiscoveredTool):
    def __init__(
        self, external_name: str, descriptor: ToolDescriptor, toolset_hash: str, client: McpClient
    ) -> None:
        super().__init__(external_name, descriptor, toolset_hash)
        object.__setattr__(self, "_client", client)

    async def execute(
        self, arguments: Mapping[str, Any], cancellation: CancellationToken
    ) -> ToolResult:
        return await self._client.call(self, arguments, cancellation)


def _convert_tool(
    server_id: str, raw: Mapping[str, Any], toolset_hash: str, client: McpClient
) -> McpTool:
    name = raw.get("name")
    schema = raw.get("inputSchema")
    if not isinstance(name, str) or not name.strip() or len(name) > 128:
        raise McpError("MCP tool has an invalid name")
    if not isinstance(schema, Mapping):
        raise McpError(f"MCP tool {name} has no valid inputSchema")
    validated = _validate_schema(schema, depth=0)
    if validated.get("type") != "object":
        raise McpError(f"MCP tool {name} inputSchema must describe an object")
    segment = _TOOL_SEGMENT.sub("_", name.lower()).strip("_")
    if not segment or not segment[0].isalpha():
        segment = "tool_" + segment
    provider = _TOOL_SEGMENT.sub("_", server_id.lower().replace("-", "_")).strip("_")
    descriptor = ToolDescriptor(
        id=f"mcp.{provider}.{segment}",
        description=(
            f"External MCP tool {server_id}/{name}: {str(raw.get('description', ''))[:1000]}"
        ),
        input_schema=validated,
        result_schema={"type": "object"},
        risk=RiskClass.EXTERNAL_SIDE_EFFECT,
        platforms=("windows", "linux", "darwin"),
        requires_confirmation=True,
        supports_cancellation=True,
        timeout_s=client.settings.timeout_s + 2,
        side_effect=SideEffect.EXTERNAL,
    )
    return McpTool(name, descriptor, toolset_hash, client)


def _validate_schema(schema: Mapping[str, Any], *, depth: int) -> dict[str, Any]:
    if depth > 8 or set(schema) - _SCHEMA_KEYS:
        raise McpError("MCP tool uses an unsupported JSON Schema construct")
    expected = schema.get("type")
    if expected not in {"object", "array", "string", "integer", "number", "boolean"}:
        raise McpError("MCP tool schema must use a supported explicit type")
    result = dict(schema)
    for text_key in ("description", "title"):
        if text_key in schema and not isinstance(schema[text_key], str):
            raise McpError(f"MCP tool schema {text_key} must be a string")
    if "enum" in schema:
        choices = schema["enum"]
        if not isinstance(choices, list) or not choices or len(choices) > 128:
            raise McpError("MCP tool schema enum is malformed or too large")
        try:
            json.dumps(choices, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise McpError("MCP tool schema enum is not finite JSON data") from error
    for bound in ("minimum", "maximum"):
        if bound in schema and (
            not isinstance(schema[bound], (int, float)) or isinstance(schema[bound], bool)
        ):
            raise McpError(f"MCP tool schema {bound} must be numeric")
    for bound in ("minLength", "maxLength", "maxItems"):
        if bound in schema and (type(schema[bound]) is not int or schema[bound] < 0):
            raise McpError(f"MCP tool schema {bound} must be a non-negative integer")
    if expected == "object":
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        if (
            not isinstance(properties, Mapping)
            or not isinstance(required, list)
            or not all(isinstance(x, str) for x in required)
        ):
            raise McpError("MCP tool has a malformed object schema")
        if len(properties) > 64 or not set(required).issubset(properties):
            raise McpError("MCP tool object schema is inconsistent or too large")
        if len(required) != len(set(required)):
            raise McpError("MCP tool object schema repeats a required property")
        additional = schema.get("additionalProperties", True)
        if type(additional) is not bool:
            raise McpError("MCP additionalProperties schemas are not supported")
        result["properties"] = {
            str(key): _validate_schema(value, depth=depth + 1)
            for key, value in properties.items()
            if isinstance(key, str) and isinstance(value, Mapping)
        }
        if len(result["properties"]) != len(properties):
            raise McpError("MCP tool property schema is malformed")
    elif expected == "array":
        items = schema.get("items")
        if not isinstance(items, Mapping):
            raise McpError("MCP array schema requires bounded item schema")
        result["items"] = _validate_schema(items, depth=depth + 1)
    return result


def _digest(tools: tuple[Mapping[str, Any], ...]) -> str:
    canonical = json.dumps(tools, allow_nan=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _params(**values: Any) -> dict[str, Any]:
    return {
        **values,
        "_meta": {
            "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientInfo": {
                "name": "sam-ambient",
                "version": __version__,
            },
            "io.modelcontextprotocol/clientCapabilities": {},
        },
    }


def _terminate_owned_process(process: asyncio.subprocess.Process) -> None:
    try:
        if os.name == "nt":
            process.terminate()
        else:
            os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass


def _kill_owned_process(process: asyncio.subprocess.Process) -> None:
    try:
        if os.name == "nt":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
