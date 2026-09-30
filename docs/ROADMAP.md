# Sam roadmap: after published v0.2.3

This is the authoritative priority and dependency plan toward the next alpha.
[State](STATE.md) records implemented truth; [Backlog](BACKLOG.md) keeps detailed
options and unresolved observations; [post-v0.2.3 beta diagnosis](POST_0.2.3_BETA_PLAN.md)
preserves the physical evidence. A green automated check does not establish
acoustic, device, integrated-provider or human visual acceptance. No calendar
dates or next-release feature promises are implied here.

## Baseline and decisions already made

Sam v0.2.3 is published. Since then, `dev` has repaired unsafe playback-candidate
promotion, generation retirement and typed recovery, committed-history rendering
and scrolling, exit cleanup truth, Controls inventory and diagnostics layout.
Measured input/output audio now produces bounded, different Orb responses; the
high-tier form/membrane and broad pigment evolution have source and isolated
WebGL regressions. One isolated desktop WebGL2 sample found a high-tier median
GPU draw time around 1.8 ms, not representative full-app or low-power cost.
The source checkout has a one-action Windows launcher. A targeted security review
closed authenticated-provider error-body disclosure and insecure cloud endpoint
configuration. These are implemented checkpoints, **not** a new human beta pass.

The physical 0.2.3 session established that conservative text-based echo
screening cannot give dependable early barge-in; it also found weak visual
embodiment, a static-looking surface and faint polygonal membrane. Deterministic
tests found and fixed related ownership and text-recovery defects, but did not
attribute every late failure in that physical session. Do not erase those
observations because later tests are green.

## Immediate / foundation

| Work and product reason | Implemented → remaining; prerequisite | Risk, validation and Codex size |
| --- | --- | --- |
| **Acoustic ownership and prompt barge-in.** Sam must hear a real person over its own speech and stop delivery after roughly one second without committing speaker echo or deleting generated text. | Playback candidate identities and conservative transcript screening are repaired. First select a bounded render-reference/near-end processor using actual PCM formats and latency evidence; then implement double-talk/AEC with fallback. No VAD-only timer. | High native DSP, device alignment and licensing risk. Synthetic echo/double-talk fixtures **and** later real hardware timing are required. Split design/feasibility and implementation into separate High-reasoning tasks. |
| **STT/language reliability.** Human speech should produce stable, correctly attributed transcripts. | Capture/STT lifetimes, health and bounded buffers exist. Spanish/Portuguese/Greek drift and transcript errors remain observed. Diagnose after acoustic contamination is controlled; tune endpointing/language policy only from correlated evidence. | Model and room variance; deterministic clips then real device/language checks. Good bounded Medium task after the acoustic boundary, perhaps split measurement from tuning. |
| **Coherent multilingual Sam voice.** Language changes should not unexpectedly change persona. | Response-language selection and system-voice fallback exist; beta selected David for English and Helena for Spanish. Define a deliberate per-language identity/voice policy, then evaluate available local engines without losing fallback. | Voice availability, licensing, latency and subjective identity. Adapter tests plus physical listening. Split policy/inventory from any new TTS adapter; Medium, High only if backend architecture changes. |
| **Integrated recovery evidence.** Text must remain usable through real provider and audio failures. | Route pinning, Rescan races, audio health, terminality and typed recovery have fake/integration regressions. Real provider switching, disconnect timing, device loss, LM Studio cleanup and the exact five-minute stall remain incompletely attributed. | External software/device state can interfere with the host. Later short, authorized real-provider/device tests with correlated IDs; no repeated exploratory Sam runs or human beta now. Bounded test tasks per boundary. |
| **Local control-channel security before new agency.** Future browser/console content must not inherit UI authority. | Loopback binding, Origin check, typed commands, tool policy and revocation exist; [trust review](TRUST_BOUNDARIES.md) fixed credential errors. A same-user process can forge Origin; owner authentication is absent. Design an application-lifetime, connection-scoped owner capability before exposing untrusted pages or another user session. | Authentication/lifecycle design can disrupt reconnect and native shell. Threat-model fixtures and protocol tests; High design task, then bounded implementation. Current single-user loopback design is an accepted limit, not a claimed remote service. |
| **Public Windows distribution.** Users eventually need an accepted installer rather than a checkout. | v0.2.3 wheel/source archive are public; native source/build and an unsigned development installer exist. Authenticode signing, AV/reputation review, clean-host artifact smoke and owner-controlled publication remain. The source launcher is a beta convenience, not an installer. | Signing identity and reputation are owner/security decisions; package/artifact checks on a clean Windows host. Split prerequisite/signing decision from packaging execution. Do not publish unsigned development material. |

## Core capability expansion

| Work and product reason | Implemented → remaining; prerequisite | Risk, validation and Codex size |
| --- | --- | --- |
| **Named inference connection profiles and trusted voice control.** A user should eventually say “use model X on server Y” without exposing credentials. | Exact typed provider/model switching, route snapshots, no silent fallback and a post-final-STT typed-control seam exist. Add profile + provider + model identity and trusted profile configuration; then bounded natural-language recognition and spoken acknowledgement. Needs acoustic ownership and control-channel policy first. | Ambiguity, stale catalogs, credential privacy, real provider timing. Deterministic route/intent tests then real switch checks. Split profiles, recognizer and spoken UX; Medium for each scoped slice, High for cross-boundary policy. |
| **Sam console and browser capability.** Conversation should grow into a controlled interface to the computer, not a second unmediated shell. | Approval-gated process/files/MCP stdio and bounded diagnostics exist. A managed console and browser action surface remain future. Start with capability contracts, isolation and owner approval, after local control-channel security. | Prompt injection, host authority, page-origin mixing and output exfiltration. Threat-model tests, contained browser/runtime checks and owner approval. Split into design and narrow capabilities before UI. |
| **Persistent context and memory.** Useful continuity should be structured and owner-controlled. | SQLite stores committed text; no long-term semantic memory is claimed. Define retention, provenance, review/delete and cloud-export boundaries before retrieval or context injection. | Privacy, stale/false memory and token cost. Deterministic persistence/provenance tests; later owner acceptance. High design first, bounded Medium slices thereafter. |
| **External capability and model evolution.** Keep Sam provider-neutral and policy-mediated. | Local LM Studio/Ollama/compatible adapters and approval-gated MCP stdio exist. Deskwright Linux, browser backend, PAIR-compatible routing, Streamable HTTP MCP, delegated workers and self-update bootstrap remain conditional directions, not current functionality. | Platform/security/latency variance. Add one backend only after a concrete use case and boundary review; isolate each as its own task. |

## Embodiment and interface evolution

| Work and product reason | Implemented → remaining; prerequisite | Risk, validation and Codex size |
| --- | --- | --- |
| **Human-accepted living body.** Sam's surface, membrane and speech response must read as one organism. | Measured voice pulses, form/membrane softening and broader pigment folds are implemented with deterministic tests. The older physical beta did not accept the appearance; no newer human viewing exists. Preserve warm field, pointer ownership, shared membrane tint, tier budgets and autonomous motion. | Numerical pixel or geometry change is not perceptual acceptance. Use fixed fixtures/Orb Lab, WebGL/Canvas/mobile and measured cost before one later integrated human session. Split any observed art defect into bounded tasks; do not tune blindly now. |
| **Representative performance and accessibility.** Visual richness must yield to model, speech and low-power devices. | Four-draw tiers, governor, Canvas fallback, reduced motion and isolated desktop cost sample exist. Full-app GPU/model contention, low-power hardware, audio latency and mobile layout remain unmeasured. | Driver/device variance; relative cost invariants and later representative runtime measurements, not a brittle fixed FPS CI threshold. Medium measurement task after a meaningful integrated candidate. |
| **Options and diagnostic product surface.** Status should remain legible as capabilities grow. | Controls tabs/inventory and wide-versus-narrow diagnostics layout are repaired; history and diagnostics scroll separately. Deeper server/model telemetry, physical device detail, mobile access, theme/replaceable visual architecture and a richer Sam status/console surface remain. | UI crowding and fabricated telemetry. Browser/responsive tests plus later human usability review. Split information design from new data transport; Medium bounded tasks. |

## Longer-horizon intelligence and research

Generative UI, agent delegation, Linux desktop control, trusted self-maintenance,
multi-machine local routing and deeper theme architecture stay behind concrete
capability policy and product evidence. NVIDIA Nemotron 3 Diarization is a future
multi-speaker research option (open-weight, about 100M parameters, 16 kHz mono,
up to eight speakers, streaming speaker cache/FIFO). It is **not** playback AEC.
Do not integrate it before runtime, GPU, dependency and licensing suitability are
evaluated. No research note is a committed near-term feature.

## Human acceptance and execution discipline

Human testing is scarce and unavailable now. The next requested session should
follow a substantial integrated state: acoustic barge-in and text recovery under
real devices, more stable multilingual input/output, the revised speech-reactive
Orb and membrane/surface together, and representative performance. The session
should ask whether Sam hears the human rather than its own speaker, stops speech
promptly without losing text, recovers typed input, and *perceptually* feels
alive. Automated lifecycle and renderer checks remain necessary but separate.

Use bounded checkpoint commits and focused validation. Medium reasoning fits a
well-scoped implementation or audit; use High when concurrency, acoustic source
ownership or architecture has demonstrated difficulty. Do not begin a large
slice near quota exhaustion. Separate tool/environment repair time from useful
reasoning, and never call numerical renderer change human visual acceptance.
If GPT-6.1 Sol becomes available, compare it empirically with the established
Sol workflow before changing default task allocation. These are working
practices, not permanent product architecture.

## Next seven Codex-sized tasks, in dependency order

1. **AEC/double-talk feasibility contract — High.** Choose a replaceable PCM
   boundary, signal fixtures and licensing/build option. This precedes early
   interruption because VAD and text matching cannot prove human origin.
2. **Bounded acoustic ownership implementation — High, conditional on task 1.**
   Add the chosen processor and fail-safe fallback with deterministic double-talk
   and candidate-lifecycle tests; split further if native integration is large.
   This separates speaker bleed before diagnosing STT language errors.
3. **STT language/endpoint diagnosis — Medium.** Use isolated clips and correlated
   candidate evidence after echo is separated, so speaker bleed is not mistaken
   for a Whisper language defect. Stable language evidence precedes a voice
   persona choice across languages.
4. **Multilingual voice-identity policy and adapter inventory — Medium.** Follow
   stable language evidence with a consistent persona target before introducing
   another speech backend or per-language setting. Define that expected behavior
   before the real multi-language integration check.
5. **Focused real provider/audio recovery smoke — Medium.** Exercise exact route,
   interruption, typed recovery, device/service failure and ownership-aware exit
   only with a separately authorized, bounded environment; deterministic work
   from tasks 1–4 identifies what to measure. Close the present interaction
   reliability question before expanding Sam's computer agency. This is not a
   human beta request.
6. **Owner-authenticated local control design — High.** Establish the connection
   and native/browser lifecycle contract before giving future console or browser
   content additional authority. It also precedes trusted profile/control growth.
7. **Named connection-profile contract and first typed slice — Medium.** Extend
   atomic route identity after task 6's trust boundary, keeping secrets outside
   protocol and diagnostics; natural-language recognition remains a later slice.

Windows signing/package acceptance and the integrated visual human checkpoint
remain explicit foundation gates above. They require owner decisions or scarce
real-world observation, so neither is an unprompted next coding task.
