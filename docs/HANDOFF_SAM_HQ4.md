# Sam HQ 4 — continuity and v0.2.6+ direction

**Start here.** Prepared 2026-10-15 from released source at
`dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. This is a documentation handoff,
not a new implementation, version bump, release approval or testing permission.

## Executive brief

- **Sam is an ambient, embodied AI companion.** Attractive living visual presence,
  dependable conversation, practical usefulness, trust and meaningful owner control
  are product fundamentals. Appearance is a principal attraction, not decorative polish.
- **Current owner priority: visual overhaul.** The next meaningful gain is a connected,
  peeling living skin instead of the current occasional wrapping-band impression,
  followed by coherent local form/light/audio expression. See the
  [Visual Core handoff and first assignment](HANDOFF_CODEX_VISUAL_CORE.md#first-visual-core-assignment).
- **v0.2.5 is published and verified**, as an experimental source/Python GitHub
  pre-release. It is not a public Windows installer or human acceptance of the art/voice.
- Diagnostic/composable launch, Visual Identity I–III, regional palette and visible
  provider preparation are implemented. Do not reopen them as absent foundations.
- Intermittent latency/false voice turns, weak owner multilingual recognition and
  real-room interruption remain unresolved. Use diagnostic evidence for reliability;
  do not attribute every symptom to one old race or start another synthetic AEC pass.
- Favor frequent, meaningful, green experimental increments. A possible v0.2.6 visual
  milestone is a planning target; perfection and speculative complaints are not an
  indefinite release embargo. Demonstrated security/data-loss/unrecoverable core
  failures still block the affected artifact class.

**Authority map:** [STATE](STATE.md) = implemented truth;
[ROADMAP](ROADMAP.md) = current execution order; [BACKLOG](BACKLOG.md) = retained gaps;
[ARCHITECTURE](ARCHITECTURE.md) / [DECISIONS](DECISIONS.md) = engineering contracts;
[VISUAL_DIRECTION](VISUAL_DIRECTION.md) = artistic intent;
[acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md) = evidence by class.
This handoff is a dated entry point, not a competing backlog or replacement spec.

## Provenance and missing context

| Label | Meaning in these handoffs |
| --- | --- |
| Implemented | Confirmed against the release checkout, source/comments, Git and current contracts. |
| Recorded evidence | A dated repository result or supplied release record; not rerun in this task. |
| Owner intent | Requirements explicitly supplied in the October 15 HQ4 handoff request; may exceed implementation. |
| Proposal | Next-development design, not an accepted architecture change or completed feature. |
| Unknown | Evidence is unavailable or does not isolate a cause; do not fill the gap with recollection. |

The full HQ3 and old Codex transcripts were **not** imported or reconstructed.
Repository beta triage preserves the supplied report/screenshot/diagnostic interpretation,
not every original attachment or private recording. The original visual concept board
is **missing/unrecovered**: tracked assets contain the logo, architecture illustration,
icons and generated comparison evidence, without an identifiable original board.
The logo and written reference description are useful but not equivalent substitutes.
No new human judgment, remote query, test/build, renderer, application or audio operation
was performed for this handoff. Later threads must refresh cheap Git facts.

## Released baseline and security disposition

[v0.2.5 pre-release](https://github.com/AlfonsoFR2020/sam-ambient/releases/tag/v0.2.5)
targets `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`; the locally verified annotated
tag object is `3ad2a08f269e3d80e11c0b701a8ecc899bc51359`.
At handoff start, local `dev`, `origin/dev`, `main` and `origin/main` name the release
baseline; the handoff commit will make only local `dev` ahead.

The preserved publication record points to
[exact-commit CI run 38728877630](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/38728877630):
Windows Quality **683 passed / 5 skipped**, Ubuntu Quality **644 passed / 44 skipped**,
frontend **258 tests / 32 files** on both; Quality and Package smoke passed.
Independent Native package (Windows) also passed its hosted build/smoke. That does
**not** establish a signed installer, clean-host/upgrade acceptance or public native release.
The prior local contained gate was 640 Python passes / 2 skips, plus focused shutdown
checks, frontend/types/build/static and exact-commit package inspection. These are
historical release results, not checks executed by this documentation task.

Only these assets were published and independently downloaded/hash-verified:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `sam_ambient-0.2.5-py3-none-any.whl` | 355819 | `b34b0e903ef2b659fbe905cf8c9c44f06d9f2461776cdacd922baee96d95f41a` |
| `sam_ambient-0.2.5.tar.gz` | 19285932 | `0bd3378b50fbd1560f961de0fbe5cb51836a4384e060de883be1a83168114734` |
| `SHA256SUMS-0.2.5.txt` | 192 | `d7a8ed41529c7e6b44ce9bf9993656d8faa570f5275a96926334427b6f734bf0` |

The wheel includes current static UI/resources/notices; source and runtime payload
were checked against the exact tagged commit. GitHub's automatic repository archives
are separate from the verified Python sdist. No installer, companion ZIP, executable,
private data, models or diagnostic evidence was public. Source users still need
Python 3.12+ and documented provider/browser/speech prerequisites.

[Security triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md#focused-maintenance--2026-10-15)
records source-map-js 1.2.2, esbuild 0.28.2 through Vite 7.3.6, pytest 9.0.3 and
setuptools 83.0.0 through cx_Freeze 8.7.0. Earlier Vite/Vitest/mocker findings were
already corrected. Do not resurrect the historical 20-alert or five-alert inventory
as current unresolved exposure. The release-time read-only review left **GLib 0.18.5 /
GHSA-wrw7-89jp-8q8g** on Linux/BSD GTK-native only. GTK 0.18 requires `glib ^0.18`;
the 0.20 fix is not a compatible override. Dependency-internal reachability is not
proven absent, but it is absent from the Windows native graph/Python runtime graph.
No blanket vulnerability-free or Linux-desktop-security claim. Refresh advisories
only in a later authorized maintenance/release task.

The former local Cargo helper OS-error-5 failure is historical host/toolchain evidence,
not proof that current hosted native builds fail. Public Windows distribution still
needs signing/reputation, authenticated installed/upgrade/data-recovery and clean-host
acceptance. Never publish an unsigned development installer or weaken bootstrap/sandbox.
See [release notes](RELEASE_NOTES_0.2.5.md), [readiness](RELEASE_READINESS_0.2.5.md),
[checklist](RELEASE_CHECKLIST.md), [SECURITY](../SECURITY.md) and [THIRD_PARTY](../THIRD_PARTY.md).

## Governance for the new conversations

HQ owns product priorities, architecture/scope decisions, Codex briefs, reasoning/quota
selection, scarce beta scheduling and artifact-specific release approval. Codex owns
authorized routine engineering/Git/build/verification against repository truth.
Do not make the executive owner perform routine GitHub work; do not treat available
credentials as permission to modify another repository or publish without authorization.
`main` represents released baselines; `dev` ongoing integration. Preserve history,
never blindly replay remote mutations after capacity/reboot interruption.

Use substantial bounded assignments with a few coherent commit/recovery boundaries,
explicit exclusions, evidence and stop criteria. Medium suits ordinary scoped work;
High suits demonstrated ownership/races and difficult visual geometry/optics. Extra High,
if available, may help a bounded topology/depth choice; it is not a default quota sink.
Record actual progress/validation and stop cleanly on a usage warning.

**Operation permission is task-specific.** When the computer is occupied, do not
launch Sam, providers, browsers (including headless/GPU fixtures), models, audio,
tests or builds unless that task explicitly permits them. Read-only source/docs work
is different from runtime testing. Do not inherit an old “machine released” message
as permanent permission. No personal recording, intrusive playback or device changes
by default. Human beta is scarce: reserve it for integrated, informative checkpoints;
do not repeatedly ask for another beta to cover deterministic repairs.

## Architecture that future work must preserve

| Boundary | Current rule and why it matters | Primary source |
| --- | --- | --- |
| Turn/generation authority | Runtime/TurnManager commit user text; partial/final STT is provisional until normal commitment. Cancel/supersession retires logical ownership before waiting for non-cooperative adapters; late handoffs/events cannot reclaim a newer turn. | [Architecture](ARCHITECTURE.md), decisions D-026/D-030/D-031 in [DECISIONS](DECISIONS.md) |
| Commands/discovery | Request ID, generation/turn/cancellation identity and connection epoch are distinct. Correlated terminal clears its own pending command even if stale for display. ACK is initiation, never model-load/unload success. | D-025/D-026; [cold recovery](COLD_PROVIDER_RECOVERY.md) |
| Routing/readiness | Each committed turn pins an immutable provider/router/model. Desired/requested/loading is not confirmed Active; failed exact selection may preserve a valid route, never silently substitute. Empty inventory requires successful empty data; failure/timeout is not empty. Four transient attempts use 0.5/1/2 s backoff, cancel on supersession/disconnect/Quit. | D-027/D-029/D-037; [provider evidence](CORE_INTEGRATION_0.2.4.md) |
| Model/service ownership | Default Quit keeps both. Conditional unload/stop applies only to Sam-loaded/Sam-started resources; explicit authenticated idle unload can deliberately unload the exact external model without acquiring service ownership. Confirm actual absence/stopped endpoint. LM Studio desktop and endpoint differ. | D-032/D-041; [Architecture](ARCHITECTURE.md#voice-and-providers) |
| Authority/capabilities | Random per-supervisor root, private pipes and per-connection mutual HMAC; reconnect/restart/revoke rejects replay. Static ordinary tabs have no private control. Registry/schema/policy/exact approval/epoch mediates tools. Model/page/STT/memory text is data, never authority. | [Owner](OWNER_AUTHORITY.md), [trust](TRUST_BOUNDARIES.md) |
| Voice lifetime | Capture, recognition, synthesis and playback have separate health/cancellation. Pull-based bounded PCM/pre-roll/utterance/WAV/text queues; failed voice leaves typed recovery. Mic/output gains are application PCM gains, not OS settings. | D-028; [Architecture](ARCHITECTURE.md#audio-ownership-checkpoint) |
| Text versus delivery | Complete generated assistant answer remains committed when speech stops/fails. Role/content/delivery metadata stay separate. Markdown normalization is owned by speech delivery; original formatted history remains. | [October 9 triage](BETA_TRIAGE_2026-10-09.md) |
| Acoustic uncertainty | Conservative transcript-screened candidates retain overlapped generation; TTS ending never promotes them. No raw-VAD/RMS timer proves human origin. A future proven signal may stop delivery, never directly commit user text. | [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md), D-039 |
| Supervisor/update | Presentation cannot acquire restart/update authority. Trusted process argv, bounded retirement; staged/hash-verified atomic activation and rollback, no in-place self-overwrite or LLM update authority. | [Architecture](ARCHITECTURE.md#trusted-lifecycle) |
| Private persistence | Operational history/settings and durable personal memory are distinct. Memory schema 1, stable owner principal, reviewed provenance, transactional correction/deletion, bounded local lexical recall; no silent cloud memory export. Failure does not erase data or disable text. | [Memory](MEMORY_FOUNDATION_I.md), [memory authority](MEMORY_AUTHORITY_CONTRACT.md) |

Source owner launch uses sandboxed isolated Chromium app mode, privately fulfilled
canonical assets and a private signer. Bundled native origins may authenticate;
mutable native HTTP dev pages do not. This is possession authority, **not** an OS
sandbox against same-account debugger/memory/trusted-code compromise. Thin Tauri
does not move core policy or persistence into Rust.

Cancellation identities propagate through capture/STT → turn → model → delivery/tools.
Cloud fallback must never silently export local context when disabled. Tool policy
and update authority remain trusted code outside the model. Useful core source entry
points are [runtime](../src/sam_ambient/runtime.py),
[TurnManager](../src/sam_ambient/core/turns/state_machine.py),
[voice pipeline](../src/sam_ambient/core/voice/pipeline.py),
[conversation diagnostics](../src/sam_ambient/conversation_diagnostics.py) and
[supervisor](../src/sam_ambient/supervisor/manager.py).

Provider stop has an 18 s external-cleanup bound inside the supervisor's 24 s stop
window; non-cooperative generation retirement has a 2 s grace. No generic timeout
reset should hide stranded ownership. Inventory CLI may implicitly wake LM Studio
before ownership sampling; same-ID resource replacement lacks a universal incarnation
token. Those edge cases remain explicit, not permission to kill external processes.
The October 8 exact owner-window unload/reload/Rescan/Quit **passed** against independent
inventory; earlier corrupted-locator failures were instrumentation, not product defects.

## Diagnostic launch and existing foundations

[Launch contract](DIAGNOSTIC_LAUNCH.md): `Start Sam.cmd` and the
`Diagnose Sam.cmd` preset (which adds `--diagnostic`) share one parser/supervisor. Flags compose:
`--help`, `--verbose`, `--keep-console`, `--no-keep-console`, `--log-file PATH`,
`--diagnostic`, `--keep-model`, `--keep-provider`. The preset itself is already added
by Diagnose; it need not be typed twice. CLI settings override environment, explicit
TOML, project TOML, user TOML, then defaults. Launcher-only flags have no persisted
counterpart. Retaining model implies endpoint retention; reverse implication is false.
Overrides do not rewrite saved preferences or acquire external ownership.

Default diagnostic file: `<effective-root>/.sam/diagnostics/session.jsonl`;
1 MiB plus three backups, single supervisor writer/OS file lock, 100 records/s/process,
bounded records/history and hashed correlation IDs. UTC receipt and monotonic source
timing distinguish command queue/dispatch/terminal, STT, provider headers/first token/
stream, cancellation and delivery. Summaries retain longest waits and nonterminal
owners. No credentials/proofs, routine transcript/token/tool/memory bodies or raw PCM.
Metadata is not anonymity; review paths/times before sharing. Verbose is allowlisted
operational evidence, not unrestricted DEBUG. No log promised on an unwritable path.

[Agency](AGENCY_FOUNDATION_I.md) already offers bounded canonical-workspace reads,
owner Console and isolated public-page inspection plus structured tool mediation.
The Console is not arbitrary PowerShell or workspace writes. Separately configured
trusted `process.run` has exact approval/OS-rights limitations, not an OS sandbox.
[Memory](MEMORY_FOUNDATION_I.md) already offers owner CRUD/review/provenance and
at most six whole reviewed lexical entries / 4,800 context characters for local
recall. Model `memory.propose` approval creates an unreviewed claim, not a trusted fact.
No vector DB, automatic trusted transcript learning or speaker identity. Both
foundations remain implemented assets with **expansion parked**.

## Negative acoustic knowledge — preserve, do not repeat

| Experiment | Established result | Why it was not integrated |
| --- | --- | --- |
| [Extracted AEC3](AEC_PROTOTYPE_2026-09-30.md), `75e16c9` | ~17.9 dB rejection; first-second SDR ~4.18 dB after 8 ms fixed-delay correction | Failed >=20 dB echo / >=6 dB near-end gates; wheel feasibility is not separation success. |
| [Windows Voice Capture filter](AEC_WINDOWS_FILTER_PROBE_2026-10-01.md), `7f56db2` | 18.16/19.74/19.30/14.99 dB across delays; near SDR ~12.89 dB; changed delay ~15.46 dB | Preserves near speech but fails echo/recovery. This filter probe does not disprove all native source/device APIs. |
| [Full M153 APM IV-A](AEC_FULL_APM_GATE_2026-10-07.md), `236ff49` | Processed ~39–42 dB echo but destroys onset; linear ~30–33 dB, gain ~0.999 / SDR ~20 dB, changed-delay 19.53 dB | One output loses human onset, the other initially misses recovery/cold VAD safety. |
| [IV-B](AEC_APM_DIAGNOSIS_2026-10-07.md), `4146b68` / `a21fdf2` | Exact external-delay linear mode: original echo ~33–36 dB, gain 1.000 / SDR 23.02 dB; hidden delay produces false speech at 440 ms and two diverse render spectra fail | Public smoothed ERLE/delay plus VAD is not ownership readiness. Real near-end can also disarm readiness. No engine/output selected. |

Pinned full package m153.8010.0.2, package source `65f1b3b959d3aaff17bd6611418980f49a5af3b8`,
upstream `9ea5afcad008b940468c2a15aec339592cf5a935`; narrow experimental ABI,
16 kHz mono PCM16 / 10 ms. Public configuration investigation did not edit upstream DSP.
An owned reproducible build was conditional on a pass and therefore not completed.
Current independent PortAudio streams lack validated hardware render/capture timing,
drift and reference observability. More synthetic tuning cannot supply that evidence.
Re-entry needs a separately authorized timing/physical-reference experiment, unchanged
safety/diversity gates, then a proven engine before runtime integration. No AEC work
is part of the visual programme.

## Requirement traceability and remaining experience

Acceptance terms: **implemented** = source/automated protection; **runtime-bounded** =
specific real session only; **human-open** = owner has not accepted the revised result.

| Intended owner experience | Current implementation / supporting evidence | Acceptance / remaining gap | Priority, dependency, further human observation |
| --- | --- | --- | --- |
| Beautiful organic layered presence | Six flexing sheets, quiet film/contact and shared field; [Visual Core](HANDOFF_CODEX_VISUAL_CORE.md#current-renderer-map), [III](VISUAL_IDENTITY_III.md) | Automated/headless; some views still wrapping bands; owner rejected earlier visuals | **First**: reference-led connected-film assignment; reference and later owner judgment essential |
| Whole body inhabits discourse | Independent measured envelopes, receptive/work/prosody grammar, shared spatial crest/particles; [II](VISUAL_IDENTITY_II.md) / [III](VISUAL_IDENTITY_III.md) | Implemented, synthetic; naturalness/timing not accepted | Next visual objective after membrane representation; real audio/visual judgment later |
| Living rich pigment, useful High | Three regional banks, independent palette/transport; current 9/10 draws; [palette](LIVING_PALETTE_AND_READINESS.md) | Temporal continuity/diversity proven; beauty, sustained model coexistence and low-power cost open | Preserve baseline, refine only tied to film; human color/depth preference required |
| Conversation continues after errors | Commit/terminal/stale guards, typed recovery, Markdown speech boundary; [beta triage](BETA_TRIAGE_2026-10-09.md), [diagnostics](DIAGNOSTIC_LAUNCH.md) | Several concrete bugs fixed; plausible false finals and minutes-long stalls not fully reproduced | High reliability track, act on correlated evidence; later real usage needed for residual symptoms |
| Understand English/Spanish reliably | Forced language wiring, installed whisper.cpp base; [generated benchmark](SPEECH_BASELINE_2026-10-01.md) | Generated WER en 7.95% / es 8.75%, not owner accent; beta recognition materially poor | Dedicated STT modernization; compare segmentation/language/capacity, later owner speech essential |
| Interrupt naturally; answer retained | Conservative candidates, explicit Stop, full answer separate from delivery; [AEC](AEC_DOUBLE_TALK_CONTRACT.md) | Text/ownership repairs protected; prompt human-origin detection absent | Park research pending real timing/reference; room/speaker test eventually required |
| Read coherent history | Committed roles, safe common Markdown, separate Speech stopped, own scroll/autofollow; [acceptance](CORE_EXPERIENCE_ACCEPTANCE.md) | Implemented; reload/session-resume expectation and all practical layouts not fully settled | Preserve; narrow evidence-led UX later, no transcript dump into memory |
| Control model without guessing | Truthful requested/loading/active, persistent status/wait, exact idle unload/reload; [integration](CORE_INTEGRATION_0.2.4.md), [palette/readiness](LIVING_PALETTE_AND_READINESS.md) | Real Gemma lifecycle passed; CLI wake/incarnation edge and wider hosts open | Preserve current authority; ownership-focused follow-up only with evidence |
| Direct Controls, persona and useful Console/Memory | Five Controls groups; recognition/Flow/health/voice; bounded management surfaces | Functionality exists; sparse panels, refined identity/persona/editor remain UX requests, not missing storage | Deferred refinement; owner intent needs concrete acceptance examples |
| Easy safe launch, trustworthy private data | Shared flags/private owner proof, bounded diagnostics; SQLite schema/recovery | Released source path protected; logs cannot prove all incidents fixed, database plaintext | Maintain; no new security model or capabilities; native clean-host checks separate |
| Install like ordinary Windows app | Hosted native build/smoke passes, Python/source public | No public signed/clean-host accepted installer; historical local helper failure not diagnosed | Separate distribution work; signing/business approval and install/upgrade evidence required |

Windows TTS now chooses an available cross-language persona category (this machine:
Hazel/Helena, gender metadata), honors explicit preference and reports fallback at
first PCM. This fixes the arbitrary David/Helena category switch, **not** subjective
timbre, pleasantness or the owner's desired Sam identity. Sam-specific instructions/
persona editing remain future owner-controlled design, not model-generated authority.

## Flexible next-development programme

The [ROADMAP](ROADMAP.md#hq4-programme--v026-and-beyond) owns ordering. Expected
visible benefit, existing evidence and dependencies favor:

1. **Connected peeling skin:** highest current visual mismatch; resolve representation
   with references and bounded geometry/optical alternatives, not shader-constant drift.
2. **Localized expressive coordination:** build on the chosen skin; coherent traveling
   deformation/light/specular response from existing real signals, not invented emotion.
3. **High spatial fidelity and sustained responsiveness:** refine depth/curvature only
   where comparisons show benefit; representative cost with inference needs new permission.
4. **Palette/particle composition:** preserve the new long-timescale regional grammar;
   refine its relation to film/space based on visible evidence rather than another hue sweep.
5. **Later identities/themes:** owner-intent examples include smoke/clouds, fractals,
   paint, synthwave, HAL-like, dark sphere and gold. Preserve them as future replaceable
   identities, not a theme engine or new visual implementation now.

These are not five promised releases. Ship one coherent artistic/technical advance
when verified and honestly described; do not require a second scarce beta for every
deterministic fix. STT modernization, incident-driven reliability, distribution and
persona/Controls refinement remain separate priorities. Expand Agency/Memory only
after core satisfaction improves, under an explicit later decision.

## Starting the fresh conversations

Create/open the named conversations manually; no chat migration or transcript access
is implied by this document. Leave old conversations available as archives until the
owner is comfortable that the handoff is sufficient.

**First message to “Sam HQ 4 — v0.2.6+”:**

> Use docs/HANDOFF_SAM_HQ4.md as the continuity entry point, then current STATE,
> ROADMAP and HANDOFF_CODEX_VISUAL_CORE. v0.2.5 is published at dc64c5d; repository
> truth outranks old recollection. Coordinate the reference-led connected-film visual
> assignment, scarce human acceptance and frequent meaningful experimental releases.
> Keep STT/reliability/native and future powers separate. No implementation or runtime
> testing is authorized by this onboarding message. Identify missing references and
> prepare one bounded Codex brief when the owner is ready.

**Codex thread setup:** use the existing Sam project on `dev`, title
“Sam Visual Core & Experience — v0.2.6+”, GPT-6 Sol High (Extra High only if available
and justified for topology/optics). Use the
[starter and first-assignment contract](HANDOFF_CODEX_VISUAL_CORE.md#fresh-codex-thread-starter).
Begin with Git/status and document reading; explicitly establish machine permission
before tests/rendering. Do not push this handoff or start implementation automatically.

## Handoff verification

Repository-only review covers nine Markdown files and 223 local file/heading links;
all targets resolve, no trailing whitespace is introduced, and STATE remains 200
physical lines. Local release tag/branch references and already-downloaded release
asset sizes/SHA-256 agree with the publication record above. No new remote query
or mutation was used. Product source, dependencies, versions and workflows are
unchanged. No tests, builds, application/provider/browser/GPU/audio or native
packaging ran. Historical records remain dated; only current entry points and
strongly supported stale planning statuses were reconciled. One local documentation
commit closes the task; no next implementation starts here.
