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

## Console slice

The separate **Console** button offers `files.list`, `files.read` and `system.info`.
Only the configured `workspace` root is available (canonical containment, Windows
device/drive/ADS validation, symlink/junction escape rejection). Reads are private
owner data and may include sensitive project contents; choose the workspace
deliberately. The UI requests at most 8 KiB / 200 lines for text and 100 directory
entries. The shared executor imposes its independent 16 KiB result boundary.
There is no shell, executable selector, filesystem write or Git mutation.

`control.capability.execute/cancel` receives its connection context from the
authenticated bridge, not payload identity. Admission returns immediately;
`capability.state` reports queued/running/terminal. Disconnect cancels only that
connection's manual work. Console results scroll independently, render escaped
text, remain bounded to 64 entries and never become conversation transcript or
generation state. Opening/closing the surface does not confer or revoke authority.

## Model mediation

Only provider `ModelEventKind.TOOL_CALL` proposals enter the typed accumulator;
assistant prose, page/file results and transcript text are not parsed as commands.
Schemas advertise registered tools; policy outside the model decides approval.
Browser navigation needs exact owner approval, while authorized workspace reads
use the explicit existing read policy. Results return as `MessageRole.TOOL`, tagged
`untrusted_data`, not as system policy. The model can continue after a failed/denied
tool. Malformed proposals fail recoverably; cancellation/staleness retires the turn.

Each turn has at most the configured tool rounds (default four, maximum eight),
eight proposals per round, 512 fragments per proposal round, 64 KiB argument data
and 16 KiB per result. An identical capability/argument proposal within a turn is
denied even if the provider assigns another call ID. This bounds repeated/recursive
loops without making model output permission. There is no text-envelope parser.

## Adversarial regression boundary

Tests exercise absent/wrong/stale/replayed connection proofs, Origin rejection,
revocation, action sequence replay, forged connection identity, additional argument
fields, unknown actions, path namespaces/traversal and Windows junction escapes.
Ordinary symlink creation requires privileges unavailable on the current Windows
test host; that case is skipped explicitly, while the real junction case passes.
Returned command-like text remains data. Oversized results and rejection errors
are bounded, consumer cancellation is terminal, and four concurrent manual tasks
exhaust admission until one retires. Ownership is rechecked after asynchronous
started-event publication and after waiting for the command dispatcher lock.
Unauthenticated sockets receive no shutdown broadcast or private event subscription.

Browser tests reject arbitrary script actions and private DNS results. A synthetic
CONNECT tunnel verifies one DNS lookup followed by a connection to that validated
literal IP; it makes no external connection. These tests establish protocol and
policy boundaries, not resistance to a same-user process reading Sam memory or
altering trusted code, nor a general Chromium/OS sandbox guarantee.
