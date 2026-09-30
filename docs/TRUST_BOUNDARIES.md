# Current trust boundaries after v0.2.3

This is a source-based review of the current local desktop architecture, not a
claim that Sam is safe to expose as a network service. Severity reflects Sam's
single-user, loopback-only design. No critical issue was identified in this
bounded review; real hostile-local-process testing was not performed.

## Boundaries and current controls

| Boundary | Current enforcement | Untrusted input / remaining limit |
| --- | --- | --- |
| Browser UI → core | WebSocket binds to loopback, accepts a fixed Origin list and `sam.protocol.v1`, limits message size/queue, and parses typed commands. | Browser Origin protects against an unrelated website, not an arbitrary same-user process that can forge the header. UI commands are not independently authenticated. |
| Model / transcript → UI | Protocol decoder and reducer project committed turns; `MessageContent` builds React text/element nodes for a small Markdown subset. | Model and STT text are data. They cannot become HTML or a control command through this renderer. Future rich rendering must preserve that boundary. |
| Model → capabilities | Trusted registry, argument schema, runtime policy, exact-invocation owner approval, revocable epoch and cancellation mediate calls. | Model content is never itself authority. An approved external process still runs with the owner's OS rights; this is not a sandbox. |
| UI/local control → privileged action | Dispatcher validates typed commands; model switching uses exact available routes and blocks active generation; Stop speaking reuses delivery cancellation. | Current local controls are not inferred from arbitrary spoken/model text. Future recognition must stop before ordinary turn commitment and require its own authorization policy. |
| Provider / speech / supervisor processes | Launches use argument vectors, bounded readers/timeouts and owned-process cleanup; TTS/STT run as separate lifetimes. | Trusted local configuration chooses endpoints and executable paths. Loopback service readiness is not proof of vendor identity. |
| Files / settings / diagnostics | Authorized roots reject traversal and confine tool paths; API key comes from an environment variable; ordinary settings contain no API key; logs avoid prompts/audio. | Committed text and metadata are stored locally in `.sam/` without an OS security boundary against the owner account. Diagnostics may expose paths or model names when shared. |

## Findings and disposition

| Severity | Precondition and impact | Mitigation / action |
| --- | --- | --- |
| Medium, fixed | An authenticated OpenAI-compatible endpoint returns an error containing the supplied credential. Its body formerly entered `HttpStatusError`, potentially reaching UI detail or exception logs. | Authenticated HTTP failures now retain the status but use a fixed detail. Unauthenticated local-provider errors still retain bounded details. Synthetic JSON and streaming errors cover this. |
| Medium, fixed | A configured cloud-compatible endpoint used HTTP, or embedded credentials/query data in its URL. A request could expose an API key or context over an insecure route, or place credentials in URL-shaped diagnostics. | Cloud-compatible routes require HTTPS; embedded URL credentials, query and fragment are rejected. An explicitly local-compatible route can still use loopback HTTP. Configuration must supply cloud keys through the environment. |
| Medium, accepted local-design limit | A hostile same-user process can connect to loopback and forge an allowed Origin to issue UI commands. That process can also control the owner's host directly; nevertheless future browser/console features would amplify this boundary. | Current loopback binding, browser Origin list, typed protocol and tool approvals reduce remote-web exposure. Before exposing untrusted browsing content or another user session, add a connection-scoped owner capability/authentication design. Do not treat Origin or a mutable UI flag as that capability. |
| Low / hardening | An attacker-controlled service occupies an expected loopback provider port and supplies misleading model data. | Discovery is constrained to known/explicit local endpoints, has no network scan/download, and does not authenticate vendor identity. A future provider identity or profile system should make this choice explicit. |
| Accepted limitation | A user approves `process.run` or another external action. The child can use normal owner OS permissions beyond Sam's logical roots. | Exact-invocation approval, filtered environment, timeout/output bounds and cancellation exist. Do not describe these as OS sandboxing. |

## Rules for future console, browser and memory work

Untrusted pages, retrieved files, model text, transcripts, tool output and stored
memories must remain **data**, never a direct source of UI control commands or
capability authority. New browser or terminal actions must enter the same trusted
registry/policy/approval/epoch path, with narrow arguments and bounded output.
Do not forward a core WebSocket or approval capability into arbitrary page content.
An embedded browser that can load untrusted origins needs its own isolation and a
separate owner-authenticated control channel before it can share Sam's powers.
Cloud routing must continue to require explicit owner privacy permission; memory
or clipboard context cannot silently cross that boundary. Diagnostics and audit
events may name an action and outcome but must not include API keys, raw audio or
full conversation content solely for debugging.
