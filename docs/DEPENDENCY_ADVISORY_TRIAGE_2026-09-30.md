# Sam dependency advisory triage — 2026-09-30

Historical findings are preserved below. [October 15 maintenance](#focused-maintenance--2026-10-15) is the current dev disposition.

The original read-only inspection of open GitHub Dependabot alerts for `AlfonsoFR2020/sam-ambient` was checked against the then-current manifests and lockfiles. GitHub's push notice said 20 alerts on the default branch; the API returned **20 records, but several duplicate the same package/advisory across `package.json` and its lockfile**. This is not a count of 20 independent product exposures. The table below records the **before** state and original classification; the local `dev` resolution is recorded afterward. No remote advisory state or repository setting was changed.

| Package / locked version | GitHub finding and first fixed version | Sam exposure and action |
| --- | --- | --- |
| `vite` **7.1.5** (`ui/package.json`, `ui/pnpm-lock.yaml`) | Multiple dev-server file-read/`fs.deny` bypass advisories, including **high**; Windows UNC launch-editor NTLM disclosure is **medium**. Highest listed fix **7.3.5** (same major). | **Development/build-chain exposure**, especially if the Vite server is reachable by an untrusted page/user or launch-editor receives a malicious path. Vite is a development dependency, not the packaged Sam UI runtime. Schedule a bounded locked-toolchain maintenance task; verify local-only server exposure and affected dev workflows. No reason to label the published app remotely vulnerable from this alone. |
| `vitest` **3.2.4** and `@vitest/mocker` **3.2.4** | **Critical** arbitrary read/execute when Vitest UI server listens; Vitest fix **3.2.6**. Separate **medium** mock redirect path traversal fixed in **4.1.11** for both. | **Test/development exposure**. Sam's normal `vitest run` is not the UI server, so the critical exploit precondition is not the normal test path. The 3.2.6 critical fix is same-major; the 4.1.11 advisory needs a major-version compatibility review. Do not launch a Vitest UI server until triaged/upgraded. Group with Vite maintenance, keep the two distinct fix thresholds. |
| `pytest` **8.4.2** | **Medium** vulnerable tmpdir handling, fixed **9.0.3**. | **Test-only exposure**. `pyproject.toml` currently constrains `pytest>=8.3,<9`; a fix requires changing that constraint and validating test compatibility. No Sam runtime exposure established. |
| `setuptools` **82.0.1** | **Medium** sdist `MANIFEST.in` exclusion bypass via Unicode normalization collision on macOS APFS/HFS+, fixed **83.0.0**. | `uv.lock` shows this is pulled by `cx-freeze` for **packaging/build**, despite GitHub's `runtime` scope label. The cited precondition is macOS filesystem behavior, while Sam is Windows-first. Review during packaging maintenance; no demonstrated Windows product path. |
| Rust `glib` **0.18.5** in `ui/src-tauri/Cargo.lock` | **Medium** unsound `VariantStrIter`, fixed **0.20.0**. | **Transitive native-shell dependency**, plausibly Linux/GTK only; current Windows release does not exercise GLib. Whether Sam actually invokes the affected iterator is unknown. Raising GLib across minor versions may require upstream Tauri/GTK compatibility work. Track for Linux/native dependency maintenance; inspect target graph and path before calling it a Windows blocker. |

## Local dev resolution — 2026-09-30

| Dependency | Before → after in `ui/package.json` / resolved `ui/pnpm-lock.yaml` | Covered advisory outcome |
| --- | --- | --- |
| Direct Vite | **7.1.5 → 7.3.5** | Above every Vite vulnerable range listed above, including the Windows path and UNC findings. `@vitejs/plugin-react` stays **5.0.2**; its Vite 7 peer range already accepts this version. |
| Direct Vitest | **3.2.4 → 4.1.11** | Above the critical Vitest UI threshold **3.2.6** and the separate mocker-redirect threshold **4.1.11**. The latter required the explicitly authorized Vitest 4 major migration. |
| Transitive `@vitest/mocker` | **3.2.4 → 4.1.11** through Vitest | Above its documented vulnerable range; no override or direct pin was added. |

The lockfile moved Vite's expected esbuild family **0.25.12 → 0.27.7**, its platform packages and peer-resolution keys. The Vitest change replaced its 3.x internal test graph with 4.1.11 packages and their expected transitive graph. No other direct dependency was changed. The local graph contains one Vite **7.3.5**, one Vitest **4.1.11**, and one mocker **4.1.11**. This establishes resolution against the advisory ranges recorded here; it does **not** mean GitHub alerts on the older default branch have closed or that all repository advisories are gone.

Vitest 4 required **no Sam test, helper, configuration or product-code edits**: the first complete run passed **24 files / 220 tests**. TypeScript and the frontend production Vite build passed; changed-file Biome passed for `ui/package.json`; three bounded Chrome cases passed (startup/UI, committed history, vertical Orb drag). `git diff --check` passed. The build-generated static assets were restored because this checkpoint changes the build toolchain, not the published UI artifact. These are local Windows checks; no real Sam/core/provider/audio system ran.

Pytest, setuptools and GLib remain deliberately deferred as classified above. Treat upstream advisory severity as distinct from Sam product exposure. The current development server remains loopback-bound; do not infer that the published v0.2.3 Windows runtime was remotely vulnerable from these dev-tool findings.

Source: authenticated, read-only GitHub Dependabot alerts API for this repository (open alerts 1–20) on 2026-09-30; local `ui/package.json`, `ui/pnpm-lock.yaml`, `pyproject.toml`, `uv.lock`, `ui/src-tauri/Cargo.lock`.

## Read-only recheck — 2026-10-08

Sam's API still returns the same 20 open default-branch records: 17 frontend
manifest/lock records plus pytest, setuptools and GLib. Current dev Vite 7.3.5 /
Vitest and mocker 4.1.11 are outside every returned applicable range. No new
advisory/package appeared in that source compared with this triage; this is not
a universal security audit or a remote alert closure. Deferred versions/exposure
remain unchanged. No dependency, workflow, settings or advisory mutation occurred.
See [current release-readiness decision](RELEASE_READINESS_0.2.4.md).

October 9 read-only recheck returned the same 20 records and same package/fixed
version ranges. Current manifest/lock still pins Vite 7.3.5 and Vitest/mocker
4.1.11 outside those ranges; pytest 8.4.2, setuptools 82.0.1 and GLib 0.18.5
retain the exposure-specific deferred actions above. No dependencies or remote
alert state changed; this is not a claim of zero vulnerabilities.

## Focused maintenance — 2026-10-15

### Repository and alert inventory

Authenticated read-only API inspection returned **five open default-branch alerts**:
one High, three Medium, one Low; **no Critical and no additional High** beyond the
digest. Default branch `main` is published commit `ae9cdb99ce0b317d1dbec5049eb53e378b41ca22`.
Before maintenance, dev `587775c8` had the same affected lock versions for these
five packages. Main already has the earlier Vite/Vitest repairs: the historical
20-alert inventory is not today's inventory. Launcher commits `6507e07f` and
`587775c8` were preserved to origin/dev before new work. No later push, alert
mutation, PR, workflow or repository-setting change was performed.

| Alert / advisory | Affected range / first fix | Main and initial dev | Current local dev / disposition |
| --- | --- | --- | --- |
| [22: source-map-js](https://github.com/AlfonsoFR2020/sam-ambient/security/dependabot/22), [CVE-2026-93749 / GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), High | >=1.0.0,<1.2.2 / 1.2.2 | 1.2.1 | **1.2.2, corrected.** Vite → PostCSS 8.5.26 → source-map-js. Indexed source-map offsets can block the Node event loop; Sam uses it in dev/build source-map handling, not the shipped static UI or Python runtime. Untrusted build inputs remain relevant. |
| [21: esbuild](https://github.com/AlfonsoFR2020/sam-ambient/security/dependabot/21), [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), Low | >=0.27.3,<0.28.1 / 0.28.1 | 0.27.7 | **0.28.2, corrected.** Vite → esbuild/platform binary. The advisory requires esbuild's own Windows `serve`/`servedir` path; Sam uses Vite's loopback server and build/transform APIs, with no configured esbuild serving path. It is not bundled in the Python/static runtime. |
| [19: pytest](https://github.com/AlfonsoFR2020/sam-ambient/security/dependabot/19), [CVE-2025-71176 / GHSA-6w46-j5rx-g56g](https://github.com/advisories/GHSA-6w46-j5rx-g56g), Medium | <9.0.3 / 9.0.3 | 8.4.2 | **9.0.3, corrected.** Direct dev group only; vulnerable shared temporary-directory handling is a UNIX local-user test-runner exposure, not a Windows Sam conversation/runtime path. |
| [20: setuptools](https://github.com/AlfonsoFR2020/sam-ambient/security/dependabot/20), [CVE-2026-59890 / GHSA-h35f-9h28-mq5c](https://github.com/advisories/GHSA-h35f-9h28-mq5c), Medium | <83.0.0 / 83.0.0 | 82.0.1 | **83.0.0, corrected.** Package group → cx_Freeze → setuptools. Unicode-normalization exclusion bypass requires macOS APFS/HFS+ sdist creation. Sam's wheel/sdist backend is Hatchling; this was packaging tooling, despite GitHub's runtime label. |
| [18: GLib](https://github.com/AlfonsoFR2020/sam-ambient/security/dependabot/18), [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g), Medium | >=0.15.0,<0.20.0 / 0.20.0 | 0.18.5 | **0.18.5, deferred, not fixed.** Tauri/native GTK path on Linux/BSD; absent from the Windows target graph and not a Python wheel runtime dependency. Unsafe `VariantStrIter` can crash/produce undefined behavior if used; direct Sam calls were not found, but dependency-internal reachability is not proven absent. |

### Minimal compatible resolution

- Direct Vite **7.3.5 → 7.3.6**, the first checked patch whose esbuild range changes
  from `^0.27.0` to `^0.27.0 || ^0.28.0`; Node requirements stay
  `^20.19.0 || >=22.12.0`. React plugin **5.0.2**, Vitest/mocker **4.1.11**,
  pnpm **11.19.0** and all other direct frontend dependencies remain unchanged.
- Normal targeted transitive resolution selects esbuild **0.28.2** and its 26
  platform packages, plus source-map-js **1.2.2**. No override/direct transitive pin
  is added. The compatible 0.28 patch selection exceeds the 0.28.1 minimum.
  PostCSS **8.5.26**, Rollup **4.63.1**, nanoid **3.3.18** and every unrelated
  package stay unchanged. An initial recursive Vite update refreshed these three;
  that uninstalled lock proposal was discarded and re-resolved with depth 0,
  followed by the two explicitly named transitive updates. The final diff is
  126 added/126 removed lock lines (platform hashes and Vite peer keys included).
- Pytest's dev constraint becomes **>=9.0.3,<10**. The first focused run passes
  without test/helper/runtime changes. Python remains **>=3.12**.
- cx_Freeze **8.6.4 → 8.7.0** is necessary: 8.6.4 requires setuptools `<83.0`,
  while 8.7.0 accepts `>=78.1.1,<85.0`. No 8.6.5/8.6.6 release was available.
  Its other requirements accept the existing lock. Setuptools locks **83.0.0**;
  only these three Python package versions move. freeze-core stays **0.7.5**.
  This is build-only owner-dependency maintenance, not a new native packaging claim.
- MIT licenses for Vite/esbuild, pytest and setuptools, BSD-3-Clause for source-map-js,
  and cx_Freeze's PSF license are recorded in THIRD_PARTY. No source copying or new license class.

### GLib limitation and OS boundary

The locked path includes Tauri **2.11.5** / tauri-runtime / wry / WebKitGTK and GTK
**0.18.2** → GLib **^0.18**. Tauri's published/local target manifests gate GTK to
Linux/DragonFly/FreeBSD/OpenBSD/NetBSD. GTK 0.18.2's registry requirements confirm
that 0.20.0 cannot satisfy `^0.18`; adding a second GLib or overriding it would not
repair that graph coherently. No Cargo manifest/lock/source is changed. This needs
an upstream-compatible GTK/Tauri migration or reviewed upstream backport, separately.
Do not advertise the affected Linux native shell as security-cleared.

`cargo tree --locked --offline --target x86_64-pc-windows-msvc --invert glib`
reported nothing to print. The corresponding Linux tree could not complete because
`async-broadcast 0.7.2` is not cached; no download/build was attempted to fill that
unrelated target. The path/constraint conclusion uses the lockfile, cached Tauri
manifests and crates.io GTK 0.18.2 metadata, not a claimed Linux compile or full
iterator reachability analysis. Python source/wheel use on Linux is distinct from
building the GTK native shell.

### Validation and environment

- Frozen frontend install and `uv lock --check` / `uv sync --locked` succeed.
  `uv pip check` reports all installed packages compatible. Previously installed
  optional prototype packages were restored from the unchanged lock; no probe ran.
- **105 focused Python tests pass** under pytest 9.0.3: package/resource contracts,
  configuration, launcher/diagnostics, owner authority/WebSocket, supervisor failure
  recovery and isolated SQLite store. cx_Freeze build entry imports succeed.
- **258 frontend tests / 32 files pass**, TypeScript and production build pass.
  Emitted JS/CSS names/hashes are unchanged; index-only Windows line-ending churn
  was restored, so no static/runtime source change is included.
- Ruff lint passes; format check passes for **267 files**. Changed-manifest Biome,
  source version consistency, documentation links and Git whitespace pass.
- Actual Hatchling file-selection inspection (no wheel/sdist emitted) examines
  **333 source entries / 100 wheel entries**. Required source manifest/lock/notices
  and wheel THIRD_PARTY remain; private state, temporary directories, models,
  PCM/WAV, executable/DLL assets and dependency trees are excluded. Companion
  pytest/setuptools/cx_Freeze exclusions and driver/license inventory remain intact.
- Resolved **npm audit returns no advisories** across its reported 170-package
  graph. This is a timestamped registry result, not a repository-wide zero-risk claim.
  Four of the five GitHub advisories are outside their recorded ranges in local dev;
  alerts remain on unchanged main until a separately authorized branch/release update.
- The installed pnpm shim failed before dependency work. A repository-local copy
  of the required pnpm 11.19.0 was verified against npm's SHA-512 integrity; existing
  Node 22.23.3 runs it. TLS verification initially failed; Node's supported
  `--use-system-ca` fixed trust with certificate validation retained. uv uses native
  TLS. No global tooling, certificate store or security bypass was changed.
- No full Sam/provider/browser/audio launch, native compile, installer or release
  artifacts. This does not validate cx_Freeze 8.7.0 frozen execution/installation;
  perform the normal native gates when that separate artifact class is prepared.

### Next alpha handoff

**v0.2.5 source/Python candidate preparation may begin**: these inspected advisories
add no current Windows/source-wheel runtime blocker. Run the normal exact-candidate
quality/package/authentication/data gates before publication; version stays 0.2.4
here. GLib remains a Linux/BSD native limitation; native Windows packaging/Cargo,
signing and installed smoke remain separate. Visual identity, multilingual STT,
conversation reliability and parked Agency/Memory priorities do not change.
