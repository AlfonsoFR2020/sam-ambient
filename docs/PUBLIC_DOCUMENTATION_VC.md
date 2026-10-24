# Public v0.2.5 documentation refresh — V-C

2026-10-22. Isolated branch `docs/public-v025-refresh`, based exactly on released
`main` / v0.2.5 `dc64c5d180fb44cf7a29bf4d0d1ae2f853347709`.
This is documentation and its editable/checking source only. No implementation
commit is cherry-picked and no unreleased runtime history is merged.

## What the public page now explains

The [README](../README.md) retains Sam's original logo and exact Apache attribution,
with a concise ambient-computing vision, released capabilities and clear development/
future boundaries. It removes stale v0.2.3/Ubuntu-failure/Linux-primary wording and
old Mermaid, links the latest system SVG, and pins first-use instructions to v0.2.5
with speech disabled. There is no public installer claim.

Getting Started and User Guide use released controls and primary recognition codes.
The User Guide is adapted from the release, not replaced with the IV-C guide.
Architecture keeps the released contract and explicitly labels the new lifecycle
diagram as development. [Development status](DEVELOPMENT_STATUS.md) is a standalone
bridge to pinned, already pushed `dev` records; no missing development-only local
report is required to understand or navigate the public documentation.

## Scope, verification and open visual review

Allowed changes are the README/Contributing/spec scope note, six public guides/
status/report pages, three diagram files, two standard-library documentation
scripts and one documentation-only test file. The checker enforces the exact
changed-file allowlist and one/two linear commits from the release base.
Source/runtime, compiled frontend, workflows, dependencies/lockfiles, versions,
data, original logo and LICENSE/NOTICE/THIRD_PARTY are unchanged.

Run from this checkout with an existing Python environment:

```sh
python scripts/generate_architecture_diagrams.py --check
python -m scripts.check_public_docs --profile release --release-base dc64c5d180fb44cf7a29bf4d0d1ae2f853347709
python -m pytest tests/unit/test_public_docs_checker.py
```

These are file-only checks: target-branch paths/anchors/case/tracking, SVG XML,
accessibility, no executable/external resources, source reproduction, node bounds,
estimated text fit, palette contrast, license/logo identity and docs-only ancestry.
No external URL reachability, font measurement, SVG rasterization, screenshot,
graphical layout, WebGL/provider/audio session or human acceptance is inferred.
Final file-only results: 18 prominent pages / 101 local link-and-anchor targets
pass; both SVGs reproduce; the minimum declared text/accent-to-surface contrast is
6.64:1. Twelve focused documentation-validator cases pass, including rejected
runtime diffs, merge ancestry and implementation history hidden by later reversion.
The initial test attempt had four temporary-directory fixture errors because the
ignored parent was absent in the fresh worktree; creating that parent resolved
them. Interrupted/failed setup is not counted as passing evidence.

The exact 15 changed paths are:

```text
CONTRIBUTING.md
README.md
SAM_AMBIENT_CODEX_SPEC.md
docs/ARCHITECTURE.md
docs/DEVELOPMENT_STATUS.md
docs/GETTING_STARTED.md
docs/PUBLIC_DOCUMENTATION_VC.md
docs/TROUBLESHOOTING.md
docs/USER_GUIDE.md
docs/diagrams/README.md
docs/diagrams/sam-conversation-lifecycle.svg
docs/diagrams/sam-system-architecture.svg
scripts/check_public_docs.py
scripts/generate_architecture_diagrams.py
tests/unit/test_public_docs_checker.py
```

Normalized-LF SVG SHA256s: system
`71225fafd46712523ba4569911e8ad005055c33c59bb9dd812e4b9e07e431b70`;
lifecycle `e7821f5ea47135f34304ce8e520c6230781fc2cb15295a492ad9ca1c02b6dc13`.
These establish file identity, not rendered quality.

## Remote preflight and publication

Read-only inspection confirmed remote default `main` at the release and pushed
`dev` at V-B's final commit. Main's README blob matched the inspected local base.
GitHub CLI authenticated-user inspection returned HTTP 401. The workflow triggers
on all pushes/PRs and includes full quality and native packaging without docs
filters. No authentication setup, CI-skip marker, workflow/protection change,
push, PR, merge or About/topic mutation is performed here.

The branch can be reviewed locally. Later owner-authorized publication requires
available GitHub authentication and a deliberate decision about existing CI
triggers, then a draft PR against `main`; merging remains a separate owner action.
Do not merge all of `dev` to publish these pages. Render/review the SVGs only when
graphical permission is available; do not claim visual approval in the meantime.

## Proposed About and topics — not applied

About: Local-first ambient AI with a living visual presence, conversation integrity
and owner-controlled capabilities. Windows-first alpha; Linux in development.

Retain accurate current topics such as `ambient-ai`, `local-first`, `lm-studio`,
`ollama`, `react` and `human-computer-interaction`. Add/review `windows`, `python`,
`typescript`, `privacy`, `speech-recognition`, `local-llm`, `ai-assistant` and
`human-in-the-loop`. Remove `generative-ui` and `adaptive-ui` from current-capability
metadata while those features remain future work; review broad `agentic-ai` wording
against the existing bounded Agency scope. No topic change has been made remotely.

## V-D correction and publication checkpoint — 2026-10-22

The V-C results above are historical. V-D preserves the design and corrects
reviewed-Memory recall, separate local input/output directions, directed
exceptional retirement paths and the playback-observation route. SVGs are
regenerated from the stdlib source; file-only endpoint/node-crossing checks
and 14 documentation tests cover the corrections. No raster/layout review ran.

Released v0.2.5 `ui/src/visual-engine/quality.ts` defines 12/24/64 particles;
the User Guide's 40 was a documentation error, now corrected. Historical
specification authority/Linux fields are explicitly superseded. Development
snapshot links are pinned historical evidence, distinct from current dev.

V-D authorizes the existing standard hosted CI and a non-forced docs-branch
push/draft PR. Authentication and actual publication outcome are reported in
the V-D development handoff; no merge, About/topic or release is authorized.

Current `sam-system-architecture.svg` normalized-LF SHA256: `eda3e1c07475a02fdd4ad73c55bf3647687716e188ae1c3aa268b5b2c3e4f9e5`.

Current `sam-conversation-lifecycle.svg` normalized-LF SHA256: `78e457014acdf512d4377cebff8eefe3cebd5a95a9983154035a63341c20d6ca`.
