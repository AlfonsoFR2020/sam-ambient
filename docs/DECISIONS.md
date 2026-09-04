# Decision log

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
