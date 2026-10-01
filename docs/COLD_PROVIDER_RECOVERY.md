# Cold LM Studio inventory and model readiness

Consolidation III, 2026-10-01. Published v0.2.3 is untouched. This document
separates confirmed source defects from the prior real session's unclassified cause.

## Existing transition map, before repair

| Boundary | Authority / observation | Existing problem |
| --- | --- | --- |
| Launch | Supervisor starts core; core performs initial non-bootstrap discovery, then serves owner UI | Initial inventory blocks only for a bounded request; owner UI still starts |
| Process / daemon | `lms daemon status --json --quiet` | Process presence is not serving or inventory readiness |
| Serving endpoint | Server status plus `/v1/models` HTTP probe | Reachable endpoint need not mean installed inventory ready |
| Installed inventory | `lms ls --json --quiet`, four-second bound; supplemental `/api/v0/models` | CLI failure, timeout, malformed JSON and true empty all collapse to `[]` |
| Loaded models | Compatible endpoint, overridden by native `state=loaded` where supported | Installed and loaded lists are deliberately separate |
| Desired route | Explicit configuration, otherwise last-good preference, otherwise sole installed chat model | No installed inventory prevents desired discovery/bootstrap; no automatic retry |
| Loading | Exact `lms load`, separate 180-second bound, then serving probe | A request or CLI exit code is not active-route confirmation |
| Active route | Runtime adopts confirmed refreshed provider/model and emits ready | Configured/requested identity must stay separate |
| Recovery / cancellation | Runtime refresh task and lock; Rescan supersedes old work; Quit cancels | No inventory-specific retry; disconnect does not retire a pending refresh |
| UI | Correlated discovery phases, startup/Controls state and transport epochs | A blocked empty catalog is shown as empty even if inventory failed |

The source-level causal chain is confirmed: unclassified inventory failure → false
empty interpretation → no desired installed target → bootstrap skipped → terminal
blocked state. The previous physical run did not retain enough CLI outcome evidence
to identify whether its first `ls` timed out, exited nonzero or returned malformed data.
Do not attribute that exact incident beyond available evidence.

## Reproduction checkpoint

Focused regressions specify CLI success/empty versus timeout/nonzero/malformed,
transient running-provider recovery to Gemma, and genuine empty without retry.
Known-failing requirements are temporarily strict-xfailed in the reproduction
commit; the implementation checkpoint must remove those markers and pass them.
Existing stale scan / switch / Quit regressions remain in the focused gate.

## Classified adapter checkpoint

`ModelInventory` now separates available / successful empty / timeout / nonzero CLI
failure / unavailable executable / malformed or oversized response. Only timeout
and nonzero CLI failures are transient candidates; raw stdout/stderr is never
surfaced or logged. Installed identities remain separate from callable loaded IDs.
The bounded stdout reader consumes through EOF: a single `read(n)` can return a
partial chunk even when the command eventually succeeds. A split-JSON regression
protects this additional confirmed parsing defect. Neither defect alone identifies
the exact unrecorded CLI outcome in the prior real session.

Positive native/API inventory can establish available models; an empty compatible
loaded-model response cannot erase a failed installed-inventory observation.
Explicit desired identity remains pending when unavailable; bootstrap requires the
exact model to be observed installed before loading. Definitively stale preferences
retain the existing choice/fallback policy rather than silently claiming activity.
