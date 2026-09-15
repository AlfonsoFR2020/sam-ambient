# Release checklist

Release approval and publication remain human-controlled.

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
- [x] Source/package metadata is prepared consistently as `0.2.0`.
- [ ] Merge `dev` into `main` without rewriting history.
- [ ] Create the signed/annotated version tag and GitHub pre-release.
- [ ] Upload verified artifacts and record their hashes.
- [ ] Return active development work to `dev`.

The prepared milestone is `0.2.0`, following the existing plain-version alpha
convention. Create the eventual GitHub release as a prerelease; do not add an
invented package-version suffix. This preparation is not release approval.
