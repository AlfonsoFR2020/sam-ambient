# Release checklist

Release approval and publication remain human-controlled.

- [ ] `dev` is clean, synchronized, and its GitHub CI is green.
- [ ] Intended feature branches have passed acceptance and are merged.
- [ ] Full Python/frontend regression, lint, type, build, and package gates pass.
- [ ] Physical voice and visual/native-shell acceptance match the intended release.
- [ ] Public documentation and `THIRD_PARTY.md` describe the merged tree.
- [ ] Include the architecture infographic if accurate for this release; update or
  regenerate it after material architecture changes, or label a historical snapshot
  with its version/date and note material differences.
- [ ] Package metadata, notices, version, and artifact contents are consistent.
- [ ] Windows native artifacts meet the signing and AV/reputation gate.
- [ ] Wheel, source distribution, and accepted native installer are built and smoked.
- [ ] Version is bumped once after scope is final.
- [ ] Merge `dev` into `main` without rewriting history.
- [ ] Create the signed/annotated version tag and GitHub pre-release.
- [ ] Upload verified artifacts and record their hashes.
- [ ] Return active development work to `dev`.

If only current merged hardening/productization ships, `0.1.3` is the natural
patch alpha. If the accepted native shell and substantial ambient UI ship together,
`0.2.0` is the likely milestone. Choose only after acceptance determines scope.
