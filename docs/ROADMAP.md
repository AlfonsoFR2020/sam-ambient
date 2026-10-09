# Sam development plan: post-v0.2.3 toward v0.2.4

**HQ priority change (2026-10-01): Basics Before Expansion.**
The current [release-readiness decision](RELEASE_READINESS_0.2.4.md) and
[core-experience acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md)
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

The owner completed a new physical beta October 9. [Full triage](BETA_TRIAGE_2026-10-09.md)
records spurious turns, intermittent stalls, literal spoken Markdown, source-window
security/presentation defects and failed visual/embodiment judgments. Bounded repairs
do not close all integrity reports. **Deterministic visual behavior is not human
acceptance.** No additional human beta is available now. HQ authorizes proportionate
alpha acceptance; current native build-host failure blocks installer completion.

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

**Current:** autonomous Living Surface, membrane/lighting/particles and source-specific
audio response have deterministic evidence. October 9 owner assessment still found
polygonal/dull body, absent peels and detached response despite noticing dynamism.
These are failed judgments, not missing beta scheduling. A short real-inference
submission-cadence sample exists; sustained/low-power/native/GPU/visible audio latency
remains limited. Later evidence-led visual work may address those observations;
no shader tuning or new visual identity belongs in this closure. Themes remain later.

### Distribution and productization

**Current:** prepared-checkout Windows launch is one action; v0.2.3 wheel/sdist are public; unsigned Windows development installer is withheld. Supervisor/update authority remains distinct from conversation with staged activation/rollback contracts. **Unmet:** signed, reputation-tested, clean-host public Windows installation and owner-controlled update/release. Signing identity and security-software response need owner/security decisions; do not invent a workaround. This blocks a non-developer distribution claim, not the AEC prototype. Split signing prerequisites, clean-host package test and publication. Linux/mobile distribution remain later tracks.

## Next basic-experience tasks — after Core Experience V

**October 9 source-release policy:** v0.2.4 closes as an experimental wheel/sdist
pre-release after exact-commit hosted source/package gates. Native build failure is
separate; unsigned Windows artifacts remain withheld. No additional feature work
is part of release closure. [Readiness](RELEASE_READINESS_0.2.4.md) owns disposition.

### Next-cycle handoff (not started)

1. **Diagnostic launch contract** — Medium / small. Preserve the default convenient
   one-action launch. Diagnostic mode keeps its console open and writes bounded,
   useful timings/terminal/ownership evidence. Explicit temporary flags may retain
   the selected model or provider on exit without changing persisted defaults.
   Never expose credentials, owner proofs, unnecessary conversation text or raw
   private audio. Cleanup remains safe, ownership-aware and truthful. Define the
   concrete interface before implementation; do not weaken owner authentication.
2. **Intermittent latency and false speech turns** — Medium initially, High only for
   demonstrated cross-lifetime ownership. Use those diagnostics and paced mixed
   typed/voice/playback sequences; reproduce before changing product behavior.
   Preserve legitimate short speech and typed recovery, avoid arbitrary timeout
   resets. These remain the highest reliability concerns, not claimed solved.
3. **Major multilingual STT replacement** — dedicated scoped evaluation/implementation,
   not an incidental release dependency. Owner speech quality is still inadequate;
   separate language/endpoint/model capacity and future physical acceptance.
4. **Orb/membrane/palette and voice embodiment** — dedicated artistic/technical pass
   grounded in October 9 owner rejection. Automated motion is not aesthetic acceptance;
   do not continue synthetic AEC or speculative shader tuning during closure.
5. **Windows native packaging/Cargo** — separate bounded host/toolchain diagnosis,
   then authenticated installed/upgrade data checks and signing/reputation policy.
   Never bypass security software or publish unsigned development binaries.

Refined system/persona settings and Console/Memory presentation remain later;
Agency/Memory capability expansion, profiles, arbitrary shell and diarization stay
parked. No next-cycle task is executed by this release action set.

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
