# Independent V-B closure audit — V-C

2026-10-22. Starting `dev` is clean at
`2527ee278c0b12d4f05927495d4a9260d16b2b94`. This is a fresh, bounded closure audit,
not a rerun of the whole prior validation campaign or new speech/visual acceptance.

## Commit, staging recovery and remote facts

- Final commit `2527ee2` has parent `2c44bc7`, whose parent is `2ddab32`, whose
  parent is V-B's starting `fc14933`. All three reported recovery commits exist.
- `git fsck --full --no-dangling` completes successfully in 4.05 seconds under a
  low-priority process bound. There is no index lock, staged change or untracked
  omission. A temporary permission failure is not evidence of repository corruption.
- The exact formerly failed object,
  `1a0476c41d3301a84a5550d4930e5cfee6ff997e`, is a valid blob and is the committed
  `docs/VISUAL_DIRECTION.md` entry. Subsequent staging and the final commit succeeded;
  the clean tree and object inspection independently confirm recovery. No ACL,
  security-software or OS setting is changed by this audit.
- [File manifest](evidence/closure-vc/vb-committed-files.json) records the 37 V-B
  changed paths and committed blob IDs, including five production modules, tests,
  current/historical documentation, both SVGs, generator and aggregate speech audit.
- Fresh `git ls-remote --heads origin main dev` confirms remote `dev` equals
  `2527ee2`; remote `main` equals published v0.2.5
  `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`. Local/cached refs match that snapshot.
  No fetch, push or branch mutation was needed to establish these facts.
- Remote `main` README blob `75e35879a373c229fcbb23f66050a4b9ce4ce4d6`
  matches local `main:README.md`. It still contains the mixed v0.2.5/v0.2.3 status,
  obsolete Ubuntu wording, old Mermaid and long future-vision sections.

## Source and focused regression confirmation

Inspection confirms stream sealing/PCM retirement, cancellation/context/final
evidence checks, duration-based pre-roll and locale normalization are committed.
The final metadata guard checks range before `math.isfinite`, rejects arbitrary
language labels and malformed probabilities, and bounds server duration metadata
before conversion. Explicit language still bypasses auto fallback; no route,
engine, VAD or authority change is introduced by this audit.

Freshly executed: **57 Python tests pass** (0.92 seconds) across the 28 adapter
integrity, 8 utterance integrity, 15 public-documentation/vector and 6 offline
scoring checks. This includes extreme-integer probability/duration, language-label
privacy, duplicate/late/cancelled results, buffer limits and fresh-utterance recovery.
**71 frontend contracts pass** in five files, one worker, no browser (2.39 seconds).
These fresh counts must not be added to V-B's historical distinct totals.

Collection-only inspection finds exactly **256 unique Python node IDs** across
the recorded 24 files: 167 unit + 26 framing/barge-in + 24 stream lifecycle +
36 terminality/fault/diagnostic + 1 paced sequence + 2 composed core cases.
The retained final unit log reports 167 passes; the three retained final fault logs
report 36 passes at 0.54 / 0.69 / 0.64 seconds. Historical interrupted groups lack
a successful final result and are not included. Collection is not execution;
V-C does not claim a new 256-test run or recreate erased session evidence.

## Documentation, vectors and compiled assets

- Generator `--check` confirms both committed SVGs match their editable source.
  Fresh tests confirm XML/accessibility, local links/anchors, safe resources,
  node bounds, estimated text fit, contrast and attribution.
- The static asset checker confirms 65 unchanged frontend source inputs and the
  compiled manifest/HTML/JS/CSS, digest
  `cb2e5b17395a571d4214fa3ec8326acf638afafa3c29154aa7266157c17d4542`.
  No rebuild, shader execution or graphical acceptance is implied.
- All reported V-B deliverables are committed; no closure repair is required.
  Graphical layout, natural bilingual speech, physical timing, real-provider
  latency and human acceptance remain open exactly as in the prior record.

## Publication preflight

Read-only GitHub API inspection confirms public/default `main` and the outdated
About description (Linux primary; generative UI presented without a future label).
There are zero open issues at this snapshot; no historical issue content is inferred.
`gh api user` returns HTTP 401: authenticated PR creation is unavailable.
The current workflow runs on every push/PR and includes full quality plus native
packaging without documentation filters. No workflow, protection or CI-skip bypass
is changed. V-C can prepare a local docs-only branch; remote publication remains
conditional and must not trigger an unapproved campaign.
