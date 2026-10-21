# Responsive Presence IV-C

**IV-D amendment (2026-10-21):** HQ4 confirms the beta used `Start Sam.cmd`, serving
unchanged v0.2.5 assets at that time. The attribution uncertainty below is historical;
the owner's swirl/old-peel observations do not accept IV-B/IV-C. [IV-D evidence](INTEGRATION_VALIDATION_IVD.md)
records canonical compiled-asset integration, 290 frontend / 223 scoped Python
passes and paired twelve-second PCM/reducer/motion contracts. Reduced Motion
suppresses spatial pulses while preserving meters/labels. All browser, shader,
GPU, real provider/audio and owner acceptance questions remain open. Original
IV-C source manifests and source-only evidence remain unchanged below.

2026-10-21. **IV-C source-complete checkpoint.** Focused non-graphical evidence
only; graphical, live provider/audio and release acceptance remain open.

## Provenance and permission

- Starting `dev`: `99751258bbea30c03c7bb0f82021140364906cec`, clean,
  five commits ahead of cached `origin/dev`; no fetch or remote mutation.
- Released v0.2.5: `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
- `Start Sam.cmd` runs the existing editable `.venv` launcher. The installed
  `_editable_impl_sam_ambient.pth` points to this checkout's `src` directory.
  `OwnerWindow` privately fulfills `src/sam_ambient/static` assets. Neither the
  launcher nor that window builds frontend source.
- At assignment start the checked-in static tree was identical to v0.2.5. Its last change was
  `9c5bce8c63cb90bd008571e4c4b3a03f9663b1af`; `index.html` selects
  `index-DPoRgsL3.js` and `index-D5fV1sLu.css`. A normal source launcher run
  therefore displays the released renderer, not IV-B.
- `scripts/ui-dev.ps1` / `.sh` use Vite source. Tauri development uses Vite;
  Tauri packaging explicitly builds the static frontend. Either a development
  launch or an intervening frontend rebuild could display IV-B. The owner's
  actual beta launch path is unknown. Their observations cannot yet be
  attributed to IV-B.
- IV-C explicitly permits short, sequential focused tests and static lint at
  low scheduling priority. No Sam/application launch, provider/model, browser,
  GPU, audio hardware, full build/suite, packaging or network operations.

## Owner observations (not established root causes)

Preserve the attractive evolving colourful swirls. Peels appeared questionable,
with inward curls; the desired concept is radial shells cropped by radial
sectors. Particles appeared dirty; reflections/lighting were promising.
Preparation, typed requests, unloading and quitting lacked sustained expressive
feedback. Startup was intrusive; Memory/Console presentation and Console wiring
needed review. Startup speech appeared unresponsive and typed responses could be
slow. Speech-driven motion/light stopped briefly into continuing spoken output.
Quit guidance was weak, Voice Off ambiguous, and Chromium offered translation.

This assignment does not rewrite membrane topology, redesign particles, change
palette/Flow, modernize STT/AEC or tune provider timeouts.

## Initial source validation

Executed with bundled Node, Vitest's Node environment, one worker, no file
parallelism, BelowNormal process priority. No graphical/audio fixtures:

- Four IV-B topology/deformation/contact/quality files: **20 tests passed**.
- Continuity, living-field/mock-resource and visual-input files: **24 passed**.
- The first Node shim invocation failed before test execution because no active
  nvm version was configured. The existing bundled runtime needed no install.

These checks do not compile GLSL or establish rendered quality, hardware cost or
owner acceptance. IV-B's historical source manifest remains unchanged.

## Playback boundary implementation

Output accepts at-most-20-ms PCM writes before an optional trusted observer
publishes correlated RMS/peak. The runtime no longer meters synthesis ahead of
that boundary; it marks delivery playing on the first accepted write. Output
drain remains distinct from model completion and final delivery completion.
Cancellation, active-generation and active-playback gates reject retained late
callbacks. Observer failures disable optional metering without failing speech.

The UI now tracks playback identity separately from conversational state. Source
inspection identified a concrete presentation gap: `RECOVERING` after
`INTERRUPTION_CANDIDATE` failed the old `prior === SPEAKING` predicate even with
ongoing delivery. Fresh real levels remain eligible through tentative input
recovery; cancellation, completion, failure, offline and successor turns retire
them. This establishes a software defect, not attribution of the owner's run.

Executed sequentially, BelowNormal, with no real services/devices:

- Three new adapter regressions failed before implementation; all **14** adapter
  tests pass afterward (mock streams only).
- **2** new fake-runtime tests pass: delayed acceptance, 180 pre-buffered PCM
  blocks including silence/quieter syllables, drain, late callback and Stop.
- **40** existing generation/voice-stream lifecycle regressions pass.
- **54** frontend reducer/input/reactivity tests pass, including zero reactivity
  and the new six-second delivery/recovery/quiet-syllable case.
- Targeted Ruff and Biome checks/formatting pass for these changed source/tests.

No physical speaker alignment is claimed: blocking PortAudio acceptance can lead
actual playback by device latency. Hardware timing, acoustic behavior and the
specific owner incident remain deferred. No arbitrary sustained visual envelope,
new PCM queue, raw-audio UI transport or provider timeout change was introduced.

## Lifecycle, controls and deferred evidence

`presence.ts` projects service/provider/turn/delivery facts into stable operation
identities, labels and a small renderer-only phase. Typed send is distinct from
core commitment, waiting for inference, actual token production and preparation
of speech. Pending request/shutdown IDs carry no new authority. Elapsed labels
measure observed waiting, without percentages or readiness estimates.

The Orb forms from a compact pose at initialization, concentrates during loading,
settles for unload/unloaded, and contracts during accepted departure. Existing
pigment, provider illumination and continuously moving folds remain; no palette,
speech gain, particle distribution, geometry, draw count or framebuffer changes.
Startup/retirement draw only at the existing static 15-Hz cap for bounded windows
(1.6/0.9 seconds), stop while hidden, and do not delay any command/window close.
Reduced Motion uses settled poses and the existing short state transition.

Startup is a small summary with collapsed operational facts during ordinary
preparation. Known model choices and failure details remain available. Memory and
Console share a footer group and mutually exclusive panels, close/focus behavior
and consistent controls. Their real capability requests, result projections,
cancellation and privacy gates remain intact. Quit and Ctrl Q are always visible;
spoken-reply muting explicitly controls output separately from the microphone.
Shutdown text acknowledges a request and possible ongoing cleanup; it does not
claim the process has already exited. Rejected/timed-out Quit returns to controls.

Translation: HTML has explicit `notranslate` metadata/classes; only Sam's isolated
profile gets `translate.enabled=false`, staged atomically while preserving other
valid preferences. Malformed/oversized preferences are preserved. Normal browser
profiles and Playwright sandbox/proof restrictions are untouched. Installed
Playwright already disables Chromium's standard Translate feature. Edge-specific
behavior, the actual beta window path and popup suppression require graphical
confirmation; no definitive root cause is assigned. The shipped HTML receives the
same opt-out, but its JS/CSS assets remain the released renderer. No rebuild ran.
New source additionally exposes content-free DOM build/visual identity markers.

Executed: **84** focused frontend tests across ten files, including mocked renderer
retirement/hidden suspension and static markup for startup/Console/Memory;
**19** profile, owner-authority and fake Console integration checks. Relevant
Biome/Ruff checks pass. No browser, shader, real provider or audio device ran.
Graphical usability, artistic transitions, physical output timing and cleanup
with actual model processes remain pending.

## Diagnostic intervals and source hardening

The bounded trace now distinguishes command queuing/admission, dispatch-to-turn
commitment, inference first token/full stream, synthesis/first PCM, output wait,
first accepted write and delivery drain. The HTTP boundary records request,
headers, first nonempty line and close with counts/elapsed durations; the first
line can be metadata and is not called a token. Supervisor component readiness,
authenticated UI snapshot and owner document load are separate stages. HTML
fingerprint and content-free DOM source markers improve future provenance.

Every new field uses the existing positive diagnostic allowlist and pseudonymous
IDs. Existing 128 pending / 256 history caps and log rotation/rate bounds remain.
No PCM, transcript, prompt, URL, provider body, token text or credentials are logged.
No new command, endpoint, model readiness claim, timeout or provider restart.
The browser document-load record does not establish first paint/interactivity.

Final review removed an unnecessary transcript scan on each meter update,
reused the already-computed interaction projection, bounded retired delivery IDs
to 32, and rejects unknown-generation TTS even after an ID ages out of that cache.
Profile staging is atomic and temporary-file ownership is local to one call;
optional provenance logging cannot abort owner-window launch. Compact skin CPU
samples remain finite. These are source properties, not rendered optical proof.

The no-emit TypeScript check found three errors in newly authored test code
(Node-only fixture typings and a narrowed mock input); these were fixed and the
bounded recheck passed. Targeted lint also removed an unused IV-B test export.
No production membrane topology or shader/material field was changed.

## Executed and deferred checks

All executed tools used one sequential BelowNormal process, with a 10–25-second
stop bound, no file parallelism and one Vitest worker. Groups below overlap;
their counts are not a unique-test total.

| Focused group | Result |
| --- | --- |
| IV-B topology, membrane, contact, quality (final, including compact poses) | 21 passed / four files |
| Continuity, living-field/mock-resource, input (initial refresh) | 24 passed / three files |
| Generation terminality / voice stream lifecycle | 40 passed |
| Playback adapter, fake-runtime delivery, trace, mock HTTP and profile (final) | 30 passed / five files |
| Owner authority / fake Console integration / profile | 19 passed |
| Timing plus paced fake conversation | 14 passed |
| Frontend lifecycle / client / input / status / engine / Console / Memory | 84 passed / ten files before final stale-event additions |
| Final reducer / client / input / presence / deterministic fixture data / demo / provider | 78 passed / seven files |
| Frontend TypeScript, no emit/no incremental build | Passed; about 2.8 seconds |
| Changed-file Biome, Ruff, format and Git whitespace checks | Passed |

Deferred: full suites/builds/native packaging, every browser/GLSL/WebGL run,
graphical screenshots/layout interaction, GPU timing, Sam/provider/model startup,
microphone/TTS subprocesses/speaker devices and physical timing. Fake PCM and
in-memory HTTP/provider tests do not establish any of these. Initial setup issues
(Node shim without nvm selection; sandbox temp path/argument quoting) were handled
with the existing bundled Node and workspace-scoped pytest data, without installs.

## Source inventory, resources and remaining limitations

Production modules changed:

- Playback: `core/voice/interfaces.py`, `adapters/audio/sounddevice.py`, `runtime.py`.
- Diagnostics: `conversation_diagnostics.py`, `diagnostic_log.py`, `adapters/http.py`,
  `adapters/ui/websocket.py`, `supervisor/manager.py` (under `src/sam_ambient`).
- Private browser preparation: `supervisor/app_window.py`, `supervisor/owner_window.py`.
- Frontend projection/engine: `ui/src/presence.ts` (new), `protocol/types.ts`,
  `state/client.ts`, `state/reducer.ts`, `visual-engine/input.ts`, `types.ts`,
  `motion.ts`, `engine.ts` (last four under `ui/src/visual-engine`).
- Frontend surfaces: `ui/src/App.tsx`, `ProviderStatus.tsx`, `QuitDialog.tsx`,
  `status.ts`, `main.tsx`, `styles.css`, `agency/Console.tsx`, `memory/Manager.tsx`.
- HTML opt-out: `ui/index.html`, `src/sam_ambient/static/index.html`.

[Source manifest](evidence/responsive-presence-IVC/source-manifest.json) provides
exact paths and LF-normalized hashes. New focused tests are
`tests/unit/test_playback_visual_lifetime.py`, `test_app_translation.py`,
`ui/tests/presence.test.ts` and `presence-fixture.test.ts`; existing adapter,
generation/stream, trace/HTTP and frontend contracts were adapted/hardened.

Authored but **unexecuted graphical** inputs are
`ui/tests/fixtures/responsive-presence.ts` (18 lifecycle samples plus nine tier/
accessibility combinations, seed `0x5a17`, 720 px/DPR 1/yaw 0.75), and
`ui/tests/browser/responsive-presence.spec.ts`. The dedicated IV browser config
includes them. Existing IV-B release/candidate fixtures still cover yaw 0/0.75/1.6,
curl 0/6/12 and palette 0/15/45/120/300 with pinned source/framing/illumination.
No new before/after PNG exists. Existing historical visual evidence is preserved.

Geometry/pass/quality allocation is unchanged: 9/9/10 draws; 12/24/64 particles;
body+skin 1,136/5,004/17,600 vertices; geometry plus particles
32,988/150,252/519,500 bytes, plus the unchanged 44-byte halo and bounded uniforms.
There is no meaningful geometry/uniform budget expansion. Additional CPU state
is scalar lifecycle/diagnostic data and at most 32 retired delivery IDs. PCM is
observed in roughly 20-ms blocks with no new frame queue, retaining actual silence.
Bounded startup/departure draws and observer overhead have **no measured hardware
acceptability claim**. GPU cost, CPU submission, presentation cadence and full-app
inference coexistence have not been measured or extrapolated.

Unresolved: which launcher displayed the beta; whether IV-B's inward curl/radial
character is artistically convincing; particle cleanliness/reflection quality;
compact-pose optics/contact at small radius; actual narrow-layout/focus behavior;
browser translation suppression; physical output-buffer lead; the cause of initial
speech unresponsiveness and typed stalls. PCM submission is not a DAC timestamp.
Current System TTS still buffers a bounded WAV before yielding PCM; latency from
that design is measurable but was not changed in this assignment. The missing
concept board remains missing and was not searched for in personal folders.

## Closure and next authorized verification

Recoverable commits: `953828e` provenance, `b95081e` playback, `06a1e0b`
lifecycle/controls, followed by the IV-C hardening/evidence closure commit.
Start was clean `dev` at `99751258`; final closure is on the same branch, locally
committed and clean. No fetch/push/merge/tag/version/dependency/installer change.
The published baseline remains `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.

Recommended next assignment is a bounded **graphical verification and optical
triage** pass, after explicit machine permission:

1. Check exact HEAD/assets/source marker, then authorized frontend build/static
   checks and the pinned baseline preparation. Do not accidentally inspect old JS.
2. Compile shaders; run CPU/GPU position/normal proof, IV-B matched full-colour /
   body / skin / attachment / normals / depth views across curl/yaw/palette samples.
   Record inward-curl, overlap, compact-pose or dirty-particle failures explicitly.
3. Run authored presence/UI cases at desktop/narrow dimensions, all quality tiers,
   Reduced Motion, zero reactivity, hidden/resumed and Canvas/static recovery.
   Confirm real Console wiring, profile translation opt-out and immediate Quit.
4. Only if graphically credible, compare isolated baseline/candidate GPU cost and
   CPU submission/cadence under corresponding conditions. Keep full-app inference
   coexistence separate; it requires its own authorized measurement.
5. Under separately explicit provider/audio permission, correlate cold start,
   typed dispatch, headers/first useful token, WAV/PCM preparation and physical
   playback through long speech, pauses, interruption and recovery. Do not treat
   a graph-only pass as STT/provider or acoustic acceptance.

This is technically prepared for that bounded validation and a possible v0.2.6
experimental source milestone. It is not a validated release candidate, rendered
visual success, performance acceptance or production-ready build. Stop after IV-C;
no subsequent programme or human beta is initiated.
