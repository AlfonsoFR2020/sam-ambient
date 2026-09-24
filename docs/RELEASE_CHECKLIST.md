# Release checklist

`0.2.0` and `0.2.1` are published; `0.2.2` is being prepared. Release approval and
publication remain human-controlled and do not follow automatically from a green branch.

## Patch-alpha cadence

Favor frequent, coherent patch-alpha releases such as `0.2.1`, `0.2.2` through
`0.2.12` rather than accumulating a large unreleased development delta. A release may
contain a small related set of fixes when it passes its gates and materially improves
the public alpha. Do not batch unrelated completed work merely to make a release look
larger, and do not publish a knowingly broken intermediate commit for calendar
cadence. The unit is a green coherent checkpoint.

The generation-terminality, delivery-handoff and core-interaction reliability commits
`4e22d16`, `95ed273` and `2d3bd3a` are integrated into `dev` as the focused `0.2.2`
candidate. Deferred UI, session, visual, language and Linux work must not expand this
release. Preparation is not publication approval.

The 0.2.2 alpha is Windows-first. The exact versioned release-preparation commit must
pass its hosted Windows Quality, package-smoke and Native Package gates after push.
Hosted Ubuntu reaches Python tests but retains a known unresolved failure. That Linux
issue is explicitly deferred to the dedicated 0.3.0 compatibility review and does
not block this patch alpha; do not mark the Ubuntu job successful artificially or
weaken its tests.

## Future release checklist

- [ ] `dev` is clean and synchronized; required Windows jobs are green and the
  explicitly deferred Ubuntu failure is recorded accurately.
- [ ] Intended feature branches have passed acceptance and are merged.
- [ ] Full release regression passes: Python/frontend tests, lint, formatting,
  TypeScript, Vite, Cargo, version consistency, package metadata, and artifact-content gates.
- [ ] Physical voice and combined visual/native-shell acceptance match the intended
  alpha scope. This remains required for release approval, but does not block
  metadata and documentation preparation.
- [ ] Public documentation and `THIRD_PARTY.md` describe the merged tree.
- [ ] Include the architecture infographic if accurate for this release; update or
  regenerate it after material architecture changes, or label a historical snapshot
  with its version/date and note material differences.
- [ ] Package metadata, notices, version, and artifact contents are consistent.
- [ ] Public Windows native artifacts are Authenticode-signed and pass the planned
  antivirus/reputation review; do not bypass or whitelist security findings.
- [ ] Wheel, source distribution, Python companion, and native installer are built
  through the guarded release path and pass final release-artifact smoke on a clean host.
- [ ] Source/package metadata is prepared consistently for the intended patch version.
- [ ] Merge `dev` into `main` without rewriting history.
- [ ] Create the signed/annotated version tag and GitHub pre-release.
- [ ] Upload verified artifacts and record their hashes.
- [ ] Return active development work to `dev`.

Use the existing plain-version alpha convention. Create a GitHub release as a
prerelease when the release scope requires it; do not add an invented package-version
suffix. Checklist completion is not release approval.
