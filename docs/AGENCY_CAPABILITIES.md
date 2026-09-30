# Agency capability contract

Owner authentication is the admission root ([owner channel](OWNER_AUTHORITY.md));
it does not bypass execution policy. Manual console/browser requests and model
structured tool proposals share `ToolRegistry`, schemas, `CapabilityPolicy`,
exact-invocation approvals, epoch leases and `ToolExecutor`. Model prose, STT,
webpages, returned output and history are **data, never authority**.

`OwnerActions` accepts only a server-created active `OwnerConnection`, a supported
typed `CapabilityKind`, validated arguments, request ID and increasing connection
sequence. Replayed sequence, unknown/unsupported action and additional schema
fields are rejected. Client JSON never supplies its own authenticated identity.
The manual allowlist does not include process execution or filesystem writes.

At most four manual tasks exist, including retired backends still unwinding.
Disconnect retires the connection, cancels its actions and suppresses late output;
conversation admission does not await a stubborn backend. Cancel is idempotent.
Timeouts, policy denials, failures and cancellation are structured terminal results.
Results are finite JSON, at most 16 KiB at the shared executor boundary. Oversized
results become an explicitly truncated data preview, not another action. There is
no output streaming in this slice; tools must also bound their producer/read size.
Executor audit logs name lifecycle only, not arguments/output/credentials.

Existing `files.*` uses canonical authorized roots. Existing process actions
require exact owner approval and are not exposed by the manual agency surface.
Powerful future mutations require deliberate policy/approval design. Read-only
capabilities may auto-run only under the existing explicit runtime read policy.
