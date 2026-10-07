# Sam development plan: post-v0.2.3 toward v0.2.4

**HQ priority change (2026-10-01): Basics Before Expansion.**
The current [core-experience acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md)
owns the next milestone: ordinary voice, truthful model lifecycle, stable installed
persona, connected embodiment, complete Controls and clean startup/shutdown.
The completed agency/memory foundations remain assets; new powers are parked.
The previous 2026-09-30 agency priority is superseded, not erased from history.
Owner authentication, typed bounded capabilities, read-only console/public-page
browser slices, model mediation and the adversarial simulator are implemented on
development HEAD. See [agency evidence](AGENCY_FOUNDATION_I.md).
**Memory Foundation I completed (2026-10-01):** local durable store, owner CRUD,
review/provenance, bounded lexical retrieval/context, typed proposals and restart/
privacy/recovery simulation are implemented; [memory evidence](MEMORY_FOUNDATION_I.md).
An existing LM Studio/Gemma owner-window structured workspace read, inert returned
instructions and cancellation passed. No human memory/visual/audio acceptance is claimed.
The acoustic probes, including full M153 APM, fail their integration gate. Prompt barge-in requires
a proven processor; it does not block improvements to the ordinary voice loop.
The ordered basic-experience cards below supersede the former expansion queue.
See [owner authority](OWNER_AUTHORITY.md) for the first agency checkpoint.

This is the **authoritative execution order**, not a promise that every later capability belongs in v0.2.4. [STATE](STATE.md) records implemented truth; [BACKLOG](BACKLOG.md) retains unresolved items; [ARCHITECTURE](ARCHITECTURE.md) and [DECISIONS](DECISIONS.md) contain current contracts. The [physical beta record](POST_0.2.3_BETA_PLAN.md) remains primary product evidence. Specialist sources: [AEC decision](AEC_DOUBLE_TALK_CONTRACT.md), [trust review](TRUST_BOUNDARIES.md), [dependency triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md), [visual direction](VISUAL_DIRECTION.md) and [isolated performance sample](VISUAL_PERFORMANCE_0.2.3_DEV.md). The [published v0.2.3 release scope](RELEASE_READINESS_0.2.3.md) is historical; this plan changes neither it nor its tag.

The last physical beta preceded the recent dev repairs. Its simultaneous playback/listening failure and perception of an insufficiently living Orb remain valid observations. Deterministic lifecycle and renderer checks established corrected properties; **they did not establish physical acoustic reliability or human visual acceptance**. No human beta is available now.

## Reconciled baseline

Post-release dev has repaired unsafe promotion of playback-time interruption candidates, pinned the echo-screening generation, retired superseded generations before new typed turns, and protected frontend command correlation. History now presents committed messages with separate delivery metadata and independent scrolling. Provider exit cleanup follows explicit ownership, Controls inventory is intact, and wide-screen diagnostics does not cover conversation. Measured input/output audio maps to distinct bounded Orb responses; high-tier form/membrane and broad pigment evolution were revised. Isolated WebGL cost was measured, not full-app cost. A prepared Windows source checkout has a one-action launcher. The trust review fixed authenticated-provider error-body disclosure and insecure cloud endpoint configuration. The AEC contract/prototype remains negative evidence, not runtime acoustic processing; Vite 7.3.5 / Vitest 4.1.11 advisory maintenance is complete. See [STATE](STATE.md) for exact behavior.

## Dependency-aware workstreams

### Conversation and voice foundation

**Current:** separate bounded capture, STT, synthesis and playback lifetimes; health, cancellation and turn-local route identity; conservative candidate screening and typed recovery after supersession. **Unmet requirement:** Sam cannot acoustically prove human origin during speaker output or reliably stop delivery after roughly one second of genuine overlapping speech. This blocks prompt barge-in and contaminates interpretation of STT errors. The [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md) retains the bounded reverse-render/near-end seam. All attempted processors failed ownership/diversity; research is parked pending meaningful Windows timing/physical-reference evidence, not another synthetic parameter sweep. Preserve conservative interruption and typed recovery while completing everyday fundamentals.

Explicit recognition language now reaches whisper.cpp without automatic-language
retry; default auto and preferred-language fallback remain separate. Installed
System.Speech selection now favors a consistent cross-language persona, honors an
explicit voice and reports unavoidable mismatch. Actual en/es PCM synthesis passed
without playback. The [installed speech baseline](SPEECH_BASELINE_2026-10-01.md)
now establishes actual forced/auto decoding, paced endpoints, bilingual sequential
recovery, persona switching and actual meters → fixed-WebGL response. Its generated
speech WER is 7.95% English / 8.75% Spanish, with all auto languages correct;
playback-contaminated microphone recognition must still wait for source separation.
Neither a Whisper replacement nor new TTS engine is presumed. Ordinary voice,
terminality and typed recovery pass the composed simulator. The exact historical
five-minute no-response episode remains unproven; physical timing is not inferred.

### Security and authority

**Current:** private-pipe owner bootstrap and fresh mutual connection proofs protect all private core events/commands; typed registry/policy/approval/epoch mediates manual and model actions. Replay, revocation, path, memory and injection fixtures pass. Origin is supplemental, not authority. Existing LM Studio/Gemma structured read and cancellation passed through the owner window. **Remaining:** host-account memory/code compromise is outside this boundary; powerful mutations need deliberate exact approval and policy. Native launch/bundled Playwright-driver packaging and external-site/TLS compatibility remain unverified. Pages never receive the owner signer. See [trust review](TRUST_BOUNDARIES.md) and [agency evidence](AGENCY_FOUNDATION_I.md).

The [advisory triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md) found duplicate GitHub records. Vite 7.1.5 has high-severity dev-server file-read findings; Vitest 3.2.4 has a critical finding conditioned on a listening Vitest UI server. These are **development-toolchain exposures**, not demonstrated public Windows runtime vulnerabilities. Resolved on dev with Vite 7.3.5 and Vitest/mocker 4.1.11 before this agency pass; retain separate deferred advisory work. Pytest 8.4.2, setuptools 82.0.1 and Rust GLib 0.18.5 belong to test/build/Linux-native follow-up. Future API credentials need trusted storage and redaction, never route identity, transcripts or diagnostics.

### Provider and local-control architecture

**Current:** correlated discovery/Rescan and transport epochs; immutable turn-local provider/model; exact typed switch and Stop speaking; no silent provider fallback; typed post-final-STT control seam. Configured-but-unavailable models no longer appear active in startup snapshots. Real supervised LM Studio/Gemma load, three text turns, Rescan and confirmed Sam-owned unload pass; external serving is preserved. **Unmet:** physical device/provider failure timing and broader real multi-provider recovery. Named profiles, atomic profile + provider + model switching and natural-language controls are parked expansion. Keep active route pinning and credential boundaries when those resume.

Consolidation III completes [cold readiness/recovery](COLD_PROVIDER_RECOVERY.md):
CLI failure/timeout/malformed output is distinct from successful empty inventory;
four bounded transient attempts retain exact intent and reject stale results.
The real preflight timed out, then normal startup automatically activated Gemma,
completed two text turns and Rescan, and confirmed Sam-loaded unload on Quit.
Serving was already ready at bootstrap and preserved. Runtime backoff is proven
deterministically, not exercised by that real session. Wider hosts and Sam-started
server-stop confirmation remain open; see the [evidence matrix](CORE_EXPERIENCE_ACCEPTANCE.md).

### Memory and intelligence

**Current:** [Memory Foundation I](MEMORY_FOUNDATION_I.md) separates app-data SQLite
memory from committed conversation history. A stable single-owner principal and
revisioned provenance/review support owner inspection, correction and real content
deletion. Only reviewed Personal/current-workspace claims enter selective lexical
recall: at most six complete entries / 4,800 characters as distinct local context.
Model proposals require exact tool approval to become unreviewed, then separate
owner review; model/page content cannot become authority. Cloud routes receive no
memory. Tests exercise actual store/auth/commands, restart/rotation, selective recall,
correction/delete, hostile page provenance, rollback and degraded-store text recovery.
No new dependency, vector database, raw transcript import or automatic learning.

**Unmet:** real-model memory usefulness and human recall/privacy/approval acceptance;
paraphrase/semantic ranking, explicit cloud-export/retention extensions and per-person
attribution/consent. These are distinct follow-ups, not reasons to reopen completed
CRUD. The future retriever interface preserves owner/review/scope/route/budgets before
any semantic index. Measure a lexical limitation before choosing embeddings. Multi-user
memory depends on reliable attribution and consent, not merely a diarizer label.
NVIDIA Nemotron 3 Diarization (about 100M parameters, 16 kHz mono, up to eight speakers,
streaming speaker cache/FIFO) remains a research direction, **not AEC or authentication**;
runtime/GPU/dependency/license suitability requires evaluation before adoption.

### Console, browser and tools

**Current:** authenticated owner Console supports bounded workspace list/read/system info; separate public-page browser supports navigate/read/close with scripts disabled and pinned public-IP egress. Structured provider tools share the same policy, exact approvals, result bounds, cancellation and repeated-call limits. The integrated simulator rejects injected commands and proves typed recovery. A bounded real installed-model workspace-read workflow passed. **Unmet:** practical approved workspace changes, broader real-provider/browser compatibility and richer browser interactions. They matter to Sam as a computer interface but can expose host authority to prompt injection. Add one contained ability at a time through the trusted registry/policy/approval/epoch path. A page, model response, retrieved file, memory or tool output remains data, never a control command. Threat-model and contained browser/runtime tests are mandatory. Streamable HTTP MCP, delegation, Linux desktop control and self-maintenance remain conditional later directions.

### Embodiment and interface

**Current:** autonomous Living Surface, related membrane/lighting/particles, source-specific measured audio response, tiered quality, Canvas/reduced-motion fallback and usable Controls/history/diagnostics. **Unmet:** the *revised* voice response and visual composition have no human perceptual acceptance. The earlier beta found static-feeling pigment, polygonal membrane/form and no useful audio response before the revisions. The isolated desktop high-tier GPU draw was near 1.8 ms; sustained full-app model contention, low-power hardware, native composition and audio latency are unmeasured. A bounded integrated performance/accessibility pass precedes scarce human viewing. Turn specific later observations into art tasks; do not tune blindly. Tests protect bounded motion/fallback/cost, while human acceptance decides whether it feels alive. Themes, wider palette and richer status UI are later.

### Distribution and productization

**Current:** prepared-checkout Windows launch is one action; v0.2.3 wheel/sdist are public; unsigned Windows development installer is withheld. Supervisor/update authority remains distinct from conversation with staged activation/rollback contracts. **Unmet:** signed, reputation-tested, clean-host public Windows installation and owner-controlled update/release. Signing identity and security-software response need owner/security decisions; do not invent a workaround. This blocks a non-developer distribution claim, not the AEC prototype. Split signing prerequisites, clean-host package test and publication. Linux/mobile distribution remain later tracks.

## Next basic-experience tasks — after Core Experience V

[Core Experience V](CORE_EXPERIENCE_V.md) completes persisted Surface Flow, idle
recognition mode, typed idle model unload/reload, narrow Controls/history separation,
fresh installed speech→WebGL evidence and the composed everyday simulator.
Automated visual behavior is not human acceptance. The one real V session passed
cold activation/two text turns/owned-model Quit cleanup, but stopped before explicit
unload/reload/Rescan confirmation because the probe observed an already-visible
Load button. That invitation is corrected and browser-proven; do not label its
real verification complete. This queue supersedes the prior synthetic-acoustic
sequence and is ordered by owner value and available evidence.

### 1. Confirm corrected ordinary model lifecycle in one real owner session

- **Objective / why first:** close the remaining V runtime evidence gap for an
  everyday control the owner can now use, without more architecture or UI design.
- **Prerequisites:** corrected Load-button condition, fake exact unload/reload tests,
  shipped current assets, existing LM Studio/Gemma and separately authorized session.
- **Scope:** wait for core-confirmed unloaded state/enabled Load choice, verify actual
  inventory absence, reload exact model, two short text turns, Rescan, clean Quit and
  external ownership. Record initial resource ownership and terminal states.
- **Non-scope:** audio tuning, repeated cold launches, profiles, downloads, capability
  expansion. If no installed environment is available, record the limit and stop.
- **Deliverable / validation:** concise timestamped outcome, true provider state,
  minimal regression only for a reproduced defect. No human speech or aesthetic test.
- **Reasoning / quota:** Sol Medium; small, one clean checkpoint. Escalate to High only
  for an actual stale-operation/concurrency fault; stop rather than widening scope.
- **Human checkpoint contribution:** closes model-operation readiness before the
  later integrated beta. It comes before cost measurement because false lifecycle
  readiness would invalidate that normal full-app workload.

### 2. Representative full-app speech/visual timing and low-power budget

- **Objective / why next:** ensure the now-connected living composition remains
  usable alongside local inference rather than optimizing isolated screenshots.
- **Prerequisites:** task 1 or an explicit provider limitation; current fixed-WebGL
  properties and isolated performance evidence; bounded installed-runtime access.
- **Scope:** warm-up then observe CPU submission/frame interval and available GPU
  timing honestly; low/medium/high, speech envelopes, Reduced Motion and fallback.
  Measure actual level-to-visible-update timing; optimize only a demonstrated cost.
- **Non-scope:** new art direction, reduced quality to flatter a benchmark, hardware
  installation, provider/voice/model downloads or arbitrary FPS CI thresholds.
- **Deliverable / validation:** representative resource/timing evidence and relative
  budget invariants; preserve interaction, material and envelope checks if changed.
- **Reasoning / quota:** Sol Medium; medium, checkpoint evidence before any fix. Stop
  on unavailable timers/hardware; High only for a demonstrated scheduling root cause.
- **Human contribution / order:** prepares perceptibility/latency questions before
  physical-device recovery; no aesthetic acceptance inferred from timing metrics.

### 3. Bounded Windows audio-device recovery and explicit Stop speaking

- **Objective / why next:** ordinary device start/restart and owner-clicked silence
  must be dependable independently of the unsolved acoustic overlap requirement.
- **Prerequisites:** current paced pipeline/persona tests, authorized installed-device
  window, task 2 cost limits or explicit measurement limitations.
- **Scope:** capture mute/re-enable, unavailable/default-device recovery, output stop,
  English/Spanish mode switching, STT failure→typed recovery, resource retirement.
  Non-personal generated PCM where possible; no owner recording requested.
- **Non-scope:** AEC tuning, larger Whisper/voice installation, raw audio logging,
  source separation or a repeated physical tuning loop.
- **Deliverable / validation:** bounded real-device outcome and narrow reproduced
  lifecycle regressions; complete assistant text and text recovery remain invariant.
- **Reasoning / quota:** Sol Medium; medium, High only for a reproduced lifetime race.
  Stop on unavailable/intrusive hardware, unsafe self-interruption or lost recovery.
- **Human contribution / order:** verifies device mechanics before consuming scarce
  owner time on qualitative speech/embodiment acceptance.

### 4. Later integrated 5–10-minute human beta, only when owner is available

- **Objective / why later:** obtain the missing evidence machines cannot supply:
  owner-accent recognition, pleasant/persona-coherent speech and living visual feel.
- **Prerequisites:** tasks 1–3 green or truthfully limited, the current acceptance
  matrix, and separate owner authorization/availability. No human testing is possible now.
- **Scope / deliverable:** [prepared script](CORE_EXPERIENCE_V_BETA_SCRIPT.md), compact
  acceptable/distracting/broken observations with timestamps and at most three
  concrete priorities. Include history, Controls, model operations and conservative
  interruption as an explicitly limited baseline.
- **Non-scope:** new feature demonstration, compulsive acoustic repeats or artistic
  tuning during the session. Stop on discomfort or loss of typed recovery.
- **Validation / reasoning / quota:** direct human observations, Sol Medium for the
  preparation/reconciliation; tiny. This is the actual human acceptance checkpoint.
- **Order:** qualitative correction should follow this evidence rather than guessed
  gain/palette/membrane changes based solely on automated pixels.

### 5. Correct the highest-impact basic defect established by that evidence

- **Objective / why conditional:** improve owner satisfaction from a reproduced
  remaining fundamental, one issue per task instead of another omnibus polish pass.
- **Prerequisites:** a concrete engineering or later beta finding, bounded reproduction
  and an unchanged safety/performance contract. Split unrelated findings first.
- **Scope:** only the selected basic failure; document expected visible/voice behavior.
- **Non-scope:** Agency/Memory/browser expansion, speculative redesign, unrelated
  settings, dependency modernization. No acoustic tuning without the evidence below.
- **Deliverable / validation:** failing regression then coherent fix, relevant browser
  or installed-runtime check; human aesthetic claims wait for later review.
- **Reasoning / quota:** Sol Medium; small/medium, High for demonstrated concurrency
  or cross-layer root cause. Stop if a new architecture would dominate; commit useful
  evidence and split. Contributes to the next integrated acceptance checkpoint.

### Parked acoustic re-entry contract

Prompt full-duplex interruption remains a BASIC unmet requirement, not a completed
feature. It is **not** the next synthetic tuning task. Preserve the extraction,
Windows filter, full-APM and IV-B ownership/diversity negative results. Re-entry
requires meaningful Windows render/capture clock, delay/reference validity or
physical-reference evidence under a separately bounded authorization. Only then
falsify a maintainable engine against unchanged separation/ownership gates; a pass
would precede runtime delivery-only barge-in integration and later room acceptance.
Acoustic evidence may stop TTS; only normal STT/TurnManager semantics commit text.
No raw-RMS shortcut or lowering gates. See [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md)
and [IV-B evidence](AEC_APM_DIAGNOSIS_2026-10-07.md).

## Meaningful v0.2.4 integrated checkpoint

v0.2.4 should consolidate the existing fundamentals: normal startup, truthful exact
model discovery/load/Rescan, reliable interleaved voice/text with typed recovery,
clean committed history, deliberate installed voice persona, bounded perceptible
speech embodiment, coherent current Orb/membrane/surface/particles, complete Controls,
useful diagnostics and ownership-correct confirmed cleanup. Agency and Memory remain
implemented assets with safe initialization/closure, not this milestone's expansion.

Automated evidence includes the composed owner/runtime/voice/output/frontend path,
configuration and retirement regressions, signal-to-fixed-WebGL measurements, authority
initialization, isolated memory initialization and bounded cleanup. Real evidence must
include current provider lifecycle, installed synthesis/STT and device/recovery timing;
synthetic recognition and DSP results never substitute for real-room ownership.
A credible prompt-interruption claim requires a passing processor and physical acoustic
evidence. Otherwise voice remains explicitly limited, rather than declaring barge-in solved.

**Explicitly parked:** workspace mutation, arbitrary shell, browser expansion, more
memory sophistication/vectors, profiles/hot-swapping, multi-user/diarization, public
installer/signing and new visual art direction. Preserve security/provenance contracts;
model, page, memory and transcript content never become owner authority.

**Next scarce human beta:** only a substantial integrated state with the ordinary loop,
voice selection, current revised visuals, Controls and shutdown already technically
verified, and acoustic ownership either physically supported or explicitly constrained.
Assess the owner's actual Spanish/English recognition, voice identity/pleasantness,
interruption/first-word preservation, natural visible speech response, soft form/skin,
living pigment and practical conversation usability together. No human test is available
now. Automated visual correctness is not human perceptual acceptance.

## HQ quota and execution practice

| Task class | Reasoning and runtime default | Quota/checkpoint rule |
| --- | --- | --- |
| Tiny/small inventory, docs, compatible lockfile or focused UI | Sol Medium; static/focused tests, browser only for presentation | One coherent commit, no broad suite. Escalate on concrete cross-boundary findings. |
| Medium bounded adapter, protocol or integration | Sol Medium; fake tests first, purpose-specific browser/real runtime only if scoped | Commit at independently green boundaries; stop before unrelated work. |
| Large/high-risk DSP timing, turn concurrency or owner authentication | Sol High for demonstrated architecture/race risk; synthetic fixtures before physical runs | Mandatory checkpoint commits and failure/fallback criteria. Do not start near quota exhaustion. |

Separate environment/tooling burn from productive engineering. Record first-pass yield and the cost of corrective follow-up for each checkpoint; use those observations to size later tasks. Do not run Sam, models or browser repeatedly as an exploratory loop. Record automated correctness, representative runtime behavior and scarce human perceptual acceptance as different evidence. When GPT-6.1 Sol appears, calibrate Medium and High empirically against the established Sol workflow rather than assuming benchmark scores predict this account's quota cost. No calendar or numeric future quota promise is inferred here.
