# Core Experience evidence — I through V

This is the post-Memory Foundation baseline and evidence index for **Basics Before
Expansion**. Published v0.2.3 is unchanged. Automated evidence does not establish
human acoustic, voice-persona or visual acceptance. No human session is available.
The **current** status is [October 8 integration delta below](#october-8-integration-delta),
which updates [Core Experience V](#core-experience-v-current-matrix) without rewriting it.
Earlier sections preserve historical evidence, not a second current task queue.

## Baseline before consolidation (2026-10-01)

| Journey stage | Current implementation / evidence | Remaining or contradiction |
| --- | --- | --- |
| Start Sam | Source launcher → supervisor → private owner window; deterministic first-run/owner tests | Full current composition needs bounded smoke |
| Discover/select/load | Exact discovery, stale scan rejection, pinned routes, installed-model bootstrap; provider tests | Real current load/Rescan/outcome verification |
| Typed conversation | Retired generation ownership and independent pending-command release; multi-turn recovery tests | Current integrated runtime smoke |
| Capture/STT | Pull-based capture, bounded pre-roll, isolated health, local whisper.cpp | Automatic language preferences are not an explicit recognition language; base-model accuracy unaccepted |
| Voice/model turns | Commit-only transcripts, conservative pinned playback candidates, late-event rejection | Physical echo suppression/prompt barge-in remains unsolved |
| TTS/playback | Complete answer independent of delivery, separate health, iterator cleanup | Alphabetical language voice selection changes persona; inventory reports locale only |
| Orb response | Separate waveform levels → freshness adapter → AmbientReactivity → bounded form/light | Post-beta deterministic response exists; actual signal/render link and human acceptance are separate |
| Form/membrane/surface | High-tier smoothing, shared soft membrane field, evolving broad pigment territories | Human acceptance remains open; isolated performance only |
| Particles/Controls | Persisted particle amount scales quality budget; tab inventory/browser audit | Final authoritative speech/model state needs re-audit |
| Diagnostics/history | Independent wide-layout regions, hierarchy, bounded events; clean history/scroll | Preserve previous regressions |
| Unload/stop | Independent Sam-loaded/Sam-started ownership, runtime retirement before bounded cleanup | CLI exit status currently treated as success without a post-operation state probe |
| Exit | Idempotent runtime/capability/browser/memory retirement and supervised stop | Current composed shutdown/cleanup smoke |

## Scope and evidence rules

- Improve demonstrated defects in the existing journey; do not add agentic powers.
- Preserve conservative self-echo rejection and text as the recovery path.
- External providers/models remain external. Cleanup preferences authorize only
  Sam-owned resources; server stop does not mean closing LM Studio's desktop app.
- Real smoke uses installed components only, with isolated operational/memory data.
  Synthetic voice tests require no person or physical audio output.
- Park workspace mutation, richer browser automation, arbitrary shell, additional
  memory sophistication, profiles and multi-person integration until this matrix
  is sufficiently healthy.

Checkpoint results and final acceptance distinctions are appended here as evidence
is obtained, rather than inferring success from dispatched operations.

## Provider lifecycle checkpoint

- A new deterministic regression reproduced success reports when `lms` returned
  zero but the model/server remained present. Unload now re-probes the serving
  inventory; stop requires `lms server status` to confirm `running=false`.
  Missing/contradictory confirmation is a bounded failure, not success.
- 31 provider/bootstrap/route/discovery tests pass. Existing cleanup remains
  single-pass and ownership-scoped, with runtime retirement before cleanup.
- Real Windows check: LM Studio initially reported daemon/server stopped. Cold
  inventory first returned no model; a subsequent inventory exposed the existing
  `google/gemma-4-e2b` Q4_K_M. The normal Sam discovery/bootstrap loaded that exact
  model, a short text answer completed, and Rescan retained the exact route.
  Sam-loaded model unload was confirmed absent. Serving was already running at
  bootstrap, so server stop was correctly skipped; no external process was killed.
- The smoke's temporary-directory removal exposed a Windows operational-state
  SQLite handle still open after runtime close. Investigate in the shutdown
  checkpoint; this did not prevent generation, Rescan or model unload.

## Ordinary voice checkpoint

90 focused tests pass across capture/STT, conservative interruption, multi-turn
voice delivery, generation terminality and typed recovery. No new turn semantics
are required. Physical STT accuracy and early acoustic barge-in remain unproven;
the failed AEC prototype stays outside runtime.

## Recognition configuration checkpoint

`voice.stt_language` / `SAM_STT_LANGUAGE` / `--stt-language` now carry a validated
hard language (or default `auto`) through the normal supervisor and runtime to
the existing voice-stream context. Explicit en/es makes one forced whisper.cpp
request, with no automatic hypothesis or language retry. Preferences retain their
separate automatic-fallback meaning. Endpointing/base model are unchanged; the
beta's recognition accuracy cannot be attributed solely to configuration and
still needs a later physical evaluation after echo ownership is adequate.

## Voice-persona checkpoint

Windows inventory was read without speaking: Helena/es-ES female, David/en-US
male, Zira/en-US female, Hazel/en-GB female. Default selection now consistently
prefers the installed cross-language female persona; explicit configured IDs
remain honored and missing same-persona language support is reported. Existing
metadata without gender remains compatible. No synthetic voice claims timbre
or cadence equivalence. Actual synthesis selection is delivered reliably in the
first-PCM synthesis-health event (not a coalesced meter), with stale-delivery
rejection. 33 focused Python and 37 reducer tests pass; TypeScript and the shipped
frontend build pass. Physical listening/persona acceptance remains open.

## Embodiment connectivity checkpoint

No renderer/art-direction defect was demonstrated in this pass. Separate
`voice.level` / `tts.level` feed reducer metrics, independent freshness retirement,
AmbientReactivity, radial/material response and body/membrane shaders. The browser
regression now sends ordinary output RMS 0.04 through the actual reducer instead
of assigning a near-full-scale 0.7 sample directly to UI state.

At default audio reactivity, a fixed-camera Chrome/WebGL check measured 2,112
additional covered body pixels, mean central light gain 3.24 (8-bit channels),
radius change 0.017 Orb units and output pulse 0.212. An emphasis RMS 0.2 raised
the pulse to 0.445, still bounded. 80 focused visual/input/reactivity/quality tests
pass, including zero amount, separate receptive input, expiry/cancellation and
bounded values. These metrics do not prove perceptual acceptance.

High-tier fixed body/membrane coverage remained measurable: 3,317 changed pixels,
765 outside-body pixels, no WebGL error. Controls particle amount reached the
renderer and vertical interaction remained correct. Existing form/normal/shared
material representations are preserved; no geometry, shader/noise cost or palette
art-direction change was justified.

Seven bounded browser cases passed. Remaining fixed-orientation material checks
showed long-interval mean color change 29.57 versus adjacent-frame 1.20; membrane
tint agreement 0.985, palette delta 6.68, low/medium shader errors zero; particles
had exterior coverage without rear-body depth leaks. These establish continuity,
evolution and coherent shared rendering, not aesthetic success or low-power
full-app performance.

## Controls checkpoint

The existing tab inventory remains intact: Conversation (text, microphone,
speech output, Stop speaking, gains, transcript), Appearance (intensity, motion,
reactivity, particle amount, reduced motion, fullscreen), Device (quality/profile),
System (exact provider/model, Rescan, restart, ownership-scoped exit preferences,
Quit), Diagnostics (opening status). Agency/Memory surfaces are preserved without
expansion. Recognition/effective voice/health are now also visible in Conversation
using the same core-confirmed fields as System. An enabled capture preference is
not presented as proof of functioning hardware; disconnected facts are last known.
Recognition language and voice preference remain normal source configuration,
not new live-setting commands. 65 focused frontend tests and one new Chrome status
case pass, including STT failure with typed Send still enabled.

## Startup/shutdown checkpoint

The real smoke exposed an operational conversation-state handle leak:
`sqlite3.Connection` context exit commits/rolls back but does not close. Short
SQLiteSessionStore operations now explicitly close on both success and exception,
without waiting for garbage collection/process exit. A failing regression held
strong references to every connection; after repair they are closed, rollback
preserves prior state, and Windows can remove the database immediately. 54
focused state/context/provider/generation/first-run shutdown tests pass.
Durable memory already uses per-operation closed connections; no memory features
or schemas changed. Runtime still revokes authority, retires active work and
closes speech/browser/bridge/provider resources before configured provider cleanup.

## Composed core-experience simulator

One real runtime/owner WebSocket/voice pipeline/PCM output/state/memory-init path
now exercises typed → voice → STT failure → typed recovery → Rescan → Quit.
Only the external provider, capture, recognizer, synthesis and output device are
synthetic; microphone frames remain continuous and paced, including silence.
Three complete answers retain clean user/assistant roles. Shutdown is idempotent,
revokes the owner, closes speech/output tasks, then confirms model unload before
provider stop through the existing cleanup adapter.

The same emitted core events pass through the actual frontend reducer, Controls,
history and AmbientReactivity in isolated Chrome. Output pulse is nonzero/bounded,
effective voice and degraded STT are visible, and all six committed history items
retain separate roles and content. The mounted WebGL renderer remains alive; the
separate fixed-camera regression establishes geometry/light response. No physical
audio, real inference or advanced agency/memory behavior is used by this simulator.

## Normal integrated runtime checkpoint

The normal supervisor launched its real core/UI subprocesses and private owner
window, with isolated state and app-data memory. The existing LM Studio server
was running with no loaded model; normal bootstrap loaded `google/gemma-4-e2b`.
Three short typed turns completed (request-to-completion approximately 1.39 s,
1.28 s and 0.16 s; not a benchmark). Rescan reached terminal state with that exact
route, all three committed answers remained, and no page exception occurred.
Quit returned zero, closed the owner browser/revoked authority, and confirmed the
Sam-loaded model absent. The pre-existing serving process was correctly preserved.
No provider stop of an externally owned resource was attempted.

The first smoke attempts exposed a real snapshot defect: a configured model was
reported as current while its unavailable reason still blocked generation. Ready
snapshots now report no available model/provider until bootstrap confirms them;
requested/loading identity remains separate. A parameterized regression includes
the explicit configured-model case previously absent from the pending-model test.
The smoke also reproduced the operational SQLite handle leak in SupervisorStore;
it now explicitly closes short transactions, preserving rollback. A fixture selector
error was corrected without changing product behavior. The corrected session passed
and removed its isolated temporary state without a Windows sharing violation.

Microphone and physical playback were disabled for this normal session. Separately,
actual System.Speech generated 87 PCM frames per short en/es phrase; metered peaks
were 0.702/0.771, with Hazel/en-GB and Helena/es-ES (both female). PCM was consumed
without sending it to speakers. This proves synthesis initialization/selection and
nonzero waveform, not capture/STT accuracy, sound timing or persona quality. Normal
speech event-to-render behavior is protected by the composed synthetic/browser path.

Two older Quit regressions still assumed the pre-owner-proof protocol. The final
gate exposed their missing handshake and outdated consumer signature. Fixtures
now authenticate through the shared helper and supply an OwnerConnection; 33
first-run/authority tests pass. Product authorization was not weakened or changed.

## Consolidation I acceptance matrix

Recorded 2026-10-01. “Passed” below always names its evidence class; no new human
acceptance occurred. Published v0.2.3 and its artifacts remain unchanged.

| Fundamental area | Automated evidence | Real runtime | Human acceptance | Remaining |
| --- | --- | --- | --- | --- |
| Startup | Supervisor/first-run/owner fixtures | Normal core/UI/owner window starts | Earlier beta only | Wider host/device matrix |
| Provider discovery | Exact/stale/failed scan regressions | LM Studio inventory, Rescan | Earlier beta only | Other providers and failure timing |
| Model load/select | Requested/loading separated from active | Existing Gemma load confirmed | No new session | Cold inventory delay; broader switches |
| Model unload | Outcome re-probed, contradictory CLI failure | Sam-loaded Gemma confirmed absent | No new session | External model deliberately preserved |
| Provider shutdown/ownership | Stop status verified; owned/reused/failing cases | Reused server preserved | No new session | Real Sam-started stop not exercised |
| Text conversation | Terminality, correlation, recovery, history | Three complete owner-UI turns | Earlier beta; late stall originally failed | Broader provider/device fault timing |
| Voice turn lifecycle | Sequential/mixed/failure/cancel paths; composed PCM simulator | No physical capture in this pass | Older beta worked then degraded | Physical pacing/device recovery |
| STT configuration | Hard en/es through normal launch/backend; no auto retry | Not exercised against real recognizer here | None new | Real configuration/quality benchmark |
| STT quality | Backend mocks establish semantics only | Installed base model unchanged | Beta materially failed Spanish | Actual bilingual recognition/endpoint evidence |
| TTS/persona | Installed coverage/preference/fallback/stale selection | Hazel/Helena produce real PCM without playback | Pleasantness/coherence unaccepted | Gender is a limited persona proxy |
| Interruption/barge-in | Conservative candidate/late-event/text-preservation safeguards | No new physical overlap | Beta failed prompt interruption | Proven AEC/double-talk; roughly-one-second target |
| Voice reactivity | Real reducer → freshness/motion → fixed WebGL expansion/light | Real TTS PCM nonzero; render coupling synthetic | Revised embodiment unaccepted | Physical sound/visual timing and perception |
| Orb/form | High-tier representation/geometry and WebGL checks | Isolated Chrome only | Revised form unaccepted | Perceptual softness; representative hardware |
| Membrane | Lifted coverage/shared pigment/depth checks | Isolated Chrome only | Revised skin unaccepted | Perceptual living skin/edges |
| Living Surface | Broad evolution with short-frame continuity | Fixed-orientation Chrome only | Revised evolution unaccepted | Organic perception; full-app cost |
| Particles | Density persists/scales actual quality budget; depth checks | Isolated Chrome | Beta broadly acceptable before current pass | Current density/performance acceptance |
| Controls | Inventory/wiring, core-confirmed health/voice, last-known state | Normal model/Rescan/Quit used | Beta organization improved | Current integrated discoverability |
| Diagnostics | Hierarchy/layout/scroll existing regressions preserved | No new detailed live-panel test | Earlier beta useful; old overlap repaired later | Current human readability/layout |
| Memory initialization | Real isolated store initialized in composed path | Normal app-data store initialized | Not assessed here | Advanced memory deliberately outside this pass |
| Shutdown | Idempotent retirement; runtime/supervisor handles close/rollback | Quit zero, owner closes, temp state removable | No new session | Physical devices and failed external cleanup |

Final focused gate: **252 Python tests**, **208 frontend tests (18 files)**,
TypeScript, changed-file Ruff/Biome and formatting pass. The shipped frontend
production build passes. Nine bounded Chrome cases cover ordinary speech/form/
surface/particles, Controls/drag, speech status and composed core events. No broad
advanced Agency/Memory stress suite or human beta was run.

**Freeze line:** no substantial new capability expansion until basic blockers are
fixed or explicitly reduced to human-validation items. Ordinary speech quality and
prompt acoustic interruption still need engineering evidence. Human recognition,
voice pleasantness, physical double-talk and visual naturalness remain distinct gates.

## Consolidation II provider / Controls confirmation (checkpoints 8–9)

The deterministic provider/bootstrap/local-control/first-run/supervisor gate passes
**67 tests**. Eight bounded isolated Chrome cases preserve core-confirmed speech
health/effective voice, tab inventory/particle mapping, gain interactions, startup
facts, vertical drag, narrow diagnostics separation, renderer recovery and failed
Rescan/reconnect without losing Controls or the Orb. No UI redesign was performed.

One normal-supervisor real confirmation was attempted with microphone/TTS disabled,
isolated state/memory and the installed LM Studio/Gemma request. Initial HTTP probe
was unreachable; subsequent discovery reported a running LM Studio server but empty
conversational inventory in both startup scans. The owner UI remained mounted in
degraded/unavailable state; it never falsely showed the requested model active.
The bounded 90-second wait for Gemma timed out. The harness requested authenticated
Quit, revoked authority and stopped Sam cleanly. No model was loaded/generated/
unloaded by this session, and no external provider was killed.

Immediately afterward, read-only `lms` status/inventory reported daemon running,
server running on 1234 and `google/gemma-4-e2b` installed. This is **transient
inventory/readiness evidence**, not proof that the model disappeared permanently
or a reproduced source regression. The helper can return empty inventory for
timeout/failure as well as a genuinely empty list; this run did not establish which
occurred. Do not restart providers or invent a fix from the snapshot alone.
Consolidation I's successful generation/Rescan/confirmed unload remains historical
evidence; this new lifecycle confirmation is **incomplete**, not green. A bounded
cold-readiness/inventory diagnostic is a remaining basic task, separate from AEC.

## Consolidation II composed journey (checkpoint 10)

The existing composed simulator now also runs English then Spanish across normal
configured-language restarts using the same isolated operational/memory stores.
Each authenticated session discovers a route and completes typed → voice → injected
STT failure → typed recovery → Rescan → Quit, with continuous paced capture,
effective-voice/audio activity and confirmed unload-before-stop cleanup. Six model
generations complete across those two sessions; every STT stream receives that
session's selected language. The standalone real-recognizer sequence separately
proves subsequent voice use after failure and typed recovery.

Durable conversation identity is intentionally preserved across restart; ephemeral
owner authority is separately authenticated and revoked. The regression observes
the actual published capability-revocation event rather than assuming that the
socket-only stopping notification is also an EventBus event. These were test
assumptions corrected during development, not newly discovered runtime defects.
The existing default composed scenario remains compatible with the frontend harness.
No advanced agency/memory action, physical device or new acoustic processor is used.

## Current acceptance matrix — Consolidations I, II and III

This supersedes the remaining-work column of the Consolidation I matrix above;
earlier results remain historical evidence. Recorded 2026-10-01. No human beta,
model/voice download, new capability or production acoustic integration occurred.
Specialist evidence: [installed speech benchmark](SPEECH_BASELINE_2026-10-01.md),
[Windows filter probe](AEC_WINDOWS_FILTER_PROBE_2026-10-01.md) and the bounded
provider confirmation above. Generated voices are not the owner's microphone speech.
Consolidation III selectively updates provider/startup/Controls/text/cleanup evidence
below; [cold readiness evidence](COLD_PROVIDER_RECOVERY.md) preserves its exact timeline
and limits. Other II rows remain unchanged. No new human acceptance is claimed.

| Fundamental area | Deterministic / automated | Real runtime | Human acceptance | Remaining |
| --- | --- | --- | --- | --- |
| Startup | Cold timeout/late success, bounded retries, cancel/supersession and mounted owner UI | III cold preflight timed out, normal startup recovered without external intervention | Earlier beta only | Wider hosts; runtime backoff is deterministic evidence only |
| Provider discovery | Complete bounded CLI output; available/empty/timeout/failure/malformed; late epochs ignored | III installed Gemma discovered; Rescan retained exact route | No new acceptance | Broader provider/host compatibility; exact II CLI cause remains unknown |
| Model load/select | Retained desired intent; one exact load after late inventory; loading distinct from active | III Gemma became active automatically after endpoint confirmation | No new acceptance | Broader switching/failure timing across machines |
| Model unload | Post-operation inventory verification, safe ordering | III Sam-loaded Gemma confirmed absent on Quit | No new acceptance | Wider provider implementations |
| Provider shutdown/ownership | Owned/reused/unsupported/failing/idempotent cleanup | Existing server preserved; no external process killed | No new acceptance | Real Sam-started service stop unexercised |
| Text conversation | Terminality, failed-inventory route retention and typed recovery | III two complete owner-UI answers; same history survived Rescan | Earlier beta initially worked | Broader fault timing and physical overlap |
| Voice turn lifecycle | Continuous paced capture, language restart, failure → typed → later voice; cancellation identities isolated | Actual whisper.cpp and generated PCM pass; physical capture not used | Physical beta initially worked then failed | Device loss/restart, physical pacing and sustained overlap |
| STT configuration | Hard en/es versus auto reaches each actual stream | 36 installed base-model requests; explicit language makes one forced request | No new acceptance | No demonstrated wiring defect remains |
| STT quality | Corpus scoring / edge-word / endpoint helpers, deterministic level/noise/silence | en 7.95% WER / 6.68% CER; es 8.75% / 5.30%; forced and auto equal; all auto languages correct | User Spanish quality remains unaccepted | Actual accent/room speech; base-model errors; no model download justified here |
| TTS/persona | Preference/fallback/stale-generation protection | Actual en→es→en→es Hazel/Helena; first-PCM health matches adapter; missing preference falls back | Pleasantness/persona coherence unaccepted | Shared inventory gender is not proof of matching sound |
| Interruption/barge-in | Conservative pinned candidates, full assistant text and typed recovery preserved; IV-B known-delay separation passes, ownership/diversity fail | No production engine selected or early integration; public-stat readiness accepts hidden-delay echo | Physical beta failed | Timing/reference characterization, proven-engine ownership gate, then integration and physical double-talk |
| Voice reactivity | Actual scalar meters replay through reducer/freshness/motion/WebGL; zero/expiry/input separation | Actual TTS and paced input produce events; en/es body/light response measurable | Naturalness/perceptibility unaccepted | Physical playback/visual timing; no artistic tuning here |
| Orb/form | Existing high-tier geometry/normal/fixed-camera regressions retained | Isolated Chrome only | Revised form unaccepted | Perceptual softness; full-app/lower-power cost |
| Membrane | Existing lift/shared pigment/depth coverage preserved | Isolated Chrome only | Revised living skin unaccepted | Physical appearance/perceptual edge quality |
| Living Surface | Existing broad evolution and short-frame continuity preserved | Isolated Chrome only | Revised field unaccepted | Organic perception; representative full-app performance |
| Particles | Persisted amount maps to quality budget and rendered coverage | Controls/interaction browser verification | Older beta broadly acceptable | Current density/performance acceptance |
| Controls | Waiting inventory distinct from empty/error/loading; manual retry supersession; disconnected last-known | III Chrome cold startup case plus normal real owner-window lifecycle passed | Organization improved in older beta | Current discoverability/human readability; no redesign needed |
| Diagnostics | Existing hierarchy/layout/scroll retained | Narrow layout/Controls separation protected | Earlier beta useful; revised layout unaccepted | Live human readability; no telemetry redesign |
| Memory initialization | Real isolated stores reused across restart; ordinary runtime opens/closes | Normal II supervised state/memory initialization and cleanup | Outside this task | Advanced memory expansion parked |
| Shutdown | Retry/CLI cancellation reaps child; authority/task/store retirement; bounded cleanup | III Quit unloaded owned Gemma, preserved reused serving and exited zero | No new acceptance | Physical devices; real Sam-started server stop remains unexercised |

Endpoint evidence is separate from decoding accuracy: four actual VAD/paced cases
preserve first/last words and both sentences across a trimmed 250 ms pause, with
1.22–1.44 s endpoint wall time. Forced request median is approximately 1.19 s,
auto approximately 1.74–1.79 s. This is generated-input recognition/segmentation
evidence, not physical microphone or speaker latency. No parameter search/config
change was justified. The Windows filter preserves near-end speech but fails echo
suppression (best 0/40/80/160 ms cases 18.16/19.74/19.30/14.99 dB against >=20 dB).
This historical II result is superseded only for full-APM feasibility by
[IV-A evidence](AEC_FULL_APM_GATE_2026-10-07.md): a pinned standalone full M153
library and locally built ABI are usable. Fixed-delay echo rejection is much
stronger; processed output loses first-second near-end speech, while supported
linear output preserves speech but misses changed-delay recovery (19.53 dB
against >=20). Warm VAD discrimination passes but cold residual risk remains.
No production engine selection, runtime integration or physical acceptance follows.

[IV-B diagnosis](AEC_APM_DIAGNOSIS_2026-10-07.md) supersedes only the known-delay
linear recovery result: external alignment passes the original separation gate,
but public-stat readiness falsely accepts echo after a hidden delay change, and
two additional render spectra fail rejection. Neither output is selected.
No physical acceptance or runtime barge-in follows from the synthetic improvement.

**Freeze line:** the ordinary generated speech loop, persona selection and signal
connectivity now have real-backend evidence. Cold provider recovery has deterministic
and bounded real-runtime evidence; proven early acoustic ownership remains engineering
work. No substantial Agency/Memory/
browser/workspace/profile expansion until basic blockers are fixed or reduced to
explicit acceptance limitations. Later human questions remain: actual Spanish/
English accent/room transcription, pleasant voice identity, speaker→microphone
interruption/first-word preservation, Orb aesthetic quality and natural speech
response, living membrane/pigment and practical Controls/history usability.
Automated visual correctness is not human perceptual acceptance.

Consolidation II final focused gate: **195 Python tests**, **135 frontend tests
(11 files)**, TypeScript, Ruff lint/format (nine changed Python files), changed-file
Biome and `git diff --check` pass. Two final isolated Chrome cases pass for the
composed event/history/Controls journey and actual installed speech scalar replay.
The earlier eight presentation/interaction cases are not redundantly rerun here.
Native `/W4 /WX` compilation and two optional native contract tests passed; the
signal-separation experiment itself exits failure as intended. No native DSP is
loaded by production, no dependency version changed, and no human acceptance occurred.

Consolidation III final focused gate: **127 Python tests** (provider adapter/discovery,
runtime intent/retry/cancellation, first-run, router, local controls, supervisor,
SQLite lifetime, CLI and generation terminality), **89 frontend tests in seven files**,
TypeScript, Ruff lint/format for six changed Python files, changed-file Biome for
seven UI/test files and `git diff --check` pass. Two bounded Chrome cases passed:
new cold inventory recovery/Controls mount and the existing provider Rescan case.
Production frontend build passed; shipped trusted owner assets were refreshed.
No audio/model download, dependency change or human test occurred. One real installed
LM Studio/Gemma supervisor/owner-window session is documented separately; it proves
automatic activation, two answers, Rescan and owned-model unload, not real retry
backoff execution or Sam-owned server stop.
## Core Experience V current matrix

Recorded 2026-10-07. [Evidence and quantitative details](CORE_EXPERIENCE_V.md),
[future 5–10-minute beta script](CORE_EXPERIENCE_V_BETA_SCRIPT.md), and
[ordered basics-only tasks](ROADMAP.md#next-basic-experience-tasks--after-core-experience-v).
This matrix supersedes earlier remaining-work columns; no new human acceptance.

| Fundamental area | Deterministic / automated | Real runtime | Human acceptance | Remaining |
| --- | --- | --- | --- | --- |
| Startup | Authenticated supervisor/owner initialization, cold retries, mounted degraded UI | V normal supervisor/private window starts from cold preflight timeout | No new beta | Broader machines; source launcher still existing same supervisor |
| Provider discovery | Empty/failure/not-ready classification, epochs and retry/cancel retained | V inventory recovered and exact Gemma discovered without external intervention | No new beta | Broader provider/device compatibility |
| Model load/select | Requested/loading separate from confirmed active; composed exact reload | V Gemma load began 21:00:53, confirmed 21:02:17 | No new beta | Long installed-model loading cost, wider providers |
| Model unload/reload | Exact idle typed owner command, verified callback, desired intent, failures, dedup/stale guards; corrected Load button | V explicit-operation check was premature; not completed after UI correction. Quit unload confirmed | No new beta | One later corrected owner-UI unload/reload/Rescan session |
| Provider ownership/shutdown | Explicit model unload grants no service ownership; automatic cleanup conditional and bounded | V reused serving preserved; post-Quit endpoint reachable, no loaded models | No new beta | Sam-started service stop still not exercised; no desktop-app closure claim |
| Typed conversation | Recovery/terminality/correlation plus composed journey | V two owner-UI replies completed; 1.828/0.187 s model completion | Older beta only | Current full sequence after explicit reload |
| Ordinary voice | Paced sequential/mixed/failure/re-entry, idle en/es switch reaches next actual stream | Fresh actual whisper.cpp/base + generated continuous capture; no physical mic | Older beta contradicted old overlap behavior | Physical device/pacing/recovery |
| STT configuration | Persisted Auto/en/es control, invalid/mid-utterance rejection; no guessed status parsing | Actual backend hard en/es confirmation retained | No new beta | Other codes remain config-only; no quality claim from wiring |
| STT quality | Scoring/edge-word/endpoint helpers retained | Four fresh generated sentences zero WER/CER with edge words intact; larger prior baseline remains 7.95/8.75% WER | Owner accent/room unaccepted | Real owner speech/accent/noise, base model capacity |
| TTS/persona | Preferred/missing/stale selection tests, separate health | Fresh en→es→en→es Hazel/Helena, 1,079 meters, correct missing preference fallback; no playback | Pleasantness/coherence unaccepted | Gender inventory is not perceptual equivalence |
| Interruption | Explicit Stop speaking delivery-only; full generated text and typed recovery protected | No new room overlap; production AEC unchanged | Earlier beta failed prompt barge-in | All probes rejected; research parked pending timing/physical evidence |
| Voice embodiment | Fresh real scalars → reducer/input/motion/fixed WebGL; zero/silence/input-output distinction | Generated actual PCM, paced real VAD input, discarded output | Naturalness/perceptibility unaccepted | Physical audio/visual timing and owner perception |
| Orb/form | Geometry/normals/budgets and fixed high-tier body tests pass | Isolated Chrome, no new art edits | Revised softness/polygonality unaccepted | Representative full-app/low-power cost and human judgment |
| Membrane | Shared tint/depth/lift coverage, all tiers compile | High tier 3,317 changed body pixels / 765 lifted coverage samples | Revised skin/peels unaccepted | Perceived visibility/organic attachment |
| Living Surface/palette | Independent Flow persistence/migration, pointer gate, broad material change/adjacent continuity; zero Flow pixels identical | Fixed-camera Chrome material/local palette evidence | Organic evolution unaccepted | Current whole-composition impression; no global hue-cycle redesign |
| Particles | Amount changes visible deterministic share of 12/24/40 budgets; Controls interaction pass | Isolated browser renderer path | Old beta broadly liked particles | Current density/performance preference |
| Controls | Five tabs; persisted Flow/recognition, truthful load/unload states, disconnected last-known, gain/event guards | Isolated Chrome across ordinary/fullscreen/narrow; real V typed/status controls | Current discoverability unaccepted | One real explicit model-operation confirmation; no new shader knob cluster |
| History/layout | Commit-only roles, safe common Markdown, full answer/stopped metadata, independent scroll/autofollow; narrow Controls separated | Chrome wide/narrow + real V typed history | Revised layout unaccepted | Human readability and practical window composition |
| Diagnostics | Existing health-first hierarchy, subordinate details/events and independent wide scroll preserved | Wide/narrow Chrome checks | Earlier beta useful; repair unaccepted | Actual debugging readability |
| Memory/authority initialization | Actual isolated stores/auth/revocation/ordered retirement in simulator; advanced powers not exercised | V normal core initialized; later memory-specific assertion not reached in interrupted probe | Outside fundamentals session | Expansion remains parked |
| Shutdown | Composed idle reload then owner Quit, tasks/voice/store/owned cleanup retire, repeated close idempotent | V error cleanup Quit: model absent confirmed 21:02:21; core/supervisor stopped; reused service preserved | No new beta | Wider hardware failures; Sam-owned server-stop confirmation |

Final touched-system gate: **190 Python / 199 frontend tests**, TypeScript,
changed-file Ruff/format and Biome, production frontend build, `git diff --check`.
Seventeen distinct bounded Chrome cases passed, with focused reruns for two test
assumptions and the runtime-discovered Load invitation. No full browser matrix,
advanced Agency/Memory stress suite, personal PCM capture or new acoustic work.

**Freeze line:** no substantial new capability expansion. The immediate engineering
gap is corrected real idle model lifecycle confirmation, followed by representative
full-app cost/audio-device recovery. Human appearance/voice/recognition acceptance
is explicitly outstanding; the prepared beta is for a later owner-authorized day.
Prompt full-duplex interruption remains an unmet BASIC requirement with conservative
behavior, not a passing engine waiting to be wired. ROADMAP owns subsequent order.

## October 8 integration delta

[Detailed observations](CORE_INTEGRATION_0.2.4.md) and
[v0.2.4 release decision](RELEASE_READINESS_0.2.4.md) are authoritative for this update.
All unchanged fundamental rows retain V evidence; there is **no new human acceptance**.

| Fundamental area | Current automated / runtime evidence | Remaining |
| --- | --- | --- |
| Startup / exact route | Normal supervisor cold inventory recovery; core Gemma active after ~80 s load | Owner-window route observation after probe reload timed out; UI truth not confirmed in this session |
| Explicit unload/reload / Rescan / typed work | Existing exact lifecycle simulator + Chrome passes | October 8 session never reached explicit operations/text/Rescan; real gate remains open |
| Quit / ownership | Authenticated UI Quit, confirmed Sam-loaded model absent, reused service preserved | Sam-owned service-stop and wider hosts remain untested |
| Rendering / reactivity | Mounted Chrome Low/Medium/High cadence, en/es scalar next-draw scheduling, zero/Reduced Motion; fixed WebGL magnitude regression passes | No current full-app inference/GPU/low-power/thermal sample; scheduling is not perceived latency/aesthetic acceptance |
| Speech/device mechanics / Stop | Actual generated Hazel/Helena synthesis closes; default capture opened inactive/unread; silence-only output closes; failure/re-entry/full-text Stop regressions pass | Physical loss/replug, audible-stop timing, owner accent and persona pleasantness |
| Authority / memory / installation | Current contracts reviewed; normal core initialized; existing store/rotation/recovery evidence retained | Native smoke's unauthenticated assumption is stale; current package resources/notices and installed/upgrade data preservation need candidate validation |

This assessment adds 33 focused Python checks and three targeted Chrome cases,
TypeScript/Biome and unchanged-version checks. It does not repeat V's full gate.
No product/art/dependency change is inferred from a failed probe or numerical motion.
Beta preparation remains appropriate; actual scarce owner session follows the open
runtime gate. Public native signing/security and candidate checks remain separate.
