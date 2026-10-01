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

## Runtime recovery checkpoint

The existing refresh task owns at most four discovery attempts, with 0.5 / 1 / 2 s
backoff only for an unresolved LM Studio timeout/nonzero inventory while daemon,
server or endpoint is observed running. Successful empty, malformed schema and
unavailable executable are terminal; no retry loop is attached to those outcomes.
Each attempt retains the same desired provider/model. A newer scan increments its
epoch before cancellation; late results are closed and cannot adopt a route. Quit,
disconnect and runtime close cancel pending recovery. Reconnect can explicitly
Rescan using retained intent. No raw provider error body/credentials are emitted.

Exact desired identity persists in runtime across a failed attempt and subsequent
Rescan; a successful explicit switch replaces it. One recovery can load only the
observed exact installed model and becomes active only after endpoint confirmation.
A failed inventory scan preserves an already-valid route rather than disabling
typed recovery. Deterministic coverage uses the actual discovery/bootstrap/probe
and runtime path with fake external transport, proving one load after late inventory.
The temporary expected-failure markers are removed; nearby lifecycle tests pass.

## Core-confirmed presentation and diagnostics

Initial discovery is scanning, not an assertion that loading already began.
The actual installed-model bootstrap reports `loading_model` immediately before
its exact load command. Ready follows endpoint confirmation. Retry reasons/attempts
and the current phase survive owner reconnect snapshots; failed inventory never
appears as a definitive empty catalog. Startup/System distinguishes waiting for
inventory, failed discovery, genuine empty, requested/loading and confirmed active.
Manual Rescan stays available during backoff and supersedes the automatic attempt;
Quit remains available. Disconnected facts are explicitly last known.

Low-frequency logs record attempt/epoch, endpoint readiness, safe inventory class
and count, retry/backoff, exhaustion, actual load start and active-route confirmation.
No raw stdout/stderr, credentials or conversation text is added. Isolated Chrome
protects mounted Orb/Controls, manual supersession, stale result rejection and
disconnected state; frontend correlation regressions remain green.

## Single real verification, 2026-10-01 (Europe/Madrid)

Installed LM Studio / `google/gemma-4-e2b`, normal supervisor and private owner
window, isolated state/app-data memory; microphone and TTS disabled. No downloads,
provider restart/kill, persistent endpoint changes or human session.

| Observed time | Transition |
| --- | --- |
| Before 18:24:38 launch | HTTP unreachable; daemon `not-running`, server `running=false`, no loaded model; first installed-inventory request classified **timeout** |
| 18:24:38–39 | Supervisor/core/UI start; UI healthy |
| 18:24:42 | Initial core inventory available, one installed chat model; endpoint ready, model not loaded; owner core is truthfully degraded/pending |
| 18:24:42 | Automatic bootstrap attempt 1 begins |
| 18:24:44 | Exact installed Gemma load begins; core reports loading |
| 18:24:50 | Endpoint confirms Gemma; active route adopted automatically |
| 18:25:00 | Two complete owner-UI text answers, approximately 9.89 s / 0.45 s request-to-completion; machine observations, not performance gates |
| 18:25:01–03 | Manual Rescan confirms same exact route; no second load; both answers retained, zero page errors |
| 18:25:03–04 | Authenticated Quit; authority revoked, core/resources closed; Sam-loaded Gemma unload confirmed absent; exit zero |
| 18:25:05 | Read-only endpoint probe confirms model absent; serving remains reachable |

`lms ls` can implicitly wake a stopped daemon. The bounded preflight read timed
out, then serving was ready before normal Sam bootstrap. Sam did **not** issue a
server-start operation or acquire server ownership; the log correctly skips
stopping a service already running at bootstrap. Initial preflight-stopped state
must not be described as a verified Sam-owned server-stop test. Model loading was
performed by Sam and its confirmed unload was verified. No arbitrary process kill.

This reproduces a cold **inventory timeout**, not the prior session's exact
unrecorded failure. Inventory recovered by the first core scan, so the runtime
automatic backoff branch was not needed in this session. Its failure/retry/late
success path is deterministically proven. Broader machine/provider compatibility,
physical audio and human acceptance remain outside this evidence.
