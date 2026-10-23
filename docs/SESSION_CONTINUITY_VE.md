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

The implementation will retain resume as default, reattach reload/reconnect to the
live session, add authenticated new/resume commands and a persisted launch policy,
and keep model routes/Memory separate. Session changes block active work. A genuine
application-launch identity, already supplied by the supervisor, will distinguish
fresh launch from core recovery. Final implementation and evidence follow below.
