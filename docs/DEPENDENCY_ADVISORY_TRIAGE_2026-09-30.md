# Sam dependency advisory triage — 2026-09-30

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
