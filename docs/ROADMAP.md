# Sam development plan: post-v0.2.3 toward v0.2.4

**HQ priority change (2026-09-30): secure agency now precedes further AEC.**
Owner authentication, typed bounded capabilities, read-only console/public-page
browser slices, model mediation and the adversarial simulator are implemented on
development HEAD. See [agency evidence](AGENCY_FOUNDATION_I.md).
The acoustic prototype failed its integration gate and remains a separate voice
workstream; it is not a prerequisite for agency. Existing numbered voice cards
below retain their internal dependencies, not the current cross-workstream order.
See [owner authority](OWNER_AUTHORITY.md) for the first agency checkpoint.

This is the **authoritative execution order**, not a promise that every later capability belongs in v0.2.4. [STATE](STATE.md) records implemented truth; [BACKLOG](BACKLOG.md) retains unresolved items; [ARCHITECTURE](ARCHITECTURE.md) and [DECISIONS](DECISIONS.md) contain current contracts. The [physical beta record](POST_0.2.3_BETA_PLAN.md) remains primary product evidence. Specialist sources: [AEC decision](AEC_DOUBLE_TALK_CONTRACT.md), [trust review](TRUST_BOUNDARIES.md), [dependency triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md), [visual direction](VISUAL_DIRECTION.md) and [isolated performance sample](VISUAL_PERFORMANCE_0.2.3_DEV.md). The [published v0.2.3 release scope](RELEASE_READINESS_0.2.3.md) is historical; this plan changes neither it nor its tag.

The last physical beta preceded the recent dev repairs. Its simultaneous playback/listening failure and perception of an insufficiently living Orb remain valid observations. Deterministic lifecycle and renderer checks established corrected properties; **they did not establish physical acoustic reliability or human visual acceptance**. No human beta is available now.

## Reconciled baseline

Post-release dev has repaired unsafe promotion of playback-time interruption candidates, pinned the echo-screening generation, retired superseded generations before new typed turns, and protected frontend command correlation. History now presents committed messages with separate delivery metadata and independent scrolling. Provider exit cleanup follows explicit ownership, Controls inventory is intact, and wide-screen diagnostics does not cover conversation. Measured input/output audio maps to distinct bounded Orb responses; high-tier form/membrane and broad pigment evolution were revised. Isolated WebGL cost was measured, not full-app cost. A prepared Windows source checkout has a one-action launcher. The trust review fixed authenticated-provider error-body disclosure and insecure cloud endpoint configuration. The AEC contract/prototype remains negative evidence, not runtime acoustic processing; Vite 7.3.5 / Vitest 4.1.11 advisory maintenance is complete. See [STATE](STATE.md) for exact behavior.

## Dependency-aware workstreams

### Conversation and voice foundation

**Current:** separate bounded capture, STT, synthesis and playback lifetimes; health, cancellation and turn-local route identity; conservative candidate screening and typed recovery after supersession. **Unmet requirement:** Sam cannot acoustically prove human origin during speaker output or reliably stop delivery after roughly one second of genuine overlapping speech. This blocks prompt barge-in and contaminates interpretation of STT errors. The [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md) prefers a bounded reverse-render/near-end interface and a WebRTC Audio Processing feasibility prototype. Native binding, format conversion, timing/drift and double-talk are high uncertainty. Split prototype, runtime integration and short physical validation. Synthetic echo/double-talk and lifecycle tests precede real hardware; human beta waits for a larger integrated state.

After acoustic separation, diagnose observed Spanish/Portuguese/Greek language drift and endpoint errors on attributed clips, then define a stable multilingual Sam voice identity. System Speech selected David for English and Helena for Spanish in the beta. STT clips and short real audio establish recognition; physical listening establishes persona. Neither a Whisper model replacement nor a new TTS engine is presumed. Deterministic tests reproduced and fixed stall paths, but the exact five-minute no-response incident remains unproven. Correlated real runs must validate terminality and typed recovery rather than claim retroactive attribution.

### Security and authority

**Current:** private-pipe owner bootstrap and fresh mutual connection proofs protect all private core events/commands; typed registry/policy/approval/epoch mediates manual and model actions. Replay, revocation, path and injection fixtures pass. Origin is supplemental, not authority. **Remaining:** host-account memory/code compromise is outside this boundary; powerful mutations need deliberate exact approval and policy. Native launch/bundled Playwright-driver packaging and real-provider tool use remain unverified. Pages never receive the owner signer. See [trust review](TRUST_BOUNDARIES.md) and [agency evidence](AGENCY_FOUNDATION_I.md).

The [advisory triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md) found duplicate GitHub records. Vite 7.1.5 has high-severity dev-server file-read findings; Vitest 3.2.4 has a critical finding conditioned on a listening Vitest UI server. These are **development-toolchain exposures**, not demonstrated public Windows runtime vulnerabilities. Resolved on dev with Vite 7.3.5 and Vitest/mocker 4.1.11 before this agency pass; retain separate deferred advisory work. Pytest 8.4.2, setuptools 82.0.1 and Rust GLib 0.18.5 belong to test/build/Linux-native follow-up. Future API credentials need trusted storage and redaction, never route identity, transcripts or diagnostics.

### Provider and local-control architecture

**Current:** correlated discovery/Rescan and transport epochs; immutable turn-local provider/model; exact typed switch and Stop speaking; no silent provider fallback; typed post-final-STT control seam. **Unmet:** named server/API profiles, atomic profile + provider + model switching, credential-safe configuration, spoken intent recognition/acknowledgement and real multi-provider recovery. Control-channel ownership and profile semantics precede more privileged spoken controls. Separate profile schema/route work from recognizer and UI. Fake stale-discovery tests precede real provider checks. Do not mutate an active generation's route.

### Memory and intelligence

**Current:** SQLite stores committed conversation text and bounded context; Sam does not claim persistent semantic memory. **Unmet:** owner-defined retention, provenance, review/correction/delete, per-person attribution and cloud-export policy before retrieval/context injection. False or unattributed memories would reduce trust and privacy. A policy/schema task precedes bounded persistence/retrieval slices. Validate provenance, contradictory records, deletion and cloud-off behavior deterministically, then obtain owner acceptance later. Multi-user memory depends on reliable acoustic/turn ownership. NVIDIA Nemotron 3 Diarization (about 100M parameters, 16 kHz mono, up to eight speakers, streaming speaker cache) remains a research option for multi-person attribution, **not AEC**; evaluate runtime/GPU/dependency/license suitability before adoption.

### Console, browser and tools

**Current:** authenticated owner Console supports bounded workspace list/read/system info; separate public-page browser supports navigate/read/close with scripts disabled and pinned public-IP egress. Structured provider tools share the same policy, exact approvals, result bounds, cancellation and repeated-call limits. The integrated simulator rejects injected commands and proves typed recovery. **Unmet:** practical real-provider tool workflows, explicitly approved bounded mutations and richer browser interactions. They matter to Sam as a computer interface but can expose host authority to prompt injection. Owner-authenticated control and a narrow capability contract come first; then add one contained ability at a time through the trusted registry/policy/approval/epoch path. A page, model response, retrieved file or tool output remains data, never a control command. Threat-model and contained browser/runtime tests are mandatory. Streamable HTTP MCP, delegation, Linux desktop control and self-maintenance remain conditional later directions.

### Embodiment and interface

**Current:** autonomous Living Surface, related membrane/lighting/particles, source-specific measured audio response, tiered quality, Canvas/reduced-motion fallback and usable Controls/history/diagnostics. **Unmet:** the *revised* voice response and visual composition have no human perceptual acceptance. The earlier beta found static-feeling pigment, polygonal membrane/form and no useful audio response before the revisions. The isolated desktop high-tier GPU draw was near 1.8 ms; sustained full-app model contention, low-power hardware, native composition and audio latency are unmeasured. A bounded integrated performance/accessibility pass precedes scarce human viewing. Turn specific later observations into art tasks; do not tune blindly. Tests protect bounded motion/fallback/cost, while human acceptance decides whether it feels alive. Themes, wider palette and richer status UI are later.

### Distribution and productization

**Current:** prepared-checkout Windows launch is one action; v0.2.3 wheel/sdist are public; unsigned Windows development installer is withheld. Supervisor/update authority remains distinct from conversation with staged activation/rollback contracts. **Unmet:** signed, reputation-tested, clean-host public Windows installation and owner-controlled update/release. Signing identity and security-software response need owner/security decisions; do not invent a workaround. This blocks a non-developer distribution claim, not the AEC prototype. Split signing prerequisites, clean-host package test and publication. Linux/mobile distribution remain later tracks.

## Ordered Codex task cards

These cards preserve the voice workstream's internal dependency order. **Task 1
is complete; cards 9, 10 and 12 are completed by Agency Foundation I.** Card 2
remains the next acoustic experiment, not HQ's next overall task. Follow the
current agency milestone/next bounded task below before resuming acoustic work.
Skip a card only when prerequisites/environment are unavailable and record why.
No card requests human testing now.

### 1. Development-toolchain advisory maintenance — complete on dev

- **Objective / why now:** Resolve Vite/Vitest dev-server advisories before more browser/control work.
- **Prerequisites:** [advisory triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md); clean locked toolchain.
- **Scope:** Compatible fixed dev-package versions, transitive mocker resolution and lockfile/notice review. **Non-scope:** Sam features, arbitrary upgrades, deployed-binary vulnerability claims.
- **Deliverable / validation:** One coherent dependency commit; locked install, TypeScript, focused frontend/browser tests, Biome and lock diff. No provider/audio runtime.
- **Model / quota:** Sol Medium; **small**. **Stop/escalate:** if the mocker fix requires disruptive Vitest major migration, separate it and retain a documented test-UI restriction. **Human checkpoint:** no. This prevents toolchain repair from consuming task 2's feasibility budget.

### 2. Falsifying AEC processor prototype

**First probe recorded; integration blocked:** the optional Windows AEC3
extraction binding runs, but fails the declared separation gate. See
[measurements and reproduction](AEC_PROTOTYPE_2026-09-30.md). Task 2 remains open:
establish pinned upstream APM adapter/build feasibility and replay the same
fixtures before Task 3. No runtime acoustic or early-barge-in claim is made.

- **Objective / why now:** Prove or reject the [preferred processing boundary](AEC_DOUBLE_TALK_CONTRACT.md) before changing live conversation.
- **Prerequisites:** AEC contract; native binding/license/build provenance; task 1 if tooling overlaps.
- **Scope:** Isolated adapter and short synthetic PCM/delay/resampling fixtures; measure false triggers, near-end onset and package/CPU cost. **Non-scope:** live Sam, production barge-in, UI or STT tuning.
- **Deliverable / validation:** Explicit pass/fail for echo-only, noise, double-talk, playback-end, changing delay and reset, plus 22.05-to-16 kHz conversion and license/build-size record.
- **Model / quota:** Sol High; **medium**. **Stop/escalate:** no trustworthy Windows binding or excessive native cost; compare SpeexDSP/Windows DSP instead of inventing a subsystem. **Human checkpoint:** no. A falsifiable processor result is necessary before task 3.

### 3. Bounded acoustic ownership and early delivery interruption

- **Objective / why now:** Stop TTS for validated sustained human-origin speech before STT finalizes, while keeping echo provisional and assistant text complete.
- **Prerequisites:** Task 2 passes, or a documented substitute passes the same fixtures.
- **Scope:** Bounded post-gain reference, capture alignment/delay, processed VAD/STT, pre-roll, pinned candidate identity and conservative fallback. **Non-scope:** Whisper replacement, voice persona, visual tuning, VAD-only timer or route redesign.
- **Deliverable / validation:** Generation-scoped audio path; deterministic echo/double-talk, late STT, playback-end, device-reset and typed-recovery regressions; no stale ownership or unbounded buffer.
- **Model / quota:** Sol High; **large**, with mandatory processor, candidate-handoff and integration checkpoint commits. **Stop/escalate:** false echo-only interruption or unstable delay means keep conservative fallback. **Human checkpoint:** no. This creates task 4's physical testable path.

### 4. Bounded physical acoustic/device validation

- **Objective / why now:** Check whether synthetic ownership holds on actual Windows speakers and microphone before diagnosing recognition.
- **Prerequisites:** Green task 3 and a separately authorized short real-device window.
- **Scope:** Purpose-specific playback-only and overlapping-human-speech run; measure onset-to-delivery-stop, STT continuation, reset and typed recovery. **Non-scope:** human beta, tuning marathon, provider feature work.
- **Deliverable / validation:** Correlated turn/generation/device evidence; minimal regression only for a reproduced defect.
- **Model / quota:** Sol Medium; High only for a demonstrated race; **medium**. **Stop/escalate:** unavailable hardware or repeated unsafe false interruptions; record inconclusive status. **Human checkpoint:** no. Acoustic attribution must precede task 5.

### 5. STT language and endpoint diagnosis

- **Objective / why now:** Separate real Spanish/Portuguese/Greek classification and endpoint errors from echo/candidate errors.
- **Prerequisites:** Tasks 3–4, or clean attributed clips with the limitation stated.
- **Scope:** Multilingual clip matrix, correlated language/endpoint inspection and minimal justified policy fix. **Non-scope:** unproven Whisper upgrade, diarization, audio rewrite.
- **Deliverable / validation:** Source-backed diagnosis, focused clips/state tests, brief real-language check only if authorized.
- **Model / quota:** Sol Medium; **medium**. **Stop/escalate:** model capability rather than Sam policy; do not fabricate confidence. **Human checkpoint:** no. Stable language evidence informs task 6.

### 6. Multilingual Sam voice-identity policy

- **Objective / why now:** Avoid surprising male/female persona change when Sam changes language.
- **Prerequisites:** Task 5 language evidence and installed/licensed voice inventory.
- **Scope:** Define per-language identity/fallback and make only a supported small selection correction. **Non-scope:** cloud TTS, cloning, new engine, voice marketplace.
- **Deliverable / validation:** Durable policy and adapter tests; physical listening remains later.
- **Model / quota:** Sol Medium; **medium**. **Stop/escalate:** no suitable licensed local voices; document the backend decision separately. **Human checkpoint:** later integrated voice acceptance, not this task. This defines the expected speech behavior for task 7.

### 7. Real provider/audio/typed-recovery integration

- **Objective / why now:** Check post-release terminality, exact route and audio-health guarantees against real timing without claiming the old beta incident was fully diagnosed.
- **Prerequisites:** Tasks 3–6 green or explicitly limited; available pre-existing provider/model and authorized devices.
- **Scope:** Controlled Rescan/selection, short text/voice turns, interruption, failure recovery, reconnect and ownership-aware cleanup with correlated IDs. **Non-scope:** benchmarking, new provider download/setup, exploratory runtime, human beta.
- **Deliverable / validation:** Observed provider/device results and limitations; regressions only for reproduced defects.
- **Model / quota:** Sol Medium; High for a reproduced concurrency defect; **medium**. **Stop/escalate:** no provider/device or committed-text loss/stuck typed turn. **Human checkpoint:** no. This supplies runtime evidence before task 8.

### 8. Integrated visual/performance/accessibility gate

- **Objective / why now:** Establish that the revised speech-responsive body remains bounded and usable with real conversation active.
- **Prerequisites:** Task 7 stable path; [isolated timing baseline](VISUAL_PERFORMANCE_0.2.3_DEV.md).
- **Scope:** One bounded full-app Windows cost/latency sample, lower tier if available, reduced motion/Canvas and diagnostics/history coexistence. **Non-scope:** new art direction, brittle FPS threshold, immediate human acceptance.
- **Deliverable / validation:** GPU/CPU/frame/audio-latency evidence with limitations and fixes only for measured defects; existing interaction/render tests.
- **Model / quota:** Sol Medium; **medium**. **Stop/escalate:** severe contention or missing timers; report what is actually measurable. **Human checkpoint:** prepares a later scarce integrated session, does not request it. This closes the automated/runtime evidence for a v0.2.4 candidate.

### 9. Owner-authenticated local control-channel contract

**Completed by Agency Foundation I:** [contract](OWNER_AUTHORITY.md), private bootstrap and connection/restart/revocation tests. The card below records its original scope.

- **Objective / why now:** Define command ownership before more computer agency.
- **Prerequisites:** [trust model](TRUST_BOUNDARIES.md); task 7 reconnect evidence is useful but not required.
- **Scope:** Threat model and protocol contract for owner capability, native/browser bootstrap, handshake, reconnect, rotation and revocation. **Non-scope:** browser/console implementation, OS-user isolation claims, credentials in logs/pages.
- **Deliverable / validation:** Reviewed design and fake hostile-origin/process cases, with compatibility plan.
- **Model / quota:** Sol High; **medium**. **Stop/escalate:** no secret-safe browser bootstrap; split native and browser policies. **Human checkpoint:** no. This makes task 10 implementable.

### 10. Local command-channel authentication slice

**Completed by Agency Foundation I:** all live private commands/events require a fresh owner proof; source-window fixture and native compile pass. Native physical launch/package remains unvalidated.

- **Objective / why now:** Enforce task 9 without breaking text/voice recovery or startup.
- **Prerequisites:** Approved task 9 contract.
- **Scope:** Connection-scoped handshake, bounded failure/revocation and trusted UI bootstrap while retaining Origin/protocol/policy checks. **Non-scope:** user accounts, remote service, OAuth, new tools or page access.
- **Deliverable / validation:** Protocol, reconnect, stale-capability and startup tests; one bounded browser/native seam check if required.
- **Model / quota:** Sol High; **large** with mandatory handshake/reconnect checkpoints. **Stop/escalate:** legitimate UI lockout or leak into page context. **Human checkpoint:** no. This precedes tasks 11–12.

### 11. Named inference-profile and atomic route slice

- **Objective / why now:** Enable exact profile + provider + model selection without redirecting active turns or leaking credentials.
- **Prerequisites:** Task 10 trusted channel and current route-pinning/discovery contract.
- **Scope:** Typed profile identity/storage boundary, atomic future-turn switch, unavailable/ambiguous outcomes and stale-discovery tests; minimal UI if necessary. **Non-scope:** natural-language recognizer, arbitrary API-key UI, silent fallback, mid-generation migration.
- **Deliverable / validation:** Typed route slice with fake provider and frontend/core correlation tests, later real switch check.
- **Model / quota:** Sol Medium, High if credential ownership changes; **medium**. **Stop/escalate:** unresolved secret-store policy. **Human checkpoint:** no. This gives later spoken control a safe target.

### 12. Console/browser capability boundary design

**Completed beyond the original design card:** [typed capabilities](AGENCY_CAPABILITIES.md), [owned browser](OWNED_BROWSER.md), [simulator evidence](AGENCY_FOUNDATION_I.md). No arbitrary shell, page scripting or durable memory. [Memory seam](MEMORY_AUTHORITY_CONTRACT.md) is architecture only.

- **Objective / why now:** Choose the first useful computer-facing ability without giving untrusted content owner command authority.
- **Prerequisites:** Tasks 9–10 and existing trusted tool registry/approval/epoch.
- **Scope:** One bounded console or browser use case, isolation, grants, output limits, audit and cancellation; specify an implementable first slice. **Non-scope:** full terminal, unrestricted automation, memory retrieval, self-update or natural-language controls.
- **Deliverable / validation:** Threat-modelled design and deterministic policy/injection tests; broad implementation is a separate task.
- **Model / quota:** Sol High for cross-origin authority, otherwise Medium; **medium**. **Stop/escalate:** proposed UI must expose owner capability or bypass approval. **Human checkpoint:** no. This starts a later expansion horizon.

## Meaningful v0.2.4 integrated checkpoint

HQ now prioritizes useful secure agency. The candidate may include owner-authenticated
local authority, typed bounded/cancellable capabilities, read-only Console/public-page
inspection, structured model mediation, clean conversation history/typed recovery and
the implemented visual repairs. **AEC is a separate voice workstream, not a release
prerequisite for these capabilities.** Conservative candidate safety remains required.

Before claiming real agency, obtain one separately authorized bounded real-provider
tool workflow through the owned UI, without broad model/browser exploration. Fake
protocol/adversarial/model fixtures and isolated browser evidence are green; production
native driver bundling/launch and real external-site compatibility are not established.
No new release, package/signing action or immediate human beta is implied.

**Explicitly later:** prompt acoustic barge-in/AEC integration, STT/persona improvements,
named profiles/natural-language switching, arbitrary shell, sensitive browser actions,
persistent semantic memory, diarization, signed public installer and self-update.
Their specialist contracts and internal voice dependencies above remain valid.

**Next scarce human beta:** only when secure agency has demonstrated useful integrated
owner workflows, text/voice recovery remains sound, and a separately authorized runtime
window has checked the relevant paths. It should assess actual usefulness, understandable
authority/approval, history and visual perception together. Do not request human testing
now or treat deterministic visual metrics as perceptual acceptance.

**Next bounded Codex task:** validate a representative existing real provider's structured
tool support through the owner window: one workspace read and one explicitly approved
public-page inspection, cancellation and final answer. Stop if the provider/environment
cannot support the protocol; do not download/configure a new model or add features merely
to pass. This supplies product-value evidence before choosing a bounded mutation slice.

## HQ quota and execution practice

| Task class | Reasoning and runtime default | Quota/checkpoint rule |
| --- | --- | --- |
| Tiny/small inventory, docs, compatible lockfile or focused UI | Sol Medium; static/focused tests, browser only for presentation | One coherent commit, no broad suite. Escalate on concrete cross-boundary findings. |
| Medium bounded adapter, protocol or integration | Sol Medium; fake tests first, purpose-specific browser/real runtime only if scoped | Commit at independently green boundaries; stop before unrelated work. |
| Large/high-risk DSP timing, turn concurrency or owner authentication | Sol High for demonstrated architecture/race risk; synthetic fixtures before physical runs | Mandatory checkpoint commits and failure/fallback criteria. Do not start near quota exhaustion. |

Separate environment/tooling burn from productive engineering. Record first-pass yield and the cost of corrective follow-up for each checkpoint; use those observations to size later tasks. Do not run Sam, models or browser repeatedly as an exploratory loop. Record automated correctness, representative runtime behavior and scarce human perceptual acceptance as different evidence. When GPT-6.1 Sol appears, calibrate Medium and High empirically against the established Sol workflow rather than assuming benchmark scores predict this account's quota cost. No calendar or numeric future quota promise is inferred here.
