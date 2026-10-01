# Agency Foundation I: development evidence

2026-09-30, post-v0.2.3; published release unchanged. Bounded agency foundation,
not arbitrary shell execution or a full autonomous browser agent.

## Implemented path

Supervisor private-pipe root → fresh authenticated owner connection → typed
capability admission → registry/schema/policy/exact approval/epoch lease → bounded
cancellable executor → untrusted structured result. Provider tool proposals share
that boundary; ordinary prose, pages and results never grant permission.

The real isolated WebSocket simulator uses fake structured inference and a local
inert page. It proves owner authentication, exact model navigation approval before
browser startup, bounded extraction, an injected unknown shutdown action rejected
by the registry, final answer and one clean committed typed input. A second case
cancels actual browser navigation, releases driver/proxy and completes a fresh
typed turn. Shutdown revokes owner/capability authority and cancels work before
owned-browser cleanup; repeated shutdown is harmless.

## Resource and performance evidence

- No browser driver/context/proxy before the first supported navigation. No Sam
  polling task for idle browser/console infrastructure. Open Chromium retains
  normal browser costs; this is not whole-app profiling.
- One local simulator measured owner handshake/readiness at **1.52 ms** (another
  run 1.57 ms), excluding OS browser startup. A sanity observation, not an exact
  CPU benchmark or fixed-machine regression threshold.
- Four manual tasks including unwinding backends; 64 console entries preserving
  active requests; executor history 256; result JSON 16 KiB. Browser text 8,000
  characters, title 300, URL 2,048; navigation 10 s/tool 15 s, then cleanup up to
  3 s each for owned browser close/driver stop. Cleanup failure is best-effort;
  no process-name killing or guarantee against a broken host.
- Proxy: eight connections, 8 KiB headers, 16 KiB relay chunks with drain, 2 MiB
  each direction/connection, 30 s connection lifetime; at most 20 routed requests
  per navigation. Voice queues and visual costs are unchanged.
- Python Playwright 1.63.0 adds driver/runtime (Windows wheel about 39 MB), pyee
  and greenlet. No browser download. Apache/MIT/PSF notices are in THIRD_PARTY;
  native inclusion of driver/Node/license assets needs checking before packaging.
  Existing native source compiles offline.

## Evidence limits and next use

### 2026-10-01 bounded real-provider follow-up

LM Studio's existing `google/gemma-4-e2b` completed a structured workspace
`files.read` through the shipped, privately authenticated OwnerWindow (headless
for automation). The bounded fixture contained a mascot fact and fake privileged
instructions; only the registered read ran and the model returned the correct
mascot. Owner emergency cancellation retired a subsequent model request. No
speech adapters or full supervisor stack ran; no models/providers were downloaded.
The installed model was loaded with an idle TTL, without changing saved endpoints.

This uncovered Chromium's local-network-access check blocking the owner UI's
loopback WebSocket. OwnerWindow now grants that permission **only to its trusted
UI origin**, before navigation. The separate untrusted capability browser receives
no such grant. Private shipped assets and mutual HMAC remain mandatory. The
regression exercises the actual shipped UI and text submission with fake inference.
See [Playwright permissions](https://playwright.dev/docs/api/class-browsercontext#browser-context-grant-permissions).

An inherited `SSLKEYLOGFILE` caused Python OpenSSL initialization to abort; it was
removed only from validation child processes. The first model request also failed
truthfully after the short model TTL expired during connection diagnosis; a reload
of the same installed model allowed the representative turn above. No persistent
environment or dependency change was made. Public browser/TLS and native packaging
remain outside this check.

Final touched-subsystem gate: 137 agency Python tests and 36 nearby synthetic voice
regressions pass, one Windows symlink-privilege
skip; 73 frontend tests pass across six files; TypeScript and changed-file Ruff/
format/Biome/diff checks pass. The one isolated frontend Console Chrome regression
passes. Native Cargo check and targeted frontend production asset build pass;
native packaging and full Sam execution are not part of this evidence. The owner
asset fixture proves an HTTP service at the UI origin supplies no signer-bearing
code. Native HTTP dev mode intentionally has no authority; bundled Tauri origins
retain the private RPC path.

Tests cover owner proof/replay/rotation, policy/schema rejection, cancellation,
late results, output bounds, Windows junction/path escape and pinned proxy DNS.
Ordinary Windows symlink creation is skipped for missing privilege; real junction
containment is exercised. Model/page command-like content stays inert. The source
owner binding and browser capability use isolated existing-browser fixtures only;
no complete Sam/model/audio launch was used.

An early inherited packaged-startup test contacted existing local provider discovery
before its fixture was corrected to fake discovery. No provider/model was started,
generated with, unloaded or stopped. Subsequent startup tests use the fake boundary.

Real provider tool compatibility, public-site/TLS behavior, native physical launch
and native driver packaging remain unvalidated. Same-user memory inspection,
trusted-code replacement or a compromised Sam UI are OS/trusted-code limitations,
not solved by possession proofs. Root material is never logged or exposed to pages.

The highest-value next task is a bounded, separately authorized real structured-tool
workflow with an existing provider through the owner window, before adding more
tool types. No human beta is requested. [ROADMAP](ROADMAP.md) is authoritative.
