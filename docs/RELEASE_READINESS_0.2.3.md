# Sam 0.2.3 release readiness and scope freeze

Release preparation (2026-09-28): v0.2.3 scope is frozen. Source, frontend and
native metadata advance together to 0.2.3. The owner accepts the known
real-provider, physical-audio and broader visual-validation limits for this
Windows-first alpha candidate. Do not reopen those paths solely to release.

## Real provider/text smoke attempt — 2026-09-28

On clean `dev` at `20269404`, no configured real provider was reachable, so the
integration session stopped before launching Sam. Neither the user nor workspace
`sam.toml` exists, and no `SAM_*` environment override was set. The installed
LM Studio CLI reported its server stopped; probing its default loopback model
endpoint (`127.0.0.1:1234`) and Ollama's (`127.0.0.1:11434`) found neither
reachable. An LM Studio inventory command attempted to wake its daemon and
timed out; it did not establish a serving model. LM Studio processes created by
that command were stopped after confirming none were running beforehand. No
provider/model identity could be exercised. Startup discovery, Rescan, exact
switching, text generation and frontend/core reconnect therefore remain
**unvalidated**, with no pass or product defect inferred from this unavailable
environment. No Sam runtime,
model, audio or native application was launched, and no endpoint or credential
configuration was changed. This is an accepted validation limit, not a passed
integration smoke or evidence of a product defect.

## Frozen release scope

0.2.3 contains the frontend startup, Controls, renderer recovery and diagnostics
work; correlated provider discovery and connection state; turn-local inference
routing and typed local controls for exact provider/model switching and Stop
speaking; correlated text/voice turns; bounded audio ownership and distinct
capture, STT, synthesis and playback health; and the Living Surface circulation,
shared membrane, independent lighting/palette clocks, wider particle field and
bounded AmbientReactivity. These are implemented source paths with deterministic
coverage. Real provider, physical voice, native package and human visual behavior
have not been accepted for this release.

After this freeze, new features belong after 0.2.3 unless they fix a reproduced
release blocker, a regression, or a required validation failure. In particular,
natural-language control recognition, named server/API profiles, arbitrary
credential configuration, broader spoken settings and major new visual direction
are outside 0.2.3. The typed voice-control hook is not a phrase recognizer;
source-specific audio levels are not proof of useful physical voice reactivity.

## Open-work classification

| Class | Current disposition |
| --- | --- |
| Release blocker | No reproducible source defect is confirmed at freeze. A failure in existing automated release checks or the normal build must be resolved. No known black-screen, committed-text-loss or silent-route-substitution defect is being waived. |
| Accepted validation limits | Real provider discovery/selection/generation, physical capture/STT/TTS/playback, acoustic interruption, real reconnect timing and representative GPU perception were not revalidated for this candidate. The historical real Rescan black-screen report remains unconfirmed by the deterministic regressions. Document these limits without claiming a pass. |
| Post-0.2.3 | Named connection profiles and natural-language/spoken control, wider audio/device and model choices, stronger physical reactivity, surface/palette/membrane/lighting/particle art refinement, richer diagnostics, session-resume policy, and the dedicated Linux 0.3.0 review. Preserve these in [Backlog](BACKLOG.md). |
| Speculative / obsolete | A new 0.2.3 peel implementation and an entirely absent audio-reactivity foundation are superseded claims: the membrane patches and bounded envelope consumer exist. Physical quality remains unaccepted. The old assertion that 0.2.2 is still being prepared is stale. |

## Release preparation gates

1. Keep Python, frontend, Tauri, Cargo and the Sam entries in the lockfiles at
   0.2.3; pass the existing version and package-content checks.
2. Run the existing automated Python/frontend, TypeScript, Ruff/Biome/format,
   Rust and focused browser gates that the release process supports. Record the
   known Ubuntu CI exception under the Windows-first policy.
3. Build the normal wheel, source distribution, self-contained companion and
   guarded Windows native candidate without broadening product validation.
4. Publish no unsigned Windows installer. Signing, antivirus/reputation review,
   hosted Windows gates after push, tag/release creation and artifact publication
   remain manual release execution under the [release checklist](RELEASE_CHECKLIST.md).

## Automated protection already present

- Provider/discovery, command correlation and reconnect: core control tests,
  frontend provider/reducer/transport tests and the isolated Rescan browser spec.
- Turn identity, interruption and audio failure: generation/voice pipeline and
  delivery integration tests, local-control tests, frontend lifecycle tests and
  fake PortAudio/STT/TTS tests. Real acoustic timing is not covered.
- Visual, fallback and interaction: visual-engine/material/quality/input tests
  plus browser slider, drag, Rescan and WebGL composition specs. They do not prove
  representative GPU cost or human visual acceptance.

The automated checks protect the implemented contracts; they do not establish
physical or real-provider acceptance. Those limits are accepted for this
candidate and stated in the [release notes](RELEASE_NOTES_0.2.3.md).
