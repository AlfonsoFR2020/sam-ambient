# V-E — closure audit, released test maintenance and session continuity

2026-10-23. Development evidence, not graphical, provider, physical-audio or owner
acceptance. Published v0.2.5 remains `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.

## Independent V-D closure audit

Starting dev is clean `ac19393a84f692806d549fd8c487d00a231b169f`. Read-only remote
verification finds dev still at `2527ee2`, main at the published release and public
docs at `5047050`; no later owner push is inferred. The original checkout stays dev.

Git establishes the linear sequence `95882fa` → `aca1977` → `231fb7d` → `ac19393`.
The first two add the authenticated PTT core/UI and close-worker lease correction.
`231fb7d` retains pending release ownership, revokes a queued finish on focus loss,
handles exact rejected admission and keeps capture quarantine truthful across mute.
`ac19393` adds only documents/evidence/production assets, with **no changed frontend
source input after the build**. Git alone does not establish the exact instant of
quota cutoff; source, commit times, recorded reports and fresh checks agree with the
documented interruption/resumption order. The report is not treated as proof alone.

Fresh affected checks: **38 Python** capture/PTT cases and **33 Node keyboard**
cases pass. Assertions cover command actions, real event-listener wiring, no stale
committed user text, exclusive capture cleanup, typed recovery and matching terminal
identities, including release-before-confirmation and delayed finalization cancel.
No final source defect or omitted intended file is established. Index/working tree
are clean; Git connectivity passes. Ignored execution helpers/reports are not missing
production deliverables. No abandoned tracked patch/reject file is present.

The current committed JS is `index-Bi8MHRrM.js`, CSS `index-Nh1JMxRB.css`. Asset
inspection independently matches all **66** inputs to clean source `231fb7d`, LF
digest `01243fcf5ddd6a78656e629b8cce3b246242ba677e3743d00f5ecb71130127f9`.
The source launcher calls the shared Python launcher; the private owner window
resolves contained `src/sam_ambient/static/index.html` and its assets. The earlier
`aca1977` asset manifest is explicitly historical and is not the served entry.
No rebuild is required for the V-D audit itself. Later UX-08 source requires a new
build; V-D's hash proof will remain historical, not be overwritten.

## Released CI diagnosis and isolated correction

PR #7 remains draft at `5047050`, based on released main. The released handoff test
reads a mutable active-generation pointer after an awaited start. A valid fast
replacement can already have completed/retired. An explicit `await second` before
the old assertion deterministically reproduces `None not in {None, predecessor}`.
This establishes an invalid timing assumption, not a reproduced production defect.

Maintenance branch `maintenance/v025-ubuntu-lifecycle-test` starts directly at
`dc64c5d`; commit `14c706f` changes **one test file only**. It parametrizes ordinary
and explicitly completed replacement scheduling, derives the replacement from a
completed event correlated to turn/cancellation IDs, and also requires exact output,
two provider requests, one successful replacement terminal, and exactly-once ordered
predecessor cancellation with no stale deltas. Existing meaningful assertions stay.
No runtime, workflow, dependency, assets, version or packaging changes are included.

**25 released lifecycle tests pass**, with the two affected cases passing three
additional sequential repetitions; repeats are not extra distinct cases. Ruff
passes. The first reproduction setup guard matched multiple similar blocks and
stopped before writing; its zero-test collection attempt is not counted as evidence.
The corrected focused setup then produced the expected assertion failure.

[Draft maintenance PR #8](https://github.com/AlfonsoFR2020/sam-ambient/pull/8) is
pushed; hosted results are recorded at closure. It is separate from #7, and neither
merge is authorized. Required publication order: owner-authorized maintenance merge,
reconcile docs PR against new main, verify its required checks, owner-authorized
documentation merge. No CI bypass or automatic integration occurs here.

## UX-08 investigation and intended semantics

Existing SQLite state has stable session IDs and bounded committed text. Inference
filters by session but applies a global recent-message limit first. The authenticated
ready snapshot exposes only a recovered count, **not saved messages**, so a fresh UI
can legitimately present empty history although the store still has text. This is a
reproducible missing rehydration contract, not evidence that historical data was lost.

The backend retains resume as default and adds authenticated new/resume commands,
a persisted launch policy and private history/draft snapshots. The supervisor's
existing application-launch identity distinguishes fresh launch from core recovery.
Session/revision compare-and-select is atomic; cancellation cannot strand durable
selection ahead of live state. Active response, PTT/capture cleanup, tools and enabled
ordinary input block switching (mute input first). Prior committed records remain;
no operation is automatically replayed, and model selection/Memory stay separate.
The additive registry backfills legacy state without altering existing text tables.
History/inference queries filter session **before** their limits. Snapshot text and
retained-session lists are bounded. Thirteen new session cases and 45 adjacent
cases pass; Ruff passes. Frontend integration and final evidence follow below.

## Reboot recovery and completed source integration

An unexpected PC reboot and Codex reinstall interrupted V-E after source commit
`79479c8`. The owner required a strictly read-only audit before continuation. That
audit found six modified tracked UI files and three complete untracked UI/test
files, no staged work or Git-operation lock/merge/rebase marker, sound Git object
connectivity, and unchanged V-D artifact hashes. Saved logs corroborated the prior
58-Python/57-frontend batches and completed type check. Neither was claimed as a
fresh post-reboot pass. Maintenance/public worktrees were clean; remote refs and
PR #8's green hosted checks were reverified. No file was edited or test run during
the recovery audit. Explicit owner approval then resumed V-E under occupied-PC limits.
The preserved files were continued, not overwritten by replaying edit helpers.

The integrated UI exposes compact New/Resume/launch controls, active opaque ID,
saved-text/incomplete/excerpt labels and truthful busy reasons. Private ready/change
snapshots restore committed rows/current draft; socket/runtime/session/revision and
generation checks reject old ready/ACK/terminal work without orphaning new pending
input. A completed answer and its delivery remain separate, including after reload.

Additional deterministic reproductions repaired:

- Malformed ready metadata could select another session while preserving old text;
  the UI now rejects it before context, command timers or pending ownership change.
- Returning A → B → A could let an unknown old model terminal acquire generation
  ownership. With snapshot-enabled sessions, model/TTS events require the established
  active generation; terminal events cannot create it. Core authority remains intact.
- Repeated new-on-launch starts accumulated empty descriptors. Shared trimming now
  covers fresh launch, explicit changes and ordinary message retention, without
  deleting sessions containing retained committed text.
- Cached history/catalog could outlive rows pruned by normal message retention.
  A bounded consistent read refreshes the live projection after persistence; an old
  session's callback cannot populate another current session.
- JS UTF-16 length rejected valid Python-bounded non-BMP history/drafts. Both sides
  now use Unicode code-point limits. This does not change language/model selection.

The first reduced-retention reproduction used a five-row test store, below the
existing 12-message inference query contract, and failed for that fixture reason.
It was corrected to 12 rows before proving the projection defect. Setup and
expected red reproductions are not counted as passes. Minor import/lint/accessibility
findings were corrected before affected checks. No source issue is hidden by an
earlier passing run; final source/build evidence follows in the closure section.

Authoritative backend cases now include actual context separation, atomic selection,
launch identity, upgrade/namespace isolation, malformed/reordered owner commands,
noncooperative PTT, canceled requester, injected locked store, corrupt/future state,
partial generation restart, stopped speech, unavailable model, privacy and bounds.
Frontend cases use virtual transport/time plus React server markup; they cover
rehydration/live drafts, queued output, core clock reset, old sockets/ACKs, malformed
snapshots, returned-session terminals, preference commands and accessible labels.
No browser, real provider, microphone, speaker or graphical session was used.

See [owner contract and retained limitations](CONVERSATION_SESSIONS.md). Final
validation counts and asset provenance are recorded after the last source checkpoint.

At the source checkpoint, **176 distinct Python cases in 17 files** pass across
nonoverlapping 55/70/51-case batches. The final frontend batch has **182 cases in
15 files**, one Node worker, all passed. These include 23 session-backend cases and
15 session-projection/control cases. Four critical backend ownership cases and all
15 session frontend cases additionally pass three sequential repetitions; repeats,
the V-D audit batches and maintenance-branch tests are not added to distinct totals.
Ruff covers eight changed Python files; Biome covers nine UI/test files; TypeScript
project checking passes. Requirement validation retains 66 IDs/eleven styles and
all priority bands. No complete project suite or forbidden runtime was executed.
