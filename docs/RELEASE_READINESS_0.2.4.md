# Sam v0.2.4 — experimental source/Python pre-release

Updated 2026-10-09. HQ authorizes publication of the **source/Python artifact class**
when exact-commit source quality and package gates pass. Native Windows installer:
**unavailable and still unvalidated**. Its Cargo helper execution failure does not
block a valid wheel/sdist pre-release; unsigned native artifacts remain private.

## Acceptance and publication gate

Secure owner-authenticated startup/shutdown, successive typed requests, recovery
from synthetic voice errors/cancellation, empty-STT rejection, speech-only Markdown
normalization, SQLite initialization/persistence/migration protection and sandboxed
responsive owner-window behavior pass the representative candidate tests. The prior
104 Python / 235 frontend gate remains valid for unchanged product source. Fresh
bounded verification adds 27 focused checks and an authenticated frozen companion
startup/Quit smoke with isolated data, offline provider and speech disabled.
No microphone, disruptive playback, real model loop or personal database is used.

The first hosted candidate run exposed a test-runner collection defect: console
`pytest` did not include repository helper scripts on its import path. Explicit
pytest `pythonpath` restores the same imports used by local `python -m pytest`;
no tests are removed. The Windows-only companion resource test is now explicitly
scoped to Windows, retaining all driver/license assertions on that platform.
Exact final commit CI and installed-package verification must pass before tagging.
No workflow, dependency version, authentication or sandbox policy is weakened.

## Approved scope and limitations

Only `sam_ambient-0.2.4-py3-none-any.whl`, `sam_ambient-0.2.4.tar.gz` and their
source-only SHA-256 manifest may be public. Rebuild after the final source commit;
compare metadata, notices/resources and archive contents, then independently
verify uploaded hashes. Preserve dev/main history by fast-forward and tag the
exact validated commit. Native CI must be reported separately, never as source
quality evidence. No installer, unsigned companion ZIP or diagnostic artifact upload.

Intermittent false/noise/self-playback turns and prolonged inference stalls remain
reported, incompletely reproduced limitations. The concrete beta repairs do not
prove every cause resolved. Poor real-accent STT, conservative interruption and
owner-rejected Orb/membrane/voice embodiment remain candid experimental limitations.
A reproducible unrecoverable conversation failure, serious authority defect,
corrupted persistent data or broken distributed package would still block release.
No second human beta is required for deterministic repairs; no subjective acceptance
is claimed. [Release notes](RELEASE_NOTES_0.2.4.md) describe the actual delta and
experimental Agency/Memory foundations. [Acceptance](CORE_EXPERIENCE_ACCEPTANCE.md)
and [candidate evidence](ALPHA_CANDIDATE_0.2.4.md) preserve evidence boundaries.

## Dependency review

Read-only GitHub review on October 9 returned 20 default-branch alerts. Current dev
Vite 7.3.5 and Vitest/mocker 4.1.11 are outside the returned vulnerable ranges;
17 duplicate frontend alerts refer to older default-branch versions. Remaining
pytest 8.4.2 (test tooling), setuptools 82.0.1 (build/macOS sdist path) and GLib
0.18.5 (Linux native GTK dependency) are deferred as previously triaged, not runtime
wheel security certifications. No blanket upgrade or zero-vulnerability claim.
See [triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md).

## Native distribution — separate blocker

Windows refused generated Cargo helper execution (OS error 5); exact host cause
remains unknown. No NSIS installer or installed Tauri smoke passed. A repaired
private-parent proof smoke passes for the existing frozen companion, but that is
not native installer acceptance. Public Windows distribution still needs a
maintainable build, authenticated installed/upgrade and data-recovery checks,
signing and reputation review. No security bypass or global tooling change.

The historical hold below is retained as dated evidence, with its disposition
superseded by the explicit source/Python alpha policy above.

## October 9 repair-stage decision — historical, disposition superseded above

[Complete triage and repair evidence](BETA_TRIAGE_2026-10-09.md) records every
supplied finding, including screenshot and bounded diagnostic interpretation.
Two coherent repair stages are validated; candidate preparation stops here.

| Classification | Finding / disposition |
| --- | --- |
| Confirmed blocker, fixed and verified | Binary VAD could cancel a typed generation in THINKING without recognized intent. Credible transcript is now required, as during SPEAKING. Noise-only candidates remain provisional. |
| Confirmed blocker, fixed and verified | Empty/whitespace final STT could commit a turn after a partial. It now retires without commitment; paced regression retains typed recovery and legitimate utterances. |
| Fixed and verified | Delivery received literal Markdown; repeated spoken “asterisk” evaded known-output screening. A delivery-only normalization boundary preserves original history; the demonstrated legacy echo is rejected. This is not general acoustic source separation. |
| Confirmed security/presentation blocker, fixed on source path | Playwright supplied `--no-sandbox`, a normal blank tab and fixed viewport. Sandbox-enabled actual app mode, live sizing and fullscreen pass in an isolated Windows fixture with private owner proof intact. |
| Fixed and verified | Recognition flex layout squeezed its label/selector. Full-width keyboard selection and sticky Controls tabs pass Chrome checks; shipped UI assets are refreshed. |
| Unresolved cause; release hold | Plausible wrong/noise/self-playback STT text may still commit; unsolicited responses and minutes-long stalls are not fully reproduced or attributable from the supplied snapshot. These integrity symptoms are not waived as alpha polish. No claim that all spurious turns, premature delivery stops or stalls are solved. |
| Unresolved observation / bounded follow-up | “LM Studio remains” may mean its desktop app, which cleanup deliberately does not close. CLI inventory can wake the daemon before status sampling; initial ownership observation needs an ordered-preflight reproduction. Never terminate shared/external resources to satisfy presentation expectations. |
| Accepted experimental-alpha limitation, disclosed | Conservative acoustic interruption/explicit Stop; base-model real-accent STT and installed voice choices are limited. Safety against bogus commitments is still required; these limitations do not excuse the release hold. |
| Deferred major improvement; failed owner judgment retained | Owner found polygonal/dull form, inadequate membrane and detached speech embodiment. Existing numeric tests remain valid technical evidence, not human acceptance. Major STT/visual work and persona editing are outside this closure. |
| Existing distribution blockers, still open | Current authenticated native smoke, frozen driver/resources/notices, installed SQLite/upgrade/recovery, hosted Windows gate outcomes, clean-host validation and public signing/reputation are not established for this tree. |

**Minimum remaining work:** use the correlated endpoint/STT/model/delivery timings
and deterministic paced mixed typed/voice sequences to isolate the residual
spurious-commit/stall path. Preserve unknowns when it cannot be reproduced; do not
hide it with a timer or disable the microphone globally. Resolve the daemon versus
serving-endpoint ownership observation without weakening external ownership. Then
validate the existing authenticated candidate/package gates for the intended
artifact scope. No second human beta is required merely for these deterministic
repairs, and none is requested. Later qualitative passes need later owner judgment.

This pass adds 90 focused voice Python checks, 110 owner/provider/auth checks,
30 final generation/context/storage recovery checks, 77 frontend tests and two
targeted Chrome cases, plus a refreshed-shipped-UI
authentication/text check. TypeScript, Vite build, changed-file Ruff/format/Biome
and diff check pass. The Windows app fixture is real browser launch evidence,
not a fresh LM Studio session or an installed native-package smoke.
Source version consistency remains 0.2.3; 107 relative document targets pass.

Metadata remains 0.2.3. No candidate wheel/sdist/companion/installer, candidate
hash inventory, Cargo release run or hosted gate is represented as completed.
The rebuilt development frontend assets are not release candidate artifacts.
The unsigned-installer restriction remains absolute for public distribution.

## Proposed scope and designation

Keep **v0.2.4 Windows-first alpha / Core Experience** as the proposed next version,
conditional on the gates below. The existing plain-version prerelease convention
is sensible for an unstable alpha; do not promise that this is only a tiny bugfix.
The baseline contains 81 post-v0.2.3 commits before this assessment, including real
new infrastructure. A 0.3 designation merits owner reconsideration if the next
release deliberately markets expanded agency or a broader supported-platform
contract. Neither is this milestone's objective. Do not renumber automatically.

Actual delta from published v0.2.3:

- **Everyday fundamentals:** safe committed voice candidates/echo screening;
  generation terminality and typed recovery; complete role-separated history,
  safe common Markdown, delivery metadata and independent scrolling; truthful
  cold provider readiness, exact idle unload/reload, inventory-confirmed cleanup;
  hard en/es recognition wiring and coherent installed persona selection; separate
  measured listening/speaking embodiment; smoother high-tier form/shared membrane,
  evolving pigment; persisted Flow/particle/recognition Controls; health-first
  diagnostics/wide layout; one-action prepared-checkout launcher.
- **Security:** private-pipe owner bootstrap and fresh mutual connection proof;
  bounded typed policy/approval/cancellation, credential/error redaction and HTTPS
  constraints; targeted Vite/Vitest maintenance. These are implemented protections,
  not an OS sandbox or resistance to compromised trusted code/host memory.
- **Experimental foundations already in the tree:** bounded workspace Console,
  isolated public-page reading, structured model tools, and local SQLite personal
  memory with reviewed provenance/owner CRUD/lexical recall. Disclose them explicitly
  if shipping this tree; do not describe them as newly accepted everyday features
  or imply they are absent. No expansion, unrestricted shell, workspace mutation,
  broader browser automation, profiles, semantic memory or multi-user identity.
- **Research only:** rejected acoustic engines remain isolated. No production AEC
  or prompt full-duplex ownership is delivered. Conservative interruption and
  explicit Stop speaking remain the baseline; no approximately-one-second promise.

Published v0.2.3 release notes/metadata remain historical and unchanged.

## Evidence and release disposition

| Area | Current evidence | Disposition before next alpha |
| --- | --- | --- |
| Conversation/recovery/Controls/history | Prior gates plus October 9 deterministic repairs above | Residual spurious commitment/stall evidence remains a release hold; no blanket correctness claim |
| Current real model operations | Corrected passive observer: private owner UI, correlated unload/reload, three typed replies, Rescan and Quit passed against independent inventory | **Closed on current source/installed Gemma:** previous timeout was an encoding-corrupted probe locator; candidate/installed path still needs validation |
| Provider service ownership | Reused service preserved; Sam-loaded model absent after Quit | Supported semantics; broader hosts and Sam-started service-stop still limited, disclose rather than claim |
| Speech/device mechanics | Generated installed en/es synthesis/meters; input open-only without capture; output digital silence; fake failure/re-entry/Stop regressions | Physical device loss/replug and audible stop timing remain unverified; generated STT is not owner-accent recognition |
| Renderer/performance | Fixed-WebGL/isolated tier evidence plus 101 full-app headless draw submissions across two real Gemma requests: median 36.4 ms, p95 42.4 ms, no >100 ms gaps | Bounded default inference scheduling assessed; no GPU/native/low-power/thermal or human presentation guarantee |
| Voice/visual product quality | Technical transport/form/light properties, generated bilingual baseline; October 9 real owner report | Owner reported poor recognition/form/membrane/embodiment; not accepted from metrics; retain alpha limits and later major passes |
| Authentication/memory | Actual store/auth/rotation/restart/adversarial fixtures and source-owner initialization | Candidate package must prove same boundaries and persistence on installed/upgrade path |
| Windows distribution | Prepared source launch; older package architecture and guarded unsigned-development path | **Public native blocker:** current authenticated native smoke, frozen runtime/driver assets/notices, clean-host validation and signing/reputation |

A usable prepared-source development alpha is distinct from a public Windows
installer. Technical source correctness does not waive packaging, physical or
perceptual evidence. The live route-observation failure was traced to corrupted
probe text, repaired and independently confirmed through one real lifecycle session.
No product behavior, authentication, dependency or art change was needed.

Known alpha limitations that may be disclosed/explicitly accepted rather than
silently promoted to solved: conservative acoustic interruption, base STT capacity,
installed-voice fallback/pleasantness, wider provider/device/low-power/Linux coverage,
experimental Agency/Memory usefulness. Any reproducible loss of text recovery,
false active-model state, unsafe ownership cleanup, authentication bypass, private
memory exposure or persistent UI failure is a blocker, not an accepted limitation.

## Installation, security and persistent-state checks still required

1. **Frozen companion smoke closed; native package smoke remains open:** companion
   now proves ownership over the private parent pipe and passed frozen startup/Quit.
   The native package script still assumes unauthenticated readiness; replace its
   observation through the actual native UI/proof when an installer builds, never
   weaken core authentication. No installed shell smoke passed in this task.
2. **Frozen resources/notices closed at companion scope:** private driver, Node
   LICENSE, Playwright NOTICE/ThirdPartyNotices and runtime dependency licenses
   are explicitly bundled; manifest and bundled driver execution pass. Clean-host
   installed/native resource behavior remains unverified because installer build failed.
3. **SQLite:** preserve stable owner principal/app-data locations across upgrade;
   existing history/settings plus memory schema 1 are separate stores. Transactional
   initialization, 250 ms lock bounds, future-schema rejection and corrupt-store
   text fallback have deterministic evidence. Candidate installation/upgrade must
   verify preservation, correction/delete, actual handle closure, failure recovery,
   and uninstall retention choice. Never erase a store to make startup pass.
   Plaintext under OS account privacy is not encryption or a credential vault.
4. **Lifecycle:** native startup/reconnect must authenticate; Quit revokes authority,
   cancels owned actions/audio/browser, closes databases and performs bounded
   ownership-eligible cleanup. Prove the installed path, not only source fixtures.
5. **Hosted gates:** `.github/workflows/ci.yml` Package smoke uses `needs: quality`,
   whose matrix includes both Windows and Ubuntu. If the documented Ubuntu failure
   still occurs, Package smoke is skipped despite the Windows-first exception.
   Candidate preparation must establish actual job outcomes and resolve this gate
   dependency deliberately under future authorization, or agree an explicit verified
   alternative. Do not pretend a skipped job passed or weaken Linux tests here.
6. **Distribution:** maintain `-AllowUnsignedDevelopmentBuild` as private validation
   only. Public Windows installer requires Authenticode, antivirus/reputation and
   clean-host artifact smoke; no bypass/whitelist. Wheel/sdist publication is a
   separate approved alpha decision and must not imply an available signed installer.

### Dependency alerts — read-only comparison

On 2026-10-09 the authorized Sam alerts API still returned 20 open default-branch
records: 17 duplicate manifest/lock records for Vite/Vitest/mocker and three other
findings. Current dev pins Vite 7.3.5 and Vitest/mocker 4.1.11, outside **all ranges
returned in this inspection**. No newly reported package/advisory appeared relative
to [existing triage](DEPENDENCY_ADVISORY_TRIAGE_2026-09-30.md); no global vulnerability
free claim or remote alert closure is inferred.

Remaining locked versions: pytest 8.4.2 (tmpdir, fixed 9.0.3, test-only);
setuptools 82.0.1 (macOS sdist normalization, fixed 83.0.0, build/packaging);
GLib 0.18.5 (VariantStrIter, fixed 0.20.0, Linux/GTK transitive native path).
Keep their exposure-specific maintenance, not a Windows runtime emergency or
blanket upgrade. Reassess before candidate tooling/native target changes. No
dependency, branch, advisory configuration or workflow was modified.

## Human beta decision and proportionate release procedure

The prepared session was completed October 9. Its report now drives the triage
above; another beta is unavailable for several days and is not a prerequisite for
the reproducible repairs. Do not schedule or request it here. The source alpha is
still distinct from a signed public installer, and the report does not grant
release approval or qualitative acceptance of the Orb/voice.

The session must decide: does the current Orb feel alive/soft, is membrane/flow
convincing, do speech/listening pulses feel natural, is owner en/es transcription
usable, is persona pleasant/coherent, and are Controls/history/model operations
understandable? Observe conservative interruption honestly, not as promised AEC.
Long Gemma load (~80 s here) makes a strict ten-minute cap conditional on an already
ready provider/model; separate engineering load timing from subjective beta time.

Small next-release sequence (each future mutation needs its own authorization):

1. **Completed:** close current runtime observation/lifecycle and bounded inference
   cadence ([evidence](CORE_INTEGRATION_0.2.4.md)). Preserve existing gains/art
   direction unless owner evidence contradicts them.
2. Close the remaining October 9 conversation-integrity hold with bounded evidence
   and regressions; preserve failed qualitative observations and accepted alpha limits.
   Keep capability/acoustic expansion parked. No new beta is requested now.
3. Repair authenticated native smoke/resource/notices and agree public artifact
   scope/signing path. These packaging tasks can proceed independently of owner
   qualitative availability; a package build is not perceptual acceptance.
4. Freeze one approved candidate; prepare consistent version/notes/notices only
   then. Run full release source checks, Cargo/native tests, guarded private
   candidate builds, package-content/version/hashes and clean-host install/upgrade/
   recovery/cleanup. Preserve rollback/staged update contracts.
5. Obtain required hosted Windows Quality/Native Package and actual Package smoke
   evidence on the exact approved commit; record the Linux policy/gating resolution.
   Owner approves scope, known limits and signing/security outcome.
6. Only afterward authorize merge/tag/prerelease/publication of verified artifacts.
   Do not publish unsigned installers. No such action is performed by this plan.

Closure verification: five additional focused tests pass for current owner handshake,
replay/revocation/restart/reconnect and isolated SQLite restart/deletion/future-schema/
transactional initialization. Total this assessment: **33 focused Python tests**,
three Chrome cases, TypeScript, changed-file Biome, source version consistency,
relative-document links and diff check. No candidate/native/full regression build
was performed or is represented as green.
