# Sam v0.2.4 — proposed everyday alpha / release decision

Updated 2026-10-08. **Not approved for release; no version/tag/artifact changed.**
This is the current readiness index. [Runtime evidence](CORE_INTEGRATION_0.2.4.md),
[acceptance matrix](CORE_EXPERIENCE_ACCEPTANCE.md), [ROADMAP](ROADMAP.md),
[release checklist](RELEASE_CHECKLIST.md) and [future beta](CORE_EXPERIENCE_V_BETA_SCRIPT.md)
own their respective technical, sequencing and acceptance details.

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
| Conversation/recovery/Controls/history | Prior V gate: 190 Python, 199 frontend, 17 Chrome cases; current 28 focused Python / three Chrome checks | No new reproduced product regression; retain full candidate regression gate |
| Current real model operations | Cold Gemma core activation and confirmed Quit unload passed; Oct 8 owner-window route observation timed out before explicit operations | **Open engineering gate:** successful owner UI + correlated unload/reload/two replies/Rescan/Quit required; root cause unresolved |
| Provider service ownership | Reused service preserved; Sam-loaded model absent after Quit | Supported semantics; broader hosts and Sam-started service-stop still limited, disclose rather than claim |
| Speech/device mechanics | Generated installed en/es synthesis/meters; input open-only without capture; output digital silence; fake failure/re-entry/Stop regressions | Physical device loss/replug and audible stop timing remain unverified; generated STT is not owner-accent recognition |
| Renderer/performance | Fixed-WebGL magnitude/zero tests, isolated GPU sample, mounted frontend tier/scheduling sample | **Open assessment:** no current full-app inference-contention measurement; no low-power/native/thermal guarantee |
| Voice/visual product quality | Technical transport/form/light properties, generated bilingual baseline | **Human gate:** revised appearance/persona/recognition/embodiment still unaccepted |
| Authentication/memory | Actual store/auth/rotation/restart/adversarial fixtures and source-owner initialization | Candidate package must prove same boundaries and persistence on installed/upgrade path |
| Windows distribution | Prepared source launch; older package architecture and guarded unsigned-development path | **Public native blocker:** current authenticated native smoke, frozen runtime/driver assets/notices, clean-host validation and signing/reputation |

A usable prepared-source development alpha is distinct from a public Windows
installer. Technical source correctness does not waive packaging, physical or
perceptual evidence. No confirmed new source defect was fixed in this assessment;
the live route-observation failure remains unresolved, not classified as harmless.

Known alpha limitations that may be disclosed/explicitly accepted rather than
silently promoted to solved: conservative acoustic interruption, base STT capacity,
installed-voice fallback/pleasantness, wider provider/device/low-power/Linux coverage,
experimental Agency/Memory usefulness. Any reproducible loss of text recovery,
false active-model state, unsafe ownership cleanup, authentication bypass, private
memory exposure or persistent UI failure is a blocker, not an accepted limitation.

## Installation, security and persistent-state checks still required

1. **Native smoke is stale:** `scripts/smoke_native_companion.py` and
   `scripts/smoke_native_package.py` connect without owner proof and treat the first
   received frame as `system.ready`. Current core first sends a challenge and emits
   no private readiness until authenticated. Repair the smoke through trusted
   bootstrap/native proof, test absent/replayed proof rejection, never weaken core
   authentication to make a packaging test pass. This source mismatch is identified
   statically; no native artifact was built/run here.
2. **Frozen resources/notices:** `build_native_companion.py` has no explicit
   Playwright driver/data inclusion or license inventory entry for its runtime
   distribution. Import discovery alone does not establish inclusion of bundled
   Node/driver assets, pyee/greenlet or constituent notices. Audit actual candidate
   manifest, invoke the private driver, exercise native signer RPC and verify
   clean-host behavior without a development Python/Node checkout. Missing content
   is not yet proven by an artifact, but packaging completeness is not established.
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

On 2026-10-08 the authorized Sam alerts API still returned 20 open default-branch
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

The existing 5–10-minute script covers the right owner-satisfaction questions.
**Prepared, but not the next action yet:** first close the unresolved current
owner-window lifecycle check and collect bounded inference/render cadence without
perturbing bootstrap. Then it is justified on the prepared source build when the
owner separately becomes available. A public signed installer is not required
merely to judge that source build. No beta is requested/scheduled here.

The session must decide: does the current Orb feel alive/soft, is membrane/flow
convincing, do speech/listening pulses feel natural, is owner en/es transcription
usable, is persona pleasant/coherent, and are Controls/history/model operations
understandable? Observe conservative interruption honestly, not as promised AEC.
Long Gemma load (~80 s here) makes a strict ten-minute cap conditional on an already
ready provider/model; separate engineering load timing from subjective beta time.

Small next-release sequence (each future mutation needs its own authorization):

1. Close current runtime observation/lifecycle and inference cadence; fix only an
   evidenced fault. Keep existing gains/art direction unless owner evidence contradicts.
2. Conduct the prepared beta later; address its highest-impact basic failures and
   record accepted alpha limits. Keep capability/acoustic expansion parked.
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
