# Security

## Reporting a vulnerability

If this repository's **Security → Report a vulnerability** button is available,
use GitHub's private reporting flow. No private security email is configured.
Until a private channel is available, open a minimal issue asking the maintainer
for a private channel; do not include an exploit, credentials, private files, or
sensitive logs in a public issue. The repository is initially private, but do
not assume it will remain private forever.

## Trust boundaries

The model proposes tool invocations. Immutable descriptors, filesystem roots,
approval checks, revocation epochs, and the executor determine whether they run.
File and clipboard contents are untrusted data, never authority. Approval grants
one exact invocation; global revoke invalidates pending approval and active leases.

`process.run` uses structured argv, a filtered environment, bounded output and
timeouts, and explicit owner approval. **It is not a full OS sandbox.** An
approved program runs with the owner's OS permissions and can access resources
beyond its working directory. Read the command and arguments before approval.
Filesystem containment cannot defend against a malicious same-user process
concurrently altering the host filesystem. Windows descendant cleanup is limited.

The UI HTTP server and WebSocket bridge bind to loopback. The bridge checks
origins and protocol version; it is intended for a trusted single-user machine,
not remote/multi-user hosting. Quit Sam is a direct UI command, not a model tool.
The supervisor accepts only its narrow child lifecycle protocol; arbitrary launch
specifications and update activation are not exposed to model or UI commands.

Model discovery probes known loopback endpoints and explicit local configuration;
it does not scan a network, start services, or download models. Cloud use requires
explicit configuration and privacy permission. Clipboard and retrieved file data
must not silently cross into cloud context.

Committed text and operational metadata are stored locally under `.sam/`; raw
microphone audio is not persisted. INFO/DEBUG logs omit prompts, tool contents,
credentials, and audio. Review diagnostics before sharing paths/model names.
Candidates are staged, hashed, tested, and health-observed by trusted code, with
rollback retained. Hashes identify content; they do not establish publisher trust.
