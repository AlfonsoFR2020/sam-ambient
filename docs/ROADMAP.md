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
The acoustic prototype failed its integration gate. Prompt barge-in still requires
a proven processor; it does not block improvements to the ordinary voice loop.
The ordered basic-experience cards below supersede the former expansion queue.
See [owner authority](OWNER_AUTHORITY.md) for the first agency checkpoint.

This is the **authoritative execution order**, not a promise that every later capability belongs in v0.2.4. [STATE](STATE.md) records implemented truth; [BACKLOG](BACKLOG.md) retains unresolved items; [ARCHITECTURE](ARCHITECTURE.md) and [DECISIONS](DECISIONS.md) contain current contracts. The [physical beta record](POST_0.2.3_BETA_PLAN.md) remains primary product evidence. Specialist sources: [AEC decision](AEC_DOUBLE_TALK_CONTRACT.md), [trust review](TRUST_BOUNDARIES.md), [dependency triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md), [visual direction](VISUAL_DIRECTION.md) and [isolated performance sample](VISUAL_PERFORMANCE_0.2.3_DEV.md). The [published v0.2.3 release scope](RELEASE_READINESS_0.2.3.md) is historical; this plan changes neither it nor its tag.

The last physical beta preceded the recent dev repairs. Its simultaneous playback/listening failure and perception of an insufficiently living Orb remain valid observations. Deterministic lifecycle and renderer checks established corrected properties; **they did not establish physical acoustic reliability or human visual acceptance**. No human beta is available now.

## Reconciled baseline

Post-release dev has repaired unsafe promotion of playback-time interruption candidates, pinned the echo-screening generation, retired superseded generations before new typed turns, and protected frontend command correlation. History now presents committed messages with separate delivery metadata and independent scrolling. Provider exit cleanup follows explicit ownership, Controls inventory is intact, and wide-screen diagnostics does not cover conversation. Measured input/output audio maps to distinct bounded Orb responses; high-tier form/membrane and broad pigment evolution were revised. Isolated WebGL cost was measured, not full-app cost. A prepared Windows source checkout has a one-action launcher. The trust review fixed authenticated-provider error-body disclosure and insecure cloud endpoint configuration. The AEC contract/prototype remains negative evidence, not runtime acoustic processing; Vite 7.3.5 / Vitest 4.1.11 advisory maintenance is complete. See [STATE](STATE.md) for exact behavior.

## Dependency-aware workstreams

### Conversation and voice foundation

**Current:** separate bounded capture, STT, synthesis and playback lifetimes; health, cancellation and turn-local route identity; conservative candidate screening and typed recovery after supersession. **Unmet requirement:** Sam cannot acoustically prove human origin during speaker output or reliably stop delivery after roughly one second of genuine overlapping speech. This blocks prompt barge-in and contaminates interpretation of STT errors. The [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md) prefers a bounded reverse-render/near-end interface and a WebRTC Audio Processing feasibility prototype. Native binding, format conversion, timing/drift and double-talk are high uncertainty. Split prototype, runtime integration and short physical validation. Synthetic echo/double-talk and lifecycle tests precede real hardware; human beta waits for a larger integrated state.

Explicit recognition language now reaches whisper.cpp without automatic-language
retry; default auto and preferred-language fallback remain separate. Installed
System.Speech selection now favors a consistent cross-language persona, honors an
explicit voice and reports unavoidable mismatch. Actual en/es PCM synthesis passed
without playback. Clean attributed clips can evaluate recognition before AEC;
playback-contaminated microphone recognition must still wait for source separation.
Neither a Whisper replacement nor new TTS engine is presumed. Ordinary voice,
terminality and typed recovery pass the composed simulator. The exact historical
five-minute no-response episode remains unproven; physical timing is not inferred.

### Security and authority

**Current:** private-pipe owner bootstrap and fresh mutual connection proofs protect all private core events/commands; typed registry/policy/approval/epoch mediates manual and model actions. Replay, revocation, path, memory and injection fixtures pass. Origin is supplemental, not authority. Existing LM Studio/Gemma structured read and cancellation passed through the owner window. **Remaining:** host-account memory/code compromise is outside this boundary; powerful mutations need deliberate exact approval and policy. Native launch/bundled Playwright-driver packaging and external-site/TLS compatibility remain unverified. Pages never receive the owner signer. See [trust review](TRUST_BOUNDARIES.md) and [agency evidence](AGENCY_FOUNDATION_I.md).

The [advisory triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md) found duplicate GitHub records. Vite 7.1.5 has high-severity dev-server file-read findings; Vitest 3.2.4 has a critical finding conditioned on a listening Vitest UI server. These are **development-toolchain exposures**, not demonstrated public Windows runtime vulnerabilities. Resolved on dev with Vite 7.3.5 and Vitest/mocker 4.1.11 before this agency pass; retain separate deferred advisory work. Pytest 8.4.2, setuptools 82.0.1 and Rust GLib 0.18.5 belong to test/build/Linux-native follow-up. Future API credentials need trusted storage and redaction, never route identity, transcripts or diagnostics.

### Provider and local-control architecture

**Current:** correlated discovery/Rescan and transport epochs; immutable turn-local provider/model; exact typed switch and Stop speaking; no silent provider fallback; typed post-final-STT control seam. Configured-but-unavailable models no longer appear active in startup snapshots. Real supervised LM Studio/Gemma load, three text turns, Rescan and confirmed Sam-owned unload pass; external serving is preserved. **Unmet:** physical device/provider failure timing and broader real multi-provider recovery. Named profiles, atomic profile + provider + model switching and natural-language controls are parked expansion. Keep active route pinning and credential boundaries when those resume.

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

## Next basic-experience tasks

These supersede the previous expansion queue. Each task is bounded and contributes
engineering evidence to the acceptance matrix; none requests a human session now.
Completed dependency/authority/memory foundations remain indexed above, not open cards.

### 1. Real local STT language and endpoint evidence

- **Objective / why next:** measure ordinary English/Spanish recognition using the
  installed base model now that forced-language wiring is correct. Poor recognition
  impaired the beta even outside interruption; clean attributed audio can be tested
  without pretending speaker leakage is solved.
- **Prerequisites:** existing whisper.cpp/model, explicit-language contract and small
  non-personal speech fixtures with lawful provenance, or installed TTS-generated speech.
- **Scope:** forced/automatic language, controlled level/noise/silence and endpoint
  timing; minimal demonstrated configuration fixes. **Non-scope:** model downloads,
  a broad parameter search, AEC or claims about the owner's accent from synthetic voices.
- **Deliverable / validation:** reproducible WER/CER/language/edge-word and latency
  evidence, separating recognizer quality from segmentation. Nearby voice/typed recovery.
- **Reasoning / quota:** Sol Medium, High for demonstrated lifecycle ownership trouble;
  medium. Stop if fixtures/backend are unavailable or a model comparison is required.
  **Human acceptance:** later user speech/accent/environment, not this task.

### 2. Speech timing and representative full-app performance

- **Objective / why after 1:** check real generated PCM, metering/delivery and Orb
  timing with stable ordinary language input before pursuing acoustic concurrency.
- **Prerequisites:** current signal-to-WebGL regressions, installed voices and the
  isolated performance baseline. Real-device use requires a separately bounded scope.
- **Scope:** generated English/Spanish PCM → normal meters → visual state; full-app
  and available lower-tier cost, silence/cancellation, reduced motion/Canvas.
  **Non-scope:** artistic tuning, new sliders, subjective voice claims or a speed benchmark.
- **Deliverable / validation:** measured timing/cost with CPU/frame/GPU distinctions;
  synthetic browser and existing interaction regressions; fixes only for broken paths.
- **Reasoning / quota:** Sol Medium; medium. Stop on missing hardware/timers; report
  limitations. **Human acceptance:** later speech pleasantness and natural embodied timing.

### 3. Pinned upstream APM feasibility and falsifying processor probe

- **Objective / why after ordinary paths:** prompt full-duplex interruption is a basic
  requirement, but needs a proven processor rather than raw VAD or a lower threshold.
- **Prerequisites:** [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md), the preserved
  [failed extraction probe](AEC_PROTOTYPE_2026-09-30.md), license/build provenance.
- **Scope:** one maintainable full WebRTC APM boundary first, Windows-native path only
  if that is unsuitable. Replay echo/noise/double-talk/delay/reset fixtures and unchanged
  gates. **Non-scope:** production integration, large WebRTC fork or DSP catalogue.
- **Deliverable / validation:** binary pass/fail, near-end preservation/convergence,
  real-time cost and bounded memory/build implications. No physical success inferred.
- **Reasoning / quota:** Sol High; medium with an independent evidence commit. Stop
  if the native subsystem becomes invasive or licensing/build maintenance is unclear.
  **Human acceptance:** none; failure remains useful evidence and blocks task 4.

### 4. Proven acoustic boundary and delivery-only early barge-in

- **Objective / why after 3:** stop speech promptly from sustained processed near-end
  evidence while preserving the full assistant answer and the user's first syllable.
- **Prerequisites:** processor passes task 3; existing identity/candidate/terminality rules.
- **Scope:** bounded post-gain render alignment, processed capture, VAD/STT pre-roll,
  candidate evidence and conservative failure fallback. **Non-scope:** STT replacement,
  route redesign, VAD-only timer or new user-visible settings.
- **Deliverable / validation:** checkpointed processor ownership then interruption
  integration; echo-only/noise/human-overlap/end-of-playback/reset/late-event/typed
  recovery cases with onset-to-cancellation latency. Target roughly one second.
- **Reasoning / quota:** Sol High; large, mandatory independent green checkpoints.
  Stop on false echo-only interruption or unmet near-end gate; keep conservative runtime.
  **Human acceptance:** later real speaker/microphone double-talk, not synthetic acceptance.

### 5. Bounded physical recovery and integrated acceptance preparation

- **Objective / why last:** validate the composed basic experience against device and
  provider timing after ordinary recognition and acoustic processing are coherent.
- **Prerequisites:** tasks 1–4 pass or are explicitly limited; authorized installed
  hardware/provider window. Human beta remains unavailable until separately scheduled.
- **Scope:** current LM Studio route, actual audio failure/restart, interleaved voice/text,
  confirmed conditional cleanup and available full-app cost. Use non-personal fixtures
  where possible. **Non-scope:** new capabilities, model/voice downloads or repeated tuning.
- **Deliverable / validation:** correlated runtime results and precise remaining human
  questions; minimal regressions for reproduced defects, same basic simulator/Controls gate.
- **Reasoning / quota:** Sol Medium; medium, High only for a reproduced ownership race.
  Stop on unsafe false interruption or unrecoverable text state. **Human acceptance:**
  prepares a substantial later integrated session; does not request one immediately.

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
