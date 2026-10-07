# Sam implementation state

Updated: 2026-10-07. This is current development truth, not a release acceptance claim.
Historical implementation/release detail remains in [changelog](../CHANGELOG.md),
[architecture](ARCHITECTURE.md), [decisions](DECISIONS.md) and specialist evidence.
[ROADMAP](ROADMAP.md) owns future priority; this file does not maintain another queue.

## Release and evidence boundary

- Core Experience Consolidation follows [the acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md):
  basics before capability expansion. Provider cleanup verifies the resulting
  inventory/server state; CLI dispatch success alone is insufficient.
  [Cold readiness](COLD_PROVIDER_RECOVERY.md) classifies inventory outcomes and
  bounds transient retries; exact intent, cancellation and stale-result gates pass.
- Persisted Controls recognition mode and explicit `voice.stt_language` reach STT; [generated bilingual STT](SPEECH_BASELINE_2026-10-01.md)
  has 7.95%/8.75% literal WER and intact 250 ms sentence pauses. Physical quality is unaccepted.
- System.Speech defaults to an installed cross-language persona, honoring explicit
  voice preference and reporting fallbacks. First PCM reports effective selection
  through correlated synthesis health, independently of coalesced meters.
- Core experience now verifies ordinary RMS through the reducer to actual WebGL
  expansion/light, rather than only near-full-scale visual fixtures. Human visual
  acceptance remains distinct and outstanding.
- Conversation Controls exposes core-confirmed speech health/mode/effective voice;
  preferences, actual readiness and disconnected last-known facts remain distinct.
- Operational conversation-state transactions explicitly close their SQLite handles
  on success/failure; shutdown no longer relies on garbage collection for these.
- A composed authenticated runtime/voice/PCM/history/Controls simulator proves
  typed → voice → STT failure → typed recovery → Rescan → ordered Quit. Its real
  core events also drive the isolated frontend and bounded visual response.
- Consolidation III classifies cold inventory failures and bounds recovery. A real
  preflight timeout recovered; automatic Gemma activation, two text turns, Rescan
  and Sam-loaded unload passed. Reused serving remained; broader hosts are unverified.
  Actual en/es synthesis/meters reach fixed WebGL without physical playback.
- v0.2.3 is published. Its commit/tag/public wheel and sdist are unchanged by these
  post-release repairs. The unsigned Windows development installer remains withheld.
- Windows-first development; Linux compatibility/native CI has a documented deferred
  failure. Native packaging, signing/reputation and clean-host installation remain open.
- The five-minute physical beta initially completed voice/model/TTS turns, then exposed
  self-output contamination, ineffective interruption, eventual no-response, messy
  history and inadequate visual embodiment. [Beta record](POST_0.2.3_BETA_PLAN.md)
  remains primary evidence; these dev changes have not received a new human beta.
- Deterministic lifecycle tests had missed the simultaneous playback/listening race.
  Renderer metrics prove numerical properties, not human perceptual visual acceptance.

## Secure agency

- All private core events/commands require fresh mutual HMAC owner proof. The random
  supervisor root travels over private pipes; connection challenges prevent stale
  credential replay. Disconnect/restart/revocation retire authority and actions.
- Source OwnerWindow fulfills canonical shipped assets privately; ordinary HTTP tabs
  cannot supply signer-bearing code. Native proof accepts bundled origins, not native
  HTTP development pages. Host memory/code compromise remains an OS/trusted-code limit.
- Registry, typed schemas, trusted policy, exact approval, epoch leases, cancellation
  and result limits govern both manual and structured model actions. Model prose,
  transcripts, webpage text, tool results and stored memories are data, never authority.
- Console exposes bounded workspace list/read/system info. Canonical roots reject
  traversal, absolute/device paths and symlink/junction escapes. No arbitrary shell
  or manual writes. Existing separately configured trusted tools retain their own policy.
- Owned browser is a separate ephemeral, scripts-disabled public-page context with
  navigate/read/close, validated public-IP-pinned egress and no owner binding or
  personal profile. No forms, downloads/uploads, arbitrary JS or sensitive actions.
- Four owner tasks, increasing replay sequence, bounded output/history and terminal
  guards apply. Model tool rounds/fragments/repeats are bounded; actions cannot be
  recursively manufactured from returned content. Shutdown revokes before cleanup.
- A bounded real LM Studio / installed google/gemma-4-e2b owner-window workspace
  read completed with a useful final answer; malicious fixture instructions remained
  inert and a later generation was cancelled. Chromium local-network permission is
  scoped only to the trusted UI context/origin. No physical speech was used.
  Public-site/TLS compatibility and native driver bundling remain unverified.

See [owner contract](OWNER_AUTHORITY.md), [capabilities](AGENCY_CAPABILITIES.md),
[owned browser](OWNED_BROWSER.md), [agency evidence](AGENCY_FOUNDATION_I.md) and
[trust boundaries](TRUST_BOUNDARIES.md). Vite 7.3.5 / Vitest and mocker 4.1.11 advisory
maintenance is complete; separately triaged build/test/Linux findings remain deferred.

## Durable personal memory — Foundation I implemented

- Separate standard-library SQLite schema 1 lives in Windows user app data
  `%LOCALAPPDATA%/Sam/memory.sqlite3`, not the checkout or session history.
  Tests supply temporary stores; standalone core supports --memory-db / --no-memory.
- Stable database principal scopes records across owner-session rotation; it is not
  a secret, OS username or speaker recognition. Every public operation still needs
  current authenticated authority. Personal and canonical-workspace scopes apply.
- Fact/preference/project records carry stable ID, source/reference, review/reviewer,
  timestamps, revision and last correction action. Owner create/correct is reviewed;
  model/conversation/tool/web candidates are proposed until deliberately reviewed.
- Owner-only memory.list/get/create/correct/approve/delete use the shared executor.
  CRUD is neither advertised nor allowed to models. Memory UI independently scrolls,
  searches/filters, shows provenance, inspects/edits and confirms permanent deletion.
- Only structured memory.propose is advertised to models. Exact tool approval permits
  holding an unreviewed candidate; separate owner review permits recall. Maximum two
  proposals/turn and 100 proposed entries; duplicate candidates reuse their record.
  Provenance is pinned to the live generation and actual same-generation source action.
- Obvious credentials/tokens/private keys are rejected before approval/storage. This
  is not general DLP. Database is plaintext under OS account privacy, not a secret vault.
- Scoped reviewed lexical recall ranks whole-word matches, then recency. No embeddings
  or external DB/service. Maximum six complete entries / 4,800 context characters;
  irrelevant scaffolding and unreviewed claims are omitted. Paraphrase recall is limited.
- Memory is a named, provenance-labelled context message, separate from system policy,
  committed history, current question and untrusted tool results. Context cannot grant
  capability permission. Cloud routes receive no memory, even with question cloud opt-in.
- Correction replaces old plaintext at the stable ID; expected revisions prevent lost
  updates. Delete removes live content/index text, not provider copies, chat or backups.
  Secure-delete/default rollback journal, content-free replay metadata and UI cache
  retirement avoid deliberately retaining deleted content. No forensic SSD guarantee.
- Transactional initialization, integrity/schema/row checks, 250 ms lock waits and
  before-commit ownership checks support bounded cancellation/recovery. A repaired
  store can reopen on explicit owner refresh. Memory failure does not block text.
- Restart simulator uses actual store/auth/commands/policy/context with fake inference
  and page data. It rejects an old proof, selectively recalls across restart, reviews
  proposals, corrects/deletes and keeps malicious web claims untrusted.
- Temporary 3,000-record sample: scoped search median 5.916 ms, recall/context 8.397 ms,
  mean write 13.900 ms, DB 1,404,928 bytes. Wall-clock machine evidence, not CI speed limits.
- Human recall/privacy/approval UX acceptance and real-model memory usefulness remain
  unverified. Semantic/vector retrieval, cloud export policy, multi-user consent and
  diarization are future contracts, not current capabilities.

See [memory implementation/evidence](MEMORY_FOUNDATION_I.md) and
[memory authority/multi-person seam](MEMORY_AUTHORITY_CONTRACT.md).

## Conversation, inference and voice

- Authoritative turn/generation identities, stale-event rejection and cancellation
  survive voice/model/TTS overlap. Committed typed/voice messages share clean history;
  provisional/rejected candidates stay out. Full assistant text survives stopped
  speech, whose status is separate metadata. Safe common Markdown and independent
  history scrolling/autofollow are implemented.
- Unverified playback candidates are never promoted just because playback completes;
  they retain the playback generation needed for late transcript screening and retire
  safely. VAD alone cannot distinguish a human from Sam's loudspeaker leakage.
- Superseded streams relinquish active model/delivery ownership before new typed
  work. Old voice handoffs and late model/TTS events cannot reclaim it. Stale terminal
  events release their pending command; unrelated Controls cannot disable text input.
  This proves recovery paths, not exact retrospective attribution of the beta stall.
- Provider discovery/Rescan protects correlated commands and stale catalogs. Preferred
  configuration is distinct from availability, with no silent fallback. Per-turn
  inference route is immutable; exact typed switching blocks active generation.
  System now supports confirmed idle LM Studio unload and exact selected-model reload.
  Stop speaking reuses delivery cancellation. Future identity includes profile ID;
  named profiles and natural-language recognition remain unimplemented.
- Capture/STT/synthesis/playback own separate bounded lifetimes and health. Pull-based
  PCM paths, retired speech queues and explicit TTS iterator close protect cleanup.
  Mic sensitivity applies per capture frame; output volume per synthesized frame.
  Separate voice.level / tts.level measurements retire on failure/cancellation.
- Local speech uses PortAudio/WebRTC VAD/whisper.cpp and System.Speech on Windows
  (eSpeak fallback on supported Linux). Raw audio is not persisted; missing speech
  components degrade to text. Physical timing/device recovery is not broadly accepted.
- The [lightweight](AEC_PROTOTYPE_2026-09-30.md) and
  [Windows filter](AEC_WINDOWS_FILTER_PROBE_2026-10-01.md) probes fail the echo gate.
  Windows near-end preservation passes; runtime AEC/early barge-in remain absent.
  [Full APM IV-B](AEC_APM_DIAGNOSIS_2026-10-07.md) uses a pinned DLL/ABI: linear
  ownership/diversity fail. Acoustic research is parked pending timing/physical evidence.

See [AEC contract](AEC_DOUBLE_TALK_CONTRACT.md) and the physical beta record.

## Embodiment and basic UI

- Autonomous Living Surface, shared membrane pigment, lighting and particles remain;
  measured input/output envelopes have distinct bounded form/light response under
  the existing Audio Reactivity control. Zero retains autonomous motion.
- High-tier form/membrane and broad pigment transport were revised; fixed-camera
  signal/render tests and isolated cost evidence exist. Revised appearance and speech
  embodiment have no human perceptual acceptance; low-power/full-app cost remains open.
- Controls inventory is audited: Conversation, Appearance, Device, System, Diagnostics.
  particle_density persists and chooses a visible fraction of 12/24/40 tier counts;
  Canvas has no particles. Persisted Surface Flow separates transport from Motion.
- Wide diagnostics/history occupy separate independently scrolling regions; constrained
  viewports use a bounded overlay. Current health/errors precede conversation, audio,
  collapsed renderer detail and bounded event history. No product settings moved there.

See [visual direction](VISUAL_DIRECTION.md), [performance](VISUAL_PERFORMANCE_0.2.3_DEV.md)
and the beta record; numerical visual change does not establish perceptual success.

## Supervisor, cleanup and distribution

- Supervisor stays independent of LLM logic, with readiness, bounded crash backoff,
  safe mode, capability revocation and trusted argv. Presentation failure cannot restart
  core. Versioned staged activation/hash checks/atomic pointer/rollback contracts remain.
- Exit defaults to retaining provider/model. unload_if_sam_loaded affects only a model
  Sam loaded; stop_if_sam_started only a service Sam started. Reused services/models
  stay untouched. UI eligibility and outcomes are truthful; unload precedes stop.
- Non-cooperative core tasks receive two-second retirement grace, external cleanup an
  18-second bound inside supervised 24-second stop. LM Studio unload uses structured
  lms unload MODEL; lms server stop stops serving, not the desktop application.
- Prepared Windows checkout launches through Start Sam.cmd / existing supervisor,
  without silently installing/upgrading dependencies. Public signed installation,
  updater publication and non-developer distribution remain later work.

## Focused validation and next direction

Memory's store/authority/provenance/recovery gate remains in its specialist document;
no new dependencies, models or published-release metadata changed in this pass.

The [core matrix](CORE_EXPERIENCE_ACCEPTANCE.md) separates I, II and III evidence;
III's 127-Python / 89-frontend gate and two Chrome cases pass. IV-A adds 99 focused
acoustic/voice tests, not engine acceptance. [ROADMAP](ROADMAP.md) retains basic repair;
new capabilities remain parked. Automated visuals are not human perceptual acceptance.
Human testing is scarce and reserved for a substantial integrated checkpoint; unavailable now.
