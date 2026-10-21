# Visual Core IV-D — integration and deterministic validation

2026-10-21. **Integrated experimental frontend; graphical acceptance remains open.**
This record separates build/source evidence from rendered, physical and owner evidence.

## Provenance and execution boundary

Started on clean `dev` at `65092bbe6a531eb7732f981354de62922014acdc`, nine commits
ahead of cached `origin/dev`. No fetch or remote mutation. Published v0.2.5 remains
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`; versions/dependencies are unchanged.

HQ4 confirms the October 21 beta used **Start Sam.cmd**. Before this assignment,
the static JS/CSS matched the release after normalizing checkout line endings.
HTML alone had IV-C translation metadata. Consequently both the attractive swirls
and criticism of old peels concern v0.2.5; the owner has not accepted IV-B/IV-C.
[Before-build inventory](evidence/integration-IVD/asset-provenance-before.json)
preserves hashes and launcher attribution. Prior IV/IV-C manifests remain historical.

Permission allows sequential focused tests, CPU/reference checks and the canonical
frontend build, with one additional build for repairs. No
`HEADLESS_WEBGL_ALLOWED: YES` was supplied. No browser, WebGL/shader execution,
graphical capture, GPU measurement, Sam process, provider/model, real synthesis or
microphone/speaker device was launched. Test runtimes use fake services/PCM; bounded
loopback test sockets are not a live Sam session. No new human beta was requested.

## Source to ordinary source-launch assets

`Start Sam.cmd` invokes `.venv/Scripts/sam-ambient.exe`; its editable installation
points to this checkout's `src`. It performs no frontend build. `OwnerWindow`
selects `src/sam_ambient/static`, fulfilling only canonical trusted-origin GETs
for index/assets. Proof bootstrap, owner capability boundary, sandbox and private
resource resolution are unchanged. Vite developer paths consume source separately.

Canonical command from `ui`: `pnpm run build` (`tsc -b && vite build`). With the
installed pnpm 11 runner, the occupied-PC invocation supplies
`--config.verify-deps-before-run=false`, disabling automatic dependency installation.
The initial attempt stopped in pnpm's automatic synchronization, before compilation,
on a sandbox store-link permission error. No dependencies/toolchains were installed.
Existing bundled Node plus installed project tools were used; no network was needed.

The first actual production build succeeded: 83 modules, Vite 7.3.6, about 4.72 s
wrapper time / 810 ms Vite time, no compiler/chunk warnings. Subsequent whitespace
review found mixed CRLF template / LF inserted HTML. Vite now normalizes HTML
before inserting metadata; the file checker rejects mixed endings. The authorized
repair build and final artifact hashes are recorded in the closing evidence below.
[First build](evidence/integration-IVD/first-build-integrity.json) is retained as an
intermediate provenance record; it is not the final candidate.

`ui/build-provenance.mjs` fingerprints all frontend source files and ten explicit
build inputs, normalizing text CRLF and hashing binary inputs as bytes. The build
embeds the digest in HTML and DOM markers and emits `assets/sam-build.json` plus
Vite's `.vite/manifest.json`. Git commit/dirty state is supplemental; archives
without Git retain a content identity. No timestamps, machine paths, private data
or authority enter these markers. The source commit identifies the compilation
inputs; later documentation/artifact commits can have a different HEAD.

`scripts/check_frontend_assets.py` verifies the exact source inventory/hashes,
combined digest, HTML marker, Vite entry JS/CSS, canonical asset paths and integrated
skin/playback/Quit markers. It records raw artifact SHA-256 separately. A fresh
checkout may change raw CRLF hashes; the normalized source identity remains stable.
This establishes source/build coherence, not shader compilation or bit-identical
cross-machine builds.

## Evidence-led repairs and preservation

Mocked failure injection reproduced three partial-initialization leaks: after a
second-program compile failure, missing required uniform, or partial buffer
allocation, earlier resources depended on optional context-loss cleanup. Repeated
disposal also attempted deletion twice. A setup-only ownership ledger now tracks
successful programs and every allocated VAO/buffer, retires them on constructor
failure, and empties on disposal. Four new failure/idempotency cases failed before
the repair and pass afterward; ordinary cleanup still has four programs, four
VAOs and seven buffers. No per-frame tracking, shader effect or new pipeline.

The provisional representation remains one welded parent skin with three unequal
openings and C1 lifting/curling collars. No new topology, palette, particle, optical
tuning, provider timeout, routing, STT/AEC or authority change. The released
`living-field.ts`, `living-material.ts`, `palette.ts`, `particles.ts` and `tuning.ts`
remain unchanged. Existing High contact/depth and Low/Medium identities persist.
No aesthetic defect was established through rendering, so no speculative visual
repair is described as a success.

Additional CPU tests sample triangle/surface-normal orientation at radii
0.46/0.83/1.18, ordinary/listening/thinking/strong-speaking poses and all tiers.
Float32 descriptor packing remains within position/normal proof tolerances.
Shared GLSL source/interface checks pass. The controlled displaced spheroid used
by these tests is not execution of the production body shader.

## Delivery integrity and diagnostic limits

The shared `tests/fixtures/playback_visual_contract.json` describes 600 signed-16
PCM blocks / twelve seconds of virtual delivery: ordinary samples, measured
silence, quieter samples and renewed emphasis, plus delayed acceptance and a
stalled-write interval. Python verifies exact accepted-PCM envelopes, sequence,
duration, generation identity, active delivery through drain and late-callback
rejection. TypeScript applies those same verified values through the real reducer,
presence projection, freshness adapter and MotionEvaluator. It checks expiry and
settling during missing writes, resumed quiet speech, cancellation, zero reactivity
and Reduced Motion. There is no wall-clock twelve-second playback or audio device.

Reduced Motion intentionally suppresses spatial speech pulses and freezes seeded
geometry clocks while retaining measured values and truthful status. Initial new
test assumptions about pulses/zero initial phase were corrected to this existing
contract; production accessibility behavior was not changed. Zero Audio Reactivity
remains exactly neutral. Accepted writes are not acoustic output timestamps.

Source and fake-service checks distinguish UI document load/authenticated snapshot,
confirmed provider readiness, command queue/admission, turn commitment, request,
HTTP headers, first nonempty SSE line, first useful text, generation completion,
synthesis/first PCM, output wait, first accepted write and drain/delivery completion.
OpenAI-compatible metadata/role-only/keepalive cases do not count as useful text or
extend the first-content deadline. No timeout or speculative restart was changed.

Remaining attribution gaps: document load is not first interactive paint; provider
internal admission/queuing is not observable from HTTP headers alone; current
System TTS buffers a bounded WAV before PCM; PortAudio submission may lead physical
output. No deterministic new latency defect was established or assigned as the
cause of the owner's startup/typed stalls. A later separately authorized diagnostic
session needs matching content-free command/turn/generation/instance correlations,
readiness and HTTP stages, synthesis/PCM/write/drain intervals, plus device timing
for physical alignment. No raw audio, prompt, token text or credentials are needed.

## Executed regression evidence

All commands were sequential BelowNormal processes, one Vitest worker with no
file parallelism. Individual commands were bounded; no watcher/daemon/tool install.

| Gate | Actual result |
| --- | --- |
| Complete frontend Node unit set | 290 passed / 39 files, 13.57 s; 3.53 s inside tests |
| Integrated scoped Python set | 223 passed / 22 files, 16.62 s |
| Artifact-checker repair batch | 6 passed; overlaps the integrated set except its new mixed-newline case |
| TypeScript project checks before build | Passed, about 2.7–3.0 s |
| Changed-file Biome / Ruff / format | Passed |
| Canonical production build | First succeeded; authorized HTML-repair rebuild recorded at closure |
| Local baseline preparation | 21 pinned release modules, current identical harness, no rendering |

The 223-test Python scope covers playback, long PCM, trace/HTTP/profile/assets,
voice recovery, bootstrap/cold inventory/unload, owner routing/Console, diagnostic
launch, compatible/Ollama fake transports, protocol, generation/voice-stream
terminality, paced fake conversation, input pipeline and authenticated WebSocket.
Earlier exploratory/focused batches overlap these final gates; counts are not added.
The UI set covers topology/indices/winding, compact folds/normals, contact, shared
material/palette/clocks, quality/governor, stale lifecycle and input, fallback,
controls/Memory/Console, shutdown labels, pending typed work and recovery.

## Static resource accounting and deferred graphical proof

| Tier | Draws / particles | Body + skin vertices / triangles | Geometry bytes including particles, excluding halo |
| --- | --- | ---: | ---: |
| Low | 9 / 12 | 1,136 / 2,040 | 32,988 |
| Medium | 9 / 24 | 5,004 / 9,504 | 150,252 |
| High | 10 / 64 | 17,600 / 34,272 | 519,500 |

Add unchanged halo 44 bytes and skin-specific uniforms 224/224/448 bytes.
Actual typed-array assertions pass. No geometry/uniform envelope expands. The
ownership ledger retains at most 15 setup handles; runtime heap size is not measured.
No GPU median/p95, device/renderer, disjoint validity, CPU submission, presentation
cadence, VRAM, thermal/battery or inference-coexistence measurement was performed.
Wider coating coverage/full-surface normals still carry unmeasured shader/fill cost.

The ignored local release snapshot is prepared. Comparison fixtures now explicitly
pass identical current MotionFrames to both renderers, avoiding version-specific
clock drift. Seed `0x5a17`, yaw 0/0.75/1.6, curl 0/6/12 and palette
0/15/45/120/300 remain fixed. New authored smoke cases cover eight matched
full-colour/neutral/normal/depth views and compiled production assets with synthetic
browser transport, no core/owner connection. Full IV and presence matrices plus
CPU/GPU transform feedback and matching isolated timers remain authored/unexecuted.

**No new PNG, comparison sheet, shader proof or rendered success exists.** Historical
images/manifests are preserved. Future output comes from the dedicated IV Playwright
config under `ui/test-results`, not from invented stand-ins. After explicit graphical
permission, use the smoke cases first, inspect failures, then the equation proof,
92-image-per-variant IV matrix and 27 presence scenes. Select a compact matched
sheet and a few original full-resolution shots only after real captures exist.

Evaluate richly coloured readability and the owner's **radial shells cropped by
radial sectors** criterion first. Open risks: inward-looking rolls, opened-casing
character, soft self-overlap, doubled resting coat, compact contact, Low faceting,
particles/reflections, small layouts/focus, translation suppression and actual
Console interaction. The missing concept board remains missing, without new search.
Only if visually credible proceed to corresponding isolated GPU/CPU-submission
measurements; real provider/audio and owner acceptance require separate permission.

## Closing integration evidence

The final compiled-source identity, artifact hashes, local commits and clean-tree
check are recorded during closure in this section and the linked evidence. This
is a technically testable experimental visual milestone, not v0.2.6 release,
performance acceptance, production readiness or a new beta. Stop after IV-D.
