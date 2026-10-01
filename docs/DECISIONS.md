# Decision log

## 2026-10-01 — Durable memory is reviewed local context, never authority

HQ authorized a post-MVP single-owner SQLite foundation without external database
or embedding dependency. Stable principal, provenance, review and optimistic
revisions survive credential rotation. Owner CRUD uses shared live authority;
model prose cannot write. Exact `memory.propose` approval permits an unreviewed
candidate, not a trusted fact; separate review/correction permits bounded lexical
recall. Maximum six complete entries / 4,800 characters, separate from system
instructions/history/tool results. All memory is local/private: ordinary cloud
question permission grants no memory export. No automatic transcript import.

Correction/deletion remove live old content/index text; replay keeps terminal
metadata rather than bodies. This cannot retract prior chat/provider copies,
backups or guarantee forensic erasure. Store failures preserve text, migrations
are transactional and bad databases are not auto-erased. Single-owner sessions
do not authenticate speakers; multi-user consent and semantic retrieval are future
contracts. See [memory evidence](MEMORY_FOUNDATION_I.md). Synthetic tests/real
agency smoke are distinct from human memory/privacy acceptance.

## 2026-10-01 — Memory management is owner-only shared capability authority

Use a separate app-data SQLite store and stable database principal, not ephemeral
session identity or chat-log import. Owner CRUD is hidden from model schemas and
also denied by the executor without a current direct owner action. A narrow
OWNER_DATA_MUTATION class requires exact authenticated approval and grants no
general destructive process/file power. Transactions recheck the live token and
owner before commit. A committed write cannot be retroactively rolled back by
disconnect; expected revisions and explicit refresh provide recovery.

## 2026-10-01 — Trusted owner UI receives origin-scoped loopback permission

Chromium blocks loopback WebSockets from privately fulfilled owner assets without
local-network-access permission. Grant it only to the designated Sam owner origin
inside its dedicated context. Keep shipped-asset routing, owner proof and separate
untrusted browser isolation. Never disable Chromium security globally to connect.

## 2026-09-30 — Signer-bearing UI uses trusted assets, not HTTP origin alone

Source owner-window routes fulfill only canonical shipped frontend assets over
the private browser driver, starting on a blank page before signer installation.
Another service at the UI port cannot supply privileged code. Native proof only
accepts bundled Tauri origins; HTTP Vite native-dev remains a non-authoritative
UI surface. Use the source owner window for live development. This deliberate
fail-closed restriction supersedes the initial dev-HTTP proof allowance.

## 2026-09-30 — Memory is a future policy-mediated capability

The [memory contract](MEMORY_AUTHORITY_CONTRACT.md) separates durable owner identity,
ephemeral authorization, session context, provenance and reviewable writes.
Page/model/tool output is not trusted durable memory or permission. No persistence,
retrieval or embedding implementation is introduced in the agency foundation.

## 2026-09-30 — Agency browser is a bounded inspection context

Reuse Playwright already needed for private owner bootstrap, in a separate lazy
ephemeral context. Initial browser power is navigate/read/close, not clicking or
form submission. Disable page scripts and constrain network requests to public
HTTPS and the owner-authorized origin. A small authenticated egress proxy pins
validated IPs, closes the DNS-rebinding gap, and bounds streams. Exact manual
requests constitute owner grants; model navigation still requires approval.
Dynamic/authenticated site support requires a later deliberate policy slice.

## 2026-09-30 — Owner authority precedes agency

HQ moves secure agency ahead of additional AEC experiments. The rejected AEC
prototype remains valid evidence and does not block console/browser foundations.
Use one ephemeral supervisor root and mutual, connection-specific HMAC proof;
bootstrap through private process pipes, never URL/settings or a public token
endpoint. Existing-browser source launch now needs Playwright's private pipe
binding; native launch uses private supervisor RPC. All private events/commands
require proof. This deliberately removes live-core control from ordinary debug
tabs. The boundary is possession authentication, not a same-account OS sandbox.
See [owner contract](OWNER_AUTHORITY.md); capability policy still governs execution.

Only implementation choices or justified deviations not already fixed by the
master specification are recorded here.

## D-001 — Python package layout

- **Status:** accepted, 2026-09-01
- **Decision:** Put the Python modular monolith under `src/sam_ambient` rather
  than creating importable top-level packages named `core` and `supervisor`.
- **Reason:** Namespaced packages avoid collisions and make one distributable
  core while preserving explicit core, adapter, and supervisor boundaries.
- **Consequence:** Files differ slightly from the approximate Section 14 tree;
  process authority boundaries remain unchanged.

## D-002 — Project license remains reserved during bootstrap

- **Status:** temporary, 2026-09-01
- **Decision:** Use a temporary all-rights-reserved notice until the owner makes
  the specification's MIT-vs-Apache-2.0 choice.
- **Reason:** The master specification expressly reserves the final project
  license to the owner, and implementation does not require that choice yet.
- **Consequence:** Do not distribute original project source until replaced by
  the selected license. Permissive third-party tools can still be used.

## D-003 — No historical Zev source reuse

- **Status:** accepted, 2026-09-01
- **Decision:** Independently implement the provider boundary instead of
  copying the historical Zev fork.
- **Reason:** The inspected MIT code is a small OpenAI-client wrapper tied to
  legacy configuration; reuse would add dependencies without useful plumbing.
- **Consequence:** Preserve behavior such as local detection and configurable
  Ollama URLs, but not historical internals.

## D-004 — Sam naming amendment

- **Status:** owner-directed, 2026-09-01
- **Decision:** The product and user-facing name is `Sam`; project/package names
  are `sam-ambient` and `sam_ambient`, with future processes `sam-core`,
  `sam-ui`, and `sam-supervisor`.
- **Reason:** The owner renamed the product before downstream packaging and IPC
  names became expensive to migrate.
- **Consequence:** Zev remains only in historical source/provenance references.

## D-005 — HTTPX for provider transport

- **Status:** accepted, 2026-09-01
- **Decision:** Use HTTPX `AsyncClient.stream()` for provider HTTP rather than a
  custom urllib/thread transport.
- **Reason:** Mature async streaming, connection pooling, timeouts, and native
  task cancellation reduce custom maintenance and socket-lifecycle risk.
- **Consequence:** HTTPX and transitive licenses are recorded in
  `THIRD_PARTY.md`; certifi is unmodified MPL-2.0 data/dependency. Cancellation
  cancels the consuming task and the response context closes the stream.

## D-006 — Phase 3 local voice adapters

- **Status:** accepted, 2026-09-02
- **Decision:** Use sounddevice/PortAudio for fixed-frame audio I/O, WebRTC VAD,
  and an HTTP adapter to a separately managed loopback whisper.cpp server.
- **Reason:** These are mature, replaceable implementations behind neutral
  `AudioInput`, `AudioOutput`, `VAD`, and `STT` contracts. Direct async iteration
  applies backpressure without another audio queue; native overflow is surfaced
  as an error rather than hiding lost audio.
- **Consequence:** STT is finalize-only for now and models stay external. Windows
  packages must exclude or separately approve the unused ASIO-enabled DLLs
  included in upstream sounddevice wheels.

## D-007 — Production TTS selection deferred

- **Status:** accepted, 2026-09-02
- **Decision:** Complete Phase 3 with the provider-neutral streaming TTS
  contract, deterministic sentence chunking, cancellation tests, and a test
  double; do not ship a production TTS engine yet.
- **Reason:** The evaluated Kokoro Python route currently pulls
  `phonemizer-fork`/eSpeak-NG GPL dependencies. Building speech synthesis or
  phonemization from scratch would add unjustified maintenance and license risk.
- **Consequence:** No Kokoro/Piper runtime, model, voice, or reciprocal-license
  code is included. Phase 4 can integrate against the stable TTS cancellation
  boundary while a commercially acceptable backend is selected separately.

## D-008 — Generation-scoped barge-in and delivery truth

- **Status:** accepted, 2026-09-02
- **Decision:** Keep `TurnManager` as the authoritative timestamp-driven state
  machine; use a small `BargeInController` to feed continuous VAD/optional STT
  evidence and an `InterruptionCoordinator` to cancel bound work before event
  publication. Track generated, queued, playing, spoken, and cancelled text in
  a bounded generation/chunk ledger and durable bounded TTS queue.
- **Reason:** This makes candidate interruption reversible while confirmation
  atomically stops the shared model/TTS/audio cancellation identity. Generation
  checks reject stale completions, and chunk-level delivery truth prevents
  conversation history from claiming unheard text without word alignment.
- **Consequence:** False candidates cancel only their provisional STT token and
  preserve the response queue. Confirmed candidates retain their STT identity
  as the next user turn. Logical cancellation occurs synchronously before event
  bus backpressure; physical stop latency still requires target-hardware tests.

## D-009 — Shell-neutral Phase 5A frontend

- **Status:** accepted, 2026-09-02
- **Decision:** Keep the React presentation behind a `ProtocolTransport`
  boundary. In-memory demo and browser-event transports implement the same
  protocol path; a tiny injected `NativeEventSource` is the only future Tauri
  seam. Lossy voice/playback metrics coalesce once per animation frame while
  durable state and transcript events reduce immediately.
- **Reason:** This makes protocol, state, reconnection, and visual behavior
  independently testable without pretending a missing native toolchain is a
  valid Tauri build. It also preserves the specification's future local/mobile
  transport replacement path.
- **Consequence:** Phase 5A ships a browser build and Tauri 2 metadata only. The
  Rust host and concrete Python-core bridge remain Phase 5B work; no direct
  Tauri API import leaks into presentation components.

## D-010 — Loopback development bridge and split controls

- **Status:** accepted, 2026-09-02
- **Decision:** Use a bounded, origin-checked localhost WebSocket as the
  development core/UI transport. Keep microphone, output, stop-speaking, and
  emergency-stop commands authoritative in Python; keep transcript visibility,
  motion, brightness, and fullscreen local to the presentation.
- **Reason:** `websockets` provides mature cancellation, connection, and
  backpressure behavior under BSD-3-Clause with less custom networking code.
  The split avoids duplicating conversation or runtime policy in React.
- **Consequence:** Browser development exercises the same versioned event and
  command envelopes as the future injected Tauri adapter. Remote binding and
  authentication remain deliberately unsupported.

## D-011 — Runtime-owned capabilities and epoch revocation

- **Status:** accepted, 2026-09-02
- **Decision:** Project immutable registered tool descriptors into provider
  schemas, but keep risk authorization, root scope, approval, execution, and a
  process-local epoch-based capability authority exclusively in trusted core
  code. A global revoke invalidates leases and pending approvals and cancels
  cancellable active tools; only a non-tool trusted runtime API can restore it.
- **Reason:** Model output and retrieved data are untrusted requests/data, never
  authority. Separating per-call approval, policy authority, and global revoke
  prevents prompt text or stale UI responses from escalating permissions.
- **Consequence:** Phase 6A auto-allows bounded reads in configured roots, asks
  for clipboard access/write, and denies external, privileged, and destructive
  actions. `app.open` is registered and adapter-tested but policy-disabled.

## D-012 — Post-MVP Linux desktop-control direction

- **Status:** planned architecture only, 2026-09-02
- **Decision:** Prefer AT-SPI semantic inspection/action, then desktop-native
  KWin/D-Bus/XDG portal APIs, then constrained coordinate actions, with
  screenshot/vision-derived targeting last. Keep read-only perception
  (`desktop.inspect`, window/element reads), action (element/type/pointer), and
  privacy-sensitive screenshot capabilities separate; perception never grants
  action authority.
- **Reason:** Structured accessible/native actions are more reliable and
  governable than raw coordinates or vision, and capability visibility plus an
  external global kill switch must precede desktop control.
- **Consequence:** [Pelorus](https://github.com/linuxserver/pelorus) is
  reference-only pending explicit license verification before any reuse.
  [Nidara Desktop](https://github.com/nidara-project/nidara-desktop) is
  architecture-only because it is GPL-3.0; no Nidara code may enter Sam. Phase
  6A/6B implement none of these desktop capabilities.

## D-013 — Structured process execution and explicit atomic writes

- **Status:** accepted, 2026-09-03
- **Decision:** Use one approval-only `process.run` capability with an executable
  and argv passed to `shell=False`, an authorized cwd, a sanitized inherited
  environment, bounded output, and cooperative timeout/revocation cleanup. Make
  `files.write` visible only for an explicitly writable root and use bounded
  UTF-8 temporary-file plus atomic activation semantics.
- **Reason:** Structured argv avoids accidental shell interpretation while exact
  approval remains the boundary for programs that retain normal user authority.
  Atomic replacement prevents cancellation/failure from exposing partial files.
- **Consequence:** There is no shell-string mode, elevation, destructive command
  class, or OS sandbox claim. Windows descendant-tree guarantees require a
  future native Job Object adapter if needed.

## D-014 — Trusted bounded supervisor with fail-closed recovery

- **Status:** accepted, 2026-09-03
- **Decision:** Run `sam-core` under a small LLM-independent `sam-supervisor`
  using trusted argv, an explicit stdout readiness record, bounded exponential
  restarts, and SQLite operational state. A critical failure persists a new
  capability epoch before restart; three failures within the default 60-second
  window stop restarts and persist safe mode.
- **Reason:** Process liveness alone is not readiness, and a restarted core must
  not revive pre-crash leases or approvals. Keeping launch, crash policy, and
  recovery state outside the conversational runtime makes recovery independent
  of provider, UI, and model availability.
- **Consequence:** A local console can inspect status or explicitly restore
  capability authority after diagnosis; neither action is in the UI/model
  protocol. Browser dev UI remains independently restartable until a packaged
  `sam-ui` process exists. Phase 8 may use these seams but adds no updater here.

## D-015 — Versioned staged activation with manifest pointer

- **Status:** accepted, 2026-09-04
- **Decision:** Keep update authority in the trusted supervisor layer. Stage
  component-neutral local artifacts under version directories, validate them
  with bounded structured commands, and atomically replace a small `active.json`
  manifest before a planned component restart and stable health observation.
- **Reason:** A manifest pointer gives Windows and POSIX the same unprivileged,
  recoverable activation transaction without overwriting the running version or
  assuming every future component is Python or repository-owned.
- **Consequence:** Capability authority is revoked for activation and rollback;
  last-known-good advances only after observation, ambiguous recovery rolls back,
  and double failure enters safe mode. Phase 9 supplies the stable packaged
  manifest launcher; supervisor self-update still needs a separate bootstrap.

## D-016 — Browser-packaged MVP and system speech

- **Status:** accepted, 2026-09-04
- **Decision:** Ship 0.1.0 as a Python wheel containing the production Vite
  assets and a loopback-only supervised static server. Use Windows
  System.Speech or a separately installed Linux eSpeak executable behind the
  existing TTS contract; keep native Tauri packaging deferred.
- **Reason:** This creates one installable, spoken, end-to-end MVP without a
  Rust/MSVC toolchain or a questionable bundled phonemizer/voice chain.
- **Consequence:** `sam-ambient` supervises core plus UI and resolves versioned
  `active.json` on every core start. Linux speech quality and native desktop
  integration remain replaceable post-MVP concerns; external eSpeak is not
  bundled and retains its own GPL terms.

## D-017 — First-run lifecycle and passive provider selection

- **Accepted:** 2026-09-06. Open the browser once after readiness, outside managed
  component lifetime; direct owner Quit uses an instance-bound lifecycle message,
  never an LLM tool. Windows version launch stays in the monitored child because
  CRT `exec` creates a descendant and can break graceful shutdown ownership.
- Discovery uses bounded known loopback endpoints/status-only CLI calls; explicit
  configuration wins, otherwise deterministic local priority. Never wake a model
  daemon, download assets or switch to cloud. Protocol support, not port/vendor
  identity, preserves future transparent local-router compatibility (e.g. PAIR).
- Owner selected unmodified Apache-2.0 for original Sam code, with named NOTICE;
  incorporated frontend MIT notices and external-runtime licenses stay separate.

## D-018 — Bounded local startup and shared provider ownership

- **Accepted:** 2026-09-07. Supersedes D-017's passive-only application startup:
  diagnostics remain passive, while runtime startup may start installed local
  providers/load installed chat models. Existing SQLite metadata stores successful
  local selections; explicit choices win, stale preferences fall back.
- Each backend attempt is bounded to 20 s. No downloads, model eviction or cloud
  fallback. Sam reaps direct owned Ollama children, but retains the shared LM
  daemon/server (Sam-loaded models use a 600 s idle TTL); stopping shared services
  could disrupt unrelated clients. Whisper retains its existing ownership rules.

## D-019 — Known-output transcript screening before physical AEC

- **Accepted:** 2026-09-18. During active playback, compare finalized local STT text
  with the assistant text Sam is currently delivering. Reject an output-only match
  with an explicit `playback_echo` outcome; retain clearly novel interruption words
  and require a finalized non-backchannel transcript before an unscored whisper.cpp
  result can cancel playback and become a user turn.
- This is an inexpensive ownership guard, not acoustic echo cancellation. It cannot
  recover user words omitted by recognition, distinguish identical simultaneous
  speech, or prove physical-device robustness. A true reference-audio/AEC path remains
  future work if hardware acceptance shows that text evidence is insufficient.

## D-020 — Living Surface quality and fallback diagnostics

- **Accepted:** 2026-09-24. Keep the two core field scales and pigment grammar on
  every WebGL quality tier; compile out only optional fine luminance/glint detail.
  AUTO retains its existing five-second-window hysteresis, using paced intervals
  for overload and CPU render-submission time for promotion headroom. Neither
  signal identifies local-model workload or measures GPU time.
- Expose the active backend and fallback reason as non-visual ambient-host data
  attributes, with shader-build errors in the console. This provides a dependable
  debugging/preview check without adding a permanent Controls element. Canvas
  remains a safe amber fallback, not visual acceptance of the WebGL surface.

## D-021 — One startup narrator and one diagnostics history

- **Accepted:** 2026-09-25. User-facing startup status comes from the existing UI
  state in one card or notice; connection and readiness facts reflect actual reports.
  Raw protocol and core reasons remain accessible in expandable details and the
  developer diagnostics surface. An unexpected React render exception shows a
  reload path instead of silently unmounting the window.
- Controls use separate Conversation, Appearance, Device, System and Diagnostics
  categories. The Diagnostics route is visible on touch devices and supersedes
  D-020's shortcut-only discoverability choice; the overlay remains optional and
  closes when Controls opens to avoid mobile obstruction.
- Reuse the engine's bounded event history for renderer and existing UI/core state.
  This adds no new core authority, protocol event, microphone processing or audio
  feature extraction. Verbose browser output logs event changes rather than frames.

## D-022 — Separate material transport from Orb orientation and palette balance

- **Accepted:** 2026-09-25. Keep the shared two-scale object-space field and its
  body/peel sampling, but add companion-axis asymmetry to both spherical shears.
  The prior dominant uniform rotations moved the field almost rigidly; its small,
  slowly varying shear started near zero with the default seed. Bounded seeded
  shear now changes broad spatial relationships immediately. This gives up the
  prior exact axisymmetric inverse while preserving continuous, seam-safe sampling.
- The engine-owned motion evaluator integrates a material-specific flow rate from
  elapsed time. Pointer hold eases that rate toward 12%, then release eases it back
  without resetting or banking phase. Whole-Orb rotation, relief breathing,
  palette balance, lighting and particles keep their own clocks. Palette balance
  slowly changes how the existing broad and medium fields combine; no global hue
  cycle or public Surface Flow setting is introduced.
- No extra noise octave, draw pass, geometry budget or dependency is added. Two
  inexpensive companion-axis dot products per field transport and one palette
  uniform are the main shader cost. Representative GPU timing and human perception
  remain acceptance questions.

## D-023 — Lift shared-field membrane fragments and separate key from fill

- **Accepted:** 2026-09-26. Replace the WebGL loxodromic strips with seeded,
  irregular curved membrane patches. Each patch follows the body's displaced
  radius and unrotated field direction, with stronger central lift and a soft,
  near-attached edge. Keep the existing peel count per tier and one batched draw.
  The Canvas fallback retains its simpler strips.
- Make fragments near opaque and depth writing, with a small blended edge rather
  than accumulating transparent ribbons. Shape-derived fragment normals provide
  restrained glints. Soft overlapping edges may still depend on draw order; do
  not add CPU sorting or general transparency machinery without measured need.
- Move the primary world-space light across the limb and reduce extra tier lights
  to fill. Keep its clock separate from orientation, flow and palette. Add a
  second slow palette contrast clock that changes local warm boundaries using
  existing field values, without noise or global hue cycling.
- The membrane uses about 1.5 times the old vertex count and 2.6 times its
  triangles, with potentially greater fragment coverage. Draw count, mandatory
  noise samples and quality caps stay fixed. Isolated WebGL measurements establish
  spatial light/palette response and shared tint; GPU timing, plate-like appearance
  and human visual acceptance remain open.

## D-024 — Center particles in Sam's environment and bound visual reactivity

- **Accepted:** 2026-09-26. Keep the 12/24/40 particle budgets and one batched
  point draw, but replace the old 1.1–1.4 radius band with a deterministic,
  near-biased 1.2–2.45 distribution and a sparse far tail. Individual points
  have seeded orbital planes, integer-harmonic signed rates, independent slow
  radial wander, and restrained warm size/opacity/shape variation. The particle
  field no longer follows the user-controlled Orb quaternion.
- Remove the additional camera-Z visibility fade. Body and membrane depth writes
  already occlude points at overlapping pixels; rear points beyond the silhouette
  should remain part of the environment. Points do not write depth and remain
  premultiplied blended. Canvas continues to omit particles under its v1 fallback
  budget. Far points can naturally leave a narrow viewport.
- Add a renderer-only AmbientReactivity frame fed by existing, correlated visual
  input envelopes and input peak. The adapter owns source freshness/expiry; this
  layer owns visual sustained/onset attack and release. Its zero state is neutral,
  and bounded particle spread (+0.14 Orb units), rate (+30%) and opacity (+26%)
  add to autonomous animation. Existing relief, membrane and glow consumers use
  the same smoothed sustained/onset values. No model, VAD, STT, TTS or semantic
  authority is added.
- The point buffer grows from four to eight floats per particle (at most 1.25 KiB
  for 40 points). Draw count and noise samples stay fixed; tiny point fragments
  gain simple shape/color math. Wider on-screen coverage may increase fill cost.
  Representative GPU performance and human perception remain open.

## D-025 — Correlate provider discovery with commands and connections

- **Accepted:** 2026-09-26. The core includes the initiating command id in
  `provider.discovery` events. Frontend discovery has one explicit operation
  state: unavailable, scanning, available, empty, failed or stale. The latest
  command id is retained through completion so a late older event cannot undo a
  newer scan. Transport epochs reject events from earlier connections; a fresh
  `system.ready` snapshot resets the discovery state after reconnect and reports
  any still-running core scan with its command id.
- A definitive empty/blocked result replaces the catalog, clears current
  provider/model selection and prevents another response from using an invalid
  model. A failed scan clears runtime model availability but may retain the last
  catalog as stale inventory for diagnosis. Disconnect keeps last-known data
  labeled stale, with commands disabled. Persisted last-good preference is stored
  separately by the core and is not represented as an active selection.
- Core discovery cancels and awaits a previous scan before starting the next.
  Frontend terminal discovery clears the associated pending command even if its
  acknowledgement arrives later. An unacknowledged command expires after 30
  seconds; protocol rejection and malformed discovery are recoverable states.
  Existing autonomous visuals have no dependency on discovery readiness.
- The historical black-screen symptom was not reproduced with controlled
  transport states. Verified defects were retained catalogs on empty results,
  stale active model presentation, startup-only failure blocking later success,
  and command pending state waiting unnecessarily for an acknowledgement after
  discovery had finished. Real provider timing still needs integrated validation.

## D-026 — Keep core turn authority and correlate the frontend projection

- **Accepted:** 2026-09-27. Keep `TurnManager` as the authoritative voice state
  machine. Text acceptance and committed voice transcripts converge before
  model generation; the frontend reducer projects the same lifecycle using
  current, tentative candidate, and bounded retired turn/generation identities.
  A candidate cannot replace the active identity until confirmed. Completed or
  cancelled capture returns to IDLE; `transcript.final` from voice remains
  provisional until `turn.committed`, while typed input is tagged `source=text`.
- Input cancellation publishes one STT cancellation and IDLE transition without
  touching a committed response. Terminal turns retire their identities, and
  reconnect reattaches only IDs named by the core's `system.ready` snapshot.
  Core text acceptance/early terminal events echo the initiating command ID so
  the pending UI command can finish before a late acknowledgement. Command and
  connection IDs remain separate from turn/generation/cancellation IDs.
- Keep stage failures recoverable. `component.health` for capture changes speech
  input status without changing a live generation; model/runtime failure
  terminalizes the affected turn. A post-model synthesis/playback failure emits
  `tts.failed` as a separate delivery terminal and retains committed answer
  text. Do not bind protocol lifecycle directly to
  shader controls. Existing capture endpoint, provider stream and 30-second
  command ACK bounds retain their owners; no arbitrary STT/TTS deadline is added.

## D-027 — Pin committed inference routes and reserve trusted voice control

- **Accepted:** 2026-09-27. Snapshot provider instance, router, selected model
  and availability when a text or voice generation commits. Use explicit routing
  for every model/tool round. A scan finishing after a turn starts rejects its
  new route without clearing the running route. Future selections affect future
  turns; unavailable selections never silently fall back.
- Future route identity includes a trusted named connection profile as well as
  provider and model. The current single-endpoint settings are insufficient for
  multiple servers or APIs; do not encode credentials in route IDs, diagnostics
  or spoken text. A future voice-control intent layer intercepts final STT before
  ordinary turn commitment and uses typed local controls. D-029 establishes the
  active-turn block policy; spoken acknowledgement remains deferred.

## D-028 — Keep audio PCM pull-based and visual activity source-specific

- **Accepted:** 2026-09-27. Keep capture-to-STT and metered synthesis-to-playback
  as awaited pull paths. Preserve the 10-frame pre-roll, bounded STT utterance,
  bounded whole-WAV system TTS and eight-chunk text queue rather than adding a
  second PCM queue. Input overflow fails a discontinuous utterance; output
  underflow is counted and playback continues. Close nested synthesis iterators
  when playback stops before consuming all PCM.
- `voice.level` and `tts.level` remain distinct measured producer signals.
  The frontend visual adapter retires stale source samples and owns freshness;
  `AmbientReactivity` alone owns visual smoothing and modulation. No physical
  device, acoustic timing or audio-driven art-direction claim follows from
  these deterministic checks.

## D-029 — Share typed local controls across UI and future voice input

- **Accepted:** 2026-09-27. Represent exact inference switching and Stop speaking
  as typed, non-conversational intents with explicit outcomes. Reuse the existing
  owner control dispatcher and playback cancellation rather than making a voice
  specific routing path. UI selection acknowledges initiation immediately;
  terminal discovery and bounded local-control events report its outcome.
- Block a route switch while generation/delivery is active. A failed explicit
  selection preserves a valid current route; exact provider/model mismatch is
  unavailable, never an implicit fallback. Adopt provider/router/model together
  for future turns, while each committed turn retains its own snapshot.
- Intercept ordinary final STT through an optional trusted typed recognizer
  before turn commitment. A consumed control retires the provisional input and
  cannot become model prompt text. Natural-language classification, active
  barge-in control handling, spoken acknowledgement and named connection
  profiles remain separate work. Future profile IDs may extend route identity;
  credentials never enter intents, route IDs or diagnostic events.

## D-030 — Keep playback-time speech provisional until its owner is checked

- **Accepted:** 2026-09-28. Completing TTS does not by itself promote an open
  interruption candidate to user speech. The capture monitor retains its
  playback generation for late transcript screening and retires an unresolved
  candidate when its own capture lifetime ends or a newer turn takes ownership.
  Rejection after playback returns to IDLE; an accepted final continues through
  the existing turn commitment path.
- **Reason:** The published 0.2.3 physical beta exposed Sam-output text in YOU
  history. A deterministic reproduction showed that TTS completion could
  promote an unverified candidate, after which mutable active-generation
  cleanup could remove its echo reference. The safety repair fixes that handoff
  without altering already committed assistant text.
- **Limit:** Text screening is only a fallback. No VAD-only early barge-in is
  enabled until an audio-reference/AEC boundary can distinguish human speech
  from speaker bleed. This decision does not claim physical acoustic acceptance.

## D-031 — Retire superseded conversation ownership before waiting for adapters

- **Accepted:** 2026-09-29. A new text or committed voice generation cancels its
  predecessor's token and running task, then terminalizes its model and speech
  ownership before starting the successor. It does not wait without a bound
  for a provider stream or playback adapter to return. Late work retains its
  old identity and cannot publish current model output or clear the successor.
  A committed voice handoff checks a monotonic generation epoch after its
  retirement await, so intervening typed input keeps authority.
- **Reason:** A deterministic A → B → typed C sequence proved that the former
  `response_done` handoff could keep C from reaching the provider while A's
  cancelled stream stayed open. A pending frontend command also remained when
  its old terminal was correctly ignored as stale conversation state. Command
  correlation now retires it independently, and unrelated pending Controls do
  not disable typed recovery.
- **Limit:** Core-owned state and queues retire promptly; a non-cooperative
  external adapter may still occupy its own task until it returns. The existing
  HTTP transport requests cancellation and closes its stream on unwind. This
  source-backed repair does not prove the exact cause of the physical beta's
  late no-response episode or change acoustic barge-in policy.

## D-032 — Make conditional exit cleanup explicit and single-pass

- **Accepted:** 2026-09-29. Keep the established ownership boundary: choosing
  unload/stop on Quit does not authorize Sam to unload a pre-existing model or
  stop a reused provider. Show current applicability in Controls and Quit,
  display only core-confirmed settings, and log explicit skipped, unsupported,
  failed and successful outcomes.
- Merge discoveries made during one Sam run before exit cleanup. Retire runtime
  streams first; unload Sam-loaded models once, then stop Sam-started services
  once. A failed external operation does not prevent later cleanup or Sam exit.
  `lms server stop` stops LM Studio serving, not the desktop application.
  Non-cooperative response tasks receive a two-second retirement grace, and
  the entire external cleanup receives an 18-second bound within the 24-second
  supervised core-stop window. Late generation guards still reject output from
  a detached task.

## D-033 — Keep authenticated provider errors and cloud routes outside credential logs

- **Accepted:** 2026-09-30. An authenticated provider HTTP failure reports its
  status with a fixed detail instead of carrying the remote error body into
  diagnostics or exception logs. OpenAI-compatible cloud routes require HTTPS;
  URL-embedded credentials, query and fragment are rejected. An explicitly
  local-compatible route may still use loopback HTTP.
- **Reason:** A provider can reflect its Authorization value in an error body,
  and a plaintext cloud endpoint can expose a configured API key or conversation
  context. Both paths were allowed by the previous generic adapter boundary.
- **Limit:** This is credential transport hardening, not authentication of a
  loopback provider process. The UI protocol exposure was subsequently repaired
  by Agency Foundation I's owner proof; host memory/code tampering remains outside
  that boundary. See [trust boundaries](TRUST_BOUNDARIES.md).

## D-034 — Keep a failed acoustic processor probe outside runtime

- **Accepted:** 2026-09-30. Evaluate `pywebrtc-audio` 0.2.0 only in an optional
  `aec-prototype` development group. The narrow 16 kHz/10 ms adapter and synthetic
  measurements remain separate from Sam's delivery/candidate owners.
- **Evidence:** [Windows probe](AEC_PROTOTYPE_2026-09-30.md) failed predeclared
  echo and first-second double-talk gates after measuring/correcting 8 ms fixed
  processor latency. The small Windows wheel is feasible; this vendored AEC3
  extraction's separation is not yet sufficient for the intended integration.
- **Consequence:** retain conservative transcript-gated interruption. Do not
  lower thresholds, promote candidates from VAD alone or integrate this result.
  Establish pinned upstream APM adapter feasibility next; fallback alternatives
  remain as recorded in the contract. Physical acoustic acceptance is unproven.

## D-035 — Keep installed speech persona stable across languages

- **Accepted:** 2026-10-01. Default System.Speech selection uses the installed
  gender with widest distinct-language coverage, then locale and deterministic
  voice identity. An explicit `tts_voice` wins in its supported language and
  anchors the preferred gender elsewhere. Language remains primary: if that
  persona is unavailable, use an installed language voice and report the mismatch.
- This machine has Helena (es-ES), David/Zira (en-US) and Hazel (en-GB). Automatic
  selection therefore uses female voices for English/Spanish instead of the
  former alphabetical David/Helena split. No voice is downloaded or invented.
  Gender metadata is a limited persona proxy, not proof of matched timbre/cadence.
- Actual first PCM publishes selected voice/locale/reason in a correlated,
  low-frequency synthesis-health event. Meter events are coalescible and cannot
  reliably carry the only copy of persistent selection state. Retired-generation
  health events cannot replace the current delivery's selection.
