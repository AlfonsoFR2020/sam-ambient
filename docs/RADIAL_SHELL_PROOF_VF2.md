# Radial-shell proof — V-F2

2026-10-23. Experimental `feature/orb-appearance-foundation`; integration `dev`
remains `cc69bc2b90eac4068c929af4beb1bb95705b14af`. Published v0.2.5 is unchanged.
This record distinguishes source/numerical checks, hosted rendering and owner acceptance.

## Closure audit

Starting HEAD `15db3adaa30e29103d556a7354dd9440af957f72` is clean, following
`f408918` and `7f5101e`. The closing commit contains documentation/evidence and
generated assets; no production source input changed after its build. The default
still selects `living-connected`; `radial-shell-experimental` remains internal.
The compact free-rim regression samples actual CPU points/normals across seeds,
permitted poses and phase wraps, and rejects inward radial normals. No omitted
V-F1 modification was established. Fresh compatibility/radial checks: 21 passes.

The 73-input build verifies at source commit
`7f5101eab088d680b0e8379a64f7e4d3de7a3885`, clean at build, LF digest
`e95e1edc6e5f68b3d1b99b142ba5fabab153c7ba09f355d655c1cb52dd33c73b`.
At that starting checkpoint `index-BoytXu27.js` / `index-Brem5iPs.css` were the ordinary launcher's assets.
The source/asset checker, not the branch name or bundle filename alone, establishes
coherence. [V-F1](ORB_APPEARANCE_VF1.md) retains the numerical/resource baseline.

## Hosted proof contract

`.github/workflows/orb-graphical-proof.yml` is restricted to a push of this feature
branch affecting its fixture, renderer or workflow. A branch-scoped push is used
because a new manually dispatched workflow would first need to exist on default
`main`. Actions is enabled; read-only remote preflight verified `main` at the
release and `dev` at the integration baseline. No default-branch change is needed.

The workflow has read-only contents permission, no stored checkout credential,
one browser worker, zero retries, a 15-minute job bound and a six-minute test
command bound. Only existing locked dependencies are installed on the hosted
runner. The graphics process receives an explicit small environment and a fresh
temporary home. Browser HTTP requests are restricted to the loopback fixture;
there is no core, owner session, inference service, microphone or audio playback.
Chromium sandbox stays enabled. SwiftShader is explicit, ephemeral and reported;
it establishes software WebGL2 execution, not physical GPU performance.

The existing ordinary CI remains unmodified. Its existing hosted quality/package
checks may also execute on a normal push; none publishes a release or installer.
The experimental artifact contains only fixture screenshots and content-free
source/run/failure metadata, retained for three days. Durable selected evidence
must be copied into this record before expiry. Never execute downloaded artifacts.

`ui/playwright.orb-vf2.config.ts` refuses ordinary local execution. This is an
accident-prevention guard, not a security boundary against trusted source edits.
Local V-F2 checks use only CPU test/reference functions and static analysis.

## Comparison inputs and interpretation

`ui/tests/fixtures/orb-vf2.ts` defines seed `0x5a17`, 720 × 720, DPR 1, identical
material/frame/light/exposure/camera within each pair. Only the selected skin
strategy differs. Curl samples 0/6/12 seconds advance membrane travel by 0.3
radians/second while unrelated body/light clocks stay held. Yaw samples are
0/0.75/1.6. Additional material-only samples at 45/300 seconds preserve those
unrelated clocks; they are selected long-colour checks, not the whole historical
palette matrix.

First: a full-colour High matched pair and actual WebGL2/nonblank/error checks.
Then: the existing production skin GLSL transform-feedback proof against the CPU
reference (192 position/normal samples per strategy, controlled spheroid body).
Then: 13 paired cases including neutral, normals, depth, attachment, skin-only,
body-only, compact radius 0.46, Low and compact Low. Each capture is persisted
immediately so a later failed counterpart cannot erase it. A four-row contact
sheet is produced on the hosted runner from captured WebGL pixels.

The fixture uses the production WebGL backend and verifies its source against the
committed build inventory; it is not a full-app or owner-window test. A passing
software shader proof cannot accept optical overlap, artistic quality, physical
GPU timing, inference coexistence or owner preference. Both failed and awkward
views remain evidence. Current default selection is preserved regardless of result.

## Results and remaining gates

The [first attempt](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/39983022662)
was rejected before job creation: `runner.temp` is unavailable in the job-level
environment expression. The temporary browser path is now exported from a runner
step instead. This is workflow configuration evidence, not a shader failure.

The [second attempt](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/39983241822)
verified source/assets and installed the locked browser, but Chromium exited before
page creation: `No usable sandbox` on the current Ubuntu/AppArmor image. No WebGL
context or screenshot exists from that attempt. One bounded retry uses the hosted
Ubuntu 22.04 image; browser sandboxing and OS security settings remain intact.
Its [first preflight](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/39983452379)
then exposed Ubuntu 22.04's default Python 3.10, below Sam's existing Python 3.12
requirement (`Path.is_junction` unavailable). The workflow now explicitly selects
Python 3.12; the source checker and its filesystem protections remain unchanged.
Ordinary CI separately found three pre-existing line-length errors in
`prepare_visual_iv_baseline.py`; a formatter-only correction preserves its logic.

The [first rendered run](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/39983691610)
compiled both actual renderer strategies, captured all 28 matched views and the
contact sheet, with WebGL2/ANGLE Vulkan SwiftShader and no GL errors. Its strict
equation test failed: radial position maximum 0.0001062084 exceeds 0.0001;
normal error 0.001102637 is below 0.005. Parent position/normal errors are
0.0000231640 / 0.0005040753. The failing run remains evidence; no tolerance was
relaxed. The proof now records the worst sample and domain coordinates to isolate
the discrepancy. This fixture diagnostic is not a production geometry change.

Ordinary hosted CI also exposed assertion overhead: the exhaustive High CPU
deformation test exceeded five seconds under parallel suite load. Aggregating
finite/bound/unit checks retains every vertex, triangle and existing sampled
normal while avoiding per-vertex assertion allocation. The same 23 focused cases
pass locally in a 2.12-second run; this is test efficiency, not renderer timing.

The [worst-sample rerun](https://github.com/AlfonsoFR2020/sam-ambient/actions/runs/39984683127)
reproduces radial q error 0.0005810748 at the free collar, with 23-bit vertex highp
and finite outputs. The prototype now computes latitude from `atan(axis, length(equator,side))`
and wraps longitude arithmetically; the CPU reference uses the equivalent map.
This avoids inverse-sine amplification and a redundant trigonometric round trip.
A CPU equivalence/seam/polar regression and all adjacent selected geometry,
material, resource and recovery checks pass: 73 distinct cases in ten files.
The strict GPU limits remain unchanged; the corrected hosted proof is pending.

One low-priority canonical frontend build (`tsc -b && vite build`) then completed
in 3.77 seconds without warnings at clean source commit
`1d03eacd77269f75539c12e704e97e401ab23b1b`. The replacement production bundle is
`index-DZgAZCHC.js`; CSS remains `index-Brem5iPs.css`. All 73 inputs and artifact
hashes match [the current build record](evidence/orb-vf2/frontend-assets.json), LF
digest `ab27f92db63cbb8fdba91e33cd46fcd89a14e77e0a896b2b96928111d25f9139`.
No production input is edited after this build. The old bundle is superseded,
and default appearance remains `living-connected`.

Hosted ordinary CI then passed all 380 frontend cases but exposed 17 existing
format/import-order findings in eleven visual files. Only those files were
formatted; the frozen default shader/geometry snapshots still pass. A local
whole-directory lint attempt additionally scanned ignored historical baseline
copies and CRLF-normalized unrelated files; it failed and made no edits. Focused
changed-file lint and TypeScript pass; fresh hosted LF-checkout lint is authoritative
for the complete tracked tree. No gate is disabled or weakened.

No local browser,
GPU fixture, app, provider or audio was launched. Source verification of the new
comparison plan passes 23 focused CPU tests (including the 21 closure cases),
TypeScript project checks and focused Biome checks. Repetitions are not distinct
test counts. No production source changed and no rebuild is needed for these
fixture/workflow additions.

The integration decision remains open pending actual hosted images/equation proof,
evidence-led repairs if needed, and separate owner/artistic acceptance. Hardware
performance is unmeasured. No merge, release, version or theme programme is authorized.
