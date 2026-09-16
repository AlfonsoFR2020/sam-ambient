# Release checklist

`0.2.0` is published. Release approval and publication remain human-controlled for
future patch alphas and do not follow automatically from a green branch.

## Patch-alpha cadence

Favor frequent, coherent patch-alpha releases such as `0.2.1`, `0.2.2` through
`0.2.12` rather than accumulating a large unreleased development delta. A release may
contain a small related set of fixes when it passes its gates and materially improves
the public alpha. Do not batch unrelated completed work merely to make a release look
larger, and do not publish a knowingly broken intermediate commit for calendar
cadence. The unit is a green coherent checkpoint.

The current seven-commit stabilization slice on `feature/visual-polish` is a possible
`0.2.1` candidate after integration into `dev`, deterministic gates, documentation/
version review and the minimum acceptance genuinely required for those changes. Future
voice-reliability fixes can form later coherent patch alphas. This is planning, not an
approval or a version-bump instruction.

## Future release checklist

- [ ] `dev` is clean, synchronized, and its GitHub CI is green.
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
