"""Capability registry and tool execution domain."""

from sam_ambient.core.tools.authority import (
    CapabilityAuthority,
    CapabilityAuthoritySnapshot,
    CapabilityLease,
    CapabilityRevoked,
)
from sam_ambient.core.tools.computer import (
    AppOpenAdapter,
    AppOpenTool,
    ClipboardAdapter,
    ClipboardReadTool,
    ClipboardWriteTool,
    SystemInfoTool,
)
from sam_ambient.core.tools.executor import (
    ApprovalBroker,
    ApprovalCorrelation,
    ToolExecutor,
    ToolExecutorConfig,
)
from sam_ambient.core.tools.filesystem import (
    AuthorizedPaths,
    AuthorizedRoot,
    FilesListTool,
    FilesReadTool,
    FilesSearchTool,
    PathAuthorizationError,
)
from sam_ambient.core.tools.models import (
    MalformedToolArguments,
    RiskClass,
    SideEffect,
    ToolDescriptor,
    ToolError,
    ToolExecution,
    ToolInvocation,
    ToolResult,
    ToolStatus,
    UnknownToolError,
)
from sam_ambient.core.tools.policy import (
    AuthorizationDecision,
    AuthorizationKind,
    CapabilityPolicy,
)
from sam_ambient.core.tools.registry import FunctionTool, ToolHandler, ToolRegistry

__all__ = [
    "AppOpenAdapter",
    "AppOpenTool",
    "ApprovalBroker",
    "ApprovalCorrelation",
    "AuthorizationDecision",
    "AuthorizationKind",
    "AuthorizedPaths",
    "AuthorizedRoot",
    "CapabilityAuthority",
    "CapabilityAuthoritySnapshot",
    "CapabilityLease",
    "CapabilityPolicy",
    "CapabilityRevoked",
    "ClipboardAdapter",
    "ClipboardReadTool",
    "ClipboardWriteTool",
    "FilesListTool",
    "FilesReadTool",
    "FilesSearchTool",
    "FunctionTool",
    "MalformedToolArguments",
    "PathAuthorizationError",
    "RiskClass",
    "SideEffect",
    "SystemInfoTool",
    "ToolDescriptor",
    "ToolError",
    "ToolExecution",
    "ToolExecutor",
    "ToolExecutorConfig",
    "ToolHandler",
    "ToolInvocation",
    "ToolRegistry",
    "ToolResult",
    "ToolStatus",
    "UnknownToolError",
]
