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

At the V-D audit, committed JS is `index-Bi8MHRrM.js`, CSS `index-Nh1JMxRB.css`. Asset
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

## Final integration and independently checked closure

The final implementation source checkpoint is
`d8c376ef6f6b42493b3d5bfa433e0a49f8326a1a`. It follows the focused V-D audit
`aa81eba` and backend authority/persistence checkpoint `79479c8`; the final closure
commit adds generated assets and this evidence without another source change.
The original checkout remains on `dev`. Development changes are local; V-E pushes
only the isolated maintenance branch. Remote dev was independently read as
`2527ee278c0b12d4f05927495d4a9260d16b2b94`, not assumed to contain later work.

Source ownership is concentrated in `core/storage/sqlite.py`, the new
`core/session/conversation.py`, `runtime.py`, launch identity forwarding in `cli.py`,
and additive `core/protocol` models/control dispatch. Frontend changes are the
new `ConversationControls.tsx` and `state/conversations.ts`, existing reducer/client,
Controls/protocol models, App presentation and compact styles. Focused tests live in
`test_conversation_sessions.py` and `session-continuity.test.ts`; the reviewed released
lifecycle assertion is selectively ported into the existing integration test.
There is no separate React conversation authority, dependency addition, settings-file
migration, visual-engine change or change to reviewed Memory/tool permissions.

One low-priority canonical `tsc -b && vite build` succeeds after all source repairs,
without warnings or tool installation. It takes about 4.15 seconds including type
checking (Vite reports 811 ms), transforms 86 modules and records **68 source inputs**.
The LF-normalized input digest is
`92386a1e61b4534606ca4951a6f966eaaa2da0942f52af9394d048fc901afa03`.
The authoritative production entry now references `index-BTcQ44i8.js`
(404.88 kB, 121.33 kB gzip) and `index-Brem5iPs.css` (20.44 kB, 5.37 kB gzip).
The source/build identifier records clean `d8c376e`; no source input changes follow
that build. The private ordinary-launch asset path resolves this entry. Superseded
V-D JS/CSS files are removed from the current asset set; their historical proof stays.
These are build/file observations, not GPU, full-app coexistence or latency measurements.

The final evidence package contains:

- [Distinct checks and repetition accounting](evidence/session-ve/checks.json):
  176 Python / 182 frontend passes, per-file counts and explicit execution limits.
- [Production input/artifact hashes](evidence/session-ve/frontend-assets.json):
  clean source identity, normalized digest and all five served artifact hashes.
- [Remote publication/hosted checks](evidence/session-ve/publication.json):
  all listed checks on draft PR #8 completed successfully, including Ubuntu/Windows
  quality, CodeQL and hosted packaging checks. Those hosted jobs do not authorize
  local packaging. No hosted counts are added to local distinct-test totals.
- [Final document/resource-boundary integrity](evidence/session-ve/closure-integrity.json):
  link checks, SVG reproduction, requirements invariants and source/asset agreement.

The public documentation worktree remains at `5047050`, three linear documentation/
documentation-tooling commits above released main, with 15 allowed changed paths.
Its release checker passes 18 pages/102 local links. Maintenance remains `14c706f`,
one commit directly above released main and one changed test file. Both draft PRs
remain open and unmerged; #7 is not rebased or contaminated. Its old push/PR Ubuntu
quality jobs still fail and the corresponding package-smoke jobs are skipped;
PR #8's 14 listed jobs all succeed. The required merge order above still requires
the owner, followed by fresh checks on the reconciled docs PR. The final evidence
aggregation initially found that the saved #7 snapshot omitted check results;
a fresh read supplies them before the successful rerun. That failed aggregation
does not count as a passed check. Development documentation passes its established
21-page/251-link profile plus the session-contract pages recorded in the integrity
file. The two SVGs remain reproducible and unchanged; no rendering is performed.

UX-08 is implemented and deterministically verified within the documented bounded
window, with real UI/owner acceptance open. Temporary stores/fake services establish
actual context separation, not a conclusion about every older apparent-loss report.
An unusable startup database remains an explicit failure; shared operational DBs
share the existing namespace; an entirely new supervisor invocation is a fresh launch.
Older-session browsing beyond 32 choices and broader history management are deferred.
No transcript/audio/proof enters routine diagnostics; existing global retention,
cloud-context gate, model selection, owner authentication and Memory remain distinct.

No graphical, real-provider/model, physical-audio, full-app, native-installation or
human gate ran locally. Meaningful v0.2.6 acceptance still needs connected-skin/radial-
shell and whole-Orb visual proof, natural bilingual/physical interruption evidence,
representative response-latency diagnostics and integrated resource/owner acceptance.
The next independent occupied-PC candidate is UX-09's explicit interruption/transcript
retention preference semantics and deterministic coverage, under a separate assignment.
It does not complete CONV-07 incremental speech or CONV-08 interruption sensitivity.
