# Owned browser capability (development slice)

`browser.navigate`, `browser.read`, `browser.close` share the authenticated owner
Console and existing tool registry/policy. An exact manual navigation is an
explicit owner grant. A model navigation proposal requires the ordinary exact
tool approval; model prose and page text are never permission. Results contain
URL, title and at most 8,000 visible-text characters, tagged untrusted and subject
to the executor's independent 16 KiB JSON limit.

## Deliberate initial limits

The browser is a lazy, headless, Sam-owned **ephemeral** Chromium context using
an existing Edge/Chrome installation. It shares neither the owner UI binding nor
the owner's ordinary browsing profile, passwords/cookies or provider environment.
No idle process is started. The surface is useful for inspecting static public
pages, not a full autonomous browsing agent: page JavaScript, service workers,
popups, downloads, uploads, forms, arbitrary JS, media and WebSockets are disabled.
No clicking, accounts, credentials or purchases are exposed. Browser audio is muted.

Navigation accepts public HTTPS/443 without embedded URL credentials. An owned,
random-credential loopback proxy resolves every tunnel destination, rejects any
non-global/multicast/reserved answer, then connects the **validated literal IP**.
The original hostname remains available to Chromium for TLS certificate validation;
certificates are not bypassed. This avoids a second DNS lookup after approval.
HTTP redirects and subresources remain constrained to the explicitly authorized
origin. Only GET/HEAD document/styles requests pass; iframe navigation and later
page-initiated navigation are blocked. GET visits still contact an external service
and can have tracking/server effects; do not describe them as a no-effect sandbox.

Proxy connections are bounded to eight, 30 seconds and 2 MiB per direction; each
navigation has at most 20 requests, 10 seconds to DOM readiness and a 15-second
tool lifetime. Streams use 16 KiB chunks with drain backpressure. These limits can
reject large or dynamic sites; widening them or enabling script/form interaction
is future policy work, not a quiet workaround. Exact loopback HTTP fixture origins
can be injected **only by trusted tests**, never through UI/config/model arguments.

## Ownership and evidence

The runtime owns one browser service. Operations serialize; cancellation/failure
retires its page/process/proxy, Close is idempotent and shutdown closes resources.
Shutdown first revokes authority and cancels work; browser close and driver stop
each have a three-second cleanup bound. Host/process failure remains best-effort.
Manual disconnect closes resources only if that connection still owns them;
old disconnect cleanup must not close a newer owner's page. An already-authorized
model turn remains generation-scoped under existing cancellation/lease rules.
Errors use fixed safe details, not supplied URLs, headers or proxy credentials.

An isolated existing-browser fixture verifies inert script, absence of owner
binding, bounded text, actual proxy use and cleanup. Unit tests cover URL schemes,
credential URLs, private DNS/IP families and proxy authentication. Public external
websites and physical native launch have not been exercised in this task.

Implementation uses [Playwright proxy/routing](https://playwright.dev/python/docs/network)
and [isolated contexts](https://playwright.dev/python/docs/api/class-browsercontext).
No second browser framework or new dependency is added beyond owner-bootstrap Playwright.
