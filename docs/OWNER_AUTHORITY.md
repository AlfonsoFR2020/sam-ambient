# Owner authority (post-v0.2.3 development)

The supervisor creates 32 unpredictable bytes for its lifetime. This root stays
in trusted Python processes, is not persisted, and is never an argument, URL,
setting, event, diagnostic or conversation field. It reaches the core through
the initial record on the supervisor-created private stdin pipe, before the
existing graceful-stop reader starts. A new supervisor rotates the root; core
restart changes the instance identity and closes old connections.

## Bootstrap and connection proof

The default source-checkout window uses Playwright 1.63.0 with **existing**
Edge/Chrome/Chromium. No browser is downloaded. The driver communicates through
private process pipes, not a debugging TCP port. Its dedicated ignored
`.sam/owner-ui-profile` is separate from browsing-capability profiles and the
owner's ordinary browser. Only the designated main frame at Sam's own UI origin
can call the proof binding. Popups, downloads, service workers and navigation
outside that origin are blocked. The browser receives a filtered environment
without provider credentials or the root secret.

The native main window instead requests the same proof through a bounded private
stdin/stdout RPC to its supervisor. The native command checks window identity
and bundled/development UI origin. The native shell does not receive the root.

Every WebSocket connection first receives a random nonce plus core instance and
a server HMAC. The trusted signer verifies this MAC, then returns a domain-separated
client HMAC. The core accepts it only for that connection's nonce. Five-second
authentication expiry, fresh reconnect nonce and restart identity reject wrong,
absent, stale and replayed proofs. Revocation rejects further commands/events;
shutdown closes connections. No private state subscription exists before proof.

## Command classification

| Surface | Required authority |
| --- | --- |
| Static frontend assets / owner challenge | Public loopback bootstrap only; no conversation or capabilities |
| Conversation input and private protocol events | Authenticated owner connection (context and model/tool cost are private) |
| Settings, audio controls, provider/model selection, approvals/revocation | Authenticated owner connection plus existing typed validation/policy |
| Quit/restart and future capability execution | Authenticated owner connection; supervisor lifecycle and capability policy remain separate |

Origin and `sam.protocol.v1` checks remain additional restrictions, not credentials.
Normal browser/debug tabs and standalone core launches cannot obtain this proof.
They can inspect the static UI/demo but do not control a live core. An unavailable
owner window fails closed rather than granting an ordinary tab authority.

## Limits and evidence

Mutual MACs prevent a forged local service from obtaining a proof for arbitrary
commands. Model, transcript and webpage content cannot call the signer through
their text representation. Trusted UI code is part of the authority boundary:
an XSS or modified Sam bundle would be a compromise, not a permitted content path.
This is possession authentication, **not OS sandboxing** against a same-account
process able to read Sam memory, attach a debugger, alter trusted code or hijack
the owned browser. Python does not guarantee erasure of every historical memory
copy. Browser profiles must not be shared with untrusted browsing.

Deterministic WebSocket tests exercise replay, restart, revocation, Origin and
pre-authentication commands; an isolated headless existing-browser fixture checks
the real binding and child-frame rejection. Native source compiles, but a full
native physical launch is not claimed. The published 0.2.3 release is unchanged.
